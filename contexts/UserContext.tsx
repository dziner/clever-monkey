import React from 'react';
import { supabase } from '../services/supabaseClient';
import { getMyProfile, upsertMyProfile } from '../services/profileService';
import type { UserProfile } from '../types';

interface UserContextValue {
    userEmail: string | null;
    userId: string | null;
    userProfile: UserProfile | null;
    isAuthLoading: boolean;
    refreshProfile: () => Promise<void>;
}

const UserContext = React.createContext<UserContextValue | undefined>(undefined);

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

    const fetchProfile = React.useCallback(async (uid: string, email: string) => {
        await upsertMyProfile(uid, email);
        const profile = await getMyProfile();
        setUserProfile(profile);
    }, []);

    const refreshProfile = React.useCallback(async () => {
        const profile = await getMyProfile();
        setUserProfile(profile);
    }, []);

    React.useEffect(() => {
        let isMounted = true;

        supabase.auth.getSession().then(({ data, error }) => {
            if (!isMounted) return;
            if (error) console.error('Failed to load session', error);
            const user = data.session?.user;
            const email = user?.email ?? null;
            const uid = user?.id ?? null;
            setUserEmail(email);
            setUserId(uid);
            setIsAuthLoading(false);
            if (uid && email) fetchProfile(uid, email);
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user;
            const email = user?.email ?? null;
            const uid = user?.id ?? null;
            setUserEmail(email);
            setUserId(uid);
            setIsAuthLoading(false);
            if (uid && email) {
                fetchProfile(uid, email);
            } else {
                setUserProfile(null);
            }
        });

        return () => {
            isMounted = false;
            data.subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const value = React.useMemo(
        () => ({ userEmail, userId, userProfile, isAuthLoading, refreshProfile }),
        [userEmail, userId, userProfile, isAuthLoading, refreshProfile]
    );

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
