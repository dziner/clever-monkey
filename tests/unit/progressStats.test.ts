import { describe, it, expect } from 'vitest';
import {
    localDayKey,
    computeStreak,
    averageScore,
    dailyCounts,
    type DashboardSession,
} from '../../utils/progressStats';

// Helper: ISO at a given offset from a frozen "now" (in local days).
const NOW = new Date('2026-06-11T15:00:00');
const daysAgo = (n: number, score = 80): DashboardSession => ({
    score,
    createdAt: new Date(NOW.getTime() - n * 86_400_000).toISOString(),
});

describe('progressStats — streak', () => {
    it('returns 0 for no sessions', () => {
        expect(computeStreak([], NOW)).toBe(0);
    });

    it('counts consecutive days ending today', () => {
        const sessions = [daysAgo(0), daysAgo(1), daysAgo(2)];
        expect(computeStreak(sessions, NOW)).toBe(3);
    });

    it('still counts today if user only quizzed yesterday', () => {
        // honest behaviour: streak ends yesterday, so we count up from there
        const sessions = [daysAgo(1), daysAgo(2)];
        expect(computeStreak(sessions, NOW)).toBe(2);
    });

    it('returns 0 once there is a gap of ≥2 days', () => {
        const sessions = [daysAgo(2), daysAgo(3)];
        expect(computeStreak(sessions, NOW)).toBe(0);
    });

    it('collapses multiple sessions on one day', () => {
        const sessions = [daysAgo(0), daysAgo(0), daysAgo(0), daysAgo(1)];
        expect(computeStreak(sessions, NOW)).toBe(2);
    });
});

describe('progressStats — averageScore', () => {
    it('returns 0 when no sessions in window', () => {
        expect(averageScore([], 7, NOW)).toBe(0);
    });

    it('averages and rounds within the window', () => {
        const sessions = [daysAgo(0, 100), daysAgo(1, 80), daysAgo(2, 60)];
        expect(averageScore(sessions, 7, NOW)).toBe(80);
    });

    it('excludes sessions outside the window', () => {
        const sessions = [daysAgo(0, 100), daysAgo(30, 20)];
        expect(averageScore(sessions, 7, NOW)).toBe(100);
    });
});

describe('progressStats — dailyCounts', () => {
    it('returns exactly N entries, oldest first, zero-filled', () => {
        const sessions = [daysAgo(0), daysAgo(0), daysAgo(3)];
        const out = dailyCounts(sessions, 7, NOW);
        expect(out).toHaveLength(7);
        // Today (last entry) has 2; 3 days ago has 1; everything else 0.
        expect(out.at(-1)!.count).toBe(2);
        expect(out.at(-4)!.count).toBe(1);
        const totalCount = out.reduce((s, d) => s + d.count, 0);
        expect(totalCount).toBe(3);
    });

    it('day keys are sortable strings (YYYY-MM-DD)', () => {
        const out = dailyCounts([], 5, NOW);
        const sorted = [...out].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
        expect(out.map(d => d.dayKey)).toEqual(sorted.map(d => d.dayKey));
    });
});

describe('localDayKey', () => {
    it('formats as YYYY-MM-DD', () => {
        expect(localDayKey(new Date('2026-01-05T12:00:00'))).toBe('2026-01-05');
    });
});
