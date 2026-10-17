'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Inbox, Loader2, Mail, PenSquare, RefreshCw, Reply, Send, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMail } from '../../context/MailContext';
import { apiFetch } from '../../lib/api';
import { addressLabel, type MailMessage, type MailSettings as MailSettingsType } from '../../lib/mail';
import MailSettings, { mailButton } from '../../components/mail/MailSettings';
import MailComposer, { type MailDraft } from '../../components/mail/MailComposer';
import MailAttachments from '../../components/mail/MailAttachments';
import MailBody from '../../components/mail/MailBody';

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
  const [readerExpanded, setReaderExpanded] = useState(false);
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

  const closeReader = () => { readRequest.current?.abort(); setReading(false); setSelected(null); };
  const compose = () => { readRequest.current?.abort(); setReading(false); setNotice(''); setDraft({ to: '', cc: '', subject: '', text: '' }); };
  const reply = () => {
    if (!selected) return;
    setDraft({
      to: (folder === 'sent' ? selected.to : selected.replyTo?.length ? selected.replyTo : selected.from).map(item => item.address).filter(Boolean).join(', '),
      cc: '', subject: /^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`,
      text: `\n\nOn ${dateLabel(selected.date)}, ${addressLabel(selected.from)} wrote:\n${(selected.text || '').split('\n').map(line => `> ${line}`).join('\n')}`,
    });
  };

  return <div className="mail-page flex h-full min-h-0 min-w-0 flex-col" data-reading={!!selected || !!draft}>
    <header className="mail-toolbar flex shrink-0 items-center justify-between gap-3 border-b border-[#29344a] px-3 py-2 sm:px-4">
      <div className="min-w-0"><h1 className="text-base font-semibold">Mail</h1><p className="truncate text-xs text-gray-500">{settings?.connected ? settings.email : 'Connect your Hostinger mailbox'}</p></div>
      <div className="flex shrink-0 items-center gap-1">
        {settings?.connected && <button className="communication-icon" disabled={busy} aria-label="Mailbox settings" title="Mailbox settings" onClick={() => { closeReader(); setShowSettings(value => !value); }}><Settings size={19} /></button>}
        <a className="communication-icon" href="https://mail.hostinger.com" target="_blank" rel="noopener noreferrer" aria-label="Open Hostinger webmail" title="Open Hostinger webmail"><ExternalLink size={18} /></a>
      </div>
    </header>
    {notice && <div role="status" className="flex max-h-24 shrink-0 items-start justify-between gap-2 overflow-y-auto border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200"><p>{notice}</p><button className="shrink-0 underline" onClick={() => setNotice('')}>Dismiss</button></div>}
    {!settings && !settingsError && <div role="status" className="flex items-center justify-center gap-2 p-10 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" />Loading mailbox settings…</div>}
    {settingsError && <div role="alert" className="space-y-3 p-4 text-sm text-red-300"><p>{settingsError}</p><button className={mailButton} onClick={() => void loadSettings()}>Try again</button></div>}
    {settings && (showSettings || !settings.connected) && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6"><div className="mx-auto max-w-2xl"><MailSettings key={settings.email} settings={settings} onCancel={() => setShowSettings(false)} onSaved={next => {
      readRequest.current?.abort(); setSettings(next); setShowSettings(!next.connected); setMessages([]); setSelected(null); setPage(1); setFolder('inbox'); setError(''); setNotice(next.connected ? 'Mailbox connected. You can now receive and send email.' : 'Mailbox disconnected.'); reload();
    }} /></div></div>}
    {settings?.connected && !showSettings && <>
      {error && <div role="alert" className="max-h-24 shrink-0 overflow-y-auto border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</div>}
      <div className="mail-workspace min-h-0 flex-1" data-reader-open={!!selected || !!draft} data-reader-expanded={readerExpanded}>
        <section aria-label={`${folder === 'inbox' ? 'Inbox' : 'Sent'} messages`} className="mail-list-pane flex min-h-0 min-w-0 flex-col border-r border-[#29344a] bg-[#111827]">
          <div className="shrink-0 space-y-2 border-b border-[#29344a] px-3 py-3">
            <button disabled={busy} className={`${mailButton} w-full border-[#5470F4] bg-[#5470F4] hover:bg-[#4360df]`} onClick={compose}><PenSquare size={17} />Compose</button>
            <div className="flex items-center justify-between gap-1"><nav aria-label="Mail folders" className="flex gap-1">{([{ id: 'inbox', label: 'Inbox', icon: Inbox }, { id: 'sent', label: 'Sent', icon: Send }] as const).map(item => <button key={item.id} disabled={busy} aria-current={folder === item.id ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm ${folder === item.id ? 'bg-[#5470F4]/15 text-[#5CC5FA]' : 'text-gray-400 hover:bg-[#1F293D]'}`} onClick={() => changeFolder(item.id)}><item.icon size={16} />{item.label}</button>)}</nav>
            <button aria-label="Refresh mailbox" title="Refresh mailbox" className="communication-icon" disabled={loading || busy} onClick={reload}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button></div>
          </div>
          <div className="flex shrink-0 items-center justify-between px-4 py-2 text-xs text-gray-500"><h2>{folder === 'inbox' ? 'Inbox' : 'Sent'}</h2><span>{total} messages</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading && !messages.length ? <div role="status" className="flex justify-center gap-2 p-8 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" />Loading messages…</div> : !messages.length ? <div className="p-8 text-center text-sm text-gray-400"><Inbox className="mx-auto mb-3 h-8 w-8 text-gray-600" />{error ? 'Messages could not be loaded.' : folder === 'sent' ? 'No sent messages yet.' : 'Your inbox is empty.'}</div> : <ul className="divide-y divide-[#29344a]">{messages.map(message => <li key={message.uid}><button disabled={busy || loading} aria-pressed={selected?.uid === message.uid} onClick={() => void openMessage(message)} className={`w-full border-l-2 px-4 py-3.5 text-left transition-colors hover:bg-[#1a2436] disabled:opacity-50 ${selected?.uid === message.uid ? 'border-[#5CC5FA] bg-[#5470F4]/10' : 'border-transparent'}`}>
              <div className="flex items-center gap-2">{!message.seen && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-[#5CC5FA]" />}<span className={`min-w-0 flex-1 truncate text-sm ${message.seen ? 'text-gray-400' : 'font-semibold text-white'}`}>{addressLabel(folder === 'sent' ? message.to : message.from) || 'Unknown sender'}</span></div>
              <p className={`mt-1 truncate text-sm ${message.seen ? 'text-gray-400' : 'font-medium text-gray-100'}`}>{message.subject}</p><p className="mt-1 text-[10px] text-gray-500">{dateLabel(message.date)}</p>
            </button></li>)}</ul>}
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-[#29344a] px-3 py-2"><span className="text-xs text-gray-500">Page {page}</span><div className="flex gap-1"><button aria-label="Previous page" className="communication-icon" disabled={page === 1 || loading || busy} onClick={() => { closeReader(); setPage(value => value - 1); }}><ChevronLeft size={18} /></button><button aria-label="Next page" className="communication-icon" disabled={!hasMore || loading || busy} onClick={() => { closeReader(); setPage(value => value + 1); }}><ChevronRight size={18} /></button></div></div>
        </section>
        <div className="mail-detail-pane flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0B0F19]">
          {draft ? <>
            <div className="hidden shrink-0 justify-end border-b border-[#29344a] px-3 py-1 md:flex"><button className="communication-icon" aria-label={readerExpanded ? 'Show message list' : 'Expand composer'} title={readerExpanded ? 'Show message list' : 'Expand composer'} onClick={() => setReaderExpanded(value => !value)}>{readerExpanded ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
            <MailComposer email={settings.email} initial={draft} onClose={() => setDraft(null)} onSent={message => { setDraft(null); closeReader(); setNotice(message); setFolder('sent'); setPage(1); reload(); }} />
          </> : selected ? <article className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#29344a] px-3 py-1.5">
              <button className="communication-icon" aria-label="Back to messages" title="Back to messages" onClick={closeReader}><ArrowLeft size={19} /></button>
              <div className="flex items-center gap-1"><button className="communication-icon" disabled={reading} aria-label="Reply to email" title="Reply to email" onClick={reply}><Reply size={19} /></button><button className="communication-icon hidden md:inline-flex" aria-label={readerExpanded ? 'Show message list' : 'Expand email'} title={readerExpanded ? 'Show message list' : 'Expand email'} onClick={() => setReaderExpanded(value => !value)}>{readerExpanded ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
            </header>
            <div className="mail-message-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7 lg:px-10">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold sm:text-2xl">{selected.subject}</h2>
                <div className="mt-4 space-y-1 break-words border-b border-[#29344a] pb-4 text-xs leading-relaxed text-gray-400"><p>From: {addressLabel(selected.from)}</p><p>To: {addressLabel(selected.to)}</p>{!!selected.cc?.length && <p>Cc: {addressLabel(selected.cc)}</p>}<p>{dateLabel(selected.date)}</p></div>
                {reading ? <div role="status" className="flex items-center gap-2 py-10 text-gray-400"><Loader2 size={16} className="animate-spin" />Opening message…</div> : <>
                  <MailBody key={`${folder}:${selected.uid}`} html={selected.html} text={selected.text} hasRemoteImages={selected.hasRemoteImages} />
                  <MailAttachments key={`${folder}:${selected.uid}`} attachments={(selected.attachments || []).filter(item => !item.renderedInline)} />
                  <button className={`${mailButton} mb-6`} onClick={reply}><Reply size={16} />Reply</button>
                </>}
              </div>
            </div>
          </article> : <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center"><Mail className="mb-4 h-10 w-10 text-gray-600" /><p className="text-sm text-gray-400">Select an email to read it</p><button className="mt-3 text-sm text-[#5CC5FA]" onClick={compose}>Or compose a message</button></div>}
        </div>
      </div>
    </>}
  </div>;
}
