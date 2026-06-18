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
        stripeCustomerId: (d.stripe_customer_id as string | null) ?? null,
        stripeSubscriptionId: (d.stripe_subscription_id as string | null) ?? null,
        stripeSubscriptionStatus: (d.stripe_subscription_status as string | null) ?? null,
        stripePriceId: (d.stripe_price_id as string | null) ?? null,
        stripeCurrentPeriodEnd: (d.stripe_current_period_end as string | null) ?? null,
        stripeCancelAtPeriodEnd: (d.stripe_cancel_at_period_end as boolean | null) ?? false,
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
