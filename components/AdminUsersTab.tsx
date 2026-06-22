import * as React from 'react';
import type { AdminUserRow } from '../services/adminService';
import type { UserRole, UserTier } from '../types';
import {
    AdminPanelIcon,
    PeopleIcon,
    SearchIcon,
    WarningIcon,
    WorkspacePremiumIcon,
} from './icons';
import { UserRow } from './AdminUserTable';
import { AdminStatCard } from './AdminStatCard';
import { getUserStats } from '../utils/adminStats';

interface AdminUsersTabProps {
    users: AdminUserRow[];
    currentUserId: string | null;
    updatingId: string | null;
    accountActionError: string | null;
    onTierChange: (userId: string, tier: UserTier) => void;
    onRoleChange: (userId: string, role: UserRole) => void;
    onDeactivateUser: (user: AdminUserRow) => void;
    onRestoreUser: (user: AdminUserRow) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
    users,
    currentUserId,
    updatingId,
    accountActionError,
    onTierChange,
    onRoleChange,
    onDeactivateUser,
    onRestoreUser,
}) => {
    const [search, setSearch] = React.useState('');
    const [filterTier, setFilterTier] = React.useState<'all' | UserTier>('all');

    const activeUsers = React.useMemo(
        () => users.filter(u => u.accountStatus !== 'inactive'),
        [users],
    );
    const inactiveUsers = React.useMemo(
        () => users.filter(u => u.accountStatus === 'inactive'),
        [users],
    );
    const { totalUsers, proUsers, adminUsers } = React.useMemo(
        () => getUserStats(activeUsers),
        [activeUsers],
    );
    const inactiveUserCount = inactiveUsers.length;

    const filterUser = React.useCallback((u: AdminUserRow) => {
        const matchSearch = !search || u.email.toLowerCase().includes(search.toLowerCase());
        const matchTier = filterTier === 'all' || u.tier === filterTier;
        return matchSearch && matchTier;
    }, [filterTier, search]);

    const filteredActiveUsers = activeUsers.filter(filterUser);
    const filteredInactiveUsers = inactiveUsers.filter(filterUser);

    const renderRows = (rows: AdminUserRow[], emptyText: string) => (
        <tbody>
            {rows.length === 0 ? (
                <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-400">
                        {emptyText}
                    </td>
                </tr>
            ) : rows.map(user => (
                <UserRow
                    key={user.id}
                    user={user}
                    currentUserId={currentUserId}
                    onTierChange={onTierChange}
                    onRoleChange={onRoleChange}
                    onDeactivateUser={onDeactivateUser}
                    onRestoreUser={onRestoreUser}
                    isUpdating={updatingId === user.id}
                />
            ))}
        </tbody>
    );

    const tableHead = (
        <thead>
            <tr className="bg-ink-50 border-b border-ink-200">
                <th className="px-4 py-3 text-xs font-bold text-ink-500 uppercase tracking-wider">사용자</th>
                <th className="px-4 py-3 text-xs font-bold text-ink-500 uppercase tracking-wider">상태</th>
                <th className="px-4 py-3 text-xs font-bold text-ink-500 uppercase tracking-wider">요금제</th>
                <th className="px-4 py-3 text-xs font-bold text-ink-500 uppercase tracking-wider">권한</th>
                <th className="px-4 py-3 text-xs font-bold text-ink-500 uppercase tracking-wider">문서</th>
                <th className="px-4 py-3 text-xs font-bold text-ink-500 uppercase tracking-wider min-w-[120px]">오늘 AI</th>
                <th className="px-4 py-3 text-xs font-bold text-ink-500 uppercase tracking-wider text-right">작업</th>
            </tr>
        </thead>
    );

    return (
        <div className="p-4 max-w-6xl mx-auto w-full space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <AdminStatCard icon={PeopleIcon} label="활성 사용자" value={totalUsers} color="text-brand-600" bg="bg-brand-50" />
                <AdminStatCard icon={WorkspacePremiumIcon} label="Pro" value={proUsers} color="text-violet-600" bg="bg-violet-50" />
                <AdminStatCard icon={AdminPanelIcon} label="관리자" value={adminUsers} color="text-warning-600" bg="bg-warning-50" />
                <AdminStatCard icon={WarningIcon} label="삭제 대기" value={inactiveUserCount} sub="만료 후 수동 검토" color="text-warning-600" bg="bg-warning-50" warn={inactiveUserCount > 0} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-0 relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-base pointer-events-none" />
                    <input
                        type="text"
                        placeholder="이메일로 검색..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 bg-white"
                    />
                </div>
                <select
                    value={filterTier}
                    onChange={e => setFilterTier(e.target.value as 'all' | UserTier)}
                    className="text-sm border border-ink-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                >
                    <option value="all">모든 플랜</option>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                </select>
            </div>

            {accountActionError && (
                <div className="bg-danger-50 border border-danger-500/30 rounded-xl p-4 text-sm">
                    <p className="font-bold text-danger-600">계정 상태 변경 실패</p>
                    <p className="mt-1 font-mono text-xs text-ink-600 break-all">{accountActionError}</p>
                    <p className="mt-2 text-xs text-ink-500">
                        관리자 권한, Netlify <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>, 또는 Supabase admin migration 상태를 확인하세요.
                    </p>
                </div>
            )}

            <section className="bg-white rounded-xl border border-ink-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-ink-800">활성 계정</h2>
                        <p className="text-xs text-ink-400">요금제, 권한, 삭제 처리를 명시적으로 관리합니다.</p>
                    </div>
                    <span className="text-xs font-semibold text-ink-500">
                        {filteredActiveUsers.length}명 표시 / 활성 {totalUsers}명
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        {tableHead}
                        {renderRows(filteredActiveUsers, '활성 계정 검색 결과가 없습니다')}
                    </table>
                </div>
            </section>

            <section className="bg-white rounded-xl border border-warning-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-warning-100 flex items-center justify-between gap-3 bg-warning-50/40">
                    <div>
                        <h2 className="text-sm font-bold text-ink-800">삭제된 계정</h2>
                        <p className="text-xs text-ink-500">inactive 상태로 보관되며 30일 내 복구할 수 있습니다. 만료 후에는 자동 삭제 없이 수동 검토가 필요합니다.</p>
                    </div>
                    <span className="text-xs font-semibold text-warning-700">
                        {filteredInactiveUsers.length}명 표시 / 삭제 대기 {inactiveUserCount}명
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        {tableHead}
                        {renderRows(filteredInactiveUsers, '삭제된 계정이 없습니다')}
                    </table>
                </div>
            </section>
        </div>
    );
};
