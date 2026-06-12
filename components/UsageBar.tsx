import * as React from 'react';

// Compact label + count + progress bar used in the sidebar footer for
// document and daily-AI quotas. The two original copies in FileListPanel
// were byte-identical except for label / numerator / denominator / color,
// which is exactly what one parameterized component is for.

interface UsageBarProps {
    label: React.ReactNode;
    used: number;
    /**
     * Total allowed. `Infinity` hides the bar and the slash-denominator
     * (the row collapses to "label N" — what we show for the Pro tier).
     */
    limit: number;
    /** When true, the bar and count switch to the danger color. */
    atLimit?: boolean;
    /** Tailwind class for the bar when NOT at the limit (e.g. 'bg-brand-500'). */
    activeColor?: string;
    /** Optional CTA rendered below the bar (e.g. an upgrade nudge). */
    footer?: React.ReactNode;
}

export const UsageBar: React.FC<UsageBarProps> = ({
    label, used, limit, atLimit = false, activeColor = 'bg-brand-500', footer,
}) => {
    const hasFiniteLimit = Number.isFinite(limit);
    const pct = hasFiniteLimit ? Math.min((used / limit) * 100, 100) : 0;
    const barColor = atLimit ? 'bg-danger-500' : activeColor;
    const countColor = atLimit ? 'text-danger-600' : 'text-ink-600';
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-semibold text-ink-500">{label}</span>
                <span className={`text-[11px] font-mono font-medium ${countColor}`}>
                    {used}{hasFiniteLimit ? ` / ${limit}` : ''}
                </span>
            </div>
            {hasFiniteLimit && (
                <div className="w-full bg-ink-200/70 rounded-full h-1 overflow-hidden">
                    <div
                        className={`h-1 rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
            {footer}
        </div>
    );
};
