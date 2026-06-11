// Infrastructure stress tests — run the REAL deployed handler code
// in-process at volume. No network, no AI quota: every request shape used
// here is rejected by validation before any provider call, so we measure
// our own infrastructure (rate limiter, payload caps, key pool, parsing)
// rather than Google's.
//
// Run: npx vitest run tests/stress
import { describe, it, expect, beforeAll } from 'vitest';

// Fake keys must be in place BEFORE the shared module builds its key pool
// (module-scope singleton). Never real keys — nothing here reaches the net.
process.env.GEMINI_API_KEYS = 'stress-test-key-1,stress-test-key-2,stress-test-key-3';

const now = () => performance.now();
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + 'MB';

interface HandlerResponse { statusCode: number; body: string }
type Handler = (event: {
    httpMethod: string;
    headers: Record<string, string | undefined>;
    body: string | null;
}) => Promise<HandlerResponse>;

let handler: Handler;
let shared: typeof import('../../netlify/functions/lib/shared');

beforeAll(async () => {
    shared = await import('../../netlify/functions/lib/shared');
    handler = (await import('../../netlify/functions/gemini')).handler as unknown as Handler;
});

const POST = (body: unknown, ip: string) => ({
    httpMethod: 'POST',
    headers: { 'x-nf-client-connection-ip': ip, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('IP rate limiter under load', () => {
    it('allows 30/min per IP then returns 429', async () => {
        const codes: number[] = [];
        for (let i = 0; i < 40; i++) {
            const res = await handler(POST({ action: 'nope' }, '10.0.0.1'));
            codes.push(res.statusCode);
        }
        // First 30 pass the limiter (then fail validation with 400);
        // requests 31..40 are rate limited.
        expect(codes.slice(0, 30).every(c => c === 400)).toBe(true);
        expect(codes.slice(30).every(c => c === 429)).toBe(true);
    });

    it('tracks 100k distinct IPs without pathological memory growth', () => {
        if (global.gc) global.gc();
        const before = process.memoryUsage().heapUsed;
        const t0 = now();
        for (let i = 0; i < 100_000; i++) {
            shared.tooManyRequestsByIp(`192.168.${(i >> 8) & 255}.${i & 255}-${i}`);
        }
        const elapsed = now() - t0;
        const grewBy = process.memoryUsage().heapUsed - before;
        console.log(`[ratelimiter] 100k unique IPs: ${elapsed.toFixed(0)}ms, heap +${mb(grewBy)} (~${Math.round(grewBy / 100_000)}B/IP)`);
        expect(elapsed).toBeLessThan(5_000);
        // The map is never pruned for idle IPs — document the growth rate.
        expect(grewBy).toBeLessThan(200 * 1024 * 1024);
    });

    it('sustains high call rate on a hot path (single IP, window full)', () => {
        const t0 = now();
        const CALLS = 200_000;
        for (let i = 0; i < CALLS; i++) shared.tooManyRequestsByIp('10.9.9.9');
        const elapsed = now() - t0;
        console.log(`[ratelimiter] ${CALLS} calls on one IP: ${elapsed.toFixed(0)}ms (${Math.round(CALLS / (elapsed / 1000)).toLocaleString()} ops/s)`);
        expect(elapsed).toBeLessThan(10_000);
    });
});

describe('handler request-validation throughput', () => {
    it('handles 3,000 sequential invalid-action requests', async () => {
        const t0 = now();
        const N = 3_000;
        for (let i = 0; i < N; i++) {
            // Unique IP per request so the limiter never short-circuits and
            // we measure the full validation path.
            await handler(POST({ action: 'nope' }, `seq-${i}`));
        }
        const elapsed = now() - t0;
        console.log(`[handler] ${N} sequential: ${elapsed.toFixed(0)}ms (${Math.round(N / (elapsed / 1000)).toLocaleString()} req/s single instance)`);
        expect(elapsed).toBeLessThan(30_000);
    });

    it('handles 500 concurrent requests without error', async () => {
        const t0 = now();
        const results = await Promise.all(
            Array.from({ length: 500 }, (_, i) => handler(POST({ action: 'nope' }, `conc-${i}`))),
        );
        const elapsed = now() - t0;
        console.log(`[handler] 500 concurrent: ${elapsed.toFixed(0)}ms`);
        expect(results.every(r => r.statusCode === 400)).toBe(true);
    });

    it('rejects an oversized body (4MB cap) without crashing', async () => {
        const big = JSON.stringify({ action: 'generateContent', model: 'gemini-2.5-flash', contents: 'x'.repeat(5 * 1024 * 1024) });
        const res = await handler(POST(big, 'big-1'));
        expect(res.statusCode).toBe(413);
    });

    it('rejects an oversized prompt (250k chars) before any provider call', async () => {
        const res = await handler(POST({
            action: 'generateContent', model: 'gemini-2.5-flash', contents: 'y'.repeat(260_000),
        }, 'big-2'));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/too large/i);
    });

    it('rejects malformed JSON bodies at volume', async () => {
        const results = await Promise.all(
            Array.from({ length: 200 }, (_, i) => handler(POST('{not json', `mal-${i}`))),
        );
        expect(results.every(r => r.statusCode === 400)).toBe(true);
    });
});

describe('streaming endpoint validation', () => {
    it('rejects non-POST and bad JSON quickly', async () => {
        const streamFn = (await import('../../netlify/functions/gemini-stream')).default as
            (req: Request) => Promise<Response>;
        const get = await streamFn(new Request('http://x/api/gemini-stream', { method: 'GET' }));
        expect(get.status).toBe(405);
        const bad = await streamFn(new Request('http://x/api/gemini-stream', {
            method: 'POST', body: '{nope', headers: { 'x-nf-client-connection-ip': 'sv-1' },
        }));
        expect(bad.status).toBe(400);
    });
});

describe('Gemini key pool under stress', () => {
    it('round-robins 100k picks quickly and rotates fairly', () => {
        const counts = new Map<number, number>();
        const t0 = now();
        for (let i = 0; i < 100_000; i++) {
            const s = shared.keyPool.pick();
            expect(s).not.toBeNull();
            counts.set(s!.index, (counts.get(s!.index) ?? 0) + 1);
        }
        const elapsed = now() - t0;
        const spread = [...counts.values()];
        console.log(`[keypool] 100k picks: ${elapsed.toFixed(0)}ms, distribution=${spread.join('/')}`);
        // Fair rotation: every key gets within 1% of an equal share
        for (const c of spread) expect(Math.abs(c - 100_000 / spread.length)).toBeLessThan(1_000);
    });

    it('exhausting every key yields null picks until cooldown expires', () => {
        for (let i = 0; i < shared.keyPool.size(); i++) {
            const s = shared.keyPool.pick();
            if (s) shared.keyPool.markExhausted(s, 50, 'stress: simulated 429');
        }
        expect(shared.keyPool.pick()).toBeNull();
        // After the 50ms cooldown the pool must self-heal
        return new Promise<void>((resolve) => setTimeout(() => {
            expect(shared.keyPool.pick()).not.toBeNull();
            resolve();
        }, 80));
    });
});

describe('client prompt utils at document-size extremes', () => {
    it('estimateTokens scans a 10MB mixed document in reasonable time', async () => {
        const { estimateTokens } = await import('../../utils/promptBudget');
        const doc = ('한국어 텍스트와 English text mixed. '.repeat(8))
            .repeat(Math.ceil(10 * 1024 * 1024 / 280)).slice(0, 10 * 1024 * 1024);
        const t0 = now();
        const tokens = estimateTokens(doc);
        const elapsed = now() - t0;
        console.log(`[utils] estimateTokens 10MB: ${elapsed.toFixed(0)}ms → ${tokens.toLocaleString()} tokens`);
        expect(tokens).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(5_000);
    });

    it('sampleEvenly caps a 10MB document instantly and within budget', async () => {
        const { sampleEvenly } = await import('../../utils/promptBudget');
        const doc = 'z'.repeat(10 * 1024 * 1024);
        const t0 = now();
        const out = sampleEvenly(doc, 120_000);
        const elapsed = now() - t0;
        console.log(`[utils] sampleEvenly 10MB→120k: ${elapsed.toFixed(1)}ms`);
        expect(out.length).toBeLessThanOrEqual(120_000);
        expect(elapsed).toBeLessThan(500);
    });
});
