import { supabase } from './supabaseClient';
import type { UserProfile, UserTier, UserRole } from '../types';

function mapRow(d: Record<string, unknown>): UserProfile {
    return {
        id: d.id as string,
        email: d.email as string,
        displayName: (d.display_name as string | null) ?? null,
        role: d.role as UserRole,
        tier: d.tier as UserTier,
        tierExpiresAt: (d.tier_expires_at as string | null) ?? null,
        aiActionsToday: (d.ai_actions_today as number) ?? 0,
        aiActionsDate: d.ai_actions_date as string,
        createdAt: d.created_at as string,
        language: (d.language as string | null) ?? null,
    };
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
        .select('id, email, display_name, role, tier, tier_expires_at, ai_actions_today, ai_actions_date, created_at, language')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[profile] select failed for uid', user.id, ':', error);
        return null;
    }
    if (!data) {
        console.warn('[profile] no profile row for uid', user.id, '(email:', user.email, ')');
        return null;
    }
    return mapRow(data as Record<string, unknown>);
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

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export interface ApiDayUsage {
    date: string;
    totalActions: number;
    activeUsers: number;
}

export interface ApiStats {
    totalActionsToday: number;
    activeUsersToday: number;
    usersNearLimit: number;
    last7Days: ApiDayUsage[];
}

export interface DbStats {
    documentCount: number;
    totalFileSizeBytes: number;
    storageBytes: number;
    quizSessions: number;
    wrongAnswers: number;
    folders: number;
    annotations: number;
    docsCreatedToday: number;
    docsCreatedWeek: number;
}

export async function adminGetApiStats(): Promise<ApiStats | null> {
    const { data, error } = await supabase.rpc('admin_get_api_stats');
    if (error || !data) return null;
    const d = data as {
        total_actions_today: number;
        active_users_today: number;
        users_near_limit: number;
        last_7_days: Array<{ date: string; total_actions: number; active_users: number }>;
    };
    return {
        totalActionsToday: d.total_actions_today ?? 0,
        activeUsersToday: d.active_users_today ?? 0,
        usersNearLimit: d.users_near_limit ?? 0,
        last7Days: (d.last_7_days ?? []).map(day => ({
            date: day.date,
            totalActions: day.total_actions,
            activeUsers: day.active_users,
        })),
    };
}

export async function adminGetDbStats(): Promise<DbStats | null> {
    const { data, error } = await supabase.rpc('admin_get_db_stats');
    if (error || !data) return null;
    const d = data as Record<string, number>;
    return {
        documentCount: d.document_count ?? 0,
        totalFileSizeBytes: d.total_file_size_bytes ?? 0,
        storageBytes: d.storage_bytes ?? 0,
        quizSessions: d.quiz_sessions ?? 0,
        wrongAnswers: d.wrong_answers ?? 0,
        folders: d.folders ?? 0,
        annotations: d.annotations ?? 0,
        docsCreatedToday: d.docs_created_today ?? 0,
        docsCreatedWeek: d.docs_created_week ?? 0,
    };
}
