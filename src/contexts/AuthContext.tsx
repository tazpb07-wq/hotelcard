import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { name?: string; phone?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoggedSignIn = useRef(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Update state synchronously - avoid async operations here
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Only log actual sign-ins (not token refreshes)
        if (event === 'SIGNED_IN' && currentSession?.user && !hasLoggedSignIn.current) {
          hasLoggedSignIn.current = true;
          // Use setTimeout to avoid blocking the auth state change
          setTimeout(() => {
            supabase.from('audit_logs').insert({
              action: 'login' as const,
              user_id: currentSession.user.id,
              metadata: { email: currentSession.user.email }
            }).then(({ error: logErr }) => {
              if (logErr) console.error('Error logging login:', logErr);
            });
          }, 100);
        }

        if (event === 'SIGNED_OUT') {
          hasLoggedSignIn.current = false;
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!isInitialized.current) {
        isInitialized.current = true;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setLoading(false);
        // If user already has a session, mark as logged in to prevent duplicate audit logs
        if (existingSession?.user) {
          hasLoggedSignIn.current = true;
        }
      }
    }).catch((err) => {
      console.error('Error getting session:', err);
      if (!isInitialized.current) {
        isInitialized.current = true;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: { name?: string; phone?: string }) => {
    try {
      hasLoggedSignIn.current = false; // Allow logging for new sign up
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: metadata
        }
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      hasLoggedSignIn.current = false; // Allow logging for new sign in
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      hasLoggedSignIn.current = false;
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        // Even if sign out fails on server, clear local state
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      console.error('Sign out exception:', err);
      // Clear local state even on error to prevent stuck state
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
