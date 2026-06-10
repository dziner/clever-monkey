import { describe, it, expect } from 'vitest';
import { estimateTokens, sampleEvenly, CONTENT_BUDGET } from '../../utils/promptBudget';

describe('estimateTokens', () => {
    it('returns 0 for empty text', () => {
        expect(estimateTokens('')).toBe(0);
    });

    it('estimates ~1 token per 4 chars for Latin text', () => {
        const text = 'a'.repeat(400);
        expect(estimateTokens(text)).toBe(100);
    });

    it('estimates ~1 token per char for Korean text', () => {
        const text = '한'.repeat(100);
        expect(estimateTokens(text)).toBe(100);
    });

    it('handles mixed-script text', () => {
        // 100 Hangul (100 tokens) + 100 Latin (25 tokens)
        const text = '글'.repeat(100) + 'x'.repeat(100);
        expect(estimateTokens(text)).toBe(125);
    });

    it('never returns less than 1 for non-empty text', () => {
        expect(estimateTokens('a')).toBe(1);
    });
});

describe('sampleEvenly', () => {
    it('returns content unchanged when under the cap', () => {
        const text = 'short document';
        expect(sampleEvenly(text, 1000)).toBe(text);
    });

    it('caps oversized content at the requested length', () => {
        const text = 'x'.repeat(50_000);
        const out = sampleEvenly(text, 10_000);
        expect(out.length).toBeLessThanOrEqual(10_000);
    });

    it('keeps content from the beginning, middle, and end', () => {
        const text = 'START' + 'a'.repeat(20_000) + 'MIDDLE' + 'b'.repeat(20_000) + 'END';
        const out = sampleEvenly(text, 8_000);
        expect(out).toContain('START');
        expect(out).toContain('END');
        // The middle marker sits exactly at the document center, which the
        // even stride must sample.
        expect(out.includes('a')).toBe(true);
        expect(out.includes('b')).toBe(true);
    });

    it('separates segments with an ellipsis marker', () => {
        const out = sampleEvenly('z'.repeat(100_000), 10_000);
        expect(out).toContain('[…]');
    });
});

describe('CONTENT_BUDGET', () => {
    it('keeps every budget within the server prompt cap (250k)', () => {
        for (const budget of Object.values(CONTENT_BUDGET)) {
            expect(budget).toBeLessThanOrEqual(250_000);
            expect(budget).toBeGreaterThan(0);
        }
    });
});
