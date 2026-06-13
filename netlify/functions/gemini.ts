import type { Handler } from '@netlify/functions';
import type { ContentListUnion, GenerateContentConfig } from '@google/genai';
import {
  keyPool,
  callWithKeyRotation,
  generateContentResilient,
  withRetry,
  isTransient,
  extractMessage,
  getUserIdFromToken,
  checkTierLimit,
  tooManyRequestsByIp,
  COUNTED_ACTIONS,
  ALLOWED_MODELS,
  MAX_TEXT_CHARS,
} from './lib/shared';
import { routedGenerate } from './lib/router';
import { extractTextViaFilesApi } from './lib/filesApiOcr';

// Gemini proxy (buffered responses). Key pool, retries, auth and tier
// limits live in ./lib/shared so this handler and the streaming variant
// (gemini-stream.ts) share one implementation.

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB

function json(statusCode: number, body: unknown, extraHeaders?: Record<string, string>) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

type GeminiRequest =
  | {
      action: 'countTokens';
      model: string;
      text: string;
    }
  | {
      action: 'generateContent';
      model: string;
      contents: ContentListUnion;
      config?: GenerateContentConfig;
      task?: string;
    }
  | {
      action: 'chat';
      model: string;
      systemInstruction?: string;
      history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
      message: string;
    }
  | {
      action: 'extractText';
      model: string;
      inlineData: { data: string; mimeType: string };
      prompt?: string;
    }
  | {
      action: 'extractTextFromStorage';
      model: string;
      storagePath: string;
      mimeType: string;
      fileName: string;
      prompt?: string;
    }
  | {
      action: 'tts';
      text: string;
      voice?: string;
    };

function errorStatus(err: unknown): number | null {
  const status = (err as { status?: number; statusCode?: number } | null)?.status
    ?? (err as { status?: number; statusCode?: number } | null)?.statusCode;
  return typeof status === 'number' && status >= 400 && status <= 599 ? status : null;
}

interface TtsResponsePart {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
}

interface TtsGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: TtsResponsePart[];
    };
  }>;
}

