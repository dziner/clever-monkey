import * as React from 'react';

interface AdminStatCardProps {
    icon: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    label: string;
    value: number | string;
    sub?: string;
    color: string;
    bg: string;
    warn?: boolean;
}

export const AdminStatCard: React.FC<AdminStatCardProps> = ({
    icon: Icon,
    label,
    value,
    sub,
    color,
    bg,
    warn,
}) => (
    <div className={`bg-white rounded-xl border p-5 flex items-start gap-4 ${warn ? 'border-warning-100' : 'border-ink-200'}`}>
        <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`text-2xl ${color}`} />
        </div>
        <div className="min-w-0">
            <p className="text-2xl font-bold text-ink-800 leading-none">{value}</p>
            <p className="text-sm font-semibold text-ink-500 mt-1">{label}</p>
            {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);
