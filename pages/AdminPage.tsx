import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
    adminGetUserStats, adminUpdateProfile, adminGetApiStats, adminGetDbStats,
    type AdminUserRow, type ApiStats, type DbStats,
} from '../services/profileService';
import {
    AdminPanelIcon, PeopleIcon, WorkspacePremiumIcon, DocumentIcon, BoltIcon,
    ChevronLeftIcon, SearchIcon, RefreshIcon, CheckIcon, StarIcon, TrashIcon,
    ErrorOutlineIcon, KeyIcon, StorageIcon, BarChartIcon, WarningIcon,
    QuizIcon, FolderOpenIcon, CloudIcon,
} from '../components/icons';
import { Spinner } from '../components/Spinner';
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
    icon: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    label: string;
    value: number | string;
    sub?: string;
    color: string;
    bg: string;
    warn?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sub, color, bg, warn }) => (
    <div className={`bg-white rounded-xl border p-5 flex items-start gap-4 ${warn ? 'border-orange-200' : 'border-slate-200'}`}>
        <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`text-2xl ${color}`} />
        </div>
        <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
            <p className="text-sm font-semibold text-slate-500 mt-1">{label}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ─── Tier / Role Badge ────────────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: UserTier }> = ({ tier }) =>
    tier === 'pro' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full text-xs font-bold">
            <StarIcon className="text-xs" /> Pro
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-semibold">
            Free
        </span>
    );

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) =>
    role === 'admin' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full text-xs font-bold">
            <KeyIcon className="text-xs" /> Admin
        </span>
    ) : null;

// ─── User Row ─────────────────────────────────────────────────────────────────

interface UserRowProps {
    user: AdminUserRow;
    currentUserId: string | null;
    onTierChange: (userId: string, tier: UserTier) => void;
    onRoleChange: (userId: string, role: UserRole) => void;
    isUpdating: boolean;
}

