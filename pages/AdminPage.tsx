import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { adminGetUserStats, adminUpdateProfile, type AdminUserRow } from '../services/profileService';
import {
    AdminPanelIcon, PeopleIcon, WorkspacePremiumIcon, DocumentIcon, BoltIcon,
    ChevronLeftIcon, SearchIcon, RefreshIcon, CheckIcon, StarIcon, TrashIcon,
    ErrorOutlineIcon, KeyIcon,
} from '../components/icons';
import { Spinner } from '../components/Spinner';
import { ROUTES } from '../routes';
import type { UserTier, UserRole } from '../types';

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
    icon: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    label: string;
    value: number | string;
    sub?: string;
    color: string;
    bg: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sub, color, bg }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
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

// ─── Tier Badge ───────────────────────────────────────────────────────────────

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

// ─── User Row Actions ─────────────────────────────────────────────────────────

interface UserRowProps {
    user: AdminUserRow;
    currentUserId: string | null;
    onTierChange: (userId: string, tier: UserTier) => void;
    onRoleChange: (userId: string, role: UserRole) => void;
    isUpdating: boolean;
}

const UserRow: React.FC<UserRowProps> = ({ user, currentUserId, onTierChange, onRoleChange, isUpdating }) => {
    const isMe = user.id === currentUserId;

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
            <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
                {user.documentCount}
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                    <span className="text-sm font-mono text-slate-700">{user.aiActionsToday}</span>
                    <span className="text-xs text-slate-400">/ 20</span>
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {isUpdating ? (
                        <Spinner />
                    ) : (
                        <>
                            {/* Tier toggle */}
                            {user.tier === 'free' ? (
                                <button
                                    type="button"
                                    onClick={() => onTierChange(user.id, 'pro')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
                                    title="Pro로 업그레이드"
                                >
                                    <StarIcon className="text-xs" /> Pro 설정
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onTierChange(user.id, 'free')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                                    title="Free로 다운그레이드"
                                >
                                    <TrashIcon className="text-xs" /> Free 설정
                                </button>
                            )}
                            {/* Admin toggle (can't demote yourself) */}
                            {!isMe && (
                                user.role === 'admin' ? (
                                    <button
                                        type="button"
                                        onClick={() => onRoleChange(user.id, 'user')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                        title="관리자 권한 제거"
                                    >
                                        <ErrorOutlineIcon className="text-xs" /> Admin 해제
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onRoleChange(user.id, 'admin')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                                        title="관리자 권한 부여"
                                    >
                                        <KeyIcon className="text-xs" /> Admin 설정
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

// ─── Admin Page ───────────────────────────────────────────────────────────────

interface AdminPageProps {
    onMenuClick: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = () => {
    const navigate = useNavigate();
    const { userId, userProfile, refreshProfile } = useUser();

    const [users, setUsers] = React.useState<AdminUserRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [filterTier, setFilterTier] = React.useState<'all' | UserTier>('all');
    const [activeTab, setActiveTab] = React.useState<'overview' | 'users'>('overview');

    const isAdmin = userProfile?.role === 'admin';

    const loadUsers = React.useCallback(async () => {
        setIsLoading(true);
        const data = await adminGetUserStats();
        setUsers(data);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        if (!isAdmin) return;
        loadUsers();
    }, [isAdmin, loadUsers]);

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
        if (ok) {
            setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role } : u));
        }
        setUpdatingId(null);
    }, []);

    // Redirect non-admins
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
                <button
                    type="button"
                    onClick={() => navigate(ROUTES.STUDY)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
                >
                    홈으로 돌아가기
                </button>
            </div>
        );
    }

    // Derived stats
    const totalUsers = users.length;
    const freeUsers = users.filter(u => u.tier === 'free').length;
    const proUsers = users.filter(u => u.tier === 'pro').length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const totalDocs = users.reduce((sum, u) => sum + u.documentCount, 0);
    const totalAiToday = users.reduce((sum, u) => sum + u.aiActionsToday, 0);

    // Filtered users
    const filteredUsers = users.filter(u => {
        const matchesSearch = !search || u.email.toLowerCase().includes(search.toLowerCase());
        const matchesTier = filterTier === 'all' || u.tier === filterTier;
        return matchesSearch && matchesTier;
    });

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
                <div className="h-14 flex items-center gap-3 px-4">
                    <button
                        type="button"
                        onClick={() => navigate(ROUTES.STUDY)}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        aria-label="뒤로 가기"
                    >
                        <ChevronLeftIcon className="text-xl" />
                    </button>
                    <AdminPanelIcon className="text-2xl text-orange-500" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">Admin Panel</h1>
                        <p className="text-xs text-slate-400">Clever Monkey 관리자 대시보드</p>
                    </div>
                    <button
                        type="button"
                        onClick={loadUsers}
                        className="ml-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="새로고침"
                    >
                        <RefreshIcon className="text-xl" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-t border-slate-100">
                    {([
                        { id: 'overview', label: '개요' },
                        { id: 'users',    label: `사용자 (${totalUsers})` },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 max-w-[160px] py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Spinner />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* ── Overview Tab ─────────────────────────────────── */}
                    {activeTab === 'overview' && (
                        <div className="p-4 max-w-4xl mx-auto w-full space-y-6">
                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">사용자 현황</h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <StatCard icon={PeopleIcon}           label="전체 사용자"   value={totalUsers}  color="text-blue-600"   bg="bg-blue-50" />
                                    <StatCard icon={WorkspacePremiumIcon} label="Pro 사용자"    value={proUsers}    sub={`Free: ${freeUsers}명`} color="text-violet-600" bg="bg-violet-50" />
                                    <StatCard icon={DocumentIcon}         label="전체 문서"     value={totalDocs}   color="text-green-600"  bg="bg-green-50" />
                                    <StatCard icon={BoltIcon}             label="오늘 AI 호출"  value={totalAiToday} color="text-orange-600" bg="bg-orange-50" />
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">플랜 분포</h2>
                                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                                    {totalUsers > 0 ? (
                                        <>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-semibold text-slate-700">Free</span>
                                                    <span className="text-slate-500">{freeUsers}명 ({totalUsers > 0 ? Math.round(freeUsers / totalUsers * 100) : 0}%)</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-2 bg-slate-400 rounded-full transition-all" style={{ width: `${totalUsers > 0 ? (freeUsers / totalUsers) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-semibold text-violet-700">Pro</span>
                                                    <span className="text-slate-500">{proUsers}명 ({totalUsers > 0 ? Math.round(proUsers / totalUsers * 100) : 0}%)</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-2 bg-violet-500 rounded-full transition-all" style={{ width: `${totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-slate-400 text-center py-4">사용자 데이터 없음</p>
                                    )}
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">플랜 정책</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Free tier */}
                                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-sm font-bold text-slate-700">Free 플랜</span>
                                            <TierBadge tier="free" />
                                        </div>
                                        <ul className="space-y-1.5 text-sm text-slate-600">
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />최대 5개 문서</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />하루 20회 AI 기능</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />모든 기능 접근 가능</li>
                                        </ul>
                                    </div>
                                    {/* Pro tier */}
                                    <div className="bg-white rounded-xl border border-violet-200 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-sm font-bold text-slate-700">Pro 플랜</span>
                                            <TierBadge tier="pro" />
                                        </div>
                                        <ul className="space-y-1.5 text-sm text-slate-600">
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />무제한 문서</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />무제한 AI 기능</li>
                                            <li className="flex items-center gap-2"><CheckIcon className="text-green-500 text-sm" />모든 기능 + 우선 처리</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">관리자 ({adminUsers}명)</h2>
                                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                                    {users.filter(u => u.role === 'admin').length === 0 ? (
                                        <p className="text-sm text-slate-400 p-4 text-center">관리자가 없습니다</p>
                                    ) : (
                                        users.filter(u => u.role === 'admin').map(u => (
                                            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                                                    {(u.email[0] ?? '?').toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">{u.email}</p>
                                                </div>
                                                <TierBadge tier={u.tier} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* ── Users Tab ────────────────────────────────────── */}
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

                            {/* Table */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">사용자</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">플랜 / 역할</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">문서</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">오늘 AI</th>
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
                                            ) : (
                                                filteredUsers.map(user => (
                                                    <UserRow
                                                        key={user.id}
                                                        user={user}
                                                        currentUserId={userId}
                                                        onTierChange={handleTierChange}
                                                        onRoleChange={handleRoleChange}
                                                        isUpdating={updatingId === user.id}
                                                    />
                                                ))
                                            )}
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
