// Compact "방금 / 5분 전 / 2시간 전" relative-time formatting for the
// admin error feed. Pure so it's unit-testable; takes an explicit `now`
// for deterministic tests (defaults to Date.now()).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Korean relative time for a past ISO timestamp. Falls back to an
 * absolute date for anything older than ~7 days. Future timestamps (clock
 * skew) clamp to "방금".
 */
export function formatRelativeTimeKo(iso: string, now: number = Date.now()): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = now - then;
    if (diff < MINUTE) return '방금';
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
    if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
    // Older: absolute Y/ M / D (locale-independent, compact).
    const d = new Date(then);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}.${mm}.${dd}`;
}
