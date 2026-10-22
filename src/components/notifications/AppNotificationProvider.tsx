'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Download, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCalls } from '../../context/CallContext';
import { usePwa } from '../pwa/PwaProvider';
import { apiFetch } from '../../lib/api';
import { disablePush, enablePush, supportsPush } from '../../lib/push';

type Status = 'checking' | 'available' | 'enabled' | 'blocked' | 'unsupported' | 'unconfigured' | 'error';
const Context = createContext({ openSettings: () => {}, status: 'checking' as Status });
export const useAppNotifications = () => useContext(Context);
export default function AppNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <DeviceNotifications key={user?.id || 'signed-out'} userId={user?.id}>{children}</DeviceNotifications>;
}
function DeviceNotifications({ children, userId }: { children: React.ReactNode; userId?: string }) {
  const calls = useCalls(); const pwa = usePwa();
  const [status, setStatus] = useState<Status>('checking'); const [version, setVersion] = useState('');
  const [key, setKey] = useState(''); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const live = useRef(true); const syncing = useRef(false); const promptChecked = useRef(false);
  const preference = `neximet-device-notifications:${userId}`;
  const promptKey = `neximet-notification-prompt:${userId}:${version}`;
  const panel = useRef<HTMLDivElement>(null);
  const activeCall = !!calls.meeting || !!calls.incoming;
  const check = useCallback(async () => {
    if (!userId || syncing.current) return;
    syncing.current = true;
    try {
      const response = await apiFetch('/chat/push/config', { cache: 'no-store' });
      if (!live.current) return;
      if (!supportsPush()) { setStatus('unsupported'); return; }
      if (!response.success) { setStatus('error'); setError('Unable to check notification settings. Please try again.'); return; }
      if (!response.configured || !response.publicKey) { setStatus('unconfigured'); return; }
      setKey(response.publicKey);
      let off = false; try { off = localStorage.getItem(preference) === 'off'; } catch { /* Storage is optional. */ }
      if (Notification.permission === 'denied') { setStatus('blocked'); return; }
      // Repair/rebind an already-approved device on launch and reconnect. No
      // permission dialog or open app is needed for subsequent background push.
      if (Notification.permission === 'granted' && !off) {
        await enablePush(userId, response.publicKey);
        if (live.current) { setStatus('enabled'); setError(''); }
      } else setStatus('available');
    } catch (failure) { if (live.current) { setStatus('error'); setError(failure instanceof Error ? failure.message : 'Unable to connect notifications.'); } }
    finally { syncing.current = false; }
  }, [userId, preference]);
  useEffect(() => {
    live.current = true;
    if (!userId) return;
    void fetch('/app-version.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(response => response.ok ? response.json() : null).then(value => {
      if (live.current) setVersion(typeof value?.version === 'string' && /^[\w-]{1,80}$/.test(value.version) ? value.version : 'app-notifications-v1');
    }).catch(() => { if (live.current) setVersion('app-notifications-v1'); });
    // check updates state only after its asynchronous server response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!activeCall) void check();
    const resume = () => { if (document.visibilityState === 'visible' && !activeCall) void check(); };
    window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    return () => { live.current = false; window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [userId, check, activeCall]);
  useEffect(() => {
    const shouldPrompt = status === 'available' || status === 'blocked' || status === 'unsupported' && pwa.isIOS && !pwa.isInstalled;
    if (!userId || !version || !shouldPrompt || activeCall || pwa.hasUpdateNotice || promptChecked.current) return;
    const timer = setTimeout(() => {
      try { if (localStorage.getItem(promptKey)) { promptChecked.current = true; return; } } catch { /* Show once in this session without storage. */ }
      promptChecked.current = true; setOpen(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [userId, version, status, promptKey, activeCall, pwa.hasUpdateNotice, pwa.isIOS, pwa.isInstalled]);
  const visible = open && !calls.incoming && !calls.meeting;
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null; panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [visible]);
  const close = () => { if (busy) return; try { localStorage.setItem(promptKey, 'seen'); } catch { /* Optional storage. */ } setOpen(false); };
  const allow = async () => {
    if (!userId || !key || busy) return;
    // Invoked directly by the click, before awaiting other work, for iOS.
    setBusy(true); setError('');
    try {
      await enablePush(userId, key);
      if (!live.current) return;
      try { localStorage.setItem(preference, 'on'); localStorage.setItem(promptKey, 'enabled'); } catch { /* Optional storage. */ }
      setStatus('enabled'); setOpen(false);
    } catch (failure) { if (live.current) { setError(failure instanceof Error ? failure.message : 'Unable to enable notifications.'); setStatus(Notification.permission === 'denied' ? 'blocked' : 'error'); } }
    finally { if (live.current) setBusy(false); }
  };
  const turnOff = async () => { setBusy(true); try { await disablePush(); try { localStorage.setItem(preference, 'off'); } catch { /* Optional storage. */ } if (live.current) setStatus('available'); } finally { if (live.current) setBusy(false); } };
  return <Context.Provider value={{ status, openSettings: () => { setOpen(true); void check(); } }}>
    <div className="contents" inert={visible} aria-hidden={visible ? true : undefined}>{children}</div>
    {visible && <div className="fixed inset-0 z-[115] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div ref={panel} role="dialog" aria-modal="true" aria-label="App notifications" tabIndex={-1} className="w-full max-w-md rounded-3xl border border-[#23314a] bg-[#111827] p-6 text-white shadow-2xl outline-none" onKeyDown={event => {
        if (event.key === 'Escape') close();
        if (event.key === 'Tab') { const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const first = buttons[0], last = buttons.at(-1); if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); } }
      }}>
        <div className="flex items-center justify-between"><span className="rounded-2xl bg-[#5470F4]/15 p-3 text-[#5CC5FA]"><BellRing size={27} /></span><button disabled={busy} onClick={close} aria-label="Close notification settings" className="rounded-xl p-2 text-gray-400"><X size={20} /></button></div>
        <h2 className="mt-5 text-2xl font-semibold">{status === 'enabled' ? 'Notifications are on' : 'Stay updated with Neximet'}</h2>
        <p className="mt-3 text-sm leading-6 text-gray-300">Allow notifications for messages, incoming calls, meetings, announcements, email and updates to your work—even when the app is closed.</p>
        <p className="mt-3 text-xs leading-5 text-gray-500">One permission covers the entire app on this device. Your phone’s notification and battery settings still apply.</p>
        {status === 'unsupported' && <p className="mt-4 rounded-xl bg-[#182133] p-3 text-sm text-gray-300">{pwa.isIOS && !pwa.isInstalled ? 'Add Neximet to your Home Screen, open the installed app, then allow notifications.' : 'Use an installed app or browser that supports push notifications over a secure connection.'}</p>}
        {status === 'blocked' && <p className="mt-4 rounded-xl bg-[#182133] p-3 text-sm text-amber-200">Notifications are blocked for Neximet. Allow them in your browser or phone notification settings, then return here.</p>}
        {status === 'unconfigured' && <p className="mt-4 text-sm text-amber-200">Notifications need to be enabled by your administrator first.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          {['available', 'error'].includes(status) && key && <button disabled={busy} onClick={() => void allow()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#5470F4] px-4 py-3 text-sm font-semibold disabled:opacity-50"><Bell size={17} />{busy ? 'Enabling…' : 'Allow notifications'}</button>}
          {status === 'enabled' && <button disabled={busy} onClick={() => void turnOff()} className="rounded-xl border border-[#23314a] px-4 py-3 text-sm disabled:opacity-50">Turn off on this device</button>}
          {status === 'unsupported' && !pwa.isInstalled && <button onClick={() => { close(); void pwa.promptInstall(); }} className="flex items-center gap-2 rounded-xl bg-[#5470F4] px-4 py-3 text-sm"><Download size={17} />Install app</button>}
          {['blocked', 'unconfigured', 'error'].includes(status) && <button disabled={busy} onClick={() => void check()} className="rounded-xl border border-[#23314a] px-4 py-3 text-sm">Check again</button>}
          <button disabled={busy} onClick={close} className="min-h-11 rounded-xl px-4 py-3 text-sm text-gray-400">{status === 'enabled' ? 'Done' : 'Not now'}</button>
        </div>
      </div>
    </div>}
  </Context.Provider>;
}
