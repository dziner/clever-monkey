// Shared server-side helpers for the Gemini proxy functions.
//
// Living in a subdirectory keeps Netlify from treating this file as its
// own function endpoint. Both gemini.ts (classic handler) and
// gemini-stream.ts (v2 streaming) import from here so the API-key pool,
// auth, tier limits and retry logic live in exactly one place.

import { GoogleGenAI } from '@google/genai';
import type { ContentListUnion, GenerateContentConfig, GenerateContentResponse } from '@google/genai';

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

type ServerCache = typeof globalThis & {
  __cmGeminiKeyPool?: KeyPool;
  __cmRateState?: Map<string, number[]>;
};

const serverCache = globalThis as ServerCache;

const keyPoolSingleton =
  serverCache.__cmGeminiKeyPool ??
  (serverCache.__cmGeminiKeyPool = new KeyPool(parseKeys()));
export const keyPool: KeyPool = keyPoolSingleton;

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
 * model being momentarily busy. We handle it with retries plus a fallback
 * to a higher-availability model, NOT by cooling the key.
 */
export function isOverloaded(err: unknown): boolean {
  const m = extractMessage(err);
  return /overload|high demand|currently unavailable|\bUNAVAILABLE\b|\b503\b/i.test(m);
}

/**
 * When a model is overloaded, retry on a higher-availability model. Flash
 * models have far more capacity than pro / preview models.
 */
export const OVERLOAD_FALLBACK_MODEL: Record<string, string> = {
  'gemini-2.5-pro': 'gemini-2.5-flash',
  'gemini-flash-latest': 'gemini-2.5-flash',
  'gemini-2.5-flash': 'gemini-flash-latest',
  'gemini-2.5-flash-lite': 'gemini-2.5-flash',
};

/**
 * Run a generateContent call resiliently: key rotation + transient
 * retries, and on a sustained overload, transparently retry once on a
 * fallback model so the user gets a result instead of "high demand".
 */
