import React from 'react';
import { supabase } from '../services/supabaseClient';
import { getMyProfile, ensureMyProfile, upsertMyProfile, updateMyDisplayName } from '../services/profileService';
import type { UserProfile } from '../types';

interface UserContextValue {
    userEmail: string | null;
    userId: string | null;
    userProfile: UserProfile | null;
    isAuthLoading: boolean;
    refreshProfile: () => Promise<void>;
}

const UserContext = React.createContext<UserContextValue | undefined>(undefined);

/** Detects the FK violation that means the auth.users row is gone. */
function isMissingUserError(err: unknown): boolean {
    const e = err as { code?: string; message?: string } | null;
    const msg = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase();
    return /23503|foreign key|violates foreign key|not present in table "users"/.test(msg);
}

export const useUser = (): UserContextValue => {
    const context = React.useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [userId, setUserId] = React.useState<string | null>(null);
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [isAuthLoading, setIsAuthLoading] = React.useState(true);

    const fetchProfile = React.useCallback(async (uid: string, email: string): Promise<'ok' | 'stale_session'> => {
        const { error: upsertError } = await upsertMyProfile(uid, email);
        if (upsertError && isMissingUserError(upsertError)) {
            // The local session references an auth.users row that no longer
            // exists server-side (FK profiles.id → auth.users(id) violation).
            // Signal the caller to clear the stale session.
            return 'stale_session';
        }

        // ensureMyProfile self-heals a missing row, so a signup whose
        // trigger never fired still ends up with a profile.
        let profile = await ensureMyProfile();

        // Email signup carries an explicit display_name in user_metadata
        // — seed the profile so the user doesn't have to re-enter it.
        // (Google sign-in only has full_name; we leave displayName null so
        //  the first-time prompt opens and the user confirms/edits it.)
        if (profile && !profile.displayName) {
            const { data: { user } } = await supabase.auth.getUser();
            const meta = user?.user_metadata as { display_name?: string } | undefined;
            const seed = meta?.display_name?.trim();
            if (seed) {
                const ok = await updateMyDisplayName(seed);
                if (ok) profile = await getMyProfile();
            }
        }

        setUserProfile(profile);
        return 'ok';
    }, []);

    const refreshProfile = React.useCallback(async () => {
        // Self-heal a missing profile row (e.g. the signup trigger never
        // fired) so the user isn't stuck with no profile.
        const profile = await ensureMyProfile();
        setUserProfile(profile);
    }, []);

    React.useEffect(() => {
        let isMounted = true;

        const syncUser = async (user: { id: string; email?: string } | null | undefined) => {
            const email = user?.email ?? null;
            const uid = user?.id ?? null;
            if (!isMounted) return;
            setUserEmail(email);
            setUserId(uid);
            setIsAuthLoading(false);
            if (uid && email) {
                // Always re-fetch on every auth event so server-side changes
                // (role admin↔user, tier free↔pro, language, etc.) propagate
                // without a page reload. SIGNED_IN/TOKEN_REFRESHED fire at
                // most every ~hour, so the extra query cost is negligible.
                const result = await fetchProfile(uid, email);
                if (result === 'stale_session' && isMounted) {
                    // Clear the dead session so the user sees the login
                    // button again instead of being stuck "signed in" with
                    // no profile.
                    console.warn('Clearing stale session — auth.users row appears to be missing.');
                    await supabase.auth.signOut();
                }
            } else {
                setUserProfile(null);
            }
        };

        // Use getUser() (server round-trip) instead of getSession() (local
        // cache only) so a session whose auth.users row was deleted in the
        // dashboard surfaces as an error here, not as a phantom "logged in"
        // state with no profile.
        supabase.auth.getUser().then(async ({ data, error }) => {
            if (!isMounted) return;
            if (error || !data.user) {
                if (error) console.warn('Auth user validation failed; clearing stale session', error);
                await supabase.auth.signOut();
                syncUser(null);
                return;
            }
            syncUser(data.user);
        }).catch(async (err) => {
            if (!isMounted) return;
            console.warn('Auth init failed; clearing stale session', err);
            await supabase.auth.signOut();
            syncUser(null);
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            syncUser(session?.user);
        });

        // Refresh profile when the tab regains focus — picks up server-side
        // role/tier changes for users who keep the app open across edits.
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                getMyProfile().then(p => { if (isMounted && p) setUserProfile(p); });
            }
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            isMounted = false;
            data.subscription.unsubscribe();
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [fetchProfile]);

    const value = React.useMemo(
        () => ({ userEmail, userId, userProfile, isAuthLoading, refreshProfile }),
        [userEmail, userId, userProfile, isAuthLoading, refreshProfile]
    );

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
