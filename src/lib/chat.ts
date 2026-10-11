export interface ChatPerson {
  _id: string;
  name: string;
  department: string;
  role: string;
  isActive: boolean;
}
export interface ChatConversation {
  _id: string;
  kind: 'direct' | 'group';
  name?: string;
  members: { user: ChatPerson | null; typingUntil?: string | null }[];
  unreadCount?: number;
  lastMessage?: { text: string; createdAt: string; attachment?: { name: string } };
}
export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: ChatPerson | null;
  sequence: number;
  clientId: string;
  text: string;
  readBy: string[];
  deliveredBy?: string[];
  createdAt: string;
  attachment?: { name: string; size: number; mimeType: string };
}
export function chatTitle(chat: ChatConversation, userId: string) {
  return chat.kind === 'group' ? chat.name || 'Group chat' : chat.members.find((member) => member.user?._id !== userId)?.user?.name || 'Former teammate';
}
export function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(existing.map((message) => [message._id, message]));
  for (const message of incoming) {
    const previous = merged.get(message._id);
    merged.set(message._id, { ...message, readBy: [...new Set([...(previous?.readBy || []), ...message.readBy])], deliveredBy: [...new Set([...(previous?.deliveredBy || []), ...(message.deliveredBy || [])])] });
  }
  return [...merged.values()].sort((a, b) => a.sequence - b.sequence);
}

export function messageStatus(message: ChatMessage, chat: ChatConversation, userId: string): 'sent' | 'delivered' | 'seen' {
  const recipients = chat.members.flatMap((member) => member.user && member.user._id !== userId ? [member.user._id] : []);
  if (recipients.length && recipients.every((id) => message.readBy.includes(id))) return 'seen';
  if (recipients.length && recipients.every((id) => message.deliveredBy?.includes(id) || message.readBy.includes(id))) return 'delivered';
  return 'sent';
}

export type ChatEvent =
  | { type: 'chat:message'; conversationId: string; message: ChatMessage }
  | { type: 'chat:receipt'; conversationId: string; messageIds: string[]; userId: string; status: 'read' | 'delivered' }
  | { type: 'chat:typing'; conversationId: string; userId: string; typingUntil: string | null }
  | { type: 'chat:conversation'; conversationId: string };
export type ChatCommand = 'chat:send' | 'chat:read' | 'chat:delivered' | 'chat:typing';
