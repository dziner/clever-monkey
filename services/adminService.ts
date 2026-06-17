import { supabase } from './supabaseClient';
import { mapProfileRow } from './profileMapper';
import type { UserProfile, UserTier, UserRole } from '../types';

export interface AdminUserRow extends UserProfile {
    documentCount: number;
}

export async function adminGetUserStats(): Promise<{ rows: AdminUserRow[]; error: string | null }> {
    const { data, error } = await supabase.rpc('admin_get_user_stats');
    if (error) {
        console.error('[admin] admin_get_user_stats failed:', error);
        return { rows: [], error: error.message };
    }
    if (!data) return { rows: [], error: null };

    const rows = (data as Record<string, unknown>[]).map(d => ({
        ...mapProfileRow(d),
        documentCount: (d.document_count as number) ?? 0,
    }));
    return { rows, error: null };
}

export async function adminUpdateProfile(
    userId: string,
    updates: { tier?: UserTier; role?: UserRole }
): Promise<boolean> {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
    if (error) console.error('[admin] adminUpdateProfile failed:', error);
    return !error;
}

export interface AdminAccountActionResult {
    ok: boolean;
    error: string | null;
}

export async function adminDeactivateUser(
    userId: string,
    reason: string = 'admin_soft_delete'
): Promise<AdminAccountActionResult> {
    const { error } = await supabase.rpc('admin_soft_delete_user', {
        p_user_id: userId,
        p_reason: reason,
    });
    if (error) {
        console.error('[admin] admin_soft_delete_user failed:', error);
        return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
}

export async function adminRestoreUser(userId: string): Promise<AdminAccountActionResult> {
    const { error } = await supabase.rpc('admin_restore_user', { p_user_id: userId });
    if (error) {
        console.error('[admin] admin_restore_user failed:', error);
        return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
}

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

export interface ApiCategoryUsage {
    apiCategory: string;
    model: string;
    callCount: number;
    /** Real upstream refusals: the ground-truth "near the ceiling" signal. */
    rateRejects: number;
    quotaRejects: number;
    overloadCount: number;
}

export interface KeyMeta {
    geminiKeyCount: number;
    groqEnabled: boolean;
    cerebrasEnabled: boolean;
}

/**
 * How many Gemini keys are in the rotation pool + whether Groq/Cerebras
 * are configured. Counts only: key values never leave the server.
 */
export async function fetchKeyMeta(): Promise<KeyMeta | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return null;
        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'keyMeta' }),
        });
        if (!res.ok) return null;
        const d = await res.json() as { geminiKeyCount?: number; groqEnabled?: boolean; cerebrasEnabled?: boolean };
        return {
            geminiKeyCount: d.geminiKeyCount ?? 1,
            groqEnabled: Boolean(d.groqEnabled),
            cerebrasEnabled: Boolean(d.cerebrasEnabled),
        };
    } catch {
        return null;
    }
}

export interface ApiCategoryStats {
    today: ApiCategoryUsage[];
    week: ApiCategoryUsage[];
}

/**
 * Per-feature AI usage (chat / podcast_tts / extract_storage / quiz / ...)
 * for today and the rolling 7-day window.
 */
export async function adminGetApiCategoryStats(): Promise<ApiCategoryStats | null> {
    const { data, error } = await supabase.rpc('admin_get_api_category_stats');
    if (error) console.error('[admin] admin_get_api_category_stats failed:', error);
    if (error || !data) return null;
    type Row = {
        api_category: string; model: string; call_count: number;
        rate_rejects?: number; quota_rejects?: number; overload_count?: number;
    };
    const d = data as { today: Row[]; week: Row[] };
    const norm = (row: Row): ApiCategoryUsage => ({
        apiCategory:   row.api_category ?? 'other',
        model:         row.model ?? '',
        callCount:     row.call_count ?? 0,
        rateRejects:   row.rate_rejects ?? 0,
        quotaRejects:  row.quota_rejects ?? 0,
        overloadCount: row.overload_count ?? 0,
    });
    return {
        today: (d.today ?? []).map(norm),
        week:  (d.week  ?? []).map(norm),
    };
}

