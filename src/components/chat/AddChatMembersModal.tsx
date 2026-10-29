'use client';
import { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import ParticipantPicker from '../calls/ParticipantPicker';
import { apiPost } from '../../lib/api';
import type { MeetingPerson } from '../../lib/meetings';
import type { ChatConversation } from '../../lib/chat';

export default function AddChatMembersModal({ conversation, onClose, onSaved }: { conversation: ChatConversation; onClose: () => void; onSaved: (conversation: ChatConversation) => void }) {
  const [selected, setSelected] = useState<MeetingPerson[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; dialog.current?.querySelector<HTMLButtonElement>('button')?.focus(); return () => previous?.focus(); }, []);
  async function save() {
    setBusy(true); setError('');
    const result = await apiPost(`/chat/conversations/${conversation._id}/members`, { participantIds: selected.map(person => person._id) });
    setBusy(false);
    if (result.success) onSaved(result.conversation); else setError(result.message || 'Unable to add members.');
  }
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Add conversation members" className="max-h-[85dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-[#29334a] bg-[#111827] p-5" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') { const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input')); const first = controls[0], last = controls.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}><div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">Add conversation members</h2><button disabled={busy} onClick={onClose} aria-label="Close add members"><X size={20} /></button></div>
      <p className="text-sm text-gray-400">New members can read this conversation’s history and participate in its chats and calls.</p>
      <ParticipantPicker selected={selected} onChange={setSelected} disabled={busy} excludeIds={conversation.members.flatMap(member => member.user ? [member.user._id] : [])} limit={50 - conversation.members.length} label="Conversation members" addLabel="Choose members" />
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}<button disabled={busy || !selected.length} onClick={() => void save()} className="gradient-btn w-full rounded-xl p-3 text-sm disabled:opacity-40">{busy ? 'Adding…' : 'Add members'}</button>
    </div>
  </div>;
}
