// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasSupabaseUrl = Boolean(supabaseUrl)
const hasSupabaseAnonKey = Boolean(supabaseAnonKey)
export const isSupabaseConfigured = hasSupabaseUrl && hasSupabaseAnonKey

if (import.meta.env.DEV) {
    console.info('[supabase] env presence', {
        hasSupabaseUrl,
        hasSupabaseAnonKey,
    })
}

if (!isSupabaseConfigured && import.meta.env.PROD) {
    throw new Error(
        'Missing Supabase env vars. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (see .env.local.sample).'
    )
}

if (!isSupabaseConfigured && import.meta.env.DEV) {
    console.warn(
        'Missing Supabase env vars. Public app shell will render, but auth, sync, and storage calls will fail until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
    )
}

const effectiveSupabaseUrl = isSupabaseConfigured ? supabaseUrl : 'http://127.0.0.1:54321'
const effectiveSupabaseAnonKey = isSupabaseConfigured ? supabaseAnonKey : 'missing-local-supabase-anon-key'

export const supabase = createClient(effectiveSupabaseUrl, effectiveSupabaseAnonKey)
export const supabaseProjectUrl = effectiveSupabaseUrl

export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        },
    })
    if (error) console.error('Error logging in with Google:', error.message)
    return { data, error }
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error signing out:', error.message)
    return { error }
}

export const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) console.error('Error logging in with email:', error.message)
    return { data, error }
}

export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const trimmedName = displayName?.trim() || undefined
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: window.location.origin,
            data: trimmedName ? { display_name: trimmedName } : undefined,
        }
    })
    if (error) console.error('Error signing up with email:', error.message)
    return { data, error }
}

type SimpleError = { message: string } | null

/**
 * Start an email change. Supabase emails a confirmation link to the new
 * address (and, if "Secure email change" is on, the old one too); the
 * address only updates after the user clicks it. So the UI must tell the
 * user to check their inbox rather than reflect the change immediately.
 */
export const updateEmail = async (newEmail: string): Promise<{ error: SimpleError }> => {
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (error) console.error('Error updating email:', error.message)
    return { error: error ? { message: error.message } : null }
}

/**
 * Change password with a current-password check. updateUser({ password })
 * alone does NOT verify the existing password, so without this re-auth
 * anyone with an open session (e.g. a borrowed laptop) could silently
 * reset it. We re-authenticate first; a failure means the current
 * password was wrong.
 */
export const updatePassword = async (
    currentPassword: string,
    newPassword: string,
): Promise<{ error: SimpleError }> => {
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email) return { error: { message: 'NO_SESSION' } }

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (reauthError) return { error: { message: 'INVALID_CURRENT_PASSWORD' } }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) console.error('Error updating password:', error.message)
    return { error: error ? { message: error.message } : null }
}

interface IdentityLike { provider?: string }

/**
 * Which auth providers back the current account. Used to decide whether
 * to offer email/password management (provider 'email') or show a
 * "managed by Google" note (OAuth-only accounts have no password).
 */
export const getAuthProviders = async (): Promise<string[]> => {
    const { data: { user } } = await supabase.auth.getUser()
    const identities = (user?.identities ?? []) as IdentityLike[]
    const providers = new Set<string>()
    for (const id of identities) if (id.provider) providers.add(id.provider)
    const primary = (user?.app_metadata as { provider?: string } | undefined)?.provider
    if (primary) providers.add(primary)
    return [...providers]
}

/**
 * Hard-delete the signed-in user's account. Calls our Netlify function
 * (which uses the service-role key to remove storage + auth.users; every
 * app table cascades). After the function returns we sign out locally
 * so the now-stale session can't make follow-up requests.
 */
export const deleteMyAccount = async (): Promise<{ error: SimpleError }> => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { error: { message: 'NO_SESSION' } }

    try {
        const res = await fetch('/api/delete-account', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        })
        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string }
            return { error: { message: body.error || `HTTP ${res.status}` } }
        }
        await supabase.auth.signOut()
        return { error: null }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error'
        return { error: { message } }
    }
}
