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
  return [...new Map([...existing, ...incoming].map((message) => [message._id, message])).values()].sort((a, b) => a.sequence - b.sequence);
}
