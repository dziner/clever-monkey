// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasSupabaseUrl = Boolean(supabaseUrl)
const hasSupabaseAnonKey = Boolean(supabaseAnonKey)

console.info('[supabase] env presence', {
    hasSupabaseUrl,
    hasSupabaseAnonKey,
})

if (!hasSupabaseUrl || !hasSupabaseAnonKey) {
    throw new Error(
        'Missing Supabase env vars. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (see .env.local.sample).'
    )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
    })
    if (error) console.error('Error logging in with Google:', error.message)
    return data
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error signing out:', error.message)
}
