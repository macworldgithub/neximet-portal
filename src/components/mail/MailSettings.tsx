'use client';

import { useState } from 'react';
import { Loader2, LockKeyhole, Unplug } from 'lucide-react';
import { apiDelete, apiPut } from '../../lib/api';
import type { MailSettings as Settings } from '../../lib/mail';

export const mailInput = 'w-full rounded-xl border border-[#29344a] bg-[#0B0F19] px-3 py-2.5 text-sm text-white outline-none focus:border-[#5CC5FA] disabled:opacity-50';
export const mailButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#29344a] px-3 py-2 text-sm text-gray-200 hover:bg-[#1F293D] disabled:opacity-50 disabled:cursor-not-allowed';

export default function MailSettings({ settings, onSaved, onCancel }: { settings: Settings; onSaved: (settings: Settings) => void; onCancel: () => void }) {
  const [email, setEmail] = useState(settings.email);
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [password, setPassword] = useState('');
  const [notifications, setNotifications] = useState(settings.notificationsEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return <section aria-labelledby="mail-settings-title" className="rounded-2xl border border-[#29344a] bg-[#111827] p-5 sm:p-6">
    <h2 id="mail-settings-title" className="text-lg font-semibold">Hostinger mailbox settings</h2>
    <p className="mt-1 text-sm text-gray-400">Connect your existing mailbox to receive and send email here. This address can differ from your portal login.</p>
    {!settings.serverConfigured && <p role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Mail setup is required on the server. Ask your administrator to configure the mailbox encryption key.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <form className="mt-5 space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      const result = await apiPut('/mail/settings', { email: email.trim(), displayName, password: password || undefined, notificationsEnabled: notifications });
      setBusy(false);
      if (result.success) { setPassword(''); onSaved(result.settings); }
      else setError(result.message || 'Could not save mailbox settings.');
    }}>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm text-gray-300">Email address<input type="email" autoComplete="email" required maxLength={254} className={mailInput} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@yourcompany.com" /></label>
        <label className="space-y-1.5 text-sm text-gray-300">Sender name<input maxLength={100} className={mailInput} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your name" /></label>
        <label className="space-y-1.5 text-sm text-gray-300 sm:col-span-2">Mailbox password<input type="password" autoComplete="new-password" required={!settings.connected || email.trim().toLowerCase() !== settings.email} maxLength={1024} className={mailInput} value={password} onChange={event => setPassword(event.target.value)} placeholder={settings.connected ? 'Leave blank to keep the current password' : 'Your Hostinger mailbox password'} /><span className="block text-xs text-gray-500">Use the password for this email mailbox.</span></label>
        <label className="flex items-start gap-3 text-sm text-gray-300 sm:col-span-2"><input type="checkbox" className="mt-1 accent-[#5470F4]" checked={notifications} onChange={event => setNotifications(event.target.checked)} /><span>Show unread email notifications<span className="mt-1 block text-xs text-gray-500">The Mail badge updates every minute while the portal is open.</span></span></label>
      </fieldset>
      <p className="flex items-center gap-2 text-xs text-gray-500"><LockKeyhole className="h-4 w-4 shrink-0" />Your mailbox password is encrypted. Connecting checks both incoming and outgoing mail.</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || !settings.serverConfigured} className={`${mailButton} bg-[#5470F4] border-[#5470F4] hover:bg-[#4360df]`} type="submit">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Verify &amp; save</button>
        {settings.connected && <button type="button" disabled={busy} onClick={onCancel} className={mailButton}>Cancel</button>}
        {settings.connected && <button type="button" disabled={busy} onClick={() => setConfirmDisconnect(true)} className={`${mailButton} sm:ml-auto text-red-300`}><Unplug className="h-4 w-4" />Disconnect</button>}
      </div>
    </form>
    {confirmDisconnect && <div className="mt-4 rounded-xl border border-red-500/30 p-4 text-sm">
      <p>Disconnect this mailbox from the portal? Your emails will stay in Hostinger.</p>
      <div className="mt-3 flex gap-2"><button className={mailButton} disabled={busy} onClick={async () => {
        setBusy(true); const result = await apiDelete('/mail/settings'); setBusy(false);
        if (result.success) onSaved({ ...settings, connected: false, email: '', displayName: '', notificationsEnabled: true });
        else setError(result.message || 'Could not disconnect mailbox.');
      }}>Disconnect mailbox</button><button className={mailButton} disabled={busy} onClick={() => setConfirmDisconnect(false)}>Keep connected</button></div>
    </div>}
  </section>;
}
