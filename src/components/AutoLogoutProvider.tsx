'use client';

import { useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { createClient } from '@/lib/supabaseClient';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import AutoLogoutWarning from '@/components/AutoLogoutWarning';

interface AutoLogoutProviderProps {
  children: React.ReactNode;
  timeoutMinutes?: number;
  warningMinutes?: number;
}

export default function AutoLogoutProvider({ 
  children, 
  timeoutMinutes = 30,
  warningMinutes = 5 
}: AutoLogoutProviderProps) {
  const [showWarning, setShowWarning] = useState(false);

  const handleWarning = useCallback(() => {
    setShowWarning(true);
  }, []);

  const handleLogout = useCallback(async () => {
    setShowWarning(false);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    } finally {
      await signOut({ callbackUrl: '/' });
    }
  }, []);

  const { extendSession, getRemainingTime } = useAutoLogout({
    timeout: timeoutMinutes,
    warningTime: warningMinutes,
    onWarning: handleWarning,
    onLogout: handleLogout,
  });

  const handleExtendSession = useCallback(() => {
    setShowWarning(false);
    extendSession();
  }, [extendSession]);

  const handleLogoutNow = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  return (
    <>
      {children}
      <AutoLogoutWarning
        isVisible={showWarning}
        remainingSeconds={getRemainingTime()}
        onExtend={handleExtendSession}
        onLogoutNow={handleLogoutNow}
      />
    </>
  );
}