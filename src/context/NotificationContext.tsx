'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch, apiPost } from '../lib/api';
import { useRouter } from 'next/navigation';

export type PortalNotification = { _id: string; kind: string; title: string; body: string; url: string; readAt: string | null; createdAt: string };
const Context = createContext<{
  notifications: PortalNotification[]; unread: number; loading: boolean; error: string; nextCursor: string | null;
  refresh: () => Promise<void>; read: (id: string) => Promise<boolean>; readAll: () => Promise<void>;
} | null>(null);
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <NotificationState key={user?.id || 'signed-out'} userId={user?.id}>{children}</NotificationState>;
}
function NotificationState({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0); const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState(''); const [nextCursor, setNextCursor] = useState<string | null>(null);
  const version = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    const current = ++version.current;
    const response = await apiFetch('/notifications', { cache: 'no-store', signal });
    if (signal?.aborted || current !== version.current) return;
    if (response.success) { setNotifications(response.notifications); setUnread(response.unreadCount); setNextCursor(response.nextCursor); setError(''); }
    else setError(response.message || 'Unable to load notifications.');
    setLoading(false);
  }, [userId]);
  const refresh = useCallback(() => load(), [load]);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const resume = () => { if (document.visibilityState !== 'hidden') void load(controller.signal); };
    // Updates state only after the asynchronous API response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    const interval = setInterval(resume, 10000);
    window.addEventListener('focus', resume); window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [userId, load]);
  const read = useCallback(async (id: string) => {
    const response = await apiPost(`/notifications/${id}/read`, {});
    if (!response.success) { setError(response.message || 'Unable to mark notification read.'); return false; }
    await refresh(); return true;
  }, [refresh]);
  const readAll = useCallback(async () => {
    if (!notifications.length) return;
    const response = await apiPost('/notifications/read-all', { through: notifications[0]._id });
    if (!response.success) setError(response.message || 'Unable to mark notifications read.');
    else await refresh();
  }, [notifications, refresh]);
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator)) return;
    const open = (event: MessageEvent) => {
      if (event.data?.type !== 'OPEN_PLATFORM_NOTIFICATION' || event.data.userId !== userId) return;
      try {
        const url = new URL(event.data.url, location.origin);
        if (url.origin !== location.origin || !(['/announcements', '/notifications', '/mail', '/projects', '/leaves', '/attendance', '/deduction-settings', '/dashboard', '/employees'].includes(url.pathname) || /^\/projects\/[a-f\d]{24}$/i.test(url.pathname))) return;
        if (/^[a-f\d]{24}$/i.test(event.data.notificationId || '')) void read(event.data.notificationId);
        router.push(url.pathname + url.search);
      } catch { /* Ignore invalid navigation payloads. */ }
    };
    navigator.serviceWorker.addEventListener('message', open);
    return () => navigator.serviceWorker.removeEventListener('message', open);
  }, [userId, router, read]);
  return <Context.Provider value={{ notifications, unread, loading, error, nextCursor, refresh, read, readAll }}>{children}</Context.Provider>;
}
export function useNotifications() { const value = useContext(Context); if (!value) throw new Error('NotificationProvider is missing'); return value; }
