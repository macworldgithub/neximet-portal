'use client';

import { useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { apiPost } from '../../lib/api';
import { mailButton, mailInput } from './MailSettings';

export interface MailDraft { to: string; cc: string; subject: string; text: string }

export default function MailComposer({ email, initial, onSent, onClose }: { email: string; initial: MailDraft; onSent: (notice: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [requestId] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const close = () => { if (draft.to || draft.cc || draft.subject || draft.text) setConfirmDiscard(true); else onClose(); };
  const update = (key: keyof MailDraft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));

  return <section aria-labelledby="compose-title" className="rounded-2xl border border-[#29344a] bg-[#111827] p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><h2 id="compose-title" className="text-lg font-semibold">New message</h2><button aria-label="Close composer" className={mailButton} disabled={sending} onClick={close}><X className="h-4 w-4" /></button></div>
    <p className="mt-1 break-all text-xs text-gray-400">From: {email}</p>
    <form className="mt-5 space-y-4" onSubmit={async event => {
      event.preventDefault(); if (sending) return;
      setSending(true); setError(''); setAttempted(true);
      const response = await apiPost('/mail/send', { ...draft, requestId });
      setSending(false);
      if (response.success) onSent([response.rejected?.length ? `Email accepted, except for: ${response.rejected.join(', ')}.` : 'Email sent.', response.sentCopySaved ? '' : 'The Sent copy could not be saved. Check Hostinger webmail before resending.'].filter(Boolean).join(' '));
      else { if (response.safeToEdit) setAttempted(false); setError(response.message || 'The send could not be confirmed. Check Sent before trying again.'); }
    }}>
      <fieldset disabled={sending || attempted} className="space-y-4">
        <label className="block space-y-1.5 text-sm text-gray-300">To<input autoFocus required maxLength={6000} className={mailInput} value={draft.to} onChange={event => update('to', event.target.value)} placeholder="recipient@example.com, another@example.com" /></label>
        <label className="block space-y-1.5 text-sm text-gray-300">Cc<input maxLength={6000} className={mailInput} value={draft.cc} onChange={event => update('cc', event.target.value)} placeholder="Optional recipients" /></label>
        <label className="block space-y-1.5 text-sm text-gray-300">Subject<input required maxLength={998} className={mailInput} value={draft.subject} onChange={event => update('subject', event.target.value)} /></label>
        <label className="block space-y-1.5 text-sm text-gray-300">Message<textarea required maxLength={100000} rows={12} className={`${mailInput} resize-y leading-relaxed`} value={draft.text} onChange={event => update('text', event.target.value)} placeholder="Write your message…" /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={sending} className={`${mailButton} bg-[#5470F4] border-[#5470F4] hover:bg-[#4360df]`}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? 'Sending…' : attempted ? 'Check send result' : 'Send email'}</button><button type="button" disabled={sending} className={mailButton} onClick={close}>Discard</button></div>
      {attempted && error && <p className="text-xs text-gray-400">This message is locked to prevent duplicate sends. Check Sent, then discard and compose a new message if needed.</p>}
    </form>
    {confirmDiscard && <div className="mt-4 rounded-xl border border-amber-500/30 p-4 text-sm"><p>Discard this unsaved message?</p><div className="mt-3 flex gap-2"><button className={mailButton} onClick={onClose}>Discard message</button><button className={mailButton} onClick={() => setConfirmDiscard(false)}>Keep editing</button></div></div>}
  </section>;
}
