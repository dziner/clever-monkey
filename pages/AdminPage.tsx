import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
    adminDeactivateUser, adminGetUserStats, adminRestoreUser, adminUpdateProfile,
    adminGetApiStats, adminGetApiCategoryStats, adminGetDbStats,
    fetchKeyMeta,
    type AdminUserRow, type ApiStats, type ApiCategoryStats, type DbStats, type KeyMeta,
} from '../services/adminService';
import {
    AdminPanelIcon, PeopleIcon, WorkspacePremiumIcon, DocumentIcon, BoltIcon,
    ChevronLeftIcon, RefreshIcon, CheckIcon,
    ErrorOutlineIcon, StorageIcon, WarningIcon,
    QuizIcon, FolderOpenIcon, CloudIcon, AnnotationIcon,
} from '../components/icons';
import { Spinner } from '../components/Spinner';
import { TierBadge } from '../components/AdminUserTable';
import { AdminStatCard } from '../components/AdminStatCard';
import { AdminUsersTab } from '../components/AdminUsersTab';
import { MiniBarChart, StorageGauge } from '../components/AdminCharts';
import { AdminCapacityPanel } from '../components/AdminCapacityPanel';
import { AdminRecentErrors } from '../components/AdminRecentErrors';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getUserStats } from '../utils/adminStats';
import { isAdminUser } from '../services/adminConfig';
import { ROUTES } from '../routes';
import type { UserTier, UserRole } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[i]}`;
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

interface AdminPageProps {
    onMenuClick: () => void;
}

type TabId = 'overview' | 'usage' | 'users';

type PendingAccountAction = {
    type: 'deactivate' | 'restore';
    user: AdminUserRow;
};

export const AdminPage: React.FC<AdminPageProps> = () => {
    const navigate = useNavigate();
    const { userId, userEmail, userProfile, refreshProfile } = useUser();

    const [users, setUsers] = React.useState<AdminUserRow[]>([]);
    const [apiStats, setApiStats] = React.useState<ApiStats | null>(null);
    const [apiCategoryStats, setApiCategoryStats] = React.useState<ApiCategoryStats | null>(null);
    const [keyMeta, setKeyMeta] = React.useState<KeyMeta | null>(null);
    const [dbStats, setDbStats] = React.useState<DbStats | null>(null);
    const [serverError, setServerError] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState<TabId>('overview');
    const [accountActionError, setAccountActionError] = React.useState<string | null>(null);
    const [pendingAccountAction, setPendingAccountAction] = React.useState<PendingAccountAction | null>(null);

    const isAdmin = isAdminUser(userProfile?.role, userEmail, userProfile?.accountStatus);

    // Re-entry guard: prevents the refresh button from firing concurrent
    // batches if the user mashes it. Plain isLoading state would lag a
    // render behind clicks (React state update -> re-render -> button
    // re-disabled), so a ref reads the latest synchronously.
    const loadingRef = React.useRef(false);
    const loadAll = React.useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setIsLoading(true);
        try {
            const [usersResult, apiData, apiCategoryData, keyMetaData, dbData] = await Promise.all([
                adminGetUserStats(),
                adminGetApiStats(),
                adminGetApiCategoryStats(),
                fetchKeyMeta(),
                adminGetDbStats(),
            ]);
            setUsers(usersResult.rows);
            setApiStats(apiData);
            setApiCategoryStats(apiCategoryData);
            setKeyMeta(keyMetaData);
            setDbStats(dbData);
            setServerError(usersResult.error);
        } finally {
            setIsLoading(false);
            loadingRef.current = false;
        }
    }, []);

    // Always re-fetch the profile when entering /admin so a freshly-promoted
    // role (e.g., right after running make_admin.sql) is picked up without a
    // page reload.
    React.useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    React.useEffect(() => {
        if (!isAdmin) return;
        loadAll();
    }, [isAdmin, loadAll]);

    const handleTierChange = React.useCallback(async (targetUserId: string, tier: UserTier) => {
        setAccountActionError(null);
        setUpdatingId(targetUserId);
        const ok = await adminUpdateProfile(targetUserId, { tier });
        if (ok) {
            setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, tier } : u));
            if (targetUserId === userId) await refreshProfile();
        } else {
            setAccountActionError('요금제 변경에 실패했습니다. 관리자 권한 또는 Supabase 정책을 확인하세요.');
        }
        setUpdatingId(null);
    }, [userId, refreshProfile]);

    const handleRoleChange = React.useCallback(async (targetUserId: string, role: UserRole) => {
        setAccountActionError(null);
        setUpdatingId(targetUserId);
        const ok = await adminUpdateProfile(targetUserId, { role });
        if (ok) setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role } : u));
        else setAccountActionError('권한 변경에 실패했습니다. 관리자 권한 또는 Supabase 정책을 확인하세요.');
        setUpdatingId(null);
    }, []);

    const handleConfirmAccountAction = React.useCallback(async () => {
        if (!pendingAccountAction) return;
        const target = pendingAccountAction.user;
        setAccountActionError(null);
        setUpdatingId(target.id);
        const result = pendingAccountAction.type === 'deactivate'
            ? await adminDeactivateUser(target.id, 'admin_soft_delete')
            : await adminRestoreUser(target.id);

        if (result.ok) {
            setPendingAccountAction(null);
            await loadAll();
            if (target.id === userId) await refreshProfile();
        } else {
            setAccountActionError(result.error ?? '계정 상태 변경에 실패했습니다.');
            setPendingAccountAction(null);
        }
        setUpdatingId(null);
    }, [loadAll, pendingAccountAction, refreshProfile, userId]);

    // ── Access guard ──────────────────────────────────────────────────────────
    // Render the diagnostic even when userProfile is null. Otherwise a failed
    // profile fetch silently falls through and the panel renders empty with
    // no explanation.
    if (!isAdmin) {
        const profileMissing = userProfile === null;
        return (
            <div className="flex flex-col h-full items-center justify-center bg-ink-50 gap-4 p-8">
                <div className="w-16 h-16 bg-danger-50 rounded-full flex items-center justify-center">
                    <ErrorOutlineIcon className="text-3xl text-red-400" />
                </div>
                <div className="text-center">
                    <p className="font-bold text-ink-700">접근 권한이 없습니다</p>
                    <p className="text-sm text-ink-500 mt-1">
                        {profileMissing
                            ? '프로필을 불러오지 못했습니다 (브라우저 콘솔의 [profile] 로그를 확인하세요).'
                            : '관리자 권한이 필요한 페이지입니다.'}
                    </p>
                </div>
                <div className="mt-2 max-w-md w-full text-left bg-white border border-ink-200 rounded-xl p-4 text-xs font-mono text-ink-600 space-y-1">
                    <p className="font-sans text-[11px] uppercase tracking-wider text-ink-400 font-bold mb-2">진단 정보</p>
                    <p>email: <span className="text-ink-900">{userEmail || '(none)'}</span></p>
                    <p>profile.role: <span className="text-ink-900">{userProfile?.role || '(no profile row)'}</span></p>
                    <p>profile.tier: <span className="text-ink-900">{userProfile?.tier || '(none)'}</span></p>
                    <p>profile.status: <span className="text-ink-900">{userProfile?.accountStatus || '(legacy/no status)'}</span></p>
                    <p>profile.id: <span className="text-ink-900 break-all">{userProfile?.id || '(none)'}</span></p>
                    <p>auth uid: <span className="text-ink-900 break-all">{userId || '(none)'}</span></p>
                </div>
                <p className="max-w-md text-center text-xs text-ink-500">
                    {profileMissing
                        ? 'auth uid와 profile.id가 안 맞는 경우가 가장 흔합니다 (재가입으로 새 uid가 생성됨). supabase/make_admin.sql의 진단 SELECT로 두 값을 비교하세요.'
                        : 'profile.role이 admin이 아니면 SQL이 다른 행에 적용된 것입니다. SQL 안의 이메일과 위 email을 정확히 맞춰서 다시 실행하세요.'}
                </p>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={async () => { await refreshProfile(); }}
                        className="px-4 py-2 bg-ink-200 text-ink-800 rounded-xl font-semibold text-sm hover:bg-ink-300 transition-colors">
                        프로필 다시 불러오기
                    </button>
                    <button type="button" onClick={() => navigate(ROUTES.STUDY)}
                        className="px-4 py-2 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 transition-colors">
                        홈으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    // Single-pass tier/role tally; see utils/adminStats. `admins` is the
    // actual list so the JSX can render it without re-filtering.
    const activeUsers = React.useMemo(
        () => users.filter(u => u.accountStatus !== 'inactive'),
        [users],
    );
    const inactiveUsers = React.useMemo(
        () => users.filter(u => u.accountStatus === 'inactive'),
        [users],
    );
    const { totalUsers, freeUsers, proUsers, adminUsers, admins, freePct, proPct } =
        React.useMemo(() => getUserStats(activeUsers), [activeUsers]);
    const inactiveUserCount = inactiveUsers.length;

    const tabs: Array<{ id: TabId; label: string }> = [
        { id: 'overview', label: '개요' },
        { id: 'usage',    label: 'API · DB 현황' },
        { id: 'users',    label: `사용자 (${users.length})` },
    ];

    return (
        <div className="flex flex-col h-full bg-ink-50 overflow-hidden">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 bg-white border-b border-ink-200 shadow-sm">
                <div className="h-14 flex items-center gap-3 px-4">
                    <button type="button" onClick={() => navigate(ROUTES.STUDY)}
                        className="p-2 text-ink-500 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-colors">
                        <ChevronLeftIcon className="text-xl" />
                    </button>
                    <AdminPanelIcon className="text-2xl text-warning-500" />
                    <div>
                        <h1 className="text-lg font-bold text-ink-800 leading-tight">Admin Panel</h1>
                        <p className="text-xs text-ink-400">Clever Monkey 관리자 대시보드</p>
                    </div>
                    <button
                        type="button"
                        onClick={loadAll}
                        disabled={isLoading}
                        className="ml-auto p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="새로고침"
                        aria-busy={isLoading}
                    >
                        <RefreshIcon className={`text-xl ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-t border-ink-100">
                    {tabs.map(tab => (
                        <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-brand-500 text-brand-700'
                                    : 'border-transparent text-ink-500 hover:text-ink-700'
                            }`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center"><Spinner /></div>
            ) : (
                <div className="flex-1 overflow-y-auto">

                    {/* Server-side denial banner — the client gate passed but
                        the DB rejected the admin RPCs. */}
                    {serverError && (
                        <div className="m-4 max-w-4xl mx-auto bg-danger-50 border border-danger-500/30 rounded-xl p-4 text-sm">
                            <p className="font-bold text-danger-600">서버가 관리자 권한을 거부했습니다</p>
                            <p className="mt-1 font-mono text-xs text-ink-600 break-all">{serverError}</p>
                            <p className="mt-2 text-xs text-ink-500 leading-relaxed">
                                DB의 <code className="font-mono">is_admin_user()</code> 함수가 아직 이 계정을 인정하지 않습니다.
                                Supabase SQL Editor에서 <code className="font-mono">supabase/make_admin.sql</code>을
                                실행하세요 (로그인 이메일과 SQL 안의 이메일이 일치해야 합니다). 실행 후 위의 새로고침 버튼을 누르세요.
                            </p>
                        </div>
                    )}

                    {/* ══ 개요 탭 ═══════════════════════════════════════════ */}
                    {activeTab === 'overview' && (
                        <div className="p-4 max-w-4xl mx-auto w-full space-y-6">
                            <section>
                                <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">사용자 현황</h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <AdminStatCard icon={PeopleIcon}           label="활성 사용자"  value={totalUsers}  sub={`삭제 대기 ${inactiveUserCount}명`} color="text-brand-600"   bg="bg-brand-50" />
                                    <AdminStatCard icon={WorkspacePremiumIcon} label="Pro 사용자"   value={proUsers}    sub={`Free ${freeUsers}명`} color="text-violet-600" bg="bg-violet-50" />
                                    <AdminStatCard icon={DocumentIcon}         label="전체 문서"    value={dbStats?.documentCount ?? '—'} color="text-success-600" bg="bg-success-50" />
                                    <AdminStatCard icon={BoltIcon}             label="오늘 AI 호출" value={apiStats?.totalActionsToday ?? '—'} color="text-warning-600" bg="bg-warning-50" />
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">플랜 분포</h2>
                                <div className="bg-white rounded-xl border border-ink-200 p-5 space-y-3">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-ink-700">Free</span>
                                            <span className="text-ink-500">{freeUsers}명 ({Math.round(freePct)}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
                                            <div className="h-2 bg-ink-400 rounded-full" style={{ width: `${freePct}%` }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-violet-700">Pro</span>
                                            <span className="text-ink-500">{proUsers}명 ({Math.round(proPct)}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
                                            <div className="h-2 bg-violet-500 rounded-full" style={{ width: `${proPct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">플랜 정책</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-white rounded-xl border border-ink-200 p-4">
                                        <div className="flex items-center gap-2 mb-3"><span className="text-sm font-bold text-ink-700">Free</span><TierBadge tier="free" /></div>
                                        <ul className="space-y-1.5 text-sm text-ink-700">
                                            <li className="flex items-center gap-2"><CheckIcon className="text-success-500 text-sm" />최대 5개 문서</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-success-500 text-sm" />하루 20회 AI 기능</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-success-500 text-sm" />모든 기능 접근 가능</li>
                                        </ul>
                                    </div>
                                    <div className="bg-white rounded-xl border border-violet-200 p-4">
                                        <div className="flex items-center gap-2 mb-3"><span className="text-sm font-bold text-ink-700">Pro</span><TierBadge tier="pro" /></div>
                                        <ul className="space-y-1.5 text-sm text-ink-700">
                                            <li className="flex items-center gap-2"><CheckIcon className="text-success-500 text-sm" />무제한 문서</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-success-500 text-sm" />무제한 AI 기능</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-success-500 text-sm" />모든 기능 + 우선 처리</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {adminUsers > 0 && (
                                <section>
                                    <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">관리자 ({adminUsers}명)</h2>
                                    <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
                                        {admins.map(u => (
                                            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                                                <div className="w-8 h-8 rounded-full bg-warning-100 flex items-center justify-center text-warning-700 font-bold text-sm">
                                                    {(u.email[0] ?? '?').toUpperCase()}
                                                </div>
                                                <p className="flex-1 text-sm font-medium text-ink-700 truncate">{u.email}</p>
                                                <TierBadge tier={u.tier} />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Live error feed — surfaces user-facing failures
                                (OCR, TTS, network) as they happen so the
                                operator can triage without opening SQL. */}
                            <AdminRecentErrors />
                        </div>
                    )}

                    {/* ══ API · DB 현황 탭 ══════════════════════════════════ */}
                    {activeTab === 'usage' && (
                        <div className="p-4 max-w-4xl mx-auto w-full space-y-6">

                            {/* ── Gemini API 현황 ── */}
                            <section>
                                <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <BoltIcon className="text-sm text-warning-500" />
                                    Gemini API 사용현황
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                    <AdminStatCard icon={BoltIcon}      label="오늘 총 AI 호출"  value={apiStats?.totalActionsToday ?? 0} color="text-warning-600" bg="bg-warning-50" />
                                    <AdminStatCard icon={PeopleIcon}    label="오늘 활성 사용자" value={apiStats?.activeUsersToday ?? 0}  color="text-brand-600"   bg="bg-brand-50" />
                                    <AdminStatCard icon={WarningIcon}   label="한도 근접 사용자"
                                        value={apiStats?.usersNearLimit ?? 0}
                                        sub="Free · 15회 이상"
                                        color="text-warning-600" bg="bg-warning-50"
                                        warn={(apiStats?.usersNearLimit ?? 0) > 0}
                                    />
                                </div>

                                {/* 7-day bar chart */}
                                <div className="bg-white rounded-xl border border-ink-200 p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-sm font-semibold text-ink-700">최근 7일 AI 호출 추이</p>
                                        <div className="flex items-center gap-3 text-xs text-ink-400">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-brand-500 rounded-sm" />총 호출</span>
                                        </div>
                                    </div>
                                    {apiStats && apiStats.last7Days.length > 0 ? (
                                        <MiniBarChart data={apiStats.last7Days} />
                                    ) : (
                                        <div className="h-24 flex items-center justify-center text-sm text-ink-400">
                                            데이터가 없습니다 (AI 기능 사용 후 로그가 쌓입니다)
                                        </div>
                                    )}
                                </div>

                                {/* Per-feature capacity dashboard — knowing which
                                    feature is closest to its free-tier ceiling
                                    drives the buy-key / add-key / fall-back-to-Groq
                                    decision. Hidden until SQL migration runs. */}
                                <div className="mt-4">
                                    <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        기능별 사용량 · 무료 한도 대비
                                    </h3>
                                    <AdminCapacityPanel stats={apiCategoryStats} keyMeta={keyMeta} />
                                </div>

                                {/* Top users today */}
                                {activeUsers.filter(u => u.aiActionsToday > 0).length > 0 && (
                                    <div className="bg-white rounded-xl border border-ink-200 overflow-hidden mt-4">
                                        <div className="px-4 py-3 border-b border-ink-100">
                                            <p className="text-sm font-semibold text-ink-700">오늘 상위 AI 사용자</p>
                                        </div>
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-ink-50 border-b border-ink-100">
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-ink-500 uppercase">사용자</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-ink-500 uppercase">플랜</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-ink-500 uppercase">호출</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-ink-500 uppercase min-w-[120px]">사용률</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...activeUsers]
                                                    .filter(u => u.aiActionsToday > 0)
                                                    .sort((a, b) => b.aiActionsToday - a.aiActionsToday)
                                                    .slice(0, 10)
                                                    .map(u => {
                                                        const pct = u.tier === 'pro' ? 0 : Math.min((u.aiActionsToday / 20) * 100, 100);
                                                        const isNear = u.tier === 'free' && u.aiActionsToday >= 15;
                                                        return (
                                                            <tr key={u.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                                                                <td className="px-4 py-2.5">
                                                                    <p className="text-sm text-ink-700 truncate max-w-[200px]">{u.email}</p>
                                                                </td>
                                                                <td className="px-4 py-2.5"><TierBadge tier={u.tier} /></td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className={`text-sm font-mono font-bold ${isNear ? 'text-warning-600' : 'text-ink-700'}`}>
                                                                        {u.tier === 'pro' ? `${u.aiActionsToday} ∞` : `${u.aiActionsToday} / 20`}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    {u.tier === 'pro' ? (
                                                                        <span className="text-xs text-violet-600 font-semibold">무제한</span>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden max-w-[80px]">
                                                                                <div className={`h-1.5 rounded-full ${isNear ? 'bg-orange-500' : 'bg-brand-400'}`} style={{ width: `${pct}%` }} />
                                                                            </div>
                                                                            <span className="text-xs text-ink-400 flex-shrink-0">{Math.round(pct)}%</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>

                            {/* ── Supabase DB 현황 ── */}
                            <section>
                                <h2 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <StorageIcon className="text-sm text-success-500" />
                                    Supabase DB · 스토리지 현황
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    <AdminStatCard icon={DocumentIcon}   label="총 문서"        value={dbStats?.documentCount ?? '—'}  sub={`오늘 +${dbStats?.docsCreatedToday ?? 0}`} color="text-brand-600"   bg="bg-brand-50" />
                                    <AdminStatCard icon={QuizIcon}       label="퀴즈 세션"       value={dbStats?.quizSessions ?? '—'}   color="text-success-600"  bg="bg-success-50" />
                                    <AdminStatCard icon={ErrorOutlineIcon} label="오답 기록"     value={dbStats?.wrongAnswers ?? '—'}   color="text-danger-500"    bg="bg-danger-50" />
                                    <AdminStatCard icon={FolderOpenIcon} label="폴더"            value={dbStats?.folders ?? '—'}        color="text-warning-600" bg="bg-warning-50" />
                                </div>

                                {/* Storage gauges */}
                                <div className="bg-white rounded-xl border border-ink-200 p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CloudIcon className="text-ink-500 text-base" />
                                        <p className="text-sm font-semibold text-ink-700">스토리지 사용량</p>
                                    </div>
                                    <StorageGauge
                                        used={dbStats?.storageBytes ?? 0}
                                        label="Supabase Storage (docs 버킷)"
                                        limit={5 * 1024 * 1024 * 1024}
                                    />
                                    <div className="border-t border-ink-100 pt-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                            <div>
                                                <p className="text-lg font-bold text-ink-800">{formatBytes(dbStats?.storageBytes ?? 0)}</p>
                                                <p className="text-xs text-ink-400">스토리지</p>
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-ink-800">{formatBytes(dbStats?.totalFileSizeBytes ?? 0)}</p>
                                                <p className="text-xs text-ink-400">파일 크기 합계</p>
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-ink-800">
                                                    {dbStats && dbStats.documentCount > 0
                                                        ? formatBytes(Math.round(dbStats.totalFileSizeBytes / dbStats.documentCount))
                                                        : '—'}
                                                </p>
                                                <p className="text-xs text-ink-400">문서당 평균</p>
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-ink-800">+{dbStats?.docsCreatedWeek ?? 0}</p>
                                                <p className="text-xs text-ink-400">이번 주 신규</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Table count summary */}
                                <div className="bg-white rounded-xl border border-ink-200 overflow-hidden mt-4">
                                    <div className="px-4 py-3 border-b border-ink-100">
                                        <p className="text-sm font-semibold text-ink-700">테이블별 레코드 수</p>
                                    </div>
                                    <div className="divide-y divide-ink-50">
                                        {[
                                            { label: 'profiles',      value: users.length,                Icon: PeopleIcon },
                                            { label: 'documents',     value: dbStats?.documentCount ?? 0, Icon: DocumentIcon },
                                            { label: 'folders',       value: dbStats?.folders ?? 0,       Icon: FolderOpenIcon },
                                            { label: 'quiz_sessions', value: dbStats?.quizSessions ?? 0,  Icon: QuizIcon },
                                            { label: 'wrong_answers', value: dbStats?.wrongAnswers ?? 0,  Icon: ErrorOutlineIcon },
                                            { label: 'annotations',   value: dbStats?.annotations ?? 0,   Icon: AnnotationIcon },
                                        ].map(row => (
                                            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                                <span className="text-sm text-ink-700 font-mono flex items-center gap-2">
                                                    <row.Icon className="text-base text-ink-500" />
                                                    {row.label}
                                                </span>
                                                <span className="text-sm font-bold text-ink-800 tabular-nums">
                                                    {row.value.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* ── BarChart legend ── */}
                            <p className="text-xs text-ink-400 text-center pb-4">
                                * API 호출 로그는 <code className="bg-ink-100 px-1 rounded">ai_usage_daily_log</code> 테이블에 누적됩니다.
                                Supabase 스토리지 한도는 프리 플랜 기준 500MB입니다.
                            </p>
                        </div>
                    )}

                    {/* ══ 사용자 탭 ═════════════════════════════════════════ */}
                    {activeTab === 'users' && (
                        <AdminUsersTab
                            users={users}
                            currentUserId={userId}
                            updatingId={updatingId}
                            accountActionError={accountActionError}
                            onTierChange={handleTierChange}
                            onRoleChange={handleRoleChange}
                            onDeactivateUser={user => setPendingAccountAction({ type: 'deactivate', user })}
                            onRestoreUser={user => setPendingAccountAction({ type: 'restore', user })}
                        />
                    )}
                </div>
            )}
            <ConfirmDialog
                isOpen={pendingAccountAction?.type === 'deactivate'}
                onClose={() => setPendingAccountAction(null)}
                onConfirm={handleConfirmAccountAction}
                title="계정을 삭제 처리할까요?"
                body={
                    pendingAccountAction
                        ? `"${pendingAccountAction.user.email}" 계정을 inactive 상태로 전환합니다. auth 계정과 사용자 데이터는 보존되며, 30일 내 삭제된 계정 섹션에서 복구할 수 있습니다. 30일이 지나도 자동 영구삭제되지는 않으며 수동 검토 상태로 남습니다.`
                        : undefined
                }
                confirmLabel="삭제 처리"
                destructive
            />
            <ConfirmDialog
                isOpen={pendingAccountAction?.type === 'restore'}
                onClose={() => setPendingAccountAction(null)}
                onConfirm={handleConfirmAccountAction}
                title="계정을 복구할까요?"
                body={
                    pendingAccountAction
                        ? `"${pendingAccountAction.user.email}" 계정을 다시 active 상태로 전환합니다.`
                        : undefined
                }
                confirmLabel="복구"
            />
        </div>
    );
};
