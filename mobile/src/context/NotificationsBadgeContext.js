import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { patientApi } from '../api/patientApi';
import { useAuth } from './AuthContext';

const NotificationsBadgeContext = createContext(null);

const POLL_INTERVAL_MS = 60000;

/**
 * Polls the unread-notifications count so the "More" tab can show a badge without the user
 * having to open the inbox first. This is purely in-app (no OS-level push) — see
 * PUSH_NOTIFICATIONS_SETUP.md for what real background push notifications would require.
 */
export function NotificationsBadgeProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const refresh = async () => {
    try {
      const result = await patientApi.unreadCount();
      const count = typeof result === 'number' ? result : result?.count ?? result?.unreadCount ?? 0;
      setUnreadCount(Number(count) || 0);
    } catch {
      // Silently ignore — a stale/missing badge count is not worth surfacing to the patient.
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refresh();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount: refresh }), [unreadCount]);

  return <NotificationsBadgeContext.Provider value={value}>{children}</NotificationsBadgeContext.Provider>;
}

export function useNotificationsBadge() {
  const ctx = useContext(NotificationsBadgeContext);
  if (!ctx) throw new Error('useNotificationsBadge must be used within NotificationsBadgeProvider');
  return ctx;
}

export default NotificationsBadgeContext;
