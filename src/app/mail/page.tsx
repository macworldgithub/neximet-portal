'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Inbox, Loader2, Mail, PenSquare, RefreshCw, Reply, Send, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMail } from '../../context/MailContext';
import { apiFetch } from '../../lib/api';
import { addressLabel, type MailMessage, type MailSettings as MailSettingsType } from '../../lib/mail';
import MailSettings, { mailButton } from '../../components/mail/MailSettings';
import MailComposer, { type MailDraft } from '../../components/mail/MailComposer';
import MailAttachments from '../../components/mail/MailAttachments';

function dateLabel(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function MailPage() {
  const { user } = useAuth();
  return user ? <Mailbox key={user.id} /> : null;
}

function Mailbox() {
  const { refresh: refreshUnread } = useMail();
  const [settings, setSettings] = useState<MailSettingsType | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [uidValidity, setUidValidity] = useState('');
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<MailDraft | null>(null);
  const [revision, setRevision] = useState(0);
  const readRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const busy = !!draft;
  const reload = useCallback(() => { setRevision(value => value + 1); void refreshUnread(); }, [refreshUnread]);

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    const result = await apiFetch('/mail/settings', { signal, cache: 'no-store' });
    if (signal?.aborted) return;
    if (result.success) { setSettings(result.settings); setShowSettings(!result.settings.connected); setSettingsError(''); }
    else setSettingsError(result.message || 'Unable to load Mail settings.');
  }, []);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => loadSettings(controller.signal)); return () => controller.abort(); }, [loadSettings]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; readRequest.current?.abort(); }; }, []);
  useEffect(() => {
    if (!settings?.connected || showSettings) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setError('');
      const result = await apiFetch(`/mail/messages?folder=${folder}&page=${page}`, { signal: controller.signal, cache: 'no-store' });
      if (controller.signal.aborted) return;
      if (result.success) { setMessages(result.messages); setTotal(result.total); setHasMore(result.hasMore); setUidValidity(result.uidValidity); }
      else { setMessages([]); setError(result.message || 'Could not load messages.'); }
      setLoading(false);
    };
    void load();
    const interval = setInterval(() => { if (document.visibilityState === 'visible' && !draft) void load(); }, 60000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [settings, showSettings, folder, page, revision, draft]);

  const changeFolder = (next: 'inbox' | 'sent') => {
    readRequest.current?.abort(); setReading(false); setSelected(null); setMessages([]); setFolder(next); setPage(1);
  };
  const openMessage = async (message: MailMessage) => {
    readRequest.current?.abort();
    const controller = new AbortController(); readRequest.current = controller;
    setSelected(message); setReading(true); setError('');
    const result = await apiFetch(`/mail/messages/${message.uid}?folder=${folder}&uidValidity=${encodeURIComponent(uidValidity)}`, { signal: controller.signal, cache: 'no-store' });
    if (controller.signal.aborted || !mounted.current) return;
    if (result.success) { setSelected(result.emailMessage); setMessages(previous => previous.map(item => item.uid === message.uid ? { ...item, seen: true } : item)); void refreshUnread(); }
    else { setSelected(null); setError(result.message || 'Could not open message.'); }
    setReading(false);
  };

  return <div className="space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-3"><span className="rounded-xl bg-[#5470F4]/15 p-2.5 text-[#5CC5FA]"><Mail className="h-5 w-5" /></span><h1 className="text-2xl font-bold">Mail</h1></div><p className="mt-2 break-all text-sm text-gray-400">{settings?.connected ? settings.email : 'Your Hostinger email, inside Neximet.'}</p></div>
      <div className="flex flex-wrap gap-2"><a className={mailButton} href="https://mail.hostinger.com" target="_blank" rel="noopener noreferrer">Webmail<ExternalLink className="h-3.5 w-3.5" /></a>{settings?.connected && <button className={mailButton} disabled={busy} onClick={() => { readRequest.current?.abort(); setReading(false); setShowSettings(value => !value); setSelected(null); }}><Settings className="h-4 w-4" />Settings</button>}</div>
    </header>
    <div aria-live="polite">{notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}<button className="ml-3 underline" onClick={() => setNotice('')}>Dismiss</button></div>}</div>
    {!settings && !settingsError && <div className="flex items-center gap-2 py-10 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" />Loading your mailbox settings…</div>}
    {settingsError && <div role="alert" className="space-y-3 rounded-xl border border-red-500/30 p-4 text-sm text-red-300"><p>{settingsError}</p><button className={mailButton} onClick={() => void loadSettings()}>Try again</button></div>}
    {settings && (showSettings || !settings.connected) && <MailSettings key={settings.email} settings={settings} onCancel={() => setShowSettings(false)} onSaved={next => {
      readRequest.current?.abort(); setSettings(next); setShowSettings(!next.connected); setMessages([]); setSelected(null); setPage(1); setFolder('inbox'); setError(''); setNotice(next.connected ? 'Mailbox connected. You can now receive and send email.' : 'Mailbox disconnected.'); reload();
    }} />}
    {settings?.connected && !showSettings && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Mail folders" className="flex gap-2">{([{ id: 'inbox', label: 'Inbox', icon: Inbox }, { id: 'sent', label: 'Sent', icon: Send }] as const).map(item => <button key={item.id} disabled={busy} aria-current={folder === item.id ? 'page' : undefined} className={`${mailButton} ${folder === item.id ? 'border-[#5470F4] bg-[#5470F4]/15 text-[#5CC5FA]' : ''}`} onClick={() => changeFolder(item.id)}><item.icon className="h-4 w-4" />{item.label}</button>)}</nav>
        <div className="flex gap-2"><button aria-label="Refresh mailbox" className={mailButton} disabled={loading || busy} onClick={reload}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button disabled={busy} className={`${mailButton} border-[#5470F4] bg-[#5470F4] hover:bg-[#4360df]`} onClick={() => { readRequest.current?.abort(); setReading(false); setNotice(''); setDraft({ to: '', cc: '', subject: '', text: '' }); }}><PenSquare className="h-4 w-4" />Compose</button></div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section aria-label={`${folder === 'inbox' ? 'Inbox' : 'Sent'} messages`} className={`${selected || draft ? 'hidden xl:block' : ''} min-w-0 overflow-hidden rounded-2xl border border-[#29344a] bg-[#111827]`}>
          <div className="flex items-center justify-between border-b border-[#29344a] px-4 py-3 text-sm"><h2 className="font-semibold">{folder === 'inbox' ? 'Inbox' : 'Sent'}</h2><span className="text-xs text-gray-500">{total} messages</span></div>
          {loading && !messages.length ? <div role="status" className="flex justify-center gap-2 p-10 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Loading messages…</div> : !messages.length ? <div className="p-10 text-center text-sm text-gray-400"><Inbox className="mx-auto mb-3 h-8 w-8 text-gray-600" />{error ? 'Messages could not be loaded.' : folder === 'sent' ? 'No sent messages yet.' : 'Your inbox is empty.'}</div> : <ul className="max-h-[65vh] divide-y divide-[#29344a] overflow-y-auto">{messages.map(message => <li key={message.uid}><button disabled={busy || loading} onClick={() => void openMessage(message)} className={`w-full px-4 py-4 text-left transition-colors hover:bg-[#1a2436] disabled:opacity-50 ${selected?.uid === message.uid ? 'bg-[#5470F4]/10' : ''}`}>
            <div className="flex items-center gap-2">{!message.seen && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-[#5CC5FA]" />}<span className={`min-w-0 flex-1 truncate text-sm ${message.seen ? 'text-gray-400' : 'font-semibold text-white'}`}>{addressLabel(folder === 'sent' ? message.to : message.from) || 'Unknown sender'}</span><span className="shrink-0 text-[10px] text-gray-500">{dateLabel(message.date)}</span></div>
            <p className={`mt-1 truncate text-sm ${message.seen ? 'text-gray-400' : 'font-medium text-gray-100'}`}>{message.subject}</p>
          </button></li>)}</ul>}
          <div className="flex items-center justify-between border-t border-[#29344a] px-4 py-3"><span className="text-xs text-gray-500">Page {page}</span><div className="flex gap-2"><button aria-label="Previous page" className={mailButton} disabled={page === 1 || loading || busy} onClick={() => { setSelected(null); setPage(value => value - 1); }}><ChevronLeft className="h-4 w-4" /></button><button aria-label="Next page" className={mailButton} disabled={!hasMore || loading || busy} onClick={() => { setSelected(null); setPage(value => value + 1); }}><ChevronRight className="h-4 w-4" /></button></div></div>
        </section>
        {draft ? <MailComposer email={settings.email} initial={draft} onClose={() => setDraft(null)} onSent={message => { setDraft(null); setSelected(null); setNotice(message); setFolder('sent'); setPage(1); reload(); }} /> : selected ? <article className="min-w-0 rounded-2xl border border-[#29344a] bg-[#111827] p-5 sm:p-6">
          <button className={`${mailButton} mb-4 xl:hidden`} onClick={() => { readRequest.current?.abort(); setReading(false); setSelected(null); }}><ArrowLeft className="h-4 w-4" />Back to messages</button>
          <h2 className="break-words text-xl font-semibold">{selected.subject}</h2>
          <div className="mt-4 space-y-1 break-words border-b border-[#29344a] pb-4 text-xs text-gray-400"><p>From: {addressLabel(selected.from)}</p><p>To: {addressLabel(selected.to)}</p>{!!selected.cc?.length && <p>Cc: {addressLabel(selected.cc)}</p>}<p>{dateLabel(selected.date)}</p></div>
          {reading ? <div role="status" className="flex items-center gap-2 py-10 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Opening message…</div> : <><div className="whitespace-pre-wrap break-words py-6 text-sm leading-7 text-gray-200 [overflow-wrap:anywhere]">{selected.text || 'This message has no text content.'}</div><MailAttachments key={`${folder}:${selected.uid}`} attachments={selected.attachments || []} /><button className={mailButton} onClick={() => setDraft({ to: (folder === 'sent' ? selected.to : selected.replyTo?.length ? selected.replyTo : selected.from).map(item => item.address).filter(Boolean).join(', '), cc: '', subject: /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`, text: `\n\nOn ${dateLabel(selected.date)}, ${addressLabel(selected.from)} wrote:\n${(selected.text || '').split('\n').map(line => `> ${line}`).join('\n')}` })}><Reply className="h-4 w-4" />Reply</button></>}
        </article> : <div className="hidden min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[#29344a] p-8 text-center xl:flex"><Mail className="mb-4 h-10 w-10 text-gray-600" /><p className="text-sm text-gray-400">Select an email to read it</p><p className="mt-1 text-xs text-gray-600">Or compose a message from {settings.email}</p></div>}
      </div>
    </>}
  </div>;
}