const UserRow: React.FC<UserRowProps> = ({ user, currentUserId, onTierChange, onRoleChange, isUpdating }) => {
    const isMe = user.id === currentUserId;
    const aiPct = Math.min(Math.round((user.aiActionsToday / 20) * 100), 100);
    const isNearLimit = user.tier === 'free' && user.aiActionsToday >= 15;

    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            <td className="px-4 py-3 min-w-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {(user.email[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]" title={user.email}>
                            {user.email}
                            {isMe && <span className="ml-1.5 text-xs text-blue-600 font-semibold">(나)</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                            {new Date(user.createdAt).toLocaleDateString('ko-KR')}에 가입
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                    <TierBadge tier={user.tier} />
                    {user.role === 'admin' && <RoleBadge role={user.role} />}
                </div>
            </td>
            <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">{user.documentCount}</td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2 min-w-[80px]">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-1.5 rounded-full transition-all ${isNearLimit ? 'bg-orange-500' : 'bg-blue-400'}`}
                            style={{ width: `${user.tier === 'pro' ? 0 : aiPct}%` }}
                        />
                    </div>
                    <span className={`text-xs font-mono tabular-nums flex-shrink-0 ${isNearLimit ? 'text-orange-600 font-bold' : 'text-slate-500'}`}>
                        {user.tier === 'pro' ? '∞' : `${user.aiActionsToday}`}
                    </span>
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {isUpdating ? <Spinner /> : (
                        <>
                            {user.tier === 'free' ? (
                                <button type="button" onClick={() => onTierChange(user.id, 'pro')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
                                    <StarIcon className="text-xs" /> Pro
                                </button>
                            ) : (
                                <button type="button" onClick={() => onTierChange(user.id, 'free')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors">
                                    Free
                                </button>
                            )}
                            {!isMe && (
                                user.role === 'admin' ? (
                                    <button type="button" onClick={() => onRoleChange(user.id, 'user')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                                        Admin 해제
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => onRoleChange(user.id, 'admin')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                                        <KeyIcon className="text-xs" /> Admin
                                    </button>
                                )
                            )}
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
};

// ─── Bar Chart (7-day trend) ──────────────────────────────────────────────────

interface MiniBarChartProps {
    data: Array<{ date: string; totalActions: number; activeUsers: number }>;
}

const MiniBarChart: React.FC<MiniBarChartProps> = ({ data }) => {
    const max = Math.max(...data.map(d => d.totalActions), 1);
    return (
        <div className="flex items-end gap-1.5 h-24 w-full">
            {data.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="relative flex-1 w-full flex items-end">
                        <div
                            className="w-full bg-blue-500 rounded-t transition-all duration-500 hover:bg-blue-600"
                            style={{ height: `${Math.max((d.totalActions / max) * 100, 4)}%`, minHeight: d.totalActions > 0 ? 4 : 0 }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                            <div className="bg-slate-800 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap">
                                {d.totalActions}회 · {d.activeUsers}명
                            </div>
                            <div className="w-1.5 h-1.5 bg-slate-800 rotate-45 -mt-0.5" />
                        </div>
                    </div>
                    <span className="text-[9px] text-slate-400 leading-none">{d.date}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Storage Gauge ────────────────────────────────────────────────────────────

const StorageGauge: React.FC<{ used: number; limit?: number; label: string }> = ({ used, limit = 5 * 1024 * 1024 * 1024, label }) => {
    const pct = Math.min((used / limit) * 100, 100);
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-green-500';
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-600">{label}</span>
                <span className="text-slate-500 font-mono">{formatBytes(used)}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>{pct.toFixed(1)}% 사용됨</span>
                <span>한도 {formatBytes(limit)}</span>
            </div>
        </div>
    );
};

// ─── Admin Page ───────────────────────────────────────────────────────────────

interface AdminPageProps {
    onMenuClick: () => void;
}

type TabId = 'overview' | 'usage' | 'users';

export const AdminPage: React.FC<AdminPageProps> = () => {
    const navigate = useNavigate();
    const { userId, userProfile, refreshProfile } = useUser();

    const [users, setUsers] = React.useState<AdminUserRow[]>([]);
    const [apiStats, setApiStats] = React.useState<ApiStats | null>(null);
    const [dbStats, setDbStats] = React.useState<DbStats | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [filterTier, setFilterTier] = React.useState<'all' | UserTier>('all');
    const [activeTab, setActiveTab] = React.useState<TabId>('overview');

    const isAdmin = userProfile?.role === 'admin';

    const loadAll = React.useCallback(async () => {
        setIsLoading(true);
        const [usersData, apiData, dbData] = await Promise.all([
            adminGetUserStats(),
            adminGetApiStats(),
            adminGetDbStats(),
        ]);
        setUsers(usersData);
        setApiStats(apiData);
        setDbStats(dbData);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        if (!isAdmin) return;
        loadAll();
    }, [isAdmin, loadAll]);

    const handleTierChange = React.useCallback(async (targetUserId: string, tier: UserTier) => {
        setUpdatingId(targetUserId);
        const ok = await adminUpdateProfile(targetUserId, { tier });
        if (ok) {
            setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, tier } : u));
            if (targetUserId === userId) await refreshProfile();
        }
        setUpdatingId(null);
    }, [userId, refreshProfile]);

    const handleRoleChange = React.useCallback(async (targetUserId: string, role: UserRole) => {
        setUpdatingId(targetUserId);
        const ok = await adminUpdateProfile(targetUserId, { role });
        if (ok) setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role } : u));
        setUpdatingId(null);
    }, []);

    // ── Access guard ──────────────────────────────────────────────────────────
    if (!isAdmin && userProfile !== null) {
        return (
            <div className="flex flex-col h-full items-center justify-center bg-slate-50 gap-4 p-8">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                    <ErrorOutlineIcon className="text-3xl text-red-400" />
                </div>
                <div className="text-center">
                    <p className="font-bold text-slate-700">접근 권한이 없습니다</p>
                    <p className="text-sm text-slate-500 mt-1">관리자 권한이 필요한 페이지입니다.</p>
                </div>
                <button type="button" onClick={() => navigate(ROUTES.STUDY)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                    홈으로 돌아가기
                </button>
            </div>
        );
    }

    // ── Derived stats ─────────────────────────────────────────────────────────
    const totalUsers = users.length;
    const freeUsers  = users.filter(u => u.tier === 'free').length;
    const proUsers   = users.filter(u => u.tier === 'pro').length;
    const adminUsers = users.filter(u => u.role === 'admin').length;

    const filteredUsers = users.filter(u => {
        const matchSearch = !search || u.email.toLowerCase().includes(search.toLowerCase());
        const matchTier   = filterTier === 'all' || u.tier === filterTier;
        return matchSearch && matchTier;
    });

    const tabs: Array<{ id: TabId; label: string }> = [
        { id: 'overview', label: '개요' },
        { id: 'usage',    label: 'API · DB 현황' },
        { id: 'users',    label: `사용자 (${totalUsers})` },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
                <div className="h-14 flex items-center gap-3 px-4">
                    <button type="button" onClick={() => navigate(ROUTES.STUDY)}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                        <ChevronLeftIcon className="text-xl" />
                    </button>
                    <AdminPanelIcon className="text-2xl text-orange-500" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">Admin Panel</h1>
                        <p className="text-xs text-slate-400">Clever Monkey 관리자 대시보드</p>
                    </div>
                    <button type="button" onClick={loadAll}
                        className="ml-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="새로고침">
                        <RefreshIcon className="text-xl" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-t border-slate-100">
                    {tabs.map(tab => (
                        <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
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

                    {/* ══ 개요 탭 ═══════════════════════════════════════════ */}
                    {activeTab === 'overview' && (
                        <div className="p-4 max-w-4xl mx-auto w-full space-y-6">
                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">사용자 현황</h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <StatCard icon={PeopleIcon}           label="전체 사용자"  value={totalUsers}  color="text-blue-600"   bg="bg-blue-50" />
                                    <StatCard icon={WorkspacePremiumIcon} label="Pro 사용자"   value={proUsers}    sub={`Free ${freeUsers}명`} color="text-violet-600" bg="bg-violet-50" />
                                    <StatCard icon={DocumentIcon}         label="전체 문서"    value={dbStats?.documentCount ?? '—'} color="text-green-600" bg="bg-green-50" />
                                    <StatCard icon={BoltIcon}             label="오늘 AI 호출" value={apiStats?.totalActionsToday ?? '—'} color="text-orange-600" bg="bg-orange-50" />
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">플랜 분포</h2>
                                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-slate-700">Free</span>
                                            <span className="text-slate-500">{freeUsers}명 ({totalUsers > 0 ? Math.round(freeUsers / totalUsers * 100) : 0}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-2 bg-slate-400 rounded-full" style={{ width: `${totalUsers > 0 ? (freeUsers / totalUsers) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-violet-700">Pro</span>
                                            <span className="text-slate-500">{proUsers}명 ({totalUsers > 0 ? Math.round(proUsers / totalUsers * 100) : 0}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-2 bg-violet-500 rounded-full" style={{ width: `${totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">플랜 정책</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-center gap-2 mb-3"><span className="text-sm font-bold text-slate-700">Free</span><TierBadge tier="free" /></div>
                                        <ul className="space-y-1.5 text-sm text-slate-600">
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />최대 5개 문서</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />하루 20회 AI 기능</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />모든 기능 접근 가능</li>
                                        </ul>
                                    </div>
                                    <div className="bg-white rounded-xl border border-violet-200 p-4">
                                        <div className="flex items-center gap-2 mb-3"><span className="text-sm font-bold text-slate-700">Pro</span><TierBadge tier="pro" /></div>
                                        <ul className="space-y-1.5 text-sm text-slate-600">
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />무제한 문서</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />무제한 AI 기능</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />모든 기능 + 우선 처리</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {adminUsers > 0 && (
                                <section>
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">관리자 ({adminUsers}명)</h2>
                                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                                        {users.filter(u => u.role === 'admin').map(u => (
                                            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                                                    {(u.email[0] ?? '?').toUpperCase()}
                                                </div>
                                                <p className="flex-1 text-sm font-medium text-slate-700 truncate">{u.email}</p>
                                                <TierBadge tier={u.tier} />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {/* ══ API · DB 현황 탭 ══════════════════════════════════ */}
                    {activeTab === 'usage' && (
                        <div className="p-4 max-w-4xl mx-auto w-full space-y-6">

                            {/* ── Gemini API 현황 ── */}
                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <BoltIcon className="text-sm text-orange-500" />
                                    Gemini API 사용현황
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                                    <StatCard icon={BoltIcon}      label="오늘 총 AI 호출"  value={apiStats?.totalActionsToday ?? 0} color="text-orange-600" bg="bg-orange-50" />
                                    <StatCard icon={PeopleIcon}    label="오늘 활성 사용자" value={apiStats?.activeUsersToday ?? 0}  color="text-blue-600"   bg="bg-blue-50" />
                                    <StatCard icon={WarningIcon}   label="한도 근접 사용자"
                                        value={apiStats?.usersNearLimit ?? 0}
                                        sub="Free · 15회 이상"
                                        color="text-orange-600" bg="bg-orange-50"
                                        warn={(apiStats?.usersNearLimit ?? 0) > 0}
                                    />
                                </div>

                                {/* 7-day bar chart */}
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-sm font-semibold text-slate-700">최근 7일 AI 호출 추이</p>
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm" />총 호출</span>
                                        </div>
                                    </div>
                                    {apiStats && apiStats.last7Days.length > 0 ? (
                                        <MiniBarChart data={apiStats.last7Days} />
                                    ) : (
                                        <div className="h-24 flex items-center justify-center text-sm text-slate-400">
                                            데이터가 없습니다 (AI 기능 사용 후 로그가 쌓입니다)
                                        </div>
                                    )}
                                </div>

                                {/* Top users today */}
                                {users.filter(u => u.aiActionsToday > 0).length > 0 && (
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-4">
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <p className="text-sm font-semibold text-slate-700">오늘 상위 AI 사용자</p>
                                        </div>
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">사용자</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">플랜</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">호출</th>
                                                    <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase min-w-[120px]">사용률</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...users]
                                                    .filter(u => u.aiActionsToday > 0)
                                                    .sort((a, b) => b.aiActionsToday - a.aiActionsToday)
                                                    .slice(0, 10)
                                                    .map(u => {
                                                        const pct = u.tier === 'pro' ? 0 : Math.min((u.aiActionsToday / 20) * 100, 100);
                                                        const isNear = u.tier === 'free' && u.aiActionsToday >= 15;
                                                        return (
                                                            <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                                <td className="px-4 py-2.5">
                                                                    <p className="text-sm text-slate-700 truncate max-w-[200px]">{u.email}</p>
                                                                </td>
                                                                <td className="px-4 py-2.5"><TierBadge tier={u.tier} /></td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className={`text-sm font-mono font-bold ${isNear ? 'text-orange-600' : 'text-slate-700'}`}>
                                                                        {u.tier === 'pro' ? `${u.aiActionsToday} ∞` : `${u.aiActionsToday} / 20`}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    {u.tier === 'pro' ? (
                                                                        <span className="text-xs text-violet-600 font-semibold">무제한</span>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                                                                                <div className={`h-1.5 rounded-full ${isNear ? 'bg-orange-500' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                                                                            </div>
                                                                            <span className="text-xs text-slate-400 flex-shrink-0">{Math.round(pct)}%</span>
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
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <StorageIcon className="text-sm text-green-500" />
                                    Supabase DB · 스토리지 현황
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    <StatCard icon={DocumentIcon}   label="총 문서"        value={dbStats?.documentCount ?? '—'}  sub={`오늘 +${dbStats?.docsCreatedToday ?? 0}`} color="text-blue-600"   bg="bg-blue-50" />
                                    <StatCard icon={QuizIcon}       label="퀴즈 세션"       value={dbStats?.quizSessions ?? '—'}   color="text-green-600"  bg="bg-green-50" />
                                    <StatCard icon={ErrorOutlineIcon} label="오답 기록"     value={dbStats?.wrongAnswers ?? '—'}   color="text-red-500"    bg="bg-red-50" />
                                    <StatCard icon={FolderOpenIcon} label="폴더"            value={dbStats?.folders ?? '—'}        color="text-yellow-600" bg="bg-yellow-50" />
                                </div>

                                {/* Storage gauges */}
                                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CloudIcon className="text-slate-500 text-base" />
                                        <p className="text-sm font-semibold text-slate-700">스토리지 사용량</p>
                                    </div>
                                    <StorageGauge
                                        used={dbStats?.storageBytes ?? 0}
                                        label="Supabase Storage (docs 버킷)"
                                        limit={5 * 1024 * 1024 * 1024}
                                    />
                                    <div className="border-t border-slate-100 pt-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                            <div>
                                                <p className="text-lg font-bold text-slate-800">{formatBytes(dbStats?.storageBytes ?? 0)}</p>
                                                <p className="text-xs text-slate-400">스토리지</p>
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-800">{formatBytes(dbStats?.totalFileSizeBytes ?? 0)}</p>
                                                <p className="text-xs text-slate-400">파일 크기 합계</p>
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-800">
                                                    {dbStats && dbStats.documentCount > 0
                                                        ? formatBytes(Math.round(dbStats.totalFileSizeBytes / dbStats.documentCount))
                                                        : '—'}
                                                </p>
                                                <p className="text-xs text-slate-400">문서당 평균</p>
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-800">+{dbStats?.docsCreatedWeek ?? 0}</p>
                                                <p className="text-xs text-slate-400">이번 주 신규</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Table count summary */}
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-4">
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <p className="text-sm font-semibold text-slate-700">테이블별 레코드 수</p>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        {[
                                            { label: 'profiles',      value: totalUsers,                  icon: '👤' },
                                            { label: 'documents',     value: dbStats?.documentCount ?? 0, icon: '📄' },
                                            { label: 'folders',       value: dbStats?.folders ?? 0,       icon: '📁' },
                                            { label: 'quiz_sessions', value: dbStats?.quizSessions ?? 0,  icon: '📝' },
                                            { label: 'wrong_answers', value: dbStats?.wrongAnswers ?? 0,  icon: '❌' },
                                            { label: 'annotations',   value: dbStats?.annotations ?? 0,   icon: '🖊️' },
                                        ].map(row => (
                                            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                                <span className="text-sm text-slate-600 font-mono flex items-center gap-2">
                                                    <span>{row.icon}</span>{row.label}
                                                </span>
                                                <span className="text-sm font-bold text-slate-800 tabular-nums">
                                                    {row.value.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* ── BarChart legend ── */}
                            <p className="text-xs text-slate-400 text-center pb-4">
                                * API 호출 로그는 <code className="bg-slate-100 px-1 rounded">ai_usage_daily_log</code> 테이블에 누적됩니다.
                                Supabase 스토리지 한도는 프리 플랜 기준 500MB입니다.
                            </p>
                        </div>
                    )}

                    {/* ══ 사용자 탭 ═════════════════════════════════════════ */}
                    {activeTab === 'users' && (
                        <div className="p-4 max-w-5xl mx-auto w-full">
                            {/* Filters */}
                            <div className="flex items-center gap-2 mb-4 flex-wrap">
                                <div className="flex-1 min-w-0 relative">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="이메일로 검색..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-400 outline-none bg-white"
                                    />
                                </div>
                                <select
                                    value={filterTier}
                                    onChange={e => setFilterTier(e.target.value as 'all' | UserTier)}
                                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                >
                                    <option value="all">모든 플랜</option>
                                    <option value="free">Free</option>
                                    <option value="pro">Pro</option>
                                </select>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">사용자</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">플랜</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">문서</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[120px]">오늘 AI</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                                                        검색 결과가 없습니다
                                                    </td>
                                                </tr>
                                            ) : filteredUsers.map(user => (
                                                <UserRow
                                                    key={user.id}
                                                    user={user}
                                                    currentUserId={userId}
                                                    onTierChange={handleTierChange}
                                                    onRoleChange={handleRoleChange}
                                                    isUpdating={updatingId === user.id}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredUsers.length > 0 && (
                                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                                        {filteredUsers.length}명 표시 / 전체 {totalUsers}명
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
