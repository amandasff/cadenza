"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../supabase/client';
import { AuthService, type AuthUser } from '../services/AuthService';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const service = AuthService.getInstance(supabase);
    const currentUser = await service.getCurrentUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Restore session on initial page load
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        await refresh();
      }
      setLoading(false);
    });

    // Listen for auth state changes (sign in / sign out from other tabs, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        // INITIAL_SESSION is already handled by getSession() above — skip it to
        // avoid a double loading cycle that causes the login page to flash.
        if (event === 'INITIAL_SESSION') return;
        if (session?.user) {
          // Keep loading=true until the profile is fetched. Without this, layouts
          // see loading=false && user=null and immediately redirect back to /auth/login
          // before the profile fetch completes.
          setLoading(true);
          refresh().finally(() => setLoading(false));
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const service = AuthService.getInstance(supabase);
      await service.signOut();
    } catch {
      // sign out regardless
    }
    setUser(null);
    window.location.href = '/auth/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
