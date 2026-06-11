// Router fallback stress — injects provider failures (429/503/timeouts,
// malformed JSON) at high concurrency and verifies the routing layer
// never surfaces an avoidable error. Providers are mocked: zero network,
// zero quota.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const failureRate = { gemini: 0, groq: 0, cerebras: 0 };
const callCounts = { gemini: 0, groq: 0, cerebras: 0 };
const proseMode = { gemini: false };

vi.mock('../../netlify/functions/lib/providers', () => {
    const make = (name: 'gemini' | 'groq' | 'cerebras') => ({
        name,
        available: () => true,
        async generate(_model: string, p: { json?: boolean }) {
            callCounts[name]++;
            await new Promise(r => setTimeout(r, 1 + Math.random() * 4)); // simulated latency
            if (Math.random() < failureRate[name]) {
                const codes = [429, 503, 504];
                throw new Error(`${name} ${codes[Math.floor(Math.random() * 3)]}: simulated`);
            }
            if (name === 'gemini' && proseMode.gemini && p.json) return 'Sorry, here is prose not JSON.';
            return p.json ? '{"ok":true,"from":"' + name + '"}' : 'text from ' + name;
        },
        async stream(_model: string, _p: unknown, onText: (t: string) => void) {
            callCounts[name]++;
            if (Math.random() < failureRate[name]) throw new Error(`${name} 503: simulated pre-stream`);
            for (const piece of ['chunk1 ', 'chunk2 ', 'chunk3']) {
                await new Promise(r => setTimeout(r, 1));
                onText(piece);
            }
        },
    });
    return {
        PROVIDERS: { gemini: make('gemini'), groq: make('groq'), cerebras: make('cerebras') },
        openAIBody: () => ({}),
    };
});

import { routedGenerate, routedStream } from '../../netlify/functions/lib/router';

beforeEach(() => {
    failureRate.gemini = 0; failureRate.groq = 0; failureRate.cerebras = 0;
    callCounts.gemini = 0; callCounts.groq = 0; callCounts.cerebras = 0;
    proseMode.gemini = false;
});

describe('routedGenerate under provider failure', () => {
    it('1,000 concurrent requests with gemini failing 50% — zero user-facing errors', async () => {
        failureRate.gemini = 0.5;
        const t0 = performance.now();
        const results = await Promise.all(
            Array.from({ length: 1000 }, () => routedGenerate('quiz', { prompt: 'q', json: true })),
        );
        const elapsed = performance.now() - t0;
        const byProvider: Record<string, number> = {};
        for (const r of results) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
        console.log(`[router] 1000 concurrent @gemini 50% fail: ${elapsed.toFixed(0)}ms, served by=${JSON.stringify(byProvider)}, calls=${JSON.stringify(callCounts)}`);
        expect(results.length).toBe(1000);
        expect(results.every(r => JSON.parse(r.text).ok === true)).toBe(true);
    }, 30_000);

    it('survives a full gemini outage (100% fail) via groq', async () => {
        failureRate.gemini = 1;
        const results = await Promise.all(
            Array.from({ length: 300 }, () => routedGenerate('summary', { prompt: 's' })),
        );
        expect(results.every(r => r.provider !== 'gemini')).toBe(true);
    });

    it('rejects only when EVERY provider in the chain is down', async () => {
        failureRate.gemini = 1; failureRate.groq = 1; failureRate.cerebras = 1;
        await expect(routedGenerate('quiz', { prompt: 'q' })).rejects.toThrow(/simulated/);
    });

    it('falls past a provider that answers JSON tasks with prose', async () => {
        proseMode.gemini = true;
        const r = await routedGenerate('quiz', { prompt: 'q', json: true });
        expect(r.provider).not.toBe('gemini');
        expect(JSON.parse(r.text).ok).toBe(true);
    });

    it('keeps the prose answer as last resort when no provider returns valid JSON', async () => {
        proseMode.gemini = true;
        failureRate.groq = 1; failureRate.cerebras = 1;
        const r = await routedGenerate('quiz', { prompt: 'q', json: true });
        expect(r.provider).toBe('gemini'); // soft result preserved
        expect(r.text).toMatch(/prose/);
    });
});

describe('routedStream under provider failure', () => {
    it('500 concurrent streams with gemini failing 70% pre-stream — all complete', async () => {
        failureRate.gemini = 0.7;
        const outputs = await Promise.all(
            Array.from({ length: 500 }, async () => {
                let acc = '';
                await routedStream('podcast', { prompt: 'p' }, (t) => { acc += t; });
                return acc;
            }),
        );
        expect(outputs.every(o => o === 'chunk1 chunk2 chunk3')).toBe(true);
    }, 30_000);
});
