import { describe, expect, it } from 'vitest';
import { formatRelativeTimeKo } from '../../utils/relativeTime';

const NOW = new Date('2026-06-16T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatRelativeTimeKo', () => {
    it('shows 방금 for anything under a minute (and for future skew)', () => {
        expect(formatRelativeTimeKo(ago(5_000), NOW)).toBe('방금');
        expect(formatRelativeTimeKo(new Date(NOW + 10_000).toISOString(), NOW)).toBe('방금');
    });

    it('shows minutes / hours / days for recent times', () => {
        expect(formatRelativeTimeKo(ago(5 * 60_000), NOW)).toBe('5분 전');
        expect(formatRelativeTimeKo(ago(2 * 60 * 60_000), NOW)).toBe('2시간 전');
        expect(formatRelativeTimeKo(ago(3 * 24 * 60 * 60_000), NOW)).toBe('3일 전');
    });

    it('falls back to an absolute date past ~7 days', () => {
        // 10 days ago -> absolute Y.M.D, not "10일 전"
        const out = formatRelativeTimeKo(ago(10 * 24 * 60 * 60_000), NOW);
        expect(out).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    });

    it('returns empty string for an unparseable timestamp', () => {
        expect(formatRelativeTimeKo('not-a-date', NOW)).toBe('');
    });
});
