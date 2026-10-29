'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Loader2, MessageSquare, Paperclip, Plus, Search, Send, Users, X, ChevronDown, RefreshCw, Phone, Video } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { API_URL, apiFetch, getToken } from '../../lib/api';
import { attachmentPath, chatTitle, initials, mergeMessages, messageAttachments, messageStatus, validateChatFiles, type ChatConversation, type ChatMessage } from '../../lib/chat';
import { uploadChatMessage } from '../../lib/chatUploads';
import NewChatModal from '../../components/chat/NewChatModal';
import ChatAttachment from '../../components/chat/ChatAttachment';

type PendingMessage = { clientId: string; chatId: string; text: string; files?: File[]; progress?: number; state: 'sending' | 'failed'; error?: string };
const time = (date: string) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (date: string) => new Date(date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const field = 'w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] text-sm outline-none focus:border-[#5470F4]';

export default function ChatPage() {
  const { user } = useAuth();
  const { conversations, loading: inboxLoading, error: inboxError, refresh, connected, subscribe, command } = useChat();
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [newChat, setNewChat] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { text: string; files?: File[] }>>({});
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [newMessagesBelow, setNewMessagesBelow] = useState(false);
  const [online, setOnline] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const activeId = active?._id;
  const currentChat = useRef(activeId);
  currentChat.current = activeId;
  const connection = useRef(connected);
  connection.current = connected;
  const messageRef = useRef(messages);
  messageRef.current = messages;
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const readBusy = useRef(false);
  const typingAt = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingIds = useRef(new Set<string>());
  const draft = activeId ? drafts[activeId] || { text: '' } : { text: '' };

  const scrollToBottom = useCallback(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    nearBottom.current = true;
    setNewMessagesBelow(false);
  }, []);

  useLayoutEffect(() => {
    const input = composer.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }, [draft.text, activeId]);

  useEffect(() => {
    const panel = scroller.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) panel.scrollTop = panel.scrollHeight;
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [activeId]);

  useEffect(() => subscribe((event) => {
    if (event.conversationId !== currentChat.current) return;
    if (event.type === 'chat:message') {
      setMessages((current) => mergeMessages(current, [event.message]));
      setPending((current) => current.filter((item) => item.clientId !== event.message.clientId || event.message.sender?._id !== user?.id));
    } else if (event.type === 'chat:receipt') {
      setMessages((current) => current.map((message) => event.messageIds.includes(message._id) ? {
        ...message, deliveredBy: [...new Set([...(message.deliveredBy || []), event.userId])],
        readBy: event.status === 'read' ? [...new Set([...message.readBy, event.userId])] : message.readBy,
      } : message));
    } else if (event.type === 'chat:typing') {
      setActive((current) => current ? { ...current, members: current.members.map((member) => member.user?._id === event.userId ? { ...member, typingUntil: event.typingUntil } : member) } : current);
    }
  }), [subscribe, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('conversation');
    if (!id || !/^[a-f\d]{24}$/i.test(id) || !user) return;
    const controller = new AbortController();
    void apiFetch(`/chat/conversations/${id}`, { signal: controller.signal, cache: 'no-store' }).then((result) => {
      if (!controller.signal.aborted && result.success) setActive(result.conversation);
    });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const controller = new AbortController();
    let busy = false;
    let initialized = false;
    let lastPoll = 0;
    setMessages([]); setLoading(true); setHasMore(false); setError(''); setActionError(''); setShowMembers(false);
    nearBottom.current = true; setNewMessagesBelow(false);
    const poll = async (force = false) => {
      if (busy || document.visibilityState === 'hidden') return;
      if (!force && connection.current && Date.now() - lastPoll < 20000) return;
      lastPoll = Date.now();
      busy = true;
      try {
        const previous = messageRef.current;
        const result = await apiFetch(`/chat/conversations/${activeId}/messages`, { signal: controller.signal, cache: 'no-store' });
        if (controller.signal.aborted) return;
        if (!result.success) { setError(result.message || 'Messages could not be loaded'); return; }
        let incoming: ChatMessage[] = result.messages;
        // Fetch gaps during high traffic; the latest page also catches delayed writes and read receipts.
        if (initialized && previous.length && incoming.length && incoming[0].sequence > previous[previous.length - 1].sequence) {
          let cursor = previous[previous.length - 1].sequence;
          let more = true;
          while (more && !controller.signal.aborted) {
            const catchup = await apiFetch(`/chat/conversations/${activeId}/messages?after=${cursor}`, { signal: controller.signal, cache: 'no-store' });
            if (!catchup.success) throw new Error(catchup.message || 'Unable to sync messages');
            incoming = mergeMessages(incoming, catchup.messages);
            more = catchup.hasMore && catchup.messages.length > 0;
            if (catchup.messages.length) cursor = catchup.messages[catchup.messages.length - 1].sequence;
          }
        }
        if (controller.signal.aborted) return;
        setActive(result.conversation);
        setMessages((current) => mergeMessages(current, incoming));
        setPending((current) => current.filter((item) => !incoming.some((message) => message.clientId === item.clientId && message.sender?._id === user?.id)));
        if (!initialized) setHasMore(result.hasMore);
        initialized = true; setError('');
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to sync messages');
      } finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void poll();
    const timer = setInterval(() => void poll(), 3000);
    const resume = () => { if (document.visibilityState === 'visible') void poll(true); };
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => {
      controller.abort(); clearInterval(timer);
      document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingAt.current = 0;
      void command('chat:typing', { conversationId: activeId, typing: false });
    };
  }, [activeId, user?.id, command]);

  const latestSequence = messages[messages.length - 1]?.sequence;
  useEffect(() => {
    if (nearBottom.current) scrollToBottom();
    else setNewMessagesBelow(true);
  }, [latestSequence, scrollToBottom]);

  useEffect(() => {
    if (!activeId || !user) return;
    const visible = new Set<string>();
    const mark = async () => {
      if (readBusy.current || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const ids = messageRef.current.filter((message) => visible.has(message._id) && message.sender?._id !== user.id && !message.readBy.includes(user.id)).map((message) => message._id).slice(-100);
      if (!ids.length) return;
      readBusy.current = true;
      try {
        const result = await command('chat:read', { conversationId: activeId, messageIds: ids });
        if (result.success && currentChat.current === activeId) {
          setMessages((current) => current.map((message) => ids.includes(message._id) ? { ...message, readBy: [...new Set([...message.readBy, user.id])], deliveredBy: [...new Set([...(message.deliveredBy || []), user.id])] } : message));
          void refresh();
        }
      } finally { readBusy.current = false; }
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (id) { if (entry.isIntersecting) visible.add(id); else visible.delete(id); }
      }
      void mark();
    }, { root: scroller.current, threshold: 0.1 });
    scroller.current?.querySelectorAll('[data-message-id]').forEach((node) => observer.observe(node));
    const timer = setInterval(() => void mark(), 1000);
    window.addEventListener('focus', mark);
    return () => { observer.disconnect(); clearInterval(timer); window.removeEventListener('focus', mark); };
  }, [activeId, user, messages.length, refresh, command]);

  const selectChat = (chat: ChatConversation) => {
    dragDepth.current = 0; setDragging(false);
    setActive(chat);
    const url = new URL(window.location.href); url.searchParams.set('conversation', chat._id);
    window.history.replaceState(window.history.state, '', url);
  };
  const updateDraft = (text: string) => {
    if (!activeId) return;
    setDrafts((current) => ({ ...current, [activeId]: { ...current[activeId], text } }));
    if (text.trim() && Date.now() - typingAt.current > 3000) {
      typingAt.current = Date.now(); void command('chat:typing', { conversationId: activeId, typing: true });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (!text.trim()) { typingAt.current = 0; void command('chat:typing', { conversationId: activeId, typing: false }); }
    else typingTimer.current = setTimeout(() => { typingAt.current = 0; void command('chat:typing', { conversationId: activeId, typing: false }); }, 2000);
  };

  const deliver = async (item: PendingMessage) => {
    if (sendingIds.current.has(item.clientId)) return;
    sendingIds.current.add(item.clientId);
    setPending((current) => current.map((entry) => entry.clientId === item.clientId ? { ...entry, state: 'sending', progress: undefined, error: undefined } : entry));
    try {
      let result;
      if (!item.files?.length) result = await command('chat:send', { conversationId: item.chatId, text: item.text, clientId: item.clientId });
      else {
        result = await uploadChatMessage(item.chatId, item.clientId, item.text, item.files, progress => {
          setPending(current => current.map(entry => entry.clientId === item.clientId ? { ...entry, progress } : entry));
        });
      }
      if (!result.success || typeof result.message !== 'object') throw new Error(typeof result.message === 'string' ? result.message : 'Message could not be sent');
      if (currentChat.current === item.chatId) {
        nearBottom.current = true;
        const message = result.message as ChatMessage;
        setMessages((current) => mergeMessages(current, [message]));
      }
      setPending((current) => current.filter((entry) => entry.clientId !== item.clientId));
      void refresh();
    } catch (failure) {
      setPending((current) => current.map((entry) => entry.clientId === item.clientId ? { ...entry, state: 'failed', error: failure instanceof Error ? failure.message : 'Message could not be sent' } : entry));
    } finally { sendingIds.current.delete(item.clientId); }
  };
  const send = () => {
    if (!activeId || (!draft.text.trim() && !draft.files?.length) || !online || loading) return;
    const item: PendingMessage = { clientId: crypto.randomUUID(), chatId: activeId, text: draft.text.trim(), files: draft.files, state: 'sending' };
    setPending((current) => [...current, item]);
    setDrafts((current) => ({ ...current, [activeId]: { text: '' } }));
    typingAt.current = 0;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    nearBottom.current = true;
    void deliver(item); composer.current?.focus({ preventScroll: true });
    requestAnimationFrame(scrollToBottom);
  };

  const loadOlder = async () => {
    if (!activeId || !messages.length || historyLoading) return;
    setHistoryLoading(true); setActionError('');
    const id = activeId;
    const result = await apiFetch(`/chat/conversations/${id}/messages?before=${messages[0].sequence}`, { cache: 'no-store' });
    if (currentChat.current === id) {
      if (result.success) {
        const height = scroller.current?.scrollHeight || 0;
        const top = scroller.current?.scrollTop || 0;
        nearBottom.current = false;
        setMessages((current) => mergeMessages(current, result.messages)); setHasMore(result.hasMore);
        requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = top + scroller.current.scrollHeight - height; });
      } else setActionError(result.message || 'Unable to load history');
    }
    setHistoryLoading(false);
  };

  const download = async (message: ChatMessage, index = 0) => {
    setActionError('');
    const token = getToken();
    try {
      const response = await fetch(`${API_URL}${attachmentPath(message, index)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to download this file. Please retry.');
      const blob = await response.blob();
      if (token !== getToken()) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = messageAttachments(message)[index]?.name || 'attachment'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Download failed'); }
  };

  const addFiles = (incoming: File[]) => {
    if (!activeId || !incoming.length) return;
    const files = [...(draft.files || []), ...incoming];
    const validation = validateChatFiles(files);
    if (validation) { setActionError(validation); return; }
    setActionError(''); setDrafts(current => ({ ...current, [activeId]: { text: current[activeId]?.text || '', files } }));
  };
  if (!user) return null;
  const title = active ? chatTitle(active, user.id) : '';
  const typing = active?.members.filter((member) => member.user?._id !== user.id && member.typingUntil && new Date(member.typingUntil).getTime() > clock).map((member) => member.user?.name).filter(Boolean) || [];
  const visibleChats = conversations.filter((chat) => `${chatTitle(chat, user.id)} ${chat.lastMessage?.text || ''}`.toLowerCase().includes(query.toLowerCase()));
  const unsent = pending.filter((item) => item.chatId === activeId && !messages.some((message) => message.clientId === item.clientId && message.sender?._id === user.id));
  return <div className="flex h-full min-h-0 min-w-0 flex-col">
    <div className="chat-workspace flex min-h-0 flex-1 overflow-hidden bg-[#111827]">
      <aside aria-label="Conversations" className={`${active ? 'hidden md:flex' : 'flex'} min-h-0 w-full shrink-0 flex-col border-r border-[#1F293D] md:w-72 xl:w-80`}>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-3"><div><h1 className="text-xl font-semibold">Chats</h1><p className="mt-0.5 text-[11px] text-gray-500">{connected ? 'Connected' : 'Syncing messages…'}</p></div><button onClick={() => setNewChat(true)} aria-label="New conversation" title="New conversation" className="communication-icon text-[#5CC5FA]"><Plus size={21} /></button></div>
        <div className="shrink-0 border-b border-[#1F293D] px-3 pb-3"><div className="relative"><Search size={17} className="absolute left-3 top-3 text-gray-500" /><input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} className={`${field} py-2.5 pl-10 pr-3`} /></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {inboxError && <div role="alert" className="m-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300">{inboxError}<button onClick={() => void refresh()} className="ml-2 underline">Retry</button></div>}
          {inboxLoading && <p className="p-8 text-center text-sm text-gray-400">Loading conversations…</p>}
          {!inboxLoading && !visibleChats.length && <div className="p-8 text-center"><MessageSquare className="mx-auto mb-3 text-[#5470F4]" size={30} /><p className="text-sm font-medium">{query ? 'No matching conversations' : 'Start a conversation'}</p><p className="mt-2 text-xs leading-relaxed text-gray-400">{query ? 'Try a different name or message.' : 'Message a teammate or bring your team into a group chat.'}</p>{!query && <button onClick={() => setNewChat(true)} className="mt-4 text-sm text-[#5CC5FA]">Find a teammate</button>}</div>}
          {visibleChats.map((chat) => { const label = chatTitle(chat, user.id); return <button key={chat._id} onClick={() => selectChat(chat)} aria-pressed={activeId === chat._id} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${activeId === chat._id ? 'bg-[#5470F4]/15' : 'hover:bg-[#161F30]'}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${chat.kind === 'group' ? 'bg-purple-500/15 text-purple-300' : 'bg-[#5470F4]/15 text-[#5CC5FA]'}`}>{chat.kind === 'group' ? <Users size={20} /> : initials(label)}</span>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{label}</span>{chat.lastMessage && <span className="shrink-0 text-[10px] text-gray-500">{new Date(chat.lastMessage.createdAt).toDateString() === new Date().toDateString() ? time(chat.lastMessage.createdAt) : new Date(chat.lastMessage.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}</span><span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-gray-400">{chat.lastMessage?.text || (chat.lastMessage?.attachments?.length ? (chat.lastMessage.attachments.length > 1 ? `${chat.lastMessage.attachments.length} attachments` : chat.lastMessage.attachments[0].name) : chat.lastMessage?.attachment?.name) || 'Say hello'}</span>{!!chat.unreadCount && <span aria-label={`${chat.unreadCount} unread messages`} className="rounded-full bg-[#5470F4] px-2 py-0.5 text-[10px] font-bold text-white">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}</span></span>
          </button>; })}
        </div>
      </aside>
      {active ? <section aria-label={`Chat with ${title}`} className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth.current++; setDragging(true); } }}
        onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
        onDragLeave={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); } }}
        onDrop={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false); addFiles(Array.from(event.dataTransfer.files)); } }}>
        {dragging && <div role="status" className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-[#5CC5FA] bg-[#0B0F19]/90 p-6 text-center"><div><Paperclip className="mx-auto mb-3 text-[#5CC5FA]" size={36} /><p className="text-lg font-semibold">Drop files to attach</p><p className="mt-2 text-sm text-gray-300">Up to 20 files · 100 MB total per message</p></div></div>}
        <header className="flex shrink-0 items-center gap-2 border-b border-[#1F293D] px-2 py-2 sm:px-4"><button onClick={() => setActive(null)} aria-label="Back to conversations" className="rounded-lg p-2 text-gray-400 md:hidden"><ArrowLeft size={20} /></button><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5470F4]/15 text-sm font-semibold text-[#5CC5FA]">{active.kind === 'group' ? <Users size={20} /> : initials(title)}</span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{title}</h2><p className="truncate text-xs text-gray-400">{active.kind === 'group' ? `${active.members.length} members` : active.members.find((member) => member.user?._id !== user.id)?.user?.department || 'Teammate'}</p></div><button onClick={() => setShowMembers(!showMembers)} aria-label="View conversation members" aria-expanded={showMembers} className="rounded-xl p-2 text-gray-400 hover:bg-[#1F293D]"><Users size={20} /></button></header>
        <div className="flex shrink-0 items-center gap-2 border-b border-[#1F293D] px-3 py-2 sm:px-4"><Link href={`/meet?conversation=${active._id}&mode=audio`} className="flex items-center gap-2 rounded-lg bg-[#5470F4]/15 px-3 py-2 text-xs text-[#9db2ff]"><Phone size={16} />Voice call</Link><Link href={`/meet?conversation=${active._id}&mode=video`} className="flex items-center gap-2 rounded-lg bg-[#5470F4]/15 px-3 py-2 text-xs text-[#9db2ff]"><Video size={16} />Video call</Link></div>
        {showMembers && <div className="max-h-40 overflow-y-auto border-b border-[#1F293D] bg-[#0B0F19] p-4"><p className="mb-2 text-xs font-semibold text-gray-400">Conversation members</p>{active.members.map((member, index) => <p key={member.user?._id || index} className="py-1 text-sm">{member.user?.name || 'Former teammate'}{member.user?._id === user.id ? ' (you)' : ''}<span className="ml-2 text-xs text-gray-500">{member.user?.isActive === false ? 'Inactive' : member.user?.role}</span></p>)}</div>}
        {(!online || error) && <p role="status" className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">{!online ? 'You are offline. Your drafts are kept while this page stays open.' : `${error} · Reconnecting automatically…`}</p>}
        <div className="relative min-h-0 flex-1">
        <div ref={scroller} data-chat-scroll onScroll={() => { const node = scroller.current; if (node) { nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100; if (nearBottom.current) setNewMessagesBelow(false); } }} className="h-full space-y-2 overflow-y-auto overscroll-contain bg-[#0B0F19]/50 px-3 py-4 sm:px-6">
          {hasMore && <div className="text-center"><button disabled={historyLoading} onClick={() => void loadOlder()} className="rounded-xl border border-[#1F293D] px-4 py-2 text-xs text-gray-400 hover:text-white disabled:opacity-50">{historyLoading ? 'Loading…' : 'Load earlier messages'}</button></div>}
          {loading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#5470F4]" size={24} /></div>}
          {!loading && !messages.length && !error && <div className="py-12 text-center"><MessageSquare className="mx-auto mb-3 text-[#5470F4]" size={36} /><p className="text-sm text-gray-300">Start the conversation with {title}.</p></div>}
          {messages.map((message, index) => { const own = message.sender?._id === user.id; const status = messageStatus(message, active, user.id); const statusLabel = status === 'seen' ? 'Seen by everyone' : status === 'delivered' ? 'Delivered to everyone' : 'Sent'; return <div key={message._id} data-message-id={message._id}>
            {(index === 0 || day(message.createdAt) !== day(messages[index - 1].createdAt)) && <div className="mb-5 text-center"><span className="rounded-full border border-[#1F293D] bg-[#111827] px-3 py-1 text-[10px] text-gray-400">{day(message.createdAt)}</span></div>}
            <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] rounded-2xl px-3 py-2 sm:max-w-[min(80%,48rem)] ${own ? 'rounded-br-sm bg-[#5470F4]/85 text-white' : 'rounded-bl-sm border border-[#1F293D] bg-[#161F30]'}`}>
              {!own && active.kind === 'group' && <p className="mb-1 text-xs font-semibold text-[#5CC5FA]">{message.sender?.name || 'Former teammate'}</p>}
              {message.text && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{message.text}</p>}
              {messageAttachments(message).map((attachment, index) => <ChatAttachment key={index} message={{ ...message, attachment }} attachmentIndex={index} onDownload={() => void download(message, index)} />)}
              <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px]"><time className="opacity-70" dateTime={message.createdAt}>{time(message.createdAt)}</time>{own && <span title={statusLabel} aria-label={statusLabel}>{status === 'sent' ? <Check size={14} className="text-gray-300" /> : <CheckCheck size={14} className={status === 'seen' ? 'text-[#38bdf8]' : 'text-gray-300'} />}</span>}</div>
            </div></div>
          </div>; })}
          {unsent.map((item) => <div key={item.clientId} className="flex justify-end"><div className="max-w-[90%] rounded-2xl rounded-br-sm border border-[#5470F4]/40 bg-[#5470F4]/20 px-4 py-3"><p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{item.text}</p>{item.files?.map((file, index) => <p key={index} className="mt-1 break-all text-xs text-gray-400">{file.name}</p>)}{item.state === 'sending' ? <p role="status" className="mt-2 text-right text-[10px] text-gray-400">{item.files?.length && item.progress !== undefined && item.progress < 100 ? `Uploading ${item.progress}%…` : 'Sending…'}</p> : <div className="mt-2 text-xs text-rose-300"><p role="alert">{item.error}</p><button onClick={() => void deliver(item)} disabled={!online} className="mt-2 inline-flex items-center gap-1 underline disabled:opacity-40"><RefreshCw size={12} />Retry</button><button onClick={() => setPending((current) => current.filter((entry) => entry.clientId !== item.clientId))} className="ml-3 underline">Dismiss</button></div>}</div></div>)}
        </div>
        {newMessagesBelow && <button onClick={scrollToBottom} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#5470F4]/40 bg-[#111827] px-4 py-2 text-xs text-[#5CC5FA] shadow-lg"><ChevronDown size={15} />New messages</button>}
        </div>
        {typing.length > 0 && <div className="shrink-0 px-4 py-1 text-xs text-[#5CC5FA]" aria-live="polite">{`${typing.slice(0, 2).join(', ')}${typing.length > 2 ? ' and others' : ''} ${typing.length === 1 ? 'is' : 'are'} typing…`}</div>}
        <form onSubmit={(event) => { event.preventDefault(); send(); }} className="chat-composer shrink-0 border-t border-[#1F293D] bg-[#111827] p-2 sm:px-4">
          <div className="max-h-36 overflow-y-auto overscroll-contain">
          {actionError && <p role="alert" className="mb-2 flex items-center justify-between gap-2 text-xs text-rose-300">{actionError}<button type="button" aria-label="Dismiss error" onClick={() => setActionError('')}><X size={14} /></button></p>}
          {draft.files?.map((file, index) => <div key={index} className="mb-2 flex items-center gap-2 rounded-lg bg-[#161F30] px-3 py-2 text-xs"><Paperclip size={14} /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0 text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" aria-label={`Remove attachment ${file.name}`} onClick={() => activeId && setDrafts(current => ({ ...current, [activeId]: { ...current[activeId], files: current[activeId]?.files?.filter((_, position) => position !== index) } }))}><X size={16} /></button></div>)}
          </div>
          {!!draft.files?.length && <p role="status" className="mb-2 text-[10px] text-gray-400">{draft.files.length} {draft.files.length === 1 ? 'file' : 'files'} · {(draft.files.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(1)} / 100 MB</p>}
          <div className="flex items-end gap-2"><input ref={fileInput} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.m4v,.mov,.webm,.pdf,.txt,.csv,.docx,.xlsx,.pptx,.zip" className="hidden" onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} /><button type="button" aria-label="Attach files (up to 20 files, 100 MB total)" onClick={() => fileInput.current?.click()} className="mb-1 rounded-xl p-2.5 text-gray-400 hover:bg-[#1F293D] hover:text-white"><Paperclip size={20} /></button><textarea ref={composer} aria-label="Message" placeholder={`Message ${title}…`} rows={1} maxLength={4000} value={draft.text} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(min-width: 768px)').matches) { event.preventDefault(); send(); } }} className={`${field} max-h-30 min-h-11 resize-none px-3 py-2.5`} /><button type="submit" onPointerDown={(event) => { if (document.activeElement === composer.current) event.preventDefault(); }} disabled={loading || !online || (!draft.text.trim() && !draft.files?.length)} aria-label="Send message" className="gradient-btn mb-1 rounded-xl p-3 disabled:opacity-40"><Send size={19} /></button></div><p className="mt-1 text-[10px] text-gray-500"><span className="hidden md:inline">Enter to send · Shift+Enter for a new line · </span>Drop or attach up to 20 files · 100 MB total{draft.text.length > 3500 && <span className="float-right">{draft.text.length}/4000</span>}</p>
        </form>
      </section> : <div className="hidden flex-1 flex-col items-center justify-center px-8 text-center md:flex"><div className="mb-5 rounded-3xl border border-[#5470F4]/20 bg-[#5470F4]/10 p-6"><MessageSquare className="text-[#5CC5FA]" size={44} /></div><h2 className="text-xl font-semibold">Your team, one conversation away</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-400">Share updates, ask questions, and keep everyone connected. Choose a conversation or start a new one.</p><button onClick={() => setNewChat(true)} className="gradient-btn mt-6 rounded-xl px-5 py-3 text-sm font-semibold">Start a conversation</button></div>}
    </div>
    {newChat && <NewChatModal onClose={() => setNewChat(false)} onCreated={(chat) => { setNewChat(false); selectChat(chat); void refresh(); }} />}
  </div>;
}
