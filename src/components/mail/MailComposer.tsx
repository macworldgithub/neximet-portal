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

  return <section aria-labelledby="compose-title" className="mail-compose flex min-h-0 min-w-0 flex-1 flex-col bg-[#111827]">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#29344a] px-4 py-2"><div className="min-w-0"><h2 id="compose-title" className="text-base font-semibold">New message</h2><p className="mt-0.5 truncate text-xs text-gray-500">From: {email}</p></div><button aria-label="Close composer" className="communication-icon" disabled={sending} onClick={close}><X size={19} /></button></header>
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={async event => {
      event.preventDefault(); if (sending) return;
      setSending(true); setError(''); setAttempted(true);
      const response = await apiPost('/mail/send', { ...draft, requestId });
      setSending(false);
      if (response.success) onSent([response.rejected?.length ? `Email accepted, except for: ${response.rejected.join(', ')}.` : 'Email sent.', response.sentCopySaved ? '' : 'The Sent copy could not be saved. Check Hostinger webmail before resending.'].filter(Boolean).join(' '));
      else { if (response.safeToEdit) setAttempted(false); setError(response.message || 'The send could not be confirmed. Check Sent before trying again.'); }
    }}>
      <fieldset disabled={sending || attempted} className="mail-compose-fields flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 sm:px-6">
        <label className="flex shrink-0 items-center gap-3 text-xs text-gray-400"><span className="w-12 shrink-0">To</span><input aria-label="To" autoFocus={!initial.to} required maxLength={6000} className={mailInput} value={draft.to} onChange={event => update('to', event.target.value)} placeholder="recipient@example.com" /></label>
        <label className="flex shrink-0 items-center gap-3 text-xs text-gray-400"><span className="w-12 shrink-0">Cc</span><input aria-label="Cc" maxLength={6000} className={mailInput} value={draft.cc} onChange={event => update('cc', event.target.value)} placeholder="Optional recipients" /></label>
        <label className="flex shrink-0 items-center gap-3 text-xs text-gray-400"><span className="w-12 shrink-0">Subject</span><input aria-label="Subject" required maxLength={998} className={mailInput} value={draft.subject} onChange={event => update('subject', event.target.value)} /></label>
        <label className="flex min-h-40 flex-1 flex-col gap-2 text-xs text-gray-400">Message<textarea autoFocus={!!initial.to} required maxLength={100000} rows={5} className={`${mailInput} min-h-32 flex-1 resize-none leading-relaxed`} value={draft.text} onChange={event => update('text', event.target.value)} placeholder="Write your message…" /></label>
      </fieldset>
      <footer className="mail-compose-actions shrink-0 space-y-2 border-t border-[#29344a] bg-[#111827] px-4 py-3 sm:px-6">
        {error && <div className="max-h-24 space-y-1 overflow-y-auto"><p role="alert" className="text-sm text-red-300">{error}</p>{attempted && <p className="text-xs text-gray-400">This message is locked to prevent duplicate sends. Check Sent before composing again.</p>}</div>}
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={sending} className={`${mailButton} bg-[#5470F4] border-[#5470F4] hover:bg-[#4360df]`}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? 'Sending…' : attempted ? 'Check send result' : 'Send email'}</button><button type="button" disabled={sending} className={mailButton} onClick={close}>Discard</button></div>
        {confirmDiscard && <div role="alert" className="max-h-32 overflow-y-auto rounded-xl border border-amber-500/30 p-3 text-sm"><p>Discard this unsaved message?</p><div className="mt-2 flex gap-2"><button type="button" className={mailButton} onClick={onClose}>Discard message</button><button type="button" className={mailButton} onClick={() => setConfirmDiscard(false)}>Keep editing</button></div></div>}
      </footer>
    </form>
  </section>;
}