export async function adminGetApiStats(): Promise<ApiStats | null> {
    const { data, error } = await supabase.rpc('admin_get_api_stats');
    if (error) console.error('[admin] admin_get_api_stats failed:', error);
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
    if (error) console.error('[admin] admin_get_db_stats failed:', error);
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

export interface AdminErrorRow {
    id: string;
    createdAt: string;
    severity: 'error' | 'warn';
    stage: string;
    message: string;
    errorStatus: number | null;
    errorName: string | null;
    errorMessage: string | null;
    fileName: string | null;
    fileSize: number | null;
    model: string | null;
    isGuest: boolean;
    userEmail: string | null;
    context: Record<string, unknown> | null;
}

function normalizeAdminErrorRow(r: Record<string, unknown>): AdminErrorRow {
    return {
        id: String(r.id),
        createdAt: r.created_at as string,
        severity: r.severity === 'warn' ? 'warn' : 'error',
        stage: (r.stage as string) ?? '',
        message: (r.message as string) ?? '',
        errorStatus: (r.error_status as number | null) ?? null,
        errorName: (r.error_name as string | null) ?? null,
        errorMessage: (r.error_message as string | null) ?? null,
        fileName: (r.file_name as string | null) ?? null,
        fileSize: (r.file_size as number | null) ?? null,
        model: (r.model as string | null) ?? null,
        isGuest: Boolean(r.is_guest),
        userEmail: (r.user_email as string | null) ?? null,
        context: (r.context as Record<string, unknown> | null) ?? null,
    };
}

async function adminGetRowsFromRpc(
    before?: string | null,
    limit = 20,
    includeWarnings = false,
    sendWarningsArg = false,
): Promise<AdminErrorRow[] | null> {
    const args: Record<string, unknown> = {
        p_limit: limit,
        p_before: before ?? null,
    };
    if (sendWarningsArg) args.p_include_warnings = includeWarnings;

    const { data, error } = await supabase.rpc('admin_get_recent_errors', args);
    if (error) {
        return null;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return rows.map(normalizeAdminErrorRow);
}

async function adminGetErrorRows(
    before?: string | null,
    limit = 20,
): Promise<AdminErrorRow[]> {
    const rows = await adminGetRowsFromRpc(before, limit);
    if (!rows) {
        console.error('[admin] admin_get_recent_errors failed');
        return [];
    }
    return rows;
}

async function adminGetWarningRows(
    before?: string | null,
    limit = 20,
): Promise<AdminErrorRow[]> {
    const baseQuery = supabase
        .from('diagnostic_events')
        .select('id, created_at, stage, severity, message, error_status, error_name, error_message, file_name, file_size, model, is_guest, context')
        .eq('severity', 'warn')
        .order('created_at', { ascending: false })
        .limit(limit);
    const query = before ? baseQuery.lt('created_at', before) : baseQuery;
    const { data, error } = await query;
    if (error) {
        console.error('[admin] diagnostic warning query failed:', error);
        return [];
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return rows.map(normalizeAdminErrorRow);
}

export async function adminGetRecentErrors(
    before?: string | null,
    limit = 20,
    includeWarnings = false,
): Promise<AdminErrorRow[]> {
    if (!includeWarnings) return adminGetErrorRows(before, limit);

    const rpcRows = await adminGetRowsFromRpc(before, limit, true, true);
    if (rpcRows) return rpcRows;

    console.warn('[admin] admin_get_recent_errors with warnings failed; falling back to client-side union');
    const [errors, warnings] = await Promise.all([
        adminGetErrorRows(before, limit),
        adminGetWarningRows(before, limit),
    ]);

    return [...errors, ...warnings]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
}
