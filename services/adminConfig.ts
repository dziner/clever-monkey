// Bootstrap admin allowlist (client-side UI gate).
//
// The DB is the security source of truth: admin RPCs are protected by
// the `is_admin_user()` Postgres function (see supabase/make_admin.sql),
// which honors both `profiles.role = 'admin'` AND a bootstrap email.
// This allowlist only controls whether the admin UI is *shown* — it can
// never grant data access on its own, because every admin query is
// re-checked server-side by RLS.
//
// Configure with the `VITE_ADMIN_EMAILS` env var (comma-separated), e.g.
//   VITE_ADMIN_EMAILS=you@example.com,teammate@example.com
// Set it in Netlify → Site configuration → Environment variables, then
// redeploy (VITE_* values are baked in at build time).

const raw = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? '';

export const ADMIN_EMAILS: string[] = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

/** True if this email is in the bootstrap admin allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Whether the current user should see admin UI. Combines the DB-backed
 * role with the bootstrap email allowlist so a freshly-promoted admin
 * sees the panel immediately, even before the profile row syncs.
 */
export function isAdminUser(
    role: string | null | undefined,
    email: string | null | undefined,
): boolean {
    return role === 'admin' || isAdminEmail(email);
}
