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

/** Seven-day bar chart of daily AI calls. Empty days render as 0-height. */
export const MiniBarChart: React.FC<MiniBarChartProps> = ({ data }) => {
    const max = Math.max(...data.map(d => d.totalActions), 1);
    return (
        <div className="flex items-end gap-1.5 h-24 w-full">
            {data.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="relative flex-1 w-full flex items-end">
                        <div
                            className="w-full bg-brand-500 rounded-t transition-all duration-500 hover:bg-brand-600"
                            style={{ height: `${Math.max((d.totalActions / max) * 100, 4)}%`, minHeight: d.totalActions > 0 ? 4 : 0 }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                            <div className="bg-ink-800 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap">
                                {d.totalActions}회 · {d.activeUsers}명
                            </div>
                            <div className="w-1.5 h-1.5 bg-ink-800 rotate-45 -mt-0.5" />
                        </div>
                    </div>
                    <span className="text-[9px] text-ink-400 leading-none">{d.date}</span>
                </div>
            ))}
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
