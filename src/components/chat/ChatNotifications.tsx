'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { bindPushAccount, disablePush, enablePush, supportsPush } from '../../lib/push';

export default function ChatNotifications({ userId }: { userId: string }) {
  const [state, setState] = useState<'checking' | 'unsupported' | 'unconfigured' | 'enabled' | 'disabled'>('checking');
  const [publicKey, setPublicKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!supportsPush()) { if (!cancelled) setState('unsupported'); return; }
      const config = await apiFetch('/chat/push/config', { cache: 'no-store' });
      if (cancelled) return;
      if (!config.success || !config.configured) { setState('unconfigured'); return; }
      setPublicKey(config.publicKey);
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (cancelled) return;
      if (subscription && Notification.permission === 'granted') await bindPushAccount(userId, registration);
      if (!cancelled) setState(subscription && Notification.permission === 'granted' ? 'enabled' : 'disabled');
    };
    void check().catch((failure) => {
      if (!cancelled) { setState('unconfigured'); setError(failure instanceof Error ? failure.message : 'Unable to check notification settings'); }
    });
    return () => { cancelled = true; };
  }, [userId]);
  const toggle = async () => {
    setBusy(true); setError('');
    try {
      if (state === 'enabled') { await disablePush(); setState('disabled'); }
      else { await enablePush(userId, publicKey); setState('enabled'); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to update notifications'); }
    finally { setBusy(false); }
  };
  return <div className="text-right">
    <button onClick={() => void toggle()} disabled={busy || !['enabled', 'disabled'].includes(state)} title={state === 'unsupported' ? 'On iPhone or iPad, install the PWA on your Home Screen first. Notifications require a supported browser and HTTPS.' : state === 'unconfigured' ? 'The server needs Web Push keys to enable notifications.' : undefined} className="inline-flex items-center gap-2 rounded-xl border border-[#1F293D] px-3 py-2.5 text-xs text-gray-300 disabled:opacity-50">
      {busy ? <Loader2 size={16} className="animate-spin" /> : state === 'enabled' ? <Bell size={16} /> : <BellOff size={16} />}
      <span>{state === 'enabled' ? 'Notifications on' : state === 'unsupported' ? 'Install PWA for notifications' : state === 'unconfigured' ? 'Notifications need setup' : state === 'checking' ? 'Checking notifications…' : 'Enable notifications'}</span>
    </button>
    {error && <p role="alert" className="mt-1 max-w-xs text-xs text-rose-300">{error}</p>}
  </div>;
}
