'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Users, MessageSquare, Loader2 } from 'lucide-react';
import { apiFetch, apiPost } from '../../lib/api';
import { initials, type ChatConversation, type ChatPerson } from '../../lib/chat';

export default function NewChatModal({ onClose, onCreated }: { onClose: () => void; onCreated: (chat: ChatConversation) => void }) {
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [kind, setKind] = useState<'direct' | 'group'>('direct');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    void apiFetch('/chat/people', { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.success) setPeople(result.people);
      else setError(result.message || 'Unable to load teammates');
      setLoading(false);
    });
    return () => { controller.abort(); previous?.focus(); };
  }, []);
  const create = async () => {
    setSaving(true); setError('');
    const result = await apiPost('/chat/conversations', { kind, name, participantIds: selected });
    setSaving(false);
    if (result.success) onCreated(result.conversation);
    else setError(result.message || 'Unable to create conversation');
  };
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" onClick={() => { if (!saving) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="new-chat-title" className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-2xl border border-[#1F293D] bg-[#111827] shadow-2xl" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key === 'Tab') {
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input');
        if (!controls?.length) return;
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <div className="flex items-center justify-between border-b border-[#1F293D] p-5"><h2 id="new-chat-title" className="text-lg font-semibold">New conversation</h2><button aria-label="Close new conversation" disabled={saving} onClick={onClose} className="rounded-lg p-2 hover:bg-[#1F293D]"><X size={20} /></button></div>
      <div className="space-y-4 p-5 pb-3">
        <div className="flex gap-2">{(['direct', 'group'] as const).map((type) => <button key={type} onClick={() => { setKind(type); setSelected([]); }} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm ${kind === type ? 'border-[#5470F4] bg-[#5470F4]/15 text-[#5CC5FA]' : 'border-[#1F293D] text-gray-400'}`}>{type === 'direct' ? <MessageSquare size={16} /> : <Users size={16} />}{type === 'direct' ? 'Direct message' : 'Group chat'}</button>)}</div>
        {kind === 'group' && <input aria-label="Group name" placeholder="Group name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] p-3 text-sm outline-none focus:border-[#5470F4]" />}
        <div className="relative"><Search className="absolute left-3 top-3 text-gray-500" size={18} /><input aria-label="Search teammates" placeholder="Search by name or department" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#5470F4]" /></div>
        <p className="text-xs text-gray-400">{kind === 'group' ? `${selected.length} selected · choose at least 2 teammates` : 'Choose a teammate to start chatting'}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5">{loading ? <p className="p-6 text-center text-gray-400">Loading teammates…</p> : people.filter((person) => `${person.name} ${person.department}`.toLowerCase().includes(query.toLowerCase())).map((person) => <label key={person._id} className={`mb-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected.includes(person._id) ? 'border-[#5470F4] bg-[#5470F4]/10' : 'border-transparent hover:bg-[#161F30]'}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5470F4]/15 text-sm font-semibold text-[#5CC5FA]">{initials(person.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{person.name}</span><span className="block truncate text-xs text-gray-400">{person.department}</span></span><input type={kind === 'direct' ? 'radio' : 'checkbox'} name="chat-participants" aria-label={`Select ${person.name}`} checked={selected.includes(person._id)} onChange={() => setSelected((current) => kind === 'direct' ? [person._id] : current.includes(person._id) ? current.filter((id) => id !== person._id) : [...current, person._id])} className="h-4 w-4 accent-[#5470F4]" />
      </label>)}{!loading && !people.some((person) => `${person.name} ${person.department}`.toLowerCase().includes(query.toLowerCase())) && <p className="p-6 text-center text-sm text-gray-400">No teammates found.</p>}</div>
      <div className="space-y-3 border-t border-[#1F293D] p-5">{error && <p role="alert" className="text-sm text-rose-400">{error}</p>}<button onClick={() => void create()} disabled={saving || loading || (kind === 'direct' ? selected.length !== 1 : selected.length < 2 || !name.trim() || selected.length > 49)} className="gradient-btn flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold disabled:opacity-40">{saving && <Loader2 className="animate-spin" size={16} />}Start conversation</button></div>
    </div>
  </div>;
}
