// Bootstrap admin allowlist (client-side UI gate).
//
// The DB is the security source of truth: admin RPCs are protected by
// the `is_admin_user()` Postgres function (see supabase/make_admin.sql),
// which honors both `profiles.role = 'admin'` AND a bootstrap email.
// This allowlist only controls whether the admin UI is *shown* — it can
// never grant data access on its own, because every admin query is
// re-checked server-side by RLS.
//
// DEFAULT_ADMIN_EMAILS is hardcoded so admin access survives user-table
// resets, uid changes from re-signups, and missing profile rows — the
// admin gate depends only on the signed-in email. Additional admins can
// be added via the `VITE_ADMIN_EMAILS` env var (comma-separated) in
// Netlify → Site configuration → Environment variables (redeploy after).

const DEFAULT_ADMIN_EMAILS = ['voicemakesme@gmail.com'];

const fromEnv = ((import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

export const ADMIN_EMAILS: string[] = [
    ...new Set([...DEFAULT_ADMIN_EMAILS.map(s => s.toLowerCase()), ...fromEnv]),
];

/** True if this email is in the bootstrap admin allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Whether the current user should see admin UI. Combines the DB-backed
 * role with the bootstrap email allowlist so admin access works even
 * when the profile row is missing or out of sync.
 */
export function isAdminUser(
    role: string | null | undefined,
    email: string | null | undefined,
): boolean {
    return role === 'admin' || isAdminEmail(email);
}
