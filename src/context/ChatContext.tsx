'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';
import type { ChatConversation } from '../lib/chat';

const ChatContext = createContext<{
  conversations: ChatConversation[];
  unreadCount: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
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

  return <ChatContext.Provider value={{ conversations, unreadCount: conversations.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0), loading, error, refresh }}>{children}</ChatContext.Provider>;
}
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside ChatProvider');
  return context;
}
