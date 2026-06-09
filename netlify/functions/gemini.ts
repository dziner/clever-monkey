import type { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── API key pool ─────────────────────────────────────────────────────────────
//
// Multiple Gemini API keys can be configured for automatic rotation when one
// runs out of quota or is rate-limited. Keys are resolved in this order:
//
//   1. GEMINI_API_KEYS  — comma- or newline-separated list (preferred)
//   2. GEMINI_API_KEY_1, GEMINI_API_KEY_2, … (up to _10)
//   3. GEMINI_API_KEY   — single key (legacy / fallback)
//
// When a request hits a per-key error (quota, rate-limit, invalid key) the
// pool marks that key as cooling-down and the request is retried on the
// next healthy key. Pool state lives in module scope and persists across
// invocations of the same warm Netlify Function instance.

interface KeyState {
  key: string;
  index: number;
  exhaustedUntil: number; // epoch ms; 0 means healthy
  lastError?: string;
}

function parseKeys(): string[] {
  const csv = process.env.GEMINI_API_KEYS;
  if (csv) {
    const list = csv.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    if (list.length) return list;
  }
  const numbered: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const v = process.env[`GEMINI_API_KEY_${i}`];
    if (v && v.trim()) numbered.push(v.trim());
  }
  if (numbered.length) return numbered;
  const single = process.env.GEMINI_API_KEY;
  if (single && single.trim()) return [single.trim()];
  return [];
}

class KeyPool {
  private states: KeyState[];
  private cursor = 0;

  constructor(keys: string[]) {
    // De-duplicate in case the same key was listed twice
    const seen = new Set<string>();
    this.states = [];
    keys.forEach((k, i) => {
      if (seen.has(k)) return;
      seen.add(k);
      this.states.push({ key: k, index: i, exhaustedUntil: 0 });
    });
  }

  size(): number { return this.states.length; }

  /** Return a healthy key (round-robin), or null if every key is cooling. */
  pick(): KeyState | null {
    if (this.states.length === 0) return null;
    const now = Date.now();
    for (let i = 0; i < this.states.length; i++) {
      const idx = (this.cursor + i) % this.states.length;
      const s = this.states[idx];
      if (s.exhaustedUntil <= now) {
        this.cursor = (idx + 1) % this.states.length;
        return s;
      }
    }
    return null;
  }

  markExhausted(state: KeyState, cooldownMs: number, errorMsg: string): void {
    state.exhaustedUntil = Date.now() + cooldownMs;
    state.lastError = errorMsg;
  }
}

const keyPoolSingleton =
  (globalThis as any).__cmGeminiKeyPool ??
  ((globalThis as any).__cmGeminiKeyPool = new KeyPool(parseKeys()));
const keyPool: KeyPool = keyPoolSingleton;

type ExhaustionKind = 'rate' | 'quota' | 'invalid' | 'none';

function exhaustionKind(err: unknown): ExhaustionKind {
  const m = extractMessage(err);
  if (/RESOURCE_EXHAUSTED|QuotaFailure|\bquota\b/i.test(m)) return 'quota';
  if (/\b429\b|rate.?limit|too many requests/i.test(m)) return 'rate';
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED|\b40[13]\b/i.test(m)) return 'invalid';
  return 'none';
}

function cooldownFor(kind: Exclude<ExhaustionKind, 'none'>): number {
  switch (kind) {
    case 'rate':    return 60_000;             // 1 minute
    case 'quota':   return 60 * 60_000;        // 1 hour (daily quotas reset at midnight UTC; this is a safe minimum)
    case 'invalid': return 24 * 60 * 60_000;   // 24 hours — likely dead until env is fixed
  }
}

/**
 * "Model overloaded" / "high demand" (HTTP 503 / UNAVAILABLE). Unlike
 * quota or rate-limit, this is NOT a per-key problem — it's the upstream
 * model being momentarily busy. We handle it with retries on the same key
 * plus a fallback to a higher-availability model, NOT by cooling the key
 * (which would block the fallback).
 */
function isOverloaded(err: unknown): boolean {
  const m = extractMessage(err);
  return /overload|high demand|currently unavailable|\bUNAVAILABLE\b|\b503\b/i.test(m);
}

/**
 * When a model is overloaded, retry the request on a
 * higher-availability model. Flash models have far more capacity than
 * pro / preview models, so this recovers most "high demand" failures.
 */
const OVERLOAD_FALLBACK_MODEL: Record<string, string> = {
  'gemini-2.5-pro': 'gemini-2.5-flash',
  'gemini-flash-latest': 'gemini-2.5-flash',
  'gemini-2.5-flash': 'gemini-flash-latest',
};

/**
 * Run a generateContent call resiliently: key rotation + transient
 * retries, and on a sustained overload, transparently retry once on a
 * fallback model so the user gets a result instead of "high demand".
 */
async function generateContentResilient(
  model: string,
  params: { contents: any; config?: any },
): Promise<{ text?: string } & Record<string, any>> {
  try {
    return await callWithKeyRotation(ai =>
      withRetry(() => ai.models.generateContent({ model, contents: params.contents, config: params.config })),
    );
  } catch (err) {
    const fallback = OVERLOAD_FALLBACK_MODEL[model];
    if (fallback && isOverloaded(err)) {
      console.warn(`[gemini] ${model} overloaded — retrying on ${fallback}`);
      return await callWithKeyRotation(ai =>
        withRetry(() => ai.models.generateContent({ model: fallback, contents: params.contents, config: params.config })),
      );
    }
    throw err;
  }
}

