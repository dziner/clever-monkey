// Pure helpers for the progress dashboard. Kept separate so the math is
// unit-testable without React or Supabase, and so the dashboard
// component stays a thin wrapper around them.
//
// All functions take ISO date strings (as Supabase returns them) and
// reduce to scalars or compact arrays. "Today" is computed from the
// caller's local time zone — we want the streak to feel local, not UTC.

export interface DashboardSession {
    score: number;        // 0..100 percent
    createdAt: string;    // ISO timestamp
}

const MS_PER_DAY = 86_400_000;

/** Local-time YYYY-MM-DD key for grouping sessions by calendar day. */
export function localDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Consecutive days, ending today, on which the user took at least one
 * quiz. If they didn't quiz today, the streak ends at yesterday — we
 * never call a broken streak "active" just because the user has the app
 * open. Returns 0 if they haven't quizzed in either today or yesterday.
 */
export function computeStreak(sessions: DashboardSession[], now: Date = new Date()): number {
    if (sessions.length === 0) return 0;
    const days = new Set(sessions.map(s => localDayKey(new Date(s.createdAt))));
    const today = localDayKey(now);
    const yesterday = localDayKey(new Date(now.getTime() - MS_PER_DAY));
    if (!days.has(today) && !days.has(yesterday)) return 0;

    let streak = 0;
    // Anchor at today if present, otherwise yesterday — so a user who
    // hasn't opened the app yet today still sees their honest streak.
    const anchor = days.has(today) ? now : new Date(now.getTime() - MS_PER_DAY);
    for (let i = 0; ; i++) {
        const day = new Date(anchor.getTime() - i * MS_PER_DAY);
        if (days.has(localDayKey(day))) streak++;
        else break;
    }
    return streak;
}

/**
 * Sessions whose createdAt is within the last `days` calendar days
 * (inclusive of today, by local time). Used to compute the 7-day
 * average score and the bar-chart trend.
 */
export function windowSessions(sessions: DashboardSession[], days: number, now: Date = new Date()): DashboardSession[] {
    const cutoff = new Date(localDayKey(new Date(now.getTime() - (days - 1) * MS_PER_DAY)) + 'T00:00:00').getTime();
    return sessions.filter(s => new Date(s.createdAt).getTime() >= cutoff);
}

/** Mean of the last 7 days' session scores, rounded. 0 if no sessions. */
export function averageScore(sessions: DashboardSession[], days = 7, now: Date = new Date()): number {
    const recent = windowSessions(sessions, days, now);
    if (recent.length === 0) return 0;
    const total = recent.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / recent.length);
}

/**
 * Per-day counts for the last `days` days, oldest first. Always returns
 * exactly `days` entries (zero-fill for days without activity), so the
 * bar chart renders a stable axis.
 */
export function dailyCounts(sessions: DashboardSession[], days = 7, now: Date = new Date()): { dayKey: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const s of windowSessions(sessions, days, now)) {
        const k = localDayKey(new Date(s.createdAt));
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: { dayKey: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const k = localDayKey(new Date(now.getTime() - i * MS_PER_DAY));
        out.push({ dayKey: k, count: counts.get(k) ?? 0 });
    }
    return out;
}
