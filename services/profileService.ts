import { supabase } from './supabaseClient';
import type { UserProfile, UserTier, UserRole } from '../types';

function mapRow(d: Record<string, unknown>): UserProfile {
    return {
        id: d.id as string,
        email: d.email as string,
        role: d.role as UserRole,
        tier: d.tier as UserTier,
        tierExpiresAt: (d.tier_expires_at as string | null) ?? null,
        aiActionsToday: (d.ai_actions_today as number) ?? 0,
        aiActionsDate: d.ai_actions_date as string,
        createdAt: d.created_at as string,
    };
}

export async function getMyProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, tier, tier_expires_at, ai_actions_today, ai_actions_date, created_at')
        .eq('id', user.id)
        .single();

    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
}

export async function upsertMyProfile(userId: string, email: string): Promise<void> {
    await supabase
        .from('profiles')
        .upsert({ id: userId, email }, { onConflict: 'id' });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminUserRow extends UserProfile {
    documentCount: number;
}

export async function adminGetUserStats(): Promise<AdminUserRow[]> {
    const { data, error } = await supabase.rpc('admin_get_user_stats');
    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map(d => ({
        ...mapRow(d),
        documentCount: (d.document_count as number) ?? 0,
    }));
}

export async function adminUpdateProfile(
    userId: string,
    updates: { tier?: UserTier; role?: UserRole }
): Promise<boolean> {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
    return !error;
}
