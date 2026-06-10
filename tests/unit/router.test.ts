import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    TASK_ROUTES,
    TASK_MAX_TOKENS,
    resolveChain,
    looksLikeJSON,
    isFallbackError,
} from '../../netlify/functions/lib/router';
import { PROVIDERS, openAIBody } from '../../netlify/functions/lib/providers';

const ENV_KEYS = ['GROQ_API_KEY', 'CEREBRAS_API_KEY'] as const;

describe('TASK_ROUTES integrity', () => {
    it('every route step names a known provider', () => {
        for (const steps of Object.values(TASK_ROUTES)) {
            for (const s of steps) {
                expect(PROVIDERS[s.provider]).toBeDefined();
                expect(s.model.length).toBeGreaterThan(0);
            }
        }
    });

    it('every route includes a Gemini step so a Gemini-only deploy works', () => {
        for (const [task, steps] of Object.entries(TASK_ROUTES)) {
            expect(steps.some(s => s.provider === 'gemini'), `route '${task}' has no Gemini fallback`).toBe(true);
        }
    });

    it('has a max-token budget for every routed task plus default', () => {
        for (const task of Object.keys(TASK_ROUTES)) {
            expect(TASK_MAX_TOKENS[task] ?? TASK_MAX_TOKENS.default).toBeGreaterThan(0);
        }
        expect(TASK_MAX_TOKENS.default).toBeGreaterThan(0);
    });
});

describe('resolveChain', () => {
    beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
    afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

    it('drops providers whose key is absent (no keys → empty chain in test env)', () => {
        // Gemini key pool is empty in the test environment, and Groq/Cerebras
        // keys are unset, so nothing is available.
        expect(resolveChain('quiz')).toEqual([]);
    });

    it('keeps only the providers that have a configured key, in order', () => {
        process.env.GROQ_API_KEY = 'gsk_test';
        const chain = resolveChain('podcast');
        expect(chain.every(s => s.provider === 'groq')).toBe(true);
        expect(chain.length).toBe(1); // podcast's single groq step survives
    });

    it('falls back to the default route for an unknown task', () => {
        process.env.GROQ_API_KEY = 'gsk_test';
        const chain = resolveChain('totally-unknown-task');
        expect(chain.every(s => s.provider === 'groq')).toBe(true);
        expect(chain.length).toBeGreaterThan(0);
    });
});

describe('looksLikeJSON', () => {
    it('accepts a plain JSON object', () => {
        expect(looksLikeJSON('{"a":1}')).toBe(true);
    });
    it('accepts a JSON array', () => {
        expect(looksLikeJSON('[1,2,3]')).toBe(true);
    });
    it('accepts fenced JSON', () => {
        expect(looksLikeJSON('```json\n{"a":1}\n```')).toBe(true);
    });
    it('rejects prose', () => {
        expect(looksLikeJSON('Sorry, I cannot do that.')).toBe(false);
    });
    it('rejects truncated JSON', () => {
        expect(looksLikeJSON('{"a": 1, "b":')).toBe(false);
    });
});

describe('isFallbackError', () => {
    it('treats rate limit / timeout / overload as retryable', () => {
        expect(isFallbackError(new Error('groq 429: rate limit'))).toBe(true);
        expect(isFallbackError(new Error('request timed out'))).toBe(true);
        expect(isFallbackError(new Error('model overloaded'))).toBe(true);
        expect(isFallbackError(new Error('503 Service Unavailable'))).toBe(true);
    });
    it('does not flag an ordinary validation error', () => {
        expect(isFallbackError(new Error('invalid prompt shape'))).toBe(false);
    });
});

describe('openAIBody', () => {
    it('builds system + user messages and maps options', () => {
        const body = openAIBody('llama-3.1-8b-instant', {
            prompt: 'hi',
            system: 'be brief',
            json: true,
            temperature: 0.5,
            maxOutputTokens: 256,
        }, false) as Record<string, unknown>;

        expect(body.model).toBe('llama-3.1-8b-instant');
        expect(body.messages).toEqual([
            { role: 'system', content: 'be brief' },
            { role: 'user', content: 'hi' },
        ]);
        expect(body.temperature).toBe(0.5);
        expect(body.max_tokens).toBe(256);
        expect(body.response_format).toEqual({ type: 'json_object' });
        expect(body.stream).toBe(false);
    });

    it('omits system message and json mode when not requested', () => {
        const body = openAIBody('m', { prompt: 'x' }, true) as Record<string, unknown>;
        expect(body.messages).toEqual([{ role: 'user', content: 'x' }]);
        expect(body.response_format).toBeUndefined();
        expect(body.stream).toBe(true);
    });
});
