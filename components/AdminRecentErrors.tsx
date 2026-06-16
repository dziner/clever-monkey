import * as React from 'react';
import { adminGetRecentErrors, type AdminErrorRow } from '../services/profileService';
import { formatRelativeTimeKo } from '../utils/relativeTime';
import { ErrorOutlineIcon, RefreshIcon } from './icons';
import { Spinner } from './Spinner';

// Live error feed on the admin overview tab. Reads diagnostic_events via
// admin_get_recent_errors (keyset paginated). Loads 20 at a time, caps
// the visible list at 40 (deep investigation belongs in the SQL editor),
// and auto-refreshes the newest page every 30s so an operator watching
// the screen catches failures as they happen.

const PAGE_SIZE = 20;
const MAX_VISIBLE = 40;
const AUTO_REFRESH_MS = 30_000;

/** Colour the status chip by class: 5xx red, 4xx orange, network grey. */
function statusChipClass(status: number | null, name: string | null): string {
    if (status && status >= 500) return 'bg-red-50 text-red-700 border-red-200';
    if (status && status >= 400) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (name === 'TypeError' || !status) return 'bg-ink-100 text-ink-600 border-ink-200';
    return 'bg-ink-100 text-ink-600 border-ink-200';
}

function statusLabel(row: AdminErrorRow): string {
    if (row.errorStatus) return String(row.errorStatus);
    if (row.errorName) return row.errorName;
    return 'ERR';
}

const ErrorRowItem: React.FC<{ row: AdminErrorRow }> = ({ row }) => {
    const [open, setOpen] = React.useState(false);
    const detail = row.errorMessage || row.message;
    return (
        <div className="px-4 py-2.5 hover:bg-ink-50/60 transition-colors">
            <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left flex items-start gap-3">
                <span className={`flex-shrink-0 mt-0.5 px-1.5 py-px rounded border text-[10px] font-bold tabular-nums ${statusChipClass(row.errorStatus, row.errorName)}`}>
                    {statusLabel(row)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-ink-700 truncate">{row.stage}</p>
                    <p className="text-xs text-ink-500 truncate">{detail}</p>
                </div>
                <span className="flex-shrink-0 text-[10px] text-ink-400 whitespace-nowrap mt-0.5">
                    {formatRelativeTimeKo(row.createdAt)}
                </span>
            </button>
            {open && (
                <div className="mt-2 ml-9 text-[11px] text-ink-500 space-y-0.5 border-l-2 border-ink-100 pl-3">
                    <p><span className="text-ink-400">message:</span> {detail}</p>
                    {row.userEmail && <p><span className="text-ink-400">user:</span> {row.userEmail}</p>}
                    {row.isGuest && <p><span className="text-ink-400">user:</span> (guest)</p>}
                    {row.model && <p><span className="text-ink-400">model:</span> {row.model}</p>}
                    {row.fileName && (
                        <p>
                            <span className="text-ink-400">file:</span> {row.fileName}
                            {row.fileSize ? ` (${(row.fileSize / (1024 * 1024)).toFixed(1)}MB)` : ''}
                        </p>
                    )}
                    <p><span className="text-ink-400">time:</span> {new Date(row.createdAt).toLocaleString()}</p>
                </div>
            )}
        </div>
    );
};

export const AdminRecentErrors: React.FC = () => {
    const [rows, setRows] = React.useState<AdminErrorRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [reachedEnd, setReachedEnd] = React.useState(false);

    // Refresh the newest page (replaces the head of the list). Used on
    // mount and by the 30s auto-refresh — only when the user hasn't
    // paged past the first page, so a "더 보기" expansion isn't yanked.
    const refreshHead = React.useCallback(async () => {
        const fresh = await adminGetRecentErrors(null, PAGE_SIZE);
        setRows(fresh);
        setReachedEnd(fresh.length < PAGE_SIZE);
        setLoading(false);
    }, []);

    React.useEffect(() => {
        refreshHead();
    }, [refreshHead]);

    React.useEffect(() => {
        const id = setInterval(() => {
            // Auto-refresh only while showing the first page — re-pulling
            // the head while the operator has loaded older pages would be
            // disorienting.
            setRows(prev => {
                if (prev.length > PAGE_SIZE) return prev; // paged; skip auto-refresh
                void refreshHead();
                return prev;
            });
        }, AUTO_REFRESH_MS);
        return () => clearInterval(id);
    }, [refreshHead]);

    const loadMore = React.useCallback(async () => {
        if (loadingMore || rows.length === 0) return;
        setLoadingMore(true);
        const oldest = rows[rows.length - 1];
        const next = await adminGetRecentErrors(oldest.createdAt, PAGE_SIZE);
        setRows(prev => [...prev, ...next].slice(0, MAX_VISIBLE));
        if (next.length < PAGE_SIZE) setReachedEnd(true);
        setLoadingMore(false);
    }, [loadingMore, rows]);

    const atCap = rows.length >= MAX_VISIBLE;

    return (
        <section>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ErrorOutlineIcon className="text-sm text-red-400" />
                    최근 에러 로그
                </h2>
                <button
                    type="button"
                    onClick={() => { setLoading(true); refreshHead(); }}
                    className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-colors"
                    title="새로고침"
                >
                    <RefreshIcon className={`text-base ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-10"><Spinner /></div>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-ink-400 text-center py-10">
                        최근 에러가 없습니다 — 좋은 신호예요 🎉
                    </p>
                ) : (
                    <>
                        <div className="divide-y divide-ink-50">
                            {rows.map(row => <ErrorRowItem key={row.id} row={row} />)}
                        </div>
                        <div className="px-4 py-3 bg-ink-50 border-t border-ink-100 text-center">
                            {atCap ? (
                                <p className="text-[11px] text-ink-400">
                                    최근 {MAX_VISIBLE}건만 표시합니다. 더 깊은 조사는 Supabase SQL Editor에서
                                    <code className="mx-1 bg-ink-100 px-1 rounded">diagnostic_events</code>를 조회하세요.
                                </p>
                            ) : reachedEnd ? (
                                <p className="text-[11px] text-ink-400">모든 에러를 불러왔습니다 ({rows.length}건).</p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                                >
                                    {loadingMore ? '불러오는 중…' : '더 보기'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};