export async function generateContentResilient(
  model: string,
  params: { contents: ContentListUnion; config?: GenerateContentConfig },
): Promise<GenerateContentResponse> {
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
 * Stream a generateContent call resiliently. Text chunks are delivered to
 * `onText` as they arrive. Key rotation applies only *before* the first
 * byte is emitted — once partial output has streamed we can't cleanly
 * restart, so a later error propagates. On a pre-stream overload we retry
 * once on the fallback model.
 */
export async function streamGeneratedText(
  model: string,
  params: { contents: ContentListUnion; config?: GenerateContentConfig },
  onText: (chunk: string) => void | Promise<void>,
): Promise<void> {
  if (keyPool.size() === 0) throw new Error('Server missing GEMINI_API_KEY');

  let emitted = false;
  const runStream = async (useModel: string, ai: GoogleGenAI): Promise<void> => {
    const resp = await ai.models.generateContentStream({
      model: useModel,
      contents: params.contents,
      config: params.config,
    });
    for await (const chunk of resp) {
      const t = (chunk as { text?: string }).text;
      if (t) { emitted = true; await onText(t); }
    }
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < keyPool.size(); attempt++) {
    const state = keyPool.pick();
    if (!state) break;
    const ai = new GoogleGenAI({ apiKey: state.key });
    try {
      await runStream(model, ai);
      return;
    } catch (err) {
      lastErr = err;
      if (emitted) throw err;                 // already streamed partial output
      const kind = exhaustionKind(err);
      if (kind !== 'none') {
        keyPool.markExhausted(state, cooldownFor(kind), extractMessage(err));
        console.warn(`[gemini] key #${state.index + 1} ${kind}-limited, rotating to next key`);
        continue;                             // rotate to next key
      }
      const fallback = OVERLOAD_FALLBACK_MODEL[model];
      if (fallback && isOverloaded(err)) {
        console.warn(`[gemini] ${model} overloaded — retrying stream on ${fallback}`);
        await runStream(fallback, ai);
        return;
      }
      throw err;                              // non-key, non-overload error
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('All Gemini API keys are temporarily exhausted. Please try again shortly.');
}

/**
 * Run a Gemini SDK call against the next healthy API key. On per-key
 * errors (quota / rate-limit / invalid) mark the key as cooling-down and
 * try the next one. Other errors propagate immediately (the inner caller
 * handles those via withRetry).
 */
export async function callWithKeyRotation<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
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
  if (lastErr) throw lastErr;
  throw new Error('All Gemini API keys are temporarily exhausted. Please try again shortly.');
}

export const MAX_TEXT_CHARS = 250_000;

// Fallback IP-based rate limiting (anonymous / unverified users)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateState: Map<string, number[]> =
  serverCache.__cmRateState ?? (serverCache.__cmRateState = new Map());

export function tooManyRequestsByIp(ip: string): boolean {
  const now = Date.now();
  const arr = (rateState.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  // Once the window is full, deny WITHOUT recording the timestamp. Pushing
  // unconditionally let a single spamming IP grow this array without bound,
  // turning every subsequent call into an O(n) filter — quadratic CPU that
  // a stress run surfaced as 224s for 200k same-IP hits. Capping the array
  // at RATE_LIMIT_MAX keeps each call O(RATE_LIMIT_MAX).
  if (arr.length >= RATE_LIMIT_MAX) {
    rateState.set(ip, arr);
    return true;
  }
  arr.push(now);
  rateState.set(ip, arr);
  return false;
}

// Actions that consume a daily AI credit (countTokens is free)
export const COUNTED_ACTIONS = new Set(['generateContent', 'chat', 'extractText', 'extractTextFromStorage', 'tts']);

export const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest']);

export async function getUserIdFromToken(authHeader: string | undefined): Promise<string | null> {
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

export async function checkTierLimit(userId: string): Promise<{ allowed: boolean; error?: string }> {
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

export async function downloadStorageObjectForUser(
  userId: string,
  storagePath: string,
  bucketName = 'docs',
): Promise<{ blob: Blob; contentType: string; size: number }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw Object.assign(new Error('Server missing Supabase service credentials'), { status: 500 });
  }

  if (!storagePath || !storagePath.startsWith(`${userId}/`)) {
    throw Object.assign(new Error('Storage path is not owned by the authenticated user'), { status: 403 });
  }

  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucketName}/${encodedPath}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Object.assign(
      new Error(detail || `Storage download failed (${response.status})`),
      { status: response.status },
    );
  }

  const blob = await response.blob();
  return {
    blob,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    size: blob.size,
  };
}

/**
 * Run an async Gemini call with exponential backoff on transient upstream
 * errors (5xx / UNAVAILABLE / INTERNAL / overload). Other errors surface
 * immediately.
 */
interface RetryOptions {
  /** How many total tries before giving up. Default 4. */
  attempts?: number;
  /** Base delay before the first retry, in ms. Default 600. */
  baseMs?: number;
  /** Hard cap on any single backoff delay, in ms. Default 2400. */
  capMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attemptsOrOptions: number | RetryOptions = 4,
): Promise<T> {
  const opts = typeof attemptsOrOptions === 'number'
    ? { attempts: attemptsOrOptions }
    : attemptsOrOptions;
  const attempts = opts.attempts ?? 4;
  const baseMs = opts.baseMs ?? 600;
  const capMs = opts.capMs ?? 2400;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      // Exponential backoff with a hard ceiling so we stay under the
      // function timeout. The defaults (600 / 1.2s / 2.4s) suit text
      // generation; the TTS preview model needs longer pauses to let
      // upstream recover, so callers tweak via the options form.
      await new Promise(r => setTimeout(r, Math.min(baseMs * Math.pow(2, i), capMs)));
    }
  }
  throw lastErr;
}

export function isTransient(err: unknown): boolean {
  const m = extractMessage(err);
  if (/\b(5\d\d)\b/.test(m)) return true;
  if (/INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED|temporar|retry|overload|high demand/i.test(m)) return true;
  return false;
}

/**
 * Pull a human-readable message out of an error. The @google/genai SDK
 * often stuffs the raw JSON response into err.message; surface only the
 * inner `message` so error toasts read like sentences, not API dumps.
 */
export function extractMessage(err: unknown): string {
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

// Streamed-response error protocol. When a stream fails after the HTTP
// response has already begun (status is locked at 200), the server appends
// this sentinel followed by the error message; the client detects it and
// throws. The bracketed marker is kept byte-identical to the client copy
// in services/geminiService.ts.
export const STREAM_ERROR_SENTINEL = '\n[[__GEMINI_STREAM_ERROR__]]\n';

// Single non-printing byte the streaming OCR endpoint emits as a
// keep-alive heartbeat during the Files API polling loop. Sending
// bytes keeps the Netlify gateway from killing the response at the
// 26s mark (the underlying function timeout). \x01 never appears in
// real OCR text output; client strips it before treating the body
// as the extracted text.
export const STREAM_KEEPALIVE_BYTE = '\x01';