function buildSingleNarratorTtsPrompt(text: string): string {
  return `Read the script below as one consistent narrator using exactly one voice.
Do not perform multiple speakers, character voices, interviews, panels, or dialogue voice-switching.
Do not read speaker labels or stage directions.

SCRIPT:
"""
${text}
"""`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (keyPool.size() === 0) {
    return json(500, { error: 'Server missing GEMINI_API_KEY' });
  }

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown';

  // Authenticate the request and apply tier-based limits
  const authHeader = event.headers['authorization'];
  const userId = await getUserIdFromToken(authHeader);

  // Parse action early so we can decide if it needs a credit
  let parsedAction: string | undefined;
  try {
    parsedAction = (JSON.parse(event.body || '{}') as { action?: string }).action;
  } catch { /* handled below */ }

  if (userId && parsedAction && COUNTED_ACTIONS.has(parsedAction)) {
    const { allowed, error } = await checkTierLimit(userId);
    if (!allowed) {
      return json(429, { error: error ?? 'Daily AI limit reached. Upgrade to Pro.' });
    }
  } else if (!userId) {
    // Unauthenticated: fallback to IP rate limiting
    if (tooManyRequestsByIp(ip)) {
      return json(429, { error: 'Rate limit exceeded. Please sign in or try again later.' });
    }
  }

  const raw = event.body || '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return json(413, { error: 'Request too large' });
  }

  let parsed: GeminiRequest;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  if (!parsed || typeof parsed.action !== 'string') {
    return json(400, { error: 'Missing action' });
  }

  // TTS action uses a fixed internal model — skip model whitelist check
  if (parsed.action !== 'tts') {
    const model = parsed.model;
    if (!ALLOWED_MODELS.has(model)) {
      return json(400, { error: `Unsupported model: ${String(model)}` });
    }
  }

  const model = parsed.action === 'tts' ? '' : parsed.model;

  try {
    if (parsed.action === 'countTokens') {
      if (typeof parsed.text !== 'string' || parsed.text.length > MAX_TEXT_CHARS) {
        return json(400, { error: 'Invalid text' });
      }
      const res = await callWithKeyRotation(ai =>
        ai.models.countTokens({ model, contents: { parts: [{ text: parsed.text }] } }),
      );
      return json(200, { totalTokens: res.totalTokens ?? 0 });
    }

    if (parsed.action === 'generateContent') {
      // best-effort size check on string prompts
      if (typeof parsed.contents === 'string' && parsed.contents.length > MAX_TEXT_CHARS) {
        return json(400, { error: 'Prompt too large' });
      }
      if (parsed.task) {
        // Multi-provider routing (Gemini → Groq → Cerebras) by task type.
        const { text, provider, model: usedModel } = await routedGenerate(parsed.task, {
          prompt: typeof parsed.contents === 'string' ? parsed.contents : String(parsed.contents),
          json: parsed.config?.responseMimeType === 'application/json',
          temperature: parsed.config?.temperature,
        });
        return json(200, { text }, { 'X-AI-Provider': `${provider}/${usedModel}` });
      }
      const res = await generateContentResilient(model, { contents: parsed.contents, config: parsed.config });
      return json(200, { text: res.text });
    }

    if (parsed.action === 'chat') {
      if (typeof parsed.message !== 'string' || parsed.message.length > 20_000) {
        return json(400, { error: 'Invalid message' });
      }

      const res = await callWithKeyRotation(ai => {
        const chat = ai.chats.create({
          model,
          config: parsed.systemInstruction ? { systemInstruction: parsed.systemInstruction } : undefined,
          history: parsed.history,
        });
        return withRetry(() => chat.sendMessage({ message: parsed.message }));
      });
      return json(200, { text: res.text });
    }

    if (parsed.action === 'extractText') {
      if (!parsed.inlineData?.data || !parsed.inlineData?.mimeType) {
        return json(400, { error: 'Missing inlineData' });
      }

      // Some lightweight validation; base64 can still be big, overall request already capped.
      const prompt =
        parsed.prompt ||
        'Extract all text from this document. Respond with only the text content. If there is no text, return an empty string.';

      const res = await generateContentResilient(model, {
        contents: {
          parts: [
            { inlineData: parsed.inlineData },
            { text: prompt },
          ],
        },
      });

      const text = res.text ?? '';
      if (text.length > MAX_TEXT_CHARS) {
        return json(200, { text: text.slice(0, MAX_TEXT_CHARS) });
      }

      return json(200, { text });
    }

    if (parsed.action === 'extractTextFromStorage') {
      if (!userId) {
        return json(401, { error: 'Authentication required for large file processing' });
      }
      if (!parsed.storagePath || !parsed.mimeType || !parsed.fileName) {
        return json(400, { error: 'Missing storage file metadata' });
      }

      const text = await extractTextViaFilesApi({
        userId,
        storagePath: parsed.storagePath,
        model,
        mimeType: parsed.mimeType,
        fileName: parsed.fileName,
        prompt: parsed.prompt,
      });

      if (text.length > MAX_TEXT_CHARS) {
        return json(200, { text: text.slice(0, MAX_TEXT_CHARS) });
      }

      return json(200, { text });
    }

    if (parsed.action === 'tts') {
      if (typeof parsed.text !== 'string' || parsed.text.length === 0 || parsed.text.length > 5000) {
        return json(400, { error: 'TTS text must be 1–5000 characters' });
      }

      const ALLOWED_VOICES = new Set(['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck', 'Zephyr']);
      const voice = typeof parsed.voice === 'string' && ALLOWED_VOICES.has(parsed.voice)
        ? parsed.voice
        : 'Puck';

      const res = await callWithKeyRotation(ai =>
        withRetry(() => ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text: buildSingleNarratorTtsPrompt(parsed.text) }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          } as unknown as GenerateContentConfig,
        })),
      );

      const part = (res as TtsGenerateContentResponse).candidates?.[0]?.content?.parts?.[0];
      if (!part?.inlineData?.data) {
        return json(500, { error: 'TTS returned no audio data' });
      }

      return json(200, {
        audioData: part.inlineData.data as string,
        mimeType: (part.inlineData.mimeType as string) ?? 'audio/pcm;rate=24000',
      });
    }

    return json(400, { error: 'Unknown action' });
  } catch (err: unknown) {
    console.error('gemini function error', err);
    const message = extractMessage(err);
    // If the upstream model returned 5xx after our retries, surface a
    // 503 so the client can show a friendlier "retry shortly" message
    // instead of treating it like a server bug on our side.
    const status = errorStatus(err) ?? (isTransient(err) ? 503 : 500);
    return json(status, { error: message });
  }
};
