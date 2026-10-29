'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';

const MailContext = createContext({ unread: 0, refresh: async () => {} });

export function MailProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <MailState key={user?.id || 'signed-out'} userId={user?.role === 'Client' ? undefined : user?.id}>{children}</MailState>;
}

function MailState({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const [unread, setUnread] = useState(0);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!userId || document.visibilityState === 'hidden' || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await apiFetch('/mail/status', { signal: controller.signal, cache: 'no-store' });
      if (!controller.signal.aborted) setUnread(response.success && response.notificationsEnabled ? response.unread || 0 : 0);
    } finally { if (request.current === controller) request.current = null; }
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    void refresh();
    const interval = setInterval(() => void refresh(), 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); request.current?.abort(); request.current = null; };
  }, [refresh, userId]);
  return <MailContext.Provider value={{ unread, refresh }}>{children}</MailContext.Provider>;
}

export const useMail = () => useContext(MailContext);
