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
    // Do NOT await refresh() here — auth pages handle their own redirect after sign-in.
    // Awaiting here was causing a multi-second block before setLoading(false) was called.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          // Fire and don't await — the auth page already has the user and is redirecting.
          // This call keeps the context in sync for subsequent page loads.
          refresh().catch(() => {});
        } else {
          setUser(null);
        }
        // Unblock loading immediately — never wait on the profile fetch here.
        setLoading(false);
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
