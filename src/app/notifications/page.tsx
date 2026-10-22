'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, type PortalNotification } from '../../context/NotificationContext';
import { apiFetch } from '../../lib/api';
import ChatNotifications from '../../components/chat/ChatNotifications';

export default function NotificationsPage() {
  const { user } = useAuth(); const router = useRouter(); const inbox = useNotifications();
  const head = inbox.notifications[0]?._id;
  const [pages, setPages] = useState<{ head?: string; items: PortalNotification[]; cursor: string | null }>({ items: [], cursor: null });
  const older = pages.head === head ? pages.items : []; const cursor = pages.cursor;
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  // A new head invalidates older pages without mixing pagination snapshots.
  const next = older.length ? cursor : inbox.nextCursor;
  const loadMore = async () => {
    if (!next) return; setBusy(true); setError('');
    const result = await apiFetch(`/notifications?before=${next}`, { cache: 'no-store' });
    if (result.success) { setPages(previous => ({ head, items: [...(previous.head === head ? previous.items : []), ...result.notifications], cursor: result.nextCursor })); }
    else setError(result.message || 'Unable to load older notifications.');
    setBusy(false);
  };
  const open = async (notification: PortalNotification) => {
    await inbox.read(notification._id);
    router.push(notification.url);
  };
  return <div className="space-y-6 p-4 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-3 text-2xl font-semibold"><Bell className="text-[#5CC5FA]" />Notifications</h1><p className="mt-2 text-sm text-gray-400">{inbox.unread} unread · Updates for you and your work.</p></div>{user && <ChatNotifications userId={user.id} />}</div>
    <div className="flex flex-wrap gap-3"><button disabled={!inbox.unread} onClick={() => void inbox.readAll()} className="flex items-center gap-2 rounded-xl border border-[#23314a] px-4 py-2 text-sm disabled:opacity-40"><CheckCheck size={17} />Mark all as read</button><button onClick={() => void inbox.refresh()} className="flex items-center gap-2 rounded-xl border border-[#23314a] px-4 py-2 text-sm"><RefreshCw size={16} />Refresh</button></div>
    {(error || inbox.error) && <p role="alert" className="text-sm text-rose-300">{error || inbox.error}</p>}
    <div className="overflow-hidden rounded-2xl border border-[#23314a] bg-[#111827]">
      {inbox.loading ? <p className="p-6 text-gray-400">Loading notifications…</p> : !inbox.notifications.length ? <p className="p-8 text-gray-400">You’re all caught up. New updates will appear here.</p> : [...inbox.notifications, ...older].map(notification => <button key={notification._id} onClick={() => void open(notification)} className={`flex w-full gap-4 border-b border-[#23314a] p-5 text-left last:border-0 hover:bg-[#182133] ${notification.readAt ? '' : 'bg-[#5470F4]/5'}`}>
        <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? 'bg-gray-600' : 'bg-[#5CC5FA]'}`} /><span className="min-w-0 flex-1"><span className="block font-medium">{notification.title}</span><span className="mt-1 block whitespace-pre-wrap break-words text-sm text-gray-400">{notification.body}</span><time className="mt-2 block text-xs text-gray-500" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time></span>
      </button>)}
    </div>
    {next && <button disabled={busy} onClick={() => void loadMore()} className="rounded-xl bg-[#5470F4] px-5 py-2 text-sm disabled:opacity-40">{busy ? 'Loading…' : 'Load older notifications'}</button>}
    <p className="text-xs text-gray-500">Chat and mail unread messages remain in their own inboxes. Device notifications use your browser’s notification settings.</p>
  </div>;
}
