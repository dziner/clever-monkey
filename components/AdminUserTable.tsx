import * as React from 'react';
import type { AdminUserRow } from '../services/profileService';
import type { UserTier, UserRole } from '../types';
import { KeyIcon, StarIcon } from './icons';
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

interface UserRowProps {
    user: AdminUserRow;
    currentUserId: string | null;
    onTierChange: (userId: string, tier: UserTier) => void;
    onRoleChange: (userId: string, role: UserRole) => void;
    isUpdating: boolean;
}

export const UserRow: React.FC<UserRowProps> = ({ user, currentUserId, onTierChange, onRoleChange, isUpdating }) => {
    const isMe = user.id === currentUserId;
    const aiPct = Math.min(Math.round((user.aiActionsToday / 20) * 100), 100);
    const isNearLimit = user.tier === 'free' && user.aiActionsToday >= 15;

    return (
        <tr className="border-b border-ink-100 hover:bg-ink-50/50 transition-colors">
            <td className="px-4 py-3 min-w-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                        {(user.email[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-800 truncate max-w-[200px]" title={user.email}>
                            {user.email}
                            {isMe && <span className="ml-1.5 text-xs text-brand-600 font-semibold">(나)</span>}
                        </p>
                        <p className="text-xs text-ink-400">
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
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-ink-700 bg-ink-100 border border-ink-200 rounded-lg hover:bg-ink-200 transition-colors">
                                    Free
                                </button>
                            )}
                            {!isMe && (
                                user.role === 'admin' ? (
                                    <button type="button" onClick={() => onRoleChange(user.id, 'user')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-danger-600 bg-danger-50 border border-danger-200 rounded-lg hover:bg-danger-100 transition-colors">
                                        Admin 해제
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => onRoleChange(user.id, 'admin')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-warning-700 bg-warning-50 border border-warning-200 rounded-lg hover:bg-warning-100 transition-colors">
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
