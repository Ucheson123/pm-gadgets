import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { SessionUser } from '../types';

interface AuthContextValue {
  user: SessionUser | null;
  isInitializing: boolean;
  profileError: string | null;
  /** Re-fetches the profile row — used by the pending page's "Check status" button */
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, role, status, full_name, branch_id, branch:branches(name)')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Authenticated but no profile row: sign out and surface an error
      // instead of leaving the user in a silent login loop.
      setProfileError(
        'Your account profile could not be loaded. Please contact an administrator.'
      );
      await supabase.auth.signOut();
      setUser(null);
    } else {
      setProfileError(null);
      const { branch, ...profile } = data as typeof data & {
        branch: { name: string } | null;
      };
      setUser({ ...profile, branch_name: branch?.name ?? null } as SessionUser);
    }
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchUserProfile(session.user.id);
      else setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer Supabase calls out of this callback — awaiting them directly
      // inside onAuthStateChange can deadlock (supabase-js v2 lock issue).
      setTimeout(() => {
        if (session?.user) {
          fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setIsInitializing(false);
        }
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) await fetchUserProfile(session.user.id);
  }, [fetchUserProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isInitializing, profileError, refreshProfile, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};