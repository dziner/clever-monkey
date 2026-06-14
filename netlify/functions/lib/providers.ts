// Multi-provider AI adapters. Each provider exposes the same tiny surface
// — generate() (buffered) and stream() (incremental) — over a normalized
// GenParams shape, so the router (./router.ts) can fall back from one to
// the next without caring which vendor it's talking to.
//
// Gemini goes through the shared key pool + SDK (multi-key rotation, the
// existing overload/model fallback). Groq and Cerebras are OpenAI-wire
// compatible, so they share one fetch-based implementation.
//
// Env keys (Netlify → Site settings → Environment variables):
//   GEMINI_API_KEY / GEMINI_API_KEYS  (required — already configured)
//   GROQ_API_KEY                       (optional; route steps skip if absent)
//   CEREBRAS_API_KEY                   (optional; route steps skip if absent)

import { callWithKeyRotation, streamGeneratedText, keyPool, type UsageMeta } from './shared';

export type ProviderName = 'gemini' | 'groq' | 'cerebras';

export interface GenParams {
  prompt: string;
  system?: string;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** Usage category for the capacity dashboard's rejection counters. */
  category?: string;
}

export interface Provider {
  name: ProviderName;
  /** True only when this provider has a configured API key. */
  available(): boolean;
  generate(model: string, p: GenParams): Promise<string>;
  stream(model: string, p: GenParams, onText: (t: string) => void | Promise<void>): Promise<void>;
}

// ─── Gemini (via shared key pool + SDK) ─────────────────────────────────────────

function geminiConfig(p: GenParams): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (p.temperature !== undefined) config.temperature = p.temperature;
  if (p.maxOutputTokens) config.maxOutputTokens = p.maxOutputTokens;
  if (p.json) config.responseMimeType = 'application/json';
  if (p.system) config.systemInstruction = p.system;
  return config;
}

const gemini: Provider = {
  name: 'gemini',
  available: () => keyPool.size() > 0,
  async generate(model, p) {
    const meta: UsageMeta = { category: p.category ?? 'other', model };
    const res = await callWithKeyRotation(ai =>
      ai.models.generateContent({ model, contents: p.prompt, config: geminiConfig(p) }),
      meta,
    );
    return (res as { text?: string }).text ?? '';
  },
  async stream(model, p, onText) {
    const meta: UsageMeta = { category: p.category ?? 'other', model };
    await streamGeneratedText(model, { contents: p.prompt, config: geminiConfig(p) }, onText, meta);
  },
};

// ─── OpenAI-wire-compatible providers (Groq, Cerebras) ──────────────────────────

/** Build the OpenAI chat-completions request body shared by Groq/Cerebras. */
export function openAIBody(model: string, p: GenParams, stream: boolean): Record<string, unknown> {
  const messages: Array<{ role: string; content: string }> = [];
  if (p.system) messages.push({ role: 'system', content: p.system });
  messages.push({ role: 'user', content: p.prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: p.temperature ?? 0.7,
    max_tokens: p.maxOutputTokens ?? 1024,
    stream,
  };
  // json_object mode requires the literal word "json" in the prompt; all
  // our structured prompts say "Return ONLY valid JSON", so this is safe.
  if (p.json) body.response_format = { type: 'json_object' };
  return body;
}

class HttpError extends Error {
  status: number;
  constructor(provider: string, status: number, detail: string) {
    super(`${provider} ${status}: ${detail.slice(0, 200)}`);
    this.status = status;
  }
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}

function openAICompatible(name: ProviderName, envKey: string, baseUrl: string): Provider {
  const key = () => process.env[envKey] || '';
  return {
    name,
    available: () => Boolean(key()),
    async generate(model, p) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` },
        body: JSON.stringify(openAIBody(model, p, false)),
      });
      if (!res.ok) throw new HttpError(name, res.status, await safeText(res));
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? '';
    },
    async stream(model, p, onText) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` },
        body: JSON.stringify(openAIBody(model, p, true)),
      });
      if (!res.ok || !res.body) throw new HttpError(name, res.status, await safeText(res));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';                  // keep the trailing partial line
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            const obj = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
            const piece = obj.choices?.[0]?.delta?.content;
            if (piece) await onText(piece);
          } catch { /* keepalive / partial frame — ignore */ }
        }
      }
    },
  };
}

export const PROVIDERS: Record<ProviderName, Provider> = {
  gemini,
  groq: openAICompatible('groq', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1'),
  cerebras: openAICompatible('cerebras', 'CEREBRAS_API_KEY', 'https://api.cerebras.ai/v1'),
};
