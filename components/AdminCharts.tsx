import * as React from 'react';

// Tiny presentational charts for the admin dashboard. Pure functions of
// their props — no data fetching, no internal state. Split from AdminPage
// so each visual is independently importable (and trivially testable if
// we ever need to).

function formatBytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[i]}`;
}

interface MiniBarChartProps {
    data: Array<{ date: string; totalActions: number; activeUsers: number }>;
}

/**
 * Seven-day bar chart of daily AI calls. Every column shows its count,
 * even zero — the previous version drew 0-action days as a 4-px ghost
 * tick with no label, so a window dominated by small numbers (or one
 * with the last two days at zero, as the user just hit) was visually
 * indistinguishable from a broken chart. Today's column gets a tinted
 * panel + bold date label so the latest data is unmissable, and a
 * one-line caption under the chart spells out when EVERY day is zero.
 */
export const MiniBarChart: React.FC<MiniBarChartProps> = ({ data }) => {
    const max = Math.max(...data.map(d => d.totalActions), 1);
    const allZero = data.every(d => d.totalActions === 0);
    const lastIdx = data.length - 1; // server lists oldest→newest, so the last entry is today
    return (
        <div className="w-full">
            <div className="relative flex items-end gap-1.5 h-28 w-full">
                {data.map((d, i) => {
                    const isToday = i === lastIdx;
                    const isZero = d.totalActions === 0;
                    const ratio = d.totalActions / max;
                    // Zero -> small fixed-px tick. Non-zero -> 12% floor
                    // so a value of 1 next to a value of 50 still reads
                    // as "real activity" rather than nothing.
                    const height = isZero ? 6 : Math.max(12, ratio * 100);
                    const color = isZero
                        ? 'bg-ink-200'
                        : isToday
                            ? 'bg-brand-600'
                            : 'bg-brand-500 hover:bg-brand-600';
                    return (
                        <div
                            key={d.date}
                            className={`flex-1 flex flex-col items-center gap-1 group relative ${isToday ? 'bg-brand-50/60 rounded-md py-1' : ''}`}
                        >
                            {/* Permanent count above the bar — at-a-glance even when 0 */}
                            <span className={`text-[10px] font-semibold tabular-nums leading-none ${isZero ? 'text-ink-300' : 'text-ink-700'}`}>
                                {d.totalActions}
                            </span>
                            <div className="relative flex-1 w-full flex items-end min-h-[6px]">
                                <div
                                    className={`w-full rounded-t transition-all duration-500 ${color}`}
                                    style={{ height: isZero ? `${height}px` : `${height}%` }}
                                />
                                {/* Hover tooltip with the user count too */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                    <div className="bg-ink-800 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap">
                                        {d.totalActions}회 · {d.activeUsers}명
                                    </div>
                                    <div className="w-1.5 h-1.5 bg-ink-800 rotate-45 -mt-0.5" />
                                </div>
                            </div>
                            <span className={`text-[10px] leading-none tabular-nums ${isToday ? 'text-brand-700 font-bold' : 'text-ink-400'}`}>
                                {d.date}
                            </span>
                        </div>
                    );
                })}
            </div>
            {allZero && (
                <p className="mt-2 text-center text-xs text-ink-400">
                    최근 7일간 호출 기록이 없습니다.
                </p>
            )}
        </div>
    );
};

interface StorageGaugeProps { used: number; limit?: number; label: string }

/**
 * Storage-quota progress bar. Color flips from green → orange → red as
 * the user approaches the limit, giving an at-a-glance signal that
 * matches the dashboard's other warning indicators.
 */
export const StorageGauge: React.FC<StorageGaugeProps> = ({ used, limit = 5 * 1024 * 1024 * 1024, label }) => {
    const pct = Math.min((used / limit) * 100, 100);
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-green-500';
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-ink-700">{label}</span>
                <span className="text-ink-500 font-mono">{formatBytes(used)}</span>
            </div>
            <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-ink-400 mt-0.5">
                <span>{pct.toFixed(1)}% 사용됨</span>
                <span>한도 {formatBytes(limit)}</span>
            </div>
        </div>
    );
};
