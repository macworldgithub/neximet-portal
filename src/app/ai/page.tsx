'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, History, Loader2, PanelLeftClose, Pencil, Plus, Search, Settings2, Sparkles, Square, Trash2, X } from 'lucide-react';
import { apiDelete, apiFetch, apiGet, apiPatch, apiPost } from '../../lib/api';
import { aiBillingUrl, aiProviders, emptyConnections, isAIBillingError, isAIQuotaError, providerName, streamAI, type AIConnection, type AIConversation, type AIConversationSummary, type AIMessage, type AIProvider } from '../../lib/ai';
import AIConnections, { aiButton, aiInput } from '../../components/ai/AIConnections';
import AIDialog from '../../components/ai/AIDialog';
import AIMessageBody from '../../components/ai/AIMessageBody';

const suggestions = [
  { title: 'Write an email', text: 'Help me write a clear, professional email. Ask me who it is for and what I want to say.' },
  { title: 'Plan a project', text: 'Help me turn a project idea into a practical plan. Ask me about the goal, deadline, and team.' },
  { title: 'Improve my writing', text: 'Help me improve a piece of writing for clarity and tone. Ask me to paste it and describe the audience.' },
  { title: 'Work through a problem', text: 'Help me work through a problem step by step. Start by asking what I am trying to solve.' },
];
const mergeRead = (saved: AIConversation, current: AIConversation | null): AIConversation => ({ ...saved,
  messages: saved.messages.map(message => message.status === 'pending' && current?._id === saved._id ? { ...message, content: current.messages.find(item => item.id === message.id)?.content || message.content } : message),
});

