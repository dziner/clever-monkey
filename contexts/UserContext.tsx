import React from 'react';
import { supabase } from '../services/supabaseClient';

interface UserContextValue {
  userEmail: string | null;
  isAuthLoading: boolean;
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
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) console.error('Failed to load session', error);
      setUserEmail(data.session?.user?.email ?? null);
      setIsAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ userEmail, isAuthLoading }}>
      {children}
    </UserContext.Provider>
  );
};
