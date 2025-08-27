'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { createClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface UseAutoLogoutOptions {
  timeout?: number; // in minutes, default 30
  warningTime?: number; // in minutes before logout, default 5
  onWarning?: () => void;
  onLogout?: () => void;
}

export function useAutoLogout({
  timeout = 30,
  warningTime = 5,
  onWarning,
  onLogout,
}: UseAutoLogoutOptions = {}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    } finally {
      onLogout?.();
      router.push('/');
    }
  }, [onLogout, router]);

  // Check Supabase auth state
  useEffect(() => {
    const supabase = createClient();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        router.push('/');
      }
    });

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSupabaseUser(user);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const resetTimer = useCallback(() => {
    if (!supabaseUser) return;

    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    lastActivityRef.current = Date.now();

    // Set warning timeout
    const warningMs = (timeout - warningTime) * 60 * 1000;
    if (warningMs > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        onWarning?.();
      }, warningMs);
    }

    // Set logout timeout
    const timeoutMs = timeout * 60 * 1000;
    timeoutRef.current = setTimeout(() => {
      logout();
    }, timeoutMs);
  }, [supabaseUser, timeout, warningTime, onWarning, logout]);

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const getRemainingTime = useCallback(() => {
    if (!supabaseUser) return 0;
    const elapsed = Date.now() - lastActivityRef.current;
    const remaining = (timeout * 60 * 1000) - elapsed;
    return Math.max(0, Math.floor(remaining / 1000)); // return seconds
  }, [supabaseUser, timeout]);

  useEffect(() => {
    if (!supabaseUser) {
      // Clear timers if no user
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      return;
    }

    // Start timer when user is logged in
    resetTimer();

    // Activity event listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [supabaseUser, resetTimer]);

  return {
    extendSession,
    getRemainingTime,
    isActive: !!supabaseUser,
  };
}