import { supabase } from './supabaseClient';
import { mapProfileRow } from './profileMapper';
import type { UserProfile } from '../types';

const PROFILE_COLUMNS =
    'id, email, display_name, role, tier, tier_expires_at, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_price_id, stripe_current_period_end, stripe_cancel_at_period_end, account_status, deactivated_at, deactivated_by, deactivation_reason, restore_until, ai_actions_today, ai_actions_date, created_at, language';

const LEGACY_PROFILE_COLUMNS =
    'id, email, display_name, role, tier, tier_expires_at, ai_actions_today, ai_actions_date, created_at, language';

function isMissingProfileColumn(error: unknown): boolean {
    const e = error as { code?: string; message?: string } | null;
    const msg = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase();
    return msg.includes('42703') || msg.includes('account_status') || msg.includes('restore_until') || msg.includes('stripe_');
}

export async function getMyProfile(): Promise<UserProfile | null> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
        console.error('[profile] getUser failed:', authError);
        return null;
    }
    if (!user) {
        console.warn('[profile] getUser returned no user');
        return null;
    }

    const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        if (isMissingProfileColumn(error)) {
            const { data: legacyData, error: legacyError } = await supabase
                .from('profiles')
                .select(LEGACY_PROFILE_COLUMNS)
                .eq('id', user.id)
                .maybeSingle();
            if (!legacyError && legacyData) return mapProfileRow(legacyData as Record<string, unknown>);
            if (legacyError) console.error('[profile] legacy select failed for uid', user.id, ':', legacyError);
        }
        console.error('[profile] select failed for uid', user.id, ':', error);
        return null;
    }
    if (!data) {
        console.warn('[profile] no profile row for uid', user.id, '(email:', user.email, ')');
        return null;
    }
    return mapProfileRow(data as Record<string, unknown>);
}

export async function upsertMyProfile(userId: string, email: string): Promise<{ error: unknown }> {
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, email }, { onConflict: 'id' });
    if (error) console.error('Failed to upsert profile:', error);
    return { error };
}

/**
 * Guarantee a profile row exists for the signed-in user, then return it.
 * Self-heals the case where the signup trigger never created a row (or
 * the row was deleted): inserts {id,email} and re-reads. Returns null
 * only if the user isn't signed in or the insert is genuinely rejected
 * (which is logged so the real cause is visible).
 */
export async function ensureMyProfile(): Promise<UserProfile | null> {
    const existing = await getMyProfile();
    if (existing) return existing;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.warn('[profile] ensureMyProfile: no signed-in user');
        return null;
    }

    console.info('[profile] no row for uid', user.id, '— creating one');
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email ?? '' }, { onConflict: 'id' });
    if (error) {
        console.error('[profile] failed to create profile row for uid', user.id, ':', error);
        return null;
    }
    return await getMyProfile();
}

export async function updateMyDisplayName(displayName: string): Promise<boolean> {
    const trimmed = displayName.trim();
    if (!trimmed) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', user.id);
    if (error) {
        console.error('Failed to update display name:', error);
        return false;
    }
    return true;
}

export async function updateMyLanguage(language: string | null): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const value = !language || language === 'auto' ? null : language;
    const { error } = await supabase
        .from('profiles')
        .update({ language: value })
        .eq('id', user.id);
    if (error) {
        console.error('Failed to update language:', error);
        return false;
    }
    return true;
}
