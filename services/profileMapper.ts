import type { UserProfile, UserTier, UserRole, UserAccountStatus } from '../types';

function asAccountStatus(value: unknown): UserAccountStatus {
    return value === 'inactive' ? 'inactive' : 'active';
}

export function mapProfileRow(d: Record<string, unknown>): UserProfile {
    return {
        id: d.id as string,
        email: d.email as string,
        displayName: (d.display_name as string | null) ?? null,
        role: d.role as UserRole,
        tier: d.tier as UserTier,
        tierExpiresAt: (d.tier_expires_at as string | null) ?? null,
        accountStatus: asAccountStatus(d.account_status),
        deactivatedAt: (d.deactivated_at as string | null) ?? null,
        deactivatedBy: (d.deactivated_by as string | null) ?? null,
        deactivationReason: (d.deactivation_reason as string | null) ?? null,
        restoreUntil: (d.restore_until as string | null) ?? null,
        aiActionsToday: (d.ai_actions_today as number) ?? 0,
        aiActionsDate: d.ai_actions_date as string,
        createdAt: d.created_at as string,
        language: (d.language as string | null) ?? null,
    };
}
