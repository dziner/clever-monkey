import type { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY;

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_TEXT_CHARS = 250_000;

// naive per-instance rate limiting (best-effort in serverless)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateState = globalThis.__cmRateState ?? new Map<string, number[]>();
(globalThis as any).__cmRateState = rateState;

function tooManyRequests(ip: string): boolean {
  const now = Date.now();
  const arr = rateState.get(ip) ?? [];
  const next = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  next.push(now);
  rateState.set(ip, next);
  return next.length > RATE_LIMIT_MAX;
}

function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest']);

type GeminiRequest =
  | {
      action: 'countTokens';
      model: string;
      text: string;
    }
  | {
      action: 'generateContent';
      model: string;
      contents: any;
      config?: any;
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
    };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return json(500, { error: 'Server missing GEMINI_API_KEY' });
  }

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown';

  if (tooManyRequests(ip)) {
    return json(429, { error: 'Rate limit exceeded. Please try again soon.' });
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

  if (!parsed || typeof (parsed as any).action !== 'string') {
    return json(400, { error: 'Missing action' });
  }

  const model = (parsed as any).model;
  if (!ALLOWED_MODELS.has(model)) {
    return json(400, { error: `Unsupported model: ${String(model)}` });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    if (parsed.action === 'countTokens') {
      if (typeof parsed.text !== 'string' || parsed.text.length > MAX_TEXT_CHARS) {
        return json(400, { error: 'Invalid text' });
      }
      const res = await ai.models.countTokens({ model, contents: { parts: [{ text: parsed.text }] } });
      return json(200, { totalTokens: res.totalTokens ?? 0 });
    }

    if (parsed.action === 'generateContent') {
      // best-effort size check on string prompts
      if (typeof parsed.contents === 'string' && parsed.contents.length > MAX_TEXT_CHARS) {
        return json(400, { error: 'Prompt too large' });
      }
      const res = await ai.models.generateContent({ model, contents: parsed.contents as any, config: parsed.config as any });
      return json(200, { text: res.text });
    }

    if (parsed.action === 'chat') {
      if (typeof parsed.message !== 'string' || parsed.message.length > 20_000) {
        return json(400, { error: 'Invalid message' });
      }

      const chat = ai.chats.create({
        model,
        config: parsed.systemInstruction ? { systemInstruction: parsed.systemInstruction } : undefined,
        history: parsed.history,
      });

      const res = await chat.sendMessage({ message: parsed.message });
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

      const res = await ai.models.generateContent({
        model,
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

    return json(400, { error: 'Unknown action' });
  } catch (err: any) {
    console.error('gemini function error', err);
    return json(500, { error: err?.message || 'Internal error' });
  }
};
