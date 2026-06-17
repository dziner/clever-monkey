import * as React from 'react';
import type { AdminUserRow } from '../services/profileService';
import type { UserTier, UserRole, UserAccountStatus } from '../types';
import { BlockIcon, KeyIcon, RefreshIcon, StarIcon, TrashIcon } from './icons';
import { Spinner } from './Spinner';

// Presentational pieces for the admin Users tab. Split out of AdminPage
// because they're self-contained (no internal state, no AdminPage-specific
// deps) and used together but composable individually.

export const TierBadge: React.FC<{ tier: UserTier }> = ({ tier }) =>
    tier === 'pro' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full text-xs font-bold">
            <StarIcon className="text-xs" /> Pro
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ink-100 text-ink-700 border border-ink-200 rounded-full text-xs font-semibold">
            Free
        </span>
    );

export const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) =>
    role === 'admin' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-100 text-warning-700 border border-warning-200 rounded-full text-xs font-bold">
            <KeyIcon className="text-xs" /> Admin
        </span>
    ) : null;

export const AccountStatusBadge: React.FC<{ status: UserAccountStatus; restoreUntil?: string | null }> = ({
    status,
    restoreUntil,
}) => {
    if (status === 'inactive') {
        const daysLeft = getRestoreDaysLeft(restoreUntil);
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-50 text-warning-700 border border-warning-100 rounded-full text-xs font-bold">
                <BlockIcon className="text-xs" />
                삭제 대기{daysLeft !== null ? ` · ${daysLeft}일` : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-50 text-success-700 border border-success-100 rounded-full text-xs font-bold">
            활성
        </span>
    );
};

function getRestoreDaysLeft(restoreUntil?: string | null): number | null {
    if (!restoreUntil) return null;
    const deadline = new Date(restoreUntil).getTime();
    if (!Number.isFinite(deadline)) return null;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 86_400_000));
}

function formatDate(value?: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('ko-KR');
}

const selectClassName =
    'h-9 min-w-[104px] rounded-lg border border-ink-200 bg-white px-2.5 text-sm font-semibold text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 disabled:bg-ink-50 disabled:text-ink-400 disabled:cursor-not-allowed';

interface UserRowProps {
    user: AdminUserRow;
    currentUserId: string | null;
    onTierChange: (userId: string, tier: UserTier) => void;
    onRoleChange: (userId: string, role: UserRole) => void;
    onDeactivateUser: (user: AdminUserRow) => void;
    onRestoreUser: (user: AdminUserRow) => void;
    isUpdating: boolean;
}

export const UserRow: React.FC<UserRowProps> = ({
    user,
    currentUserId,
    onTierChange,
    onRoleChange,
    onDeactivateUser,
    onRestoreUser,
    isUpdating,
}) => {
    const isMe = user.id === currentUserId;
    const isInactive = user.accountStatus === 'inactive';
    const aiPct = Math.min(Math.round((user.aiActionsToday / 20) * 100), 100);
    const isNearLimit = user.tier === 'free' && user.aiActionsToday >= 15;

    return (
        <tr className={`border-b border-ink-100 transition-colors ${isInactive ? 'bg-warning-50/30 hover:bg-warning-50/50' : 'hover:bg-ink-50/50'}`}>
            <td className="px-4 py-3 min-w-0">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isInactive ? 'bg-warning-100 text-warning-700' : 'bg-brand-100 text-brand-700'
                    }`}>
                        {(user.email[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-800 truncate max-w-[220px]" title={user.email}>
                            {user.email}
                            {isMe && <span className="ml-1.5 text-xs text-brand-600 font-semibold">(나)</span>}
                        </p>
                        <p className="text-xs text-ink-400">
                            {isInactive
                                ? `${formatDate(user.deactivatedAt)} 삭제 처리`
                                : `${formatDate(user.createdAt)} 가입`}
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <AccountStatusBadge status={user.accountStatus} restoreUntil={user.restoreUntil} />
                {isInactive && (
                    <p className="mt-1 text-[11px] text-ink-400 whitespace-nowrap">
                        복구 기한 {formatDate(user.restoreUntil)}
                    </p>
                )}
            </td>
            <td className="px-4 py-3">
                <select
                    value={user.tier}
                    onChange={e => onTierChange(user.id, e.target.value as UserTier)}
                    disabled={isUpdating || isInactive}
                    className={selectClassName}
                    aria-label={`${user.email} 요금제`}
                >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                </select>
            </td>
            <td className="px-4 py-3">
                <select
                    value={user.role}
                    onChange={e => onRoleChange(user.id, e.target.value as UserRole)}
                    disabled={isUpdating || isInactive || isMe}
                    className={selectClassName}
                    aria-label={`${user.email} 권한`}
                    title={isMe ? '본인 권한은 다른 관리자 계정에서 변경하세요' : undefined}
                >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </td>
            <td className="px-4 py-3 text-sm text-ink-700 tabular-nums">{user.documentCount}</td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2 min-w-[80px]">
                    <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div
                            className={`h-1.5 rounded-full transition-all ${isNearLimit ? 'bg-orange-500' : 'bg-brand-400'}`}
                            style={{ width: `${user.tier === 'pro' ? 0 : aiPct}%` }}
                        />
                    </div>
                    <span className={`text-xs font-mono tabular-nums flex-shrink-0 ${isNearLimit ? 'text-warning-600 font-bold' : 'text-ink-500'}`}>
                        {user.tier === 'pro' ? '∞' : `${user.aiActionsToday}`}
                    </span>
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center justify-end min-w-[112px]">
                    {isUpdating ? (
                        <Spinner />
                    ) : isInactive ? (
                        <button
                            type="button"
                            onClick={() => onRestoreUser(user)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-success-100 bg-success-50 px-3 text-xs font-bold text-success-700 hover:bg-success-100 transition-colors"
                        >
                            <RefreshIcon className="text-sm" /> 복구
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onDeactivateUser(user)}
                            disabled={isMe}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger-100 bg-danger-50 px-3 text-xs font-bold text-danger-600 hover:bg-danger-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-danger-50"
                            title={isMe ? '본인 계정은 삭제 처리할 수 없습니다' : '계정을 inactive 상태로 전환합니다'}
                        >
                            <TrashIcon className="text-sm" /> 삭제 처리
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
};
