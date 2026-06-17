import { describe, it, expect } from 'vitest';
import { getUserStats } from '../../utils/adminStats';
import type { AdminUserRow } from '../../services/profileService';

const u = (overrides: Partial<AdminUserRow>): AdminUserRow => ({
    id: 'u-1', email: 'a@b.c', displayName: null,
    role: 'user', tier: 'free', tierExpiresAt: null,
    accountStatus: 'active', deactivatedAt: null, deactivatedBy: null,
    deactivationReason: null, restoreUntil: null,
    aiActionsToday: 0, aiActionsDate: '2026-06-12',
    createdAt: '2026-06-01', language: null,
    documentCount: 0,
    ...overrides,
});

describe('getUserStats', () => {
    it('returns all zeros and an empty admin list for no users', () => {
        const s = getUserStats([]);
        expect(s.totalUsers).toBe(0);
        expect(s.freeUsers).toBe(0);
        expect(s.proUsers).toBe(0);
        expect(s.adminUsers).toBe(0);
        expect(s.admins).toEqual([]);
        // Critically: no NaN from divide-by-zero — these must clamp to 0
        // because the JSX feeds them into `width: ${n}%` directly.
        expect(s.freePct).toBe(0);
        expect(s.proPct).toBe(0);
    });

    it('counts tiers in a single pass and exposes admin rows in source order', () => {
        const users = [
            u({ id: '1', tier: 'free', role: 'user' }),
            u({ id: '2', tier: 'pro',  role: 'admin' }),
            u({ id: '3', tier: 'pro',  role: 'user' }),
            u({ id: '4', tier: 'free', role: 'admin' }),
        ];
        const s = getUserStats(users);
        expect(s.totalUsers).toBe(4);
        expect(s.freeUsers).toBe(2);
        expect(s.proUsers).toBe(2);
        expect(s.adminUsers).toBe(2);
        // Source order preserved — useful for the JSX list, which used to
        // re-filter and would silently break if we ever sorted.
        expect(s.admins.map(a => a.id)).toEqual(['2', '4']);
    });

    it('computes percentages as numbers safe to interpolate into CSS', () => {
        const users = [
            u({ id: '1', tier: 'free' }),
            u({ id: '2', tier: 'free' }),
            u({ id: '3', tier: 'pro' }),
            u({ id: '4', tier: 'pro' }),
        ];
        const s = getUserStats(users);
        expect(s.freePct).toBe(50);
        expect(s.proPct).toBe(50);
    });

    it('treats unknown tiers as neither free nor pro', () => {
        const users = [
            u({ id: '1', tier: 'free' }),
            // Hypothetical extra tier value — counts should NOT inflate.
            u({ id: '2', tier: 'guest' as unknown as 'free' }),
        ];
        const s = getUserStats(users);
        expect(s.freeUsers).toBe(1);
        expect(s.proUsers).toBe(0);
        expect(s.totalUsers).toBe(2);
        // Percentages reflect the total denominator either way.
        expect(s.freePct).toBe(50);
    });
});
