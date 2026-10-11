'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { API_URL, apiFetch, apiPost } from '../lib/api';
import { io, type Socket } from 'socket.io-client';
import type { ChatCommand, ChatConversation, ChatEvent } from '../lib/chat';
import { bindPushAccount } from '../lib/push';

type ChatResult = { success: boolean; message?: import('../lib/chat').ChatMessage | string };

const ChatContext = createContext<{
  conversations: ChatConversation[];
  unreadCount: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  connected: boolean;
  subscribe: (listener: (event: ChatEvent) => void) => () => void;
  command: (event: ChatCommand, payload: Record<string, unknown> & { conversationId: string }) => Promise<ChatResult>;
} | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  return <ChatState key={user?.id || 'signed-out'} userId={user?.id} token={token}>{children}</ChatState>;
}

function ChatState({ children, userId, token }: { children: React.ReactNode; userId?: string; token: string | null }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const socket = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<(event: ChatEvent) => void>());
  const subscribe = useCallback((listener: (event: ChatEvent) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);
  const command = useCallback(async (event: ChatCommand, payload: Record<string, unknown> & { conversationId: string }): Promise<ChatResult> => {
    if (socket.current?.connected) {
      try { return await socket.current.timeout(10000).emitWithAck(event, payload); }
      catch { /* An acknowledgement may be lost. The API uses the same retry-safe client ID. */ }
    }
    const routes = { 'chat:send': 'messages', 'chat:read': 'read', 'chat:delivered': 'delivered', 'chat:typing': 'typing' };
    return apiPost(`/chat/conversations/${payload.conversationId}/${routes[event]}`, payload);
  }, []);
  const refresh = useCallback(async () => {
    if (!userId || document.visibilityState === 'hidden') return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const result = await apiFetch('/chat/conversations', { signal: request.signal, cache: 'no-store' });
    if (request.signal.aborted) return;
    if (result.success) {
      setConversations(result.conversations);
      setError('');
    } else setError(result.message || 'Unable to load conversations');
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId || !token) return;
    const client = io(new URL(API_URL).origin, { path: '/api/socket.io', transports: ['websocket'], auth: { token }, reconnectionDelayMax: 5000 });
    socket.current = client;
    let cancelled = false, syncing = false;
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then((registration) => {
      if (!cancelled) return bindPushAccount(userId, registration);
    }).catch(() => {});
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      if (!refreshTimer) refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh(); }, 150);
    };
    const syncDeliveries = async () => {
      if (syncing || cancelled) return;
      syncing = true;
      try {
        // Receipt acknowledgements cover every conversation, including a hidden
        // tab. Receiving a message never marks it as seen.
        for (let page = 0; page < 100 && !cancelled; page++) {
          const result = await apiFetch('/chat/deliveries', { cache: 'no-store' });
          if (!result.success || !result.messages.length) break;
          const groups = new Map<string, string[]>();
          for (const message of result.messages as { _id: string; conversation: string }[]) groups.set(message.conversation, [...(groups.get(message.conversation) || []), message._id]);
          let failed = false;
          for (const [conversationId, messageIds] of groups) {
            const response = await command('chat:delivered', { conversationId, messageIds });
            if (!response.success) failed = true;
          }
          if (failed) break;
        }
      } finally { syncing = false; }
    };
    client.on('connect', () => { setConnected(true); refreshSoon(); void syncDeliveries(); });
    client.on('disconnect', () => setConnected(false));
    client.on('connect_error', () => setConnected(false));
    const events = ['chat:message', 'chat:receipt', 'chat:typing', 'chat:conversation'] as const;
    for (const type of events) client.on(type, (data) => {
      const event = { ...data, type } as ChatEvent;
      listeners.current.forEach((listener) => listener(event));
      if (event.type === 'chat:message' && event.message.sender?._id !== userId) void command('chat:delivered', { conversationId: event.conversationId, messageIds: [event.message._id] });
      if (type !== 'chat:typing') refreshSoon();
    });
    void syncDeliveries();
    void apiPost('/chat/push/flush', {});
    const catchupTimer = setInterval(() => { void syncDeliveries(); void apiPost('/chat/push/flush', {}); }, 60000);
    const resume = () => { refreshSoon(); void syncDeliveries(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      cancelled = true; clearInterval(catchupTimer); clearTimeout(refreshTimer);
      client.disconnect(); socket.current = null;
      window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume);
    };
  }, [userId, token, command, refresh]);

  useEffect(() => {
    if (!userId) return;
    // This fetch updates state only after its asynchronous network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), 12000);
    const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      clearInterval(timer);
      controller.current?.abort();
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [userId, token, refresh]);

  return <ChatContext.Provider value={{ conversations, unreadCount: conversations.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0), loading, error, refresh, connected, subscribe, command }}>{children}</ChatContext.Provider>;
}
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside ChatProvider');
  return context;
}
