'use client';

import { useEffect, useState } from 'react';
import { Check, Plus, Search, Users, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { initials } from '../../lib/chat';
import type { MeetingPerson } from '../../lib/meetings';

export default function ParticipantPicker({ selected, onChange, disabled = false, excludeIds = [], limit = 7, dark = true, label = 'Meeting participants', addLabel = 'Add participant' }: {
  selected: MeetingPerson[]; onChange: (people: MeetingPerson[]) => void; disabled?: boolean; excludeIds?: string[]; limit?: number; dark?: boolean; label?: string; addLabel?: string;
}) {
  const [people, setPeople] = useState<(MeetingPerson & { department?: string })[]>([]);
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch('/chat/people', { signal: controller.signal, cache: 'no-store' }).then(result => {
      if (controller.signal.aborted) return;
      if (result.success) { setPeople(result.people); setError(''); } else setError(result.message || 'Unable to load users');
      setLoading(false);
    });
    return () => controller.abort();
  }, [attempt]);
  const results = people.filter(person => !excludeIds.includes(person._id) && `${person.name} ${person.department || ''}`.toLowerCase().includes(query.toLowerCase()));
  const surface = dark ? 'border-white/15 bg-[#111827] text-white' : 'border-[#23314a] bg-[#111827] text-[#F3F4F6]';
  return <section aria-label={label} className="space-y-3">
    <div className="flex items-center justify-between gap-2"><span className={`flex items-center gap-2 text-sm font-medium ${dark ? 'text-white' : 'text-gray-300'}`}><Users size={17} />{label === 'Meeting participants' ? 'Participants' : label} <span className="text-xs opacity-60">{selected.length} selected</span></span><button type="button" disabled={disabled || limit <= 0} aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-[#9db2ff] disabled:opacity-40"><Plus size={16} />{addLabel}</button></div>
    {!!selected.length && <div className="flex flex-wrap gap-2">{selected.map(person => <span key={person._id} className={`flex max-w-full items-center gap-2 rounded-full border py-1 pl-1 pr-2 text-sm ${surface}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5470F4]/20 text-[10px] font-semibold text-[#afc5ff]">{initials(person.name)}</span><span className="truncate">{person.name}</span><button type="button" disabled={disabled} aria-label={`Remove ${person.name}`} onClick={() => onChange(selected.filter(item => item._id !== person._id))} className="rounded-full p-1 hover:bg-black/10"><X size={13} /></button></span>)}</div>}
    {open && <div className={`overflow-hidden rounded-xl border ${surface}`}>
      <label className="flex items-center gap-2 border-b border-current/10 px-3 py-2"><Search size={17} className="opacity-50" /><input aria-label="Search all users" autoComplete="off" placeholder="Search all users by name or department" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" /></label>
      <div className="max-h-48 overflow-y-auto p-1">{loading ? <p className="p-3 text-sm opacity-60">Loading users…</p> : error ? <div role="alert" className="p-3 text-sm text-red-500">{error}<button type="button" onClick={() => { setLoading(true); setAttempt(value => value + 1); }} className="ml-2 underline">Retry</button></div> : results.length ? results.map(person => {
        const checked = selected.some(item => item._id === person._id);
        return <button type="button" key={person._id} aria-label={`${checked ? 'Deselect' : 'Add'} ${person.name}`} aria-pressed={checked} disabled={disabled || !checked && selected.length >= limit} onClick={() => { onChange(checked ? selected.filter(item => item._id !== person._id) : [...selected, { _id: person._id, name: person.name }]); setQuery(''); }} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[#5470F4]/10 disabled:opacity-40"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5470F4]/15 text-xs font-medium text-[#9db2ff]">{initials(person.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm">{person.name}</span><span className="block truncate text-xs opacity-50">{person.department}</span></span>{checked ? <Check size={17} className="text-[#9db2ff]" /> : <Plus size={16} className="opacity-50" />}</button>;
      }) : <p className="p-3 text-sm opacity-60">No users found.</p>}</div>
      <p className="border-t border-current/10 px-3 py-2 text-xs opacity-60">{limit <= 0 ? 'This meeting is full.' : `Select up to ${limit} people.`}</p>
    </div>}
  </section>;
}