export default function AIPage() {
  const [connections, setConnections] = useState<AIConnection[]>(emptyConnections);
  const [serverConfigured, setServerConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [model, setModel] = useState('');
  const [conversation, setConversation] = useState<AIConversation | null>(null);
  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [desktopHistory, setDesktopHistory] = useState(true);
  const [search, setSearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [copied, setCopied] = useState('');
  const [action, setAction] = useState<'rename' | 'delete' | null>(null);
  const [title, setTitle] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const scroll = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null);
  const stream = useRef<AbortController | null>(null), readRequest = useRef<AbortController | null>(null);
  const busyRef = useRef(false), nearBottom = useRef(true);
  const connection = connections.find(item => item.provider === provider)!;
  const generating = busy || !!conversation?.generating;
  const blocked = loading || reading || generating;
  const activeProvider = conversation?.provider || provider;

  const setLocation = (id?: string) => window.history.replaceState(null, '', id ? `/ai?conversation=${encodeURIComponent(id)}` : '/ai');
  const applySettings = useCallback((result: Awaited<ReturnType<typeof apiGet>>) => {
    setConnectionError(!result.success);
    if (result.success) {
      setConnections(result.connections); setServerConfigured(result.serverConfigured);
      const first = (result.connections as AIConnection[]).find(item => item.connected);
      if (first) { setProvider(first.provider); setModel(first.defaultModel); }
    } else setError(result.message || 'Could not load AI connections.');
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    const id = new URLSearchParams(window.location.search).get('conversation');
    void Promise.all([apiGetWithSignal('/ai/connections', abort.signal), id && /^[a-f\d]{24}$/i.test(id) ? apiGetWithSignal(`/ai/conversations/${id}`, abort.signal) : Promise.resolve(null)]).then(([settings, chat]) => {
      if (abort.signal.aborted) return;
      applySettings(settings); setLoading(false);
      if (chat?.success) setConversation(chat.conversation);
      else if (chat) setError(chat.message || 'Could not open conversation.');
    });
    return () => { abort.abort(); stream.current?.abort(); readRequest.current?.abort(); };
  }, [applySettings]);

  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setHistoryLoading(true); setHistoryError('');
      const result = await apiGetWithSignal(`/ai/conversations?q=${encodeURIComponent(search)}&page=${historyPage}`, abort.signal);
      if (abort.signal.aborted) return;
      setHistoryLoading(false);
      if (result.success) {
        setConversations(previous => historyPage === 1 ? result.conversations : [...new Map([...previous, ...result.conversations].map(item => [item._id, item])).values()]);
        setHasMore(result.hasMore);
      } else setHistoryError(result.message || 'Could not load conversations.');
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [search, historyPage, historyVersion]);

  const conversationId = conversation?._id;
  const remoteGenerating = conversation?.generating;
  useEffect(() => {
    if (!remoteGenerating || busy || !conversationId) return;
    const abort = new AbortController();
    const timer = setInterval(async () => {
      const result = await apiGetWithSignal(`/ai/conversations/${conversationId}`, abort.signal);
      if (abort.signal.aborted) return;
      if (result.success) setConversation(current => current?._id === conversationId ? mergeRead(result.conversation, current) : current);
    }, 2500);
    return () => { clearInterval(timer); abort.abort(); };
  }, [remoteGenerating, busy, conversationId]);

  const lastContent = conversation?.messages.at(-1)?.content;
  useEffect(() => {
    if (nearBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [lastContent, conversationId, busy]);
  useEffect(() => {
    if (textarea.current) { textarea.current.style.height = 'auto'; textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 144)}px`; }
  }, [draft]);

  const newChat = () => {
    if (blocked) return;
    readRequest.current?.abort(); setConversation(null); setDraft(''); setError(''); setHistoryOpen(false); setLocation();
    nearBottom.current = true; setAwayFromBottom(false); textarea.current?.focus({ preventScroll: true });
  };
  const openChat = async (id: string) => {
    if (blocked) return;
    readRequest.current?.abort(); const abort = new AbortController(); readRequest.current = abort;
    setReading(true); setError(''); setHistoryOpen(false);
    const result = await apiGetWithSignal(`/ai/conversations/${id}`, abort.signal);
    if (abort.signal.aborted) return;
    setReading(false);
    if (result.success) { nearBottom.current = true; setAwayFromBottom(false); setConversation(result.conversation); setDraft(''); setLocation(id); }
    else setError(result.message || 'Could not open conversation.');
  };
  const send = async () => {
    if (busyRef.current || blocked || !draft.trim()) return;
    const selected = connections.find(item => item.provider === activeProvider);
    if (!selected?.connected) { setSettingsOpen(true); return; }
    busyRef.current = true; setBusy(true); setError(''); nearBottom.current = true; setAwayFromBottom(false);
    const abort = new AbortController(); stream.current = abort;
    let current = conversation;
    const text = draft.trim(), requestId = crypto.randomUUID();
    let started = false;
    try {
      if (!current) {
        const result = await apiPost('/ai/conversations', { provider, model: model || connection.defaultModel });
        if (!result.success) throw new Error(result.message || 'Could not create a chat.');
        current = result.conversation as AIConversation;
        setConversation(current); setLocation(current._id);
      }
      const id = current._id;
      await streamAI(id, text, requestId, abort.signal, event => {
        if (event.type === 'start') {
          started = true; setDraft('');
          setConversation(previous => previous?._id === id ? { ...previous, title: event.title, generating: true, messages: [...previous.messages, event.userMessage, event.assistantMessage] } : previous);
        } else if (event.type === 'delta') {
          setConversation(previous => previous?._id === id ? { ...previous, messages: previous.messages.map(message => message.requestId === requestId && message.role === 'assistant' ? { ...message, content: message.content + event.text } : message) } : previous);
        } else if (event.type === 'done') {
          setConversation(previous => previous?._id === id ? { ...previous, generating: false, messages: previous.messages.map(message => message.id === event.message.id ? event.message : message) } : previous);
          // Keep the saved, actionable error beside the failed reply rather
          // than duplicating it in a transient banner that disappears on reload.
          if (event.message.errorMessage) setError('');
        } else if (event.type === 'error') setError(event.message);
      });
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to send your message.');
      if (started) setConversation(previous => previous ? { ...previous, generating: false, messages: previous.messages.map(message => message.requestId === requestId && message.role === 'assistant' && message.status === 'pending' ? { ...message, status: abort.signal.aborted ? 'stopped' : 'error' } : message) } : previous);
    } finally {
      // On an interrupted network request, consult persisted history before another send.
      if (current) {
        const id = current._id;
        const result = await apiGet(`/ai/conversations/${id}`);
        if (result.success) {
          if (result.conversation.messages.some((message: AIMessage) => message.requestId === requestId)) setDraft('');
          setConversation(previous => previous?._id === id ? mergeRead(result.conversation, previous) : previous);
        }
      }
      busyRef.current = false; setBusy(false); stream.current = null;
      setHistoryPage(1); setHistoryVersion(value => value + 1);
    }
  };

  const historyContent = <>
    <div className="flex items-center justify-between px-3 pb-3 pt-4"><div className="flex items-center gap-2 text-sm font-semibold text-gray-300"><Sparkles size={16} className="text-[#5CC5FA]" />Neximet AI</div><button className="communication-icon" aria-label="Close conversation history" onClick={() => { setHistoryOpen(false); setDesktopHistory(false); }}><PanelLeftClose size={18} /></button></div>
    <div className="space-y-3 px-3"><button onClick={newChat} disabled={blocked} className={`${aiButton} w-full justify-start border-[#5470F4]/40 bg-[#5470F4]/10 text-[#5CC5FA]`}><Plus size={17} />New chat</button><label className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-3.5 text-gray-500" /><input aria-label="Search conversations" className={`${aiInput} pl-9`} value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setHistoryPage(1); }} placeholder="Search conversations" /></label></div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 pt-5">
      <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">Your conversations</p>
      {historyError && <div role="alert" className="p-3 text-xs leading-5 text-red-300">{historyError}<button className="mt-2 block text-[#5CC5FA]" onClick={() => setHistoryVersion(value => value + 1)}>Try again</button></div>}
      {conversations.map(item => <button disabled={blocked} key={item._id} onClick={() => void openChat(item._id)} className={`mb-1 block w-full min-w-0 rounded-xl px-3 py-3 text-left disabled:opacity-50 ${conversation?._id === item._id ? 'bg-[#5470F4]/15 text-gray-100' : 'text-gray-400 hover:bg-[#161F30]'}`}><span className="block truncate text-sm">{item.title}</span><span className="mt-1 flex items-center gap-2 text-[11px] text-gray-500"><span>{providerName(item.provider)}</span><span aria-hidden="true">·</span><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></span></button>)}
      {!conversations.length && !historyLoading && !historyError && <p className="px-3 py-6 text-sm leading-6 text-gray-500">{search ? 'No matching conversations.' : 'Your conversations will appear here.'}</p>}
      {historyLoading && <div role="status" className="flex justify-center p-4 text-gray-500"><Loader2 size={18} className="animate-spin" /><span className="sr-only">Loading conversations</span></div>}
      {hasMore && !historyLoading && <button className={`${aiButton} mt-3 w-full`} onClick={() => setHistoryPage(value => value + 1)}>Load more</button>}
    </div>
    <div className="shrink-0 border-t border-[#1F293D] p-3"><button disabled={generating} onClick={() => { setSettingsOpen(true); setHistoryOpen(false); }} className={`${aiButton} w-full justify-start`}><Settings2 size={16} />AI connections<span className="ml-auto text-xs text-gray-500">{connections.filter(item => item.connected).length}/3</span></button></div>
  </>;

  return <div className="ai-workspace relative flex h-full min-h-0 min-w-0 bg-[#0B0F19]">
    {desktopHistory && <aside aria-label="Conversation history" className="hidden w-64 shrink-0 flex-col border-r border-[#1F293D] bg-[#0E1424] lg:flex xl:w-72">{historyContent}</aside>}
    {historyOpen && <AIDialog title="Conversations" onClose={() => setHistoryOpen(false)}><div className="flex h-[min(65dvh,600px)] flex-col">{historyContent}</div></AIDialog>}
    <section aria-label="AI chat" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-[#1F293D] px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button className={`communication-icon ${desktopHistory ? 'lg:hidden' : ''}`} aria-label="Open conversation history" onClick={() => { if (window.matchMedia('(min-width: 1024px)').matches) setDesktopHistory(true); else setHistoryOpen(true); }}><History size={20} /></button>
          {conversation ? <div className="min-w-0"><h1 className="truncate text-sm font-semibold sm:text-base">{conversation.title}</h1><p className="mt-0.5 truncate text-[11px] text-gray-500">{providerName(conversation.provider)} · {conversation.model}</p></div> : <div className="flex min-w-0 items-center gap-2"><Sparkles size={19} className="shrink-0 text-[#5CC5FA]" /><h1 className="truncate font-semibold">AI workspace</h1></div>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {conversation && <><button disabled={blocked} className="communication-icon" aria-label="Rename conversation" title="Rename" onClick={() => { setTitle(conversation.title); setActionError(''); setAction('rename'); }}><Pencil size={16} /></button><button disabled={blocked} className="communication-icon" aria-label="Delete conversation" title="Delete" onClick={() => { setActionError(''); setAction('delete'); }}><Trash2 size={16} /></button></>}
          <button className="communication-icon" disabled={generating} onClick={() => setSettingsOpen(true)} aria-label="Open AI connections" title="AI connections"><Settings2 size={19} /></button>
          <button className="communication-icon" disabled={blocked} onClick={newChat} aria-label="New AI chat" title="New chat"><Plus size={21} /></button>
        </div>
      </header>

      <div data-chat-scroll ref={scroll} onScroll={() => { const element = scroll.current; if (element) { nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100; setAwayFromBottom(!nearBottom.current); } }} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {loading || reading ? <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-gray-400"><Loader2 size={20} className="animate-spin" />{reading ? 'Opening conversation…' : 'Loading AI workspace…'}</div> : !conversation?.messages.length ? <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-8 sm:px-8 sm:py-12">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#5470F4]/25 bg-[#5470F4]/10 text-[#5CC5FA]"><Sparkles size={27} /></div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[#5CC5FA]">Your AI workspace</p><h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">What are we working on?</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-gray-400">Write, plan, and work through ideas with GPT, Claude, or Gemini, right here in Neximet.</p>
          <div className="mt-5 max-w-lg rounded-xl border border-[#1F293D] bg-[#111827] px-4 py-3 text-sm leading-6 text-gray-400"><p>Start without paid API billing using a Gemini Free Tier project. Its API quota is separate from the free chat websites.</p><button type="button" disabled={blocked} className="mt-1 min-h-10 font-medium text-[#5CC5FA] disabled:opacity-40" onClick={() => { if (conversation) { setConversation(null); setLocation(); } setProvider('gemini'); setModel(connections.find(item => item.provider === 'gemini')?.defaultModel || ''); setSettingsOpen(true); }}>Set up Gemini free-tier access</button></div>
          {!connections.some(item => item.connected) && <div className="mt-6 flex flex-wrap items-center gap-3"><button disabled={connectionError} onClick={() => setSettingsOpen(true)} className={`${aiButton} border-[#5470F4] bg-[#5470F4] text-white hover:bg-[#435cd9]`}><Plus size={16} />Connect an AI provider</button><span className="text-xs text-gray-500">Use your own API account</span></div>}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">{suggestions.map(item => <button key={item.title} disabled={blocked} onClick={() => { setDraft(item.text); textarea.current?.focus({ preventScroll: true }); }} className="group min-w-0 rounded-2xl border border-[#1F293D] bg-[#111827]/60 p-4 text-left transition-colors hover:border-[#5470F4]/60 hover:bg-[#161F30]"><span className="flex items-center justify-between gap-3 text-sm font-medium text-gray-300">{item.title}<ArrowUp size={15} className="shrink-0 rotate-45 text-gray-500 group-hover:text-[#5CC5FA]" /></span><span className="mt-2 block text-xs leading-5 text-gray-500">{item.text.split('.')[0]}.</span></button>)}</div>
        </div> : <div className="mx-auto w-full max-w-4xl px-4 pb-8 pt-6 sm:px-8 sm:pt-10">
          {conversation.messages.map(message => <article key={message.id} aria-label={message.role === 'user' ? 'Your message' : `${providerName(conversation.provider)} reply`} className={`mb-8 flex min-w-0 ${message.role === 'user' ? 'justify-end' : 'gap-3 sm:gap-4'}`}>
            {message.role === 'assistant' && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#5470F4]/25 bg-[#5470F4]/10 text-[#5CC5FA]"><Sparkles size={16} /></span>}
            <div className={message.role === 'user' ? 'max-w-[92%] whitespace-pre-wrap break-words rounded-3xl rounded-tr-lg border border-[#1F293D] bg-[#161F30] px-5 py-3 text-[15px] leading-7 text-gray-100 sm:max-w-[85%]' : 'min-w-0 flex-1'}>
              {message.role === 'user' ? message.content : <><p className="mb-2 text-xs font-medium text-gray-500">{providerName(conversation.provider)}</p>{message.content ? <AIMessageBody text={message.content} /> : message.status === 'pending' ? <span role="status" className="inline-flex items-center gap-2 py-2 text-sm text-gray-500"><span className="h-2 w-2 animate-pulse rounded-full bg-[#5CC5FA]" />Thinking…</span> : !message.errorMessage && <p className="text-sm text-gray-500">{message.status === 'stopped' ? 'Generation stopped.' : 'No reply was returned. You can send another message.'}</p>}
              {message.errorMessage && <div role="alert" className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm leading-6 text-amber-100"><p>{message.errorMessage}</p>{isAIBillingError(message.errorCode) && <a href={aiBillingUrl(conversation.provider)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center font-medium text-[#5CC5FA] underline underline-offset-4">Open {providerName(conversation.provider)} API billing</a>}{isAIQuotaError(message.errorCode) && conversation.provider === 'gemini' && <a href={aiBillingUrl('gemini')} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center font-medium text-[#5CC5FA] underline underline-offset-4">Check Gemini quota &amp; usage</a>}</div>}
              {message.status === 'limited' && <p className="mt-3 text-xs text-amber-200/80">Reply limit reached. Ask the model to continue.</p>}{message.status === 'stopped' && message.content && !message.errorMessage && <p className="mt-3 text-xs text-gray-500">Generation stopped</p>}{message.status === 'error' && message.content && !message.errorMessage && <p className="mt-3 text-xs text-amber-200/80">Reply interrupted</p>}
              {message.content && message.status !== 'pending' && <button onClick={async () => { try { await navigator.clipboard.writeText(message.content); setCopied(message.id); setTimeout(() => setCopied(''), 2000); } catch { setError('Copy is unavailable in this browser. Select the reply text to copy it.'); } }} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-500 hover:bg-[#161F30] hover:text-gray-200" aria-label="Copy reply">{copied === message.id ? <Check size={14} /> : <Copy size={14} />}{copied === message.id ? 'Copied' : 'Copy'}</button>}</>}
            </div>
          </article>)}
        </div>}
      </div>

      <div className="ai-composer relative shrink-0 px-3 pb-2 pt-2 sm:px-6">
        {awayFromBottom && <button className="absolute -top-12 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[#29344a] bg-[#161F30] text-gray-300 shadow-lg" aria-label="Scroll to latest message" onClick={() => { nearBottom.current = true; setAwayFromBottom(false); if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }}><ArrowDown size={18} /></button>}
        <div className="mx-auto w-full max-w-3xl">
          {error && <div role="alert" className="mb-2 flex max-h-28 items-start gap-2 overflow-y-auto rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200"><span className="flex-1">{error}{connectionError && <button className="ml-2 underline" onClick={async () => { setLoading(true); const result = await apiGet('/ai/connections'); applySettings(result); setLoading(false); if (result.success) setError(''); }}>Retry connection</button>}</span><button aria-label="Dismiss error" className="shrink-0 p-1" onClick={() => setError('')}><X size={14} /></button></div>}
          <form onSubmit={event => { event.preventDefault(); void send(); }} className="rounded-2xl border border-[#29344a] bg-[#111827] p-2 shadow-lg focus-within:border-[#5470F4]/70">
            <textarea ref={textarea} aria-label="Message AI" value={draft} disabled={blocked} maxLength={12000} rows={1} placeholder={conversation ? `Message ${providerName(activeProvider)}…` : 'Ask anything, or start with an idea…'} className="block min-h-12 w-full resize-none overflow-y-auto bg-transparent px-3 py-3 text-base leading-6 text-gray-100 outline-none placeholder:text-gray-500 disabled:opacity-60" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(hover: hover) and (pointer: fine)').matches) { event.preventDefault(); void send(); } }} />
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1 pt-1">
              <div className="flex min-w-0 max-w-[calc(100%-3rem)] flex-wrap items-center gap-1">
                {!conversation ? <><div className="relative min-w-0"><select aria-label="AI provider" value={provider} disabled={blocked} onChange={event => { const next = event.target.value as AIProvider; setProvider(next); setModel(connections.find(item => item.provider === next)?.defaultModel || ''); }} className="max-w-full appearance-none rounded-lg bg-[#161F30] py-2 pl-3 pr-7 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-[#5CC5FA]">{aiProviders.map(item => <option value={item.id} key={item.id}>{item.short}{connections.find(c => c.provider === item.id)?.connected ? '' : ' · Connect'}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-2 top-3 text-gray-500" /></div>{connection.connected ? <select aria-label="AI model" disabled={blocked} value={model || connection.defaultModel} onChange={event => setModel(event.target.value)} className="max-w-[min(46vw,16rem)] truncate rounded-lg bg-transparent px-2 py-2 text-xs text-gray-400 outline-none focus:ring-1 focus:ring-[#5CC5FA]">{connection.models.map(item => <option key={item.id} value={item.id} className="bg-[#111827]">{item.name}</option>)}</select> : <button type="button" disabled={blocked || connectionError} className="rounded-lg px-2 py-2 text-xs text-[#5CC5FA]" onClick={() => setSettingsOpen(true)}>Connect provider</button>}</> : <span className="truncate px-2 text-xs text-gray-500">{generating ? 'Generating reply…' : providerName(activeProvider)}</span>}
              </div>
              {busy ? <button type="button" aria-label="Stop generating" title="Stop generating" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-[#0B0F19] hover:bg-white" onClick={() => stream.current?.abort()}><Square size={15} fill="currentColor" /></button> : <button type="submit" aria-label="Send message" title="Send message" disabled={blocked || !draft.trim() || connectionError} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5470F4] text-white hover:bg-[#435cd9] disabled:bg-[#1F293D] disabled:text-gray-600"><ArrowUp size={20} /></button>}
            </div>
          </form>
          <p className="mt-2 text-center text-[10px] leading-4 text-gray-600">AI can make mistakes. Check important information.</p>
        </div>
      </div>
    </section>
    {settingsOpen && <AIConnections initialProvider={activeProvider} connections={connections} serverConfigured={serverConfigured} onClose={() => setSettingsOpen(false)} onChange={next => { setConnections(previous => previous.map(item => item.provider === next.provider ? next : item)); if (next.connected) { setProvider(next.provider); setModel(next.defaultModel); } }} />}
    {action && conversation && <AIDialog title={action === 'rename' ? 'Rename conversation' : 'Delete conversation'} onClose={() => setAction(null)} busy={actionBusy}>
      <form onSubmit={async event => {
        event.preventDefault(); setActionBusy(true); setActionError('');
        const result = action === 'rename' ? await apiPatch(`/ai/conversations/${conversation._id}`, { title }) : await apiDelete(`/ai/conversations/${conversation._id}`);
        setActionBusy(false);
        if (result.success) { if (action === 'rename') setConversation(result.conversation); else { setConversation(null); setDraft(''); setLocation(); } setAction(null); setHistoryPage(1); setHistoryVersion(value => value + 1); } else setActionError(result.message || 'Unable to update conversation.');
      }}>{action === 'rename' ? <label className="block text-sm text-gray-400">Conversation title<input autoFocus required maxLength={100} className={`${aiInput} mt-2`} value={title} onChange={event => setTitle(event.target.value)} /></label> : <p className="break-words text-sm leading-6 text-gray-400">Delete “{conversation.title}” and its messages? This cannot be undone.</p>}{actionError && <p role="alert" className="mt-3 text-sm text-red-300">{actionError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={actionBusy} className={aiButton} onClick={() => setAction(null)}>Cancel</button><button disabled={actionBusy} className={`${aiButton} ${action === 'delete' ? 'border-red-400/30 text-red-300' : 'bg-[#5470F4] text-white'}`}>{actionBusy && <Loader2 size={15} className="animate-spin" />}{action === 'delete' ? 'Delete' : 'Save'}</button></div></form>
    </AIDialog>}
  </div>;
}

// Keep read requests abortable without changing the shared API helpers.
async function apiGetWithSignal(endpoint: string, signal?: AbortSignal) {
  return apiFetch(endpoint, { method: 'GET', signal, cache: 'no-store' });
}
