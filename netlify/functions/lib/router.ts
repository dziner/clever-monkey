// Task-based AI routing with cross-provider fallback.
//
// Each task maps to an ordered chain of [provider, model] steps. The
// router tries them in order, advancing to the next on any failure
// (429 rate-limit, 503 overload, 504 timeout, 5xx, network, or — for JSON
// tasks — an unparseable response). This spreads load across free tiers
// and turns a single provider's bad moment into a transparent fallback
// instead of a user-facing 504.
//
// ── Ordering rationale ──────────────────────────────────────────────────
// Quality-sensitive Korean output (summary, mindmap, slides) leads with
// Gemini, which is the most reliable for Korean + structured JSON; Groq's
// far larger free quota (≈14.4k req/day on 8B vs Gemini's ~1k) serves as
// overflow + resilience exactly when Gemini rate-limits. The cheap,
// quality-insensitive, high-frequency tasks (presetQuestions, evaluate)
// lead with Groq to spare Gemini's quota. Podcast — long output, the
// original 504 — leads with Gemini Flash and falls to Groq's 70B.
//
// Every chain ends on a Gemini step, so a deployment with ONLY
// GEMINI_API_KEY set still works for every task; adding GROQ_API_KEY /
// CEREBRAS_API_KEY simply activates the offload + fallback paths. To bias
// harder toward free quota, move the Groq step ahead of Gemini below.

import { PROVIDERS, type ProviderName, type GenParams } from './providers';
import { extractMessage } from './shared';

export interface RouteStep { provider: ProviderName; model: string; }

const step = (provider: ProviderName, model: string): RouteStep => ({ provider, model });

export const TASK_ROUTES: Record<string, RouteStep[]> = {
  podcast: [
    // Lead with Flash-Lite for faster time-to-first-token: podcast scripts
    // are the longest single generation and the most likely task to brush
    // against the Netlify Function 26s execution cap. Flash-Lite finishes
    // a 300-word Korean script comfortably; full Flash and Groq's 70B are
    // there as quality / capacity backups.
    step('gemini', 'gemini-2.5-flash-lite'),
    step('gemini', 'gemini-2.5-flash'),
    step('groq', 'llama-3.3-70b-versatile'),
    step('cerebras', 'llama-3.3-70b'),
  ],
  summary: [
    step('gemini', 'gemini-2.5-flash-lite'),
    step('groq', 'qwen/qwen3-32b'),
    step('gemini', 'gemini-2.5-flash'),
  ],
  quiz: [
    step('gemini', 'gemini-2.5-flash-lite'),
    step('groq', 'llama-3.3-70b-versatile'),
    step('gemini', 'gemini-2.5-flash'),
  ],
  flashcards: [
    step('gemini', 'gemini-2.5-flash-lite'),
    step('groq', 'llama-3.3-70b-versatile'),
    step('gemini', 'gemini-2.5-flash'),
  ],
  mindmap: [
    step('gemini', 'gemini-2.5-flash-lite'),
    step('groq', 'qwen/qwen3-32b'),
    step('gemini', 'gemini-2.5-flash'),
  ],
  slides: [
    step('gemini', 'gemini-2.5-flash-lite'),
    step('groq', 'qwen/qwen3-32b'),
    step('gemini', 'gemini-2.5-flash'),
  ],
  presetQuestions: [
    step('groq', 'llama-3.1-8b-instant'),
    step('gemini', 'gemini-2.5-flash-lite'),
  ],
  studyTips: [
    step('gemini', 'gemini-2.5-flash-lite'),
    step('groq', 'qwen/qwen3-32b'),
  ],
  evaluate: [
    step('groq', 'llama-3.1-8b-instant'),
    step('gemini', 'gemini-2.5-flash-lite'),
  ],
  default: [
    step('gemini', 'gemini-2.5-flash-lite'),
    step('groq', 'llama-3.1-8b-instant'),
  ],
};

// Per-task output cap. Sized to the real output so a runaway generation
// can't hang the function (the original podcast 504), while never
// truncating a legitimately large structured result into invalid JSON.
export const TASK_MAX_TOKENS: Record<string, number> = {
  podcast: 4096,          // ~300-word default; headroom for longer user-specified durations.
                          // Korean is ~1 token per syllable, so a snug cap truncates mid-sentence.
  summary: 8192,
  quiz: 8192,             // many questions + options + explanations
  flashcards: 8192,
  mindmap: 4096,
  slides: 4096,
  presetQuestions: 768,   // 3-4 short questions
  studyTips: 2048,
  evaluate: 768,          // score + brief feedback
  default: 4096,
};