/**
 * Run a Gemini SDK call against the next healthy API key. On per-key
 * errors (quota / rate-limit / invalid) mark the key as cooling-down and
 * try the next one. Other errors (transient 5xx, bad input, etc.) are
 * NOT key-related and propagate immediately — the inner caller handles
 * those (see `withRetry`).
 */
async function callWithKeyRotation<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  if (keyPool.size() === 0) {
    throw new Error('Server missing GEMINI_API_KEY');
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < keyPool.size(); attempt++) {
    const state = keyPool.pick();
    if (!state) break;
    const ai = new GoogleGenAI({ apiKey: state.key });
    try {
      return await fn(ai);
    } catch (err) {
      lastErr = err;
      const kind = exhaustionKind(err);
      if (kind === 'none') throw err;
      keyPool.markExhausted(state, cooldownFor(kind), extractMessage(err));
      console.warn(`[gemini] key #${state.index + 1} ${kind}-limited, rotating to next key`);
      // continue: try next key
    }
  }
  // Every key is cooling down or every attempt hit an exhaustion error.
  if (lastErr) throw lastErr;
  throw new Error('All Gemini API keys are temporarily exhausted. Please try again shortly.');
}

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_TEXT_CHARS = 250_000;

// Fallback IP-based rate limiting (anonymous / unverified users)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateState = globalThis.__cmRateState ?? new Map<string, number[]>();
(globalThis as any).__cmRateState = rateState;

function tooManyRequestsByIp(ip: string): boolean {
  const now = Date.now();
  const arr = rateState.get(ip) ?? [];
  const next = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  next.push(now);
  rateState.set(ip, next);
  return next.length > RATE_LIMIT_MAX;
}

// Actions that consume a daily AI credit (countTokens is free)
const COUNTED_ACTIONS = new Set(['generateContent', 'chat', 'extractText', 'tts']);

async function getUserIdFromToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ') || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: authHeader,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

async function checkTierLimit(userId: string): Promise<{ allowed: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { allowed: true };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_ai_action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (!res.ok) return { allowed: true }; // fail open
    const data = (await res.json()) as { allowed: boolean; error?: string };
    return { allowed: data.allowed, error: data.error };
  } catch {
    return { allowed: true }; // fail open on network errors
  }
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

/**
 * Run an async Gemini call with exponential backoff on transient
 * upstream errors. Google explicitly recommends retrying 5xx / UNAVAILABLE
 * responses, which the TTS preview model returns intermittently:
 *
 *   {"error":{"code":500,"message":"An internal error has occurred.
 *     Please retry or report …","status":"INTERNAL"}}
 *
 * Retries happen for codes 500 / 502 / 503 / 504, status INTERNAL /
 * UNAVAILABLE / DEADLINE_EXCEEDED. Other errors (4xx, parse, etc.)
 * surface immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (!isTransient(err) || i === attempts - 1) throw err;
            // 600ms, 1.2s, 2.4s — capped so we stay under the function timeout
            await new Promise(r => setTimeout(r, Math.min(600 * Math.pow(2, i), 2400)));
        }
    }
    throw lastErr;
}

function isTransient(err: unknown): boolean {
    const m = extractMessage(err);
    if (/\b(5\d\d)\b/.test(m)) return true;
    if (/INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED|temporar|retry|overload|high demand/i.test(m)) return true;
    return false;
}

/**
 * Pull a human-readable message out of an error. The @google/genai SDK
 * often stuffs the raw JSON response into err.message:
 *   `{"error":{"code":500,"message":"...","status":"INTERNAL"}}`
 * Surface only the inner `message` to clients so error toasts read
 * like sentences, not API dumps.
 */
function extractMessage(err: unknown): string {
    const raw = (err as { message?: string } | null)?.message ?? String(err ?? '');
    const jsonStart = raw.indexOf('{');
    if (jsonStart >= 0) {
        try {
            const parsed = JSON.parse(raw.slice(jsonStart));
            const inner = parsed?.error?.message ?? parsed?.message;
            if (typeof inner === 'string' && inner) return inner;
        } catch { /* not JSON; fall through */ }
    }
    return raw || 'Internal error';
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
    }
  | {
      action: 'tts';
      text: string;
      voice?: string;
    };

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

  if (!parsed || typeof (parsed as any).action !== 'string') {
    return json(400, { error: 'Missing action' });
  }

  // TTS action uses a fixed internal model — skip model whitelist check
  if (parsed.action !== 'tts') {
    const model = (parsed as any).model;
    if (!ALLOWED_MODELS.has(model)) {
      return json(400, { error: `Unsupported model: ${String(model)}` });
    }
  }

  const model = (parsed as any).model as string;

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
          contents: [{ parts: [{ text: parsed.text }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          } as any,
        })),
      );

      const part = (res as any).candidates?.[0]?.content?.parts?.[0];
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
    const status = isTransient(err) ? 503 : 500;
    return json(status, { error: message });
  }
};
