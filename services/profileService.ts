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