/** The route for a task, narrowed to providers that actually have a key. */
export function resolveChain(task: string): RouteStep[] {
  const chain = TASK_ROUTES[task] ?? TASK_ROUTES.default;
  return chain.filter(s => PROVIDERS[s.provider].available());
}

/** Cheap structural check that a model's reply is parseable JSON. */
export function looksLikeJSON(text: string): boolean {
  const stripped = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = stripped.search(/[[{]/);
  if (start < 0) return false;
  try {
    JSON.parse(stripped.slice(start));
    return true;
  } catch {
    return false;
  }
}

function maxTokensFor(task: string, params: GenParams): number {
  return params.maxOutputTokens ?? TASK_MAX_TOKENS[task] ?? TASK_MAX_TOKENS.default;
}

/** Dashboard category for a routed task (matches shared.categorizeUsage). */
function categoryForTask(task: string): string {
  return task === 'podcast' ? 'podcast_script' : task;
}

export interface RouteResult { text: string; provider: ProviderName; model: string; }

/**
 * Buffered generation across the task's provider chain. Advances on any
 * error or (for JSON tasks) an unparseable reply, keeping the best
 * available output as a last resort.
 */
export async function routedGenerate(task: string, params: GenParams): Promise<RouteResult> {
  const chain = resolveChain(task);
  if (chain.length === 0) {
    throw new Error('No AI provider available — set GEMINI_API_KEY (and optionally GROQ_API_KEY).');
  }
  const maxOutputTokens = maxTokensFor(task, params);
  const category = categoryForTask(task);

  let lastErr: unknown;
  let soft: RouteResult | null = null; // valid text that failed only the JSON check
  for (let i = 0; i < chain.length; i++) {
    const s = chain[i];
    const isLast = i === chain.length - 1;
    try {
      const text = await PROVIDERS[s.provider].generate(s.model, { ...params, maxOutputTokens, category });
      if (!text.trim()) throw new Error('empty output');
      if (params.json && !looksLikeJSON(text)) {
        soft = { text, provider: s.provider, model: s.model };
        if (!isLast) continue;               // prefer a later provider's valid JSON
      }
      return { text, provider: s.provider, model: s.model };
    } catch (err) {
      lastErr = err;
      // Free-tier flakiness: just move to the next provider in the chain.
      continue;
    }
  }
  if (soft) return soft;                       // best effort; client repairs JSON
  throw lastErr ?? new Error(`All providers failed for task: ${task}`);
}

/**
 * Streamed generation across the chain. Fallback is only possible before
 * the first token — once a provider has emitted text we're committed to
 * it. Most 504s are pre-first-token timeouts, which this still recovers.
 */
export async function routedStream(
  task: string,
  params: GenParams,
  onText: (t: string) => void | Promise<void>,
): Promise<RouteResult> {
  const chain = resolveChain(task);
  if (chain.length === 0) {
    throw new Error('No AI provider available — set GEMINI_API_KEY (and optionally GROQ_API_KEY).');
  }
  const maxOutputTokens = maxTokensFor(task, params);
  const category = categoryForTask(task);

  let emitted = false;
  const wrapped = async (t: string) => { emitted = true; await onText(t); };

  let lastErr: unknown;
  for (const s of chain) {
    try {
      await PROVIDERS[s.provider].stream(s.model, { ...params, maxOutputTokens, category }, wrapped);
      return { text: '', provider: s.provider, model: s.model };
    } catch (err) {
      lastErr = err;
      if (emitted) throw err;                  // committed mid-stream; can't fall back
      // nothing emitted yet — try the next provider
    }
  }
  if (lastErr) throw lastErr;
  throw new Error(`All providers failed (stream) for task: ${task}`);
}

/** Whether an error is the kind we expect to clear by retrying elsewhere. */
export function isFallbackError(err: unknown): boolean {
  const m = extractMessage(err).toLowerCase();
  return /\b(429|500|502|503|504)\b|rate.?limit|timeout|timed out|overload|high demand|unavailable|econnreset|network|fetch failed/.test(m);
}
