import type { AdminUserRow } from '../services/profileService';

// Pure stat derivation for the admin overview. Replaces the old pattern
// of running users.filter(...) once per count — three passes for the
// totals plus a fourth elsewhere just to render the admin list — with a
// single linear sweep that also exposes the admins as a list so the
// JSX doesn't have to re-filter for the same predicate.

export interface AdminUserStats {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    adminUsers: number;
    /** All admin rows, in source order. Saves a re-filter at render time. */
    admins: AdminUserRow[];
    /** Percentages clamped to 0 when totalUsers === 0 (no divide-by-zero). */
    freePct: number;
    proPct: number;
}

export function getUserStats(users: AdminUserRow[]): AdminUserStats {
    let freeUsers = 0;
    let proUsers = 0;
    const admins: AdminUserRow[] = [];

    for (const u of users) {
        if (u.tier === 'free') freeUsers++;
        else if (u.tier === 'pro') proUsers++;
        if (u.role === 'admin') admins.push(u);
    }

    const totalUsers = users.length;
    const safeRatio = (n: number) => totalUsers > 0 ? (n / totalUsers) * 100 : 0;

    return {
        totalUsers,
        freeUsers,
        proUsers,
        adminUsers: admins.length,
        admins,
        freePct: safeRatio(freeUsers),
        proPct: safeRatio(proUsers),
    };
}
