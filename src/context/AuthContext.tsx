'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: 'citizen' | 'gov' | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, role: 'citizen' | 'gov', name?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  role: null,
  loading: true,
  signIn: async () => ({ error: 'Auth not initialized' }),
  signUp: async () => ({ error: 'Auth not initialized' }),
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
  });

  const extractRole = useCallback((user: User | null): 'citizen' | 'gov' | null => {
    if (!user) return null;
    const meta = user.user_metadata;
    if (meta?.role === 'gov') return 'gov';
    return 'citizen';
  }, []);

  const syncCookies = useCallback((session: Session | null, role: 'citizen' | 'gov' | null) => {
    if (typeof document === 'undefined') return;
    if (session?.access_token) {
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `sb-user-role=${role || 'citizen'}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'sb-user-role=; path=/; max-age=0; SameSite=Lax';
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userRole = extractRole(session?.user ?? null);
      setState({
        user: session?.user ?? null,
        session,
        role: userRole,
        loading: false,
      });
      syncCookies(session, userRole);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const userRole = extractRole(session?.user ?? null);
        setState({
          user: session?.user ?? null,
          session,
          role: userRole,
          loading: false,
        });
        syncCookies(session, userRole);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [extractRole, syncCookies]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session) {
      const userRole = extractRole(data.user);
      syncCookies(data.session, userRole);
    }
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, role: 'citizen' | 'gov', name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          user_name: name || email.split('@')[0],
        },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    syncCookies(null, null);
    await supabase.auth.signOut();
    setState({ user: null, session: null, role: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx || defaultAuthContext;
}
