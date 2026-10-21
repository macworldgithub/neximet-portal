'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Download, History, Plus, Search, Video, Volume2, VolumeX, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useCalls } from '../../context/CallContext';
import { apiFetch } from '../../lib/api';
import { chatTitle } from '../../lib/chat';
import type { ChatConversation } from '../../lib/chat';
import { calendarDays, duration, meetingCalendarFile, meetingLink, timezones, utcTime, wallTime, type MeetingHistory, type ScheduledMeeting } from '../../lib/meetings';
import ParticipantPicker from './ParticipantPicker';
import ChatNotifications from '../chat/ChatNotifications';

const field = 'mt-1 w-full rounded-lg border border-[#dadce0] bg-white p-3 text-sm text-[#202124] outline-none focus:border-[#1a73e8]';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#dadce0] px-3 py-2 text-sm disabled:opacity-40';
const format = (value: string, zone: string, date = true) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...(date ? { day: 'numeric', month: 'short', year: 'numeric' } as const : {}), hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const statusLabel = (value: string) => value.replaceAll('_', ' ');
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  return now;
}

function Modal({ title, children, close, busy = false }: { title: string; children: React.ReactNode; close: () => void; busy?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3" onMouseDown={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div ref={root} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#dadce0] bg-white p-5 shadow-2xl outline-none sm:p-7" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) close();
      if (event.key !== 'Tab') return;
      const controls = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select:not(:disabled), a[href]') || [])];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}><header className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Close meeting dialog" disabled={busy} onClick={close} className="rounded-lg p-2 hover:bg-[#f1f3f4]"><X size={20} /></button></header>{children}</div>
  </div>;
}

function ScheduleForm({ meeting, day, zone, close, saved }: { meeting?: ScheduledMeeting; day: string; zone: string; close: () => void; saved: () => void }) {
  const { conversations: cachedConversations } = useChat(); const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>(cachedConversations);
  const initialZone = meeting?.timezone || zone;
  const [initialStart] = useState(() => meeting ? wallTime(meeting.startsAt, initialZone) : day === wallTime(new Date(), zone).slice(0, 10) ? wallTime(new Date(Date.now() + 3600000), zone) : `${day}T10:00`);
  const [title, setTitle] = useState(meeting?.title || '');
  const [description, setDescription] = useState(meeting?.description || '');
  const [conversation, setConversation] = useState('');
  const [participants, setParticipants] = useState(() => (meeting?.participants || []).filter(person => person._id !== user?.id));
  const [timezone, setTimezone] = useState(initialZone);
  const [starts, setStarts] = useState(initialStart);
  const [ends, setEnds] = useState(meeting ? wallTime(meeting.endsAt, initialZone) : wallTime(new Date(+new Date(utcTime(initialStart, initialZone)) + 1800000), initialZone));
  const [mode, setMode] = useState(meeting?.mode || 'video');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch('/chat/conversations', { signal: controller.signal, cache: 'no-store' }).then(result => {
      if (controller.signal.aborted) return;
      if (result.success) setConversations(result.conversations); else setError(result.message || 'Unable to load conversations');
    });
    return () => controller.abort();
  }, []);
  return <Modal title={meeting ? 'Edit meeting' : 'Schedule meeting'} close={close} busy={busy}><form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const startsAt = utcTime(starts, timezone), endsAt = utcTime(ends, timezone);
      const result = await apiFetch(meeting ? `/meetings/${meeting._id}` : '/meetings', { method: meeting ? 'PATCH' : 'POST', body: JSON.stringify({ title, description, participantIds: participants.map(person => person._id), startsAt, endsAt, timezone, mode }) });
      if (!result.success) throw new Error(result.message || 'Unable to save meeting');
      saved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save meeting'); }
    finally { setBusy(false); }
  }}>
    <label className="block text-sm">Title<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className={field} /></label>
    <ParticipantPicker selected={participants} onChange={setParticipants} disabled={busy} />
    <details className="rounded-lg border border-[#dadce0] p-3"><summary className="cursor-pointer text-xs text-[#5f6368]">Add people from an existing conversation</summary><label className="mt-2 block text-sm">Invite conversation<select aria-label="Invite conversation" value={conversation} onChange={event => { setConversation(event.target.value); const chat = conversations.find(item => item._id === event.target.value); if (chat) setParticipants(current => [...new Map([...current, ...chat.members.flatMap(member => member.user && member.user._id !== user?.id ? [{ _id: member.user._id, name: member.user.name }] : [])].map(person => [person._id, person])).values()].slice(0, 7)); }} className={field}><option value="">Choose a conversation</option>{conversations.map(chat => <option key={chat._id} value={chat._id}>{chatTitle(chat, user?.id || '')}</option>)}</select></label></details>
    <p className="text-xs text-[#5f6368]">Selected participants receive this invitation in their calendar. You are included as the organizer.</p>
    <label className="block text-sm">Time zone<select aria-label="Time zone" value={timezone} onChange={event => setTimezone(event.target.value)} className={field}>{[...new Set([...timezones, timezone])].map(zone => <option key={zone}>{zone}</option>)}</select></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Starts<input required type="datetime-local" value={starts} onChange={event => setStarts(event.target.value)} className={field} /></label><label className="block text-sm">Ends<input required type="datetime-local" value={ends} onChange={event => setEnds(event.target.value)} className={field} /></label></div>
    <label className="block text-sm">Call type<select aria-label="Call type" value={mode} onChange={event => setMode(event.target.value as 'audio' | 'video')} className={field}><option value="video">Video meeting</option><option value="audio">Voice meeting</option></select></label>
    <label className="block text-sm">Description<textarea maxLength={4000} rows={3} value={description} onChange={event => setDescription(event.target.value)} className={field} /></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <footer className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={close} className={button}>Close</button><button disabled={busy} className={`${button} bg-[#1a73e8] text-white`}>{busy ? 'Saving…' : meeting ? 'Save changes' : 'Schedule meeting'}</button></footer>
  </form></Modal>;
}

function MeetingDetails({ meeting, zone, close, changed, edit }: { meeting: ScheduledMeeting; zone: string; close: () => void; changed: (meeting: ScheduledMeeting) => void; edit: () => void }) {
  const { user } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [copied, setCopied] = useState(false); const [confirmCancel, setConfirmCancel] = useState(false);
  const organizer = meeting.organizer?._id === user?.id;
  const now = useNow();
  const joinable = meeting.status === 'in_progress' || meeting.status === 'scheduled' && +new Date(meeting.startsAt) <= now + 900000 && +new Date(meeting.endsAt) > now;
  const rsvp = meeting.responses.find(item => item.user === user?.id)?.response;
  async function command(path: string, body: object = {}) {
    setBusy(true); setError('');
    const result = await apiFetch(`/meetings/${meeting._id}/${path}`, { method: 'POST', body: JSON.stringify(body) });
    if (result.success) changed(result.meeting); else setError(result.message || 'Unable to update meeting');
    setBusy(false);
  }
  return <Modal title={meeting.title} close={close} busy={busy}>
    <p className="mb-3 text-xs uppercase tracking-wide text-[#1967d2]">{statusLabel(meeting.status)} · {meeting.mode === 'audio' ? 'Voice' : 'Video'}</p>
    <p className="text-sm">{format(meeting.startsAt, zone)} — {format(meeting.endsAt, zone, false)}</p><p className="mt-1 text-xs text-[#5f6368]">{zone} · Created in {meeting.timezone}</p>
    <p className="mt-3 text-sm text-[#5f6368]">Organizer: {meeting.organizer?.name || 'Former teammate'}</p>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Invited participants">{meeting.participants.map(person => <span key={person._id} className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs text-[#1967d2]">{person.name}{person._id === meeting.organizer?._id ? ' (organizer)' : ''}</span>)}</div>
    {meeting.description && <p className="mt-4 whitespace-pre-wrap text-sm text-[#3c4043]">{meeting.description}</p>}
    <div className="my-5 flex flex-wrap gap-2">{joinable && <Link className={`${button} bg-[#1a73e8] text-white`} href={meetingLink(meeting)}><Video size={17} />Join meeting</Link>}
      <button className={button} onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}${meetingLink(meeting)}`).then(() => setCopied(true)).catch(() => setError('Unable to copy the meeting link.')); }}><Copy size={16} />{copied ? 'Copied' : 'Copy link'}</button>
      <button className={button} onClick={() => {
        const url = URL.createObjectURL(new Blob([meetingCalendarFile(meeting, window.location.origin)], { type: 'text/calendar;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `meeting-${meeting._id}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}><Download size={16} />Add to calendar</button>
    </div>
    {meeting.status === 'scheduled' && !joinable && <p className="mb-4 text-xs text-[#5f6368]">Join opens 15 minutes before the start. Meetings cannot be joined after their scheduled end.</p>}
    {meeting.status === 'scheduled' && <div className="mb-5 flex flex-wrap items-center gap-2 text-sm"><span className="mr-2 text-[#5f6368]">Your RSVP</span>{(['accepted', 'tentative', 'declined'] as const).map(response => <button key={response} disabled={busy} aria-pressed={rsvp === response} className={`${button} capitalize ${rsvp === response ? 'bg-[#e8f0fe] text-[#1967d2]' : ''}`} onClick={() => void command('rsvp', { response })}>{response}</button>)}</div>}
    <h3 className="mb-2 text-sm font-semibold">Invited teammates ({meeting.participants.length})</h3><ul className="max-h-44 space-y-2 overflow-y-auto text-sm">{meeting.participants.map(person => <li key={person._id} className="flex justify-between gap-3"><span>{person.name}</span><span className="text-xs capitalize text-[#5f6368]">{meeting.responses.find(item => item.user === person._id)?.response || 'Awaiting reply'}</span></li>)}</ul>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {organizer && meeting.status === 'scheduled' && <footer className="mt-6 flex flex-wrap items-center gap-2 border-t border-[#dadce0] pt-4"><button className={button} disabled={busy} onClick={edit}>Edit meeting</button>{confirmCancel ? <><span className="text-sm text-[#5f6368]">Cancel for everyone?</span><button className={`${button} bg-red-600`} disabled={busy} onClick={() => void command('cancel')}>Confirm cancellation</button><button className={button} onClick={() => setConfirmCancel(false)}>Keep meeting</button></> : <button className={`${button} text-red-700`} onClick={() => setConfirmCancel(true)}>Cancel meeting</button>}</footer>}
  </Modal>;
}

function MeetingCalendar({ zone, setZone }: { zone: string; setZone: (zone: string) => void }) {
  const now = useNow();
  const [month, setMonth] = useState(() => wallTime(new Date(), zone).slice(0, 7));
  const [selected, setSelected] = useState(() => wallTime(new Date(), zone).slice(0, 10));
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]); const [upcoming, setUpcoming] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [form, setForm] = useState<{ meeting?: ScheduledMeeting } | null>(null); const [details, setDetails] = useState<ScheduledMeeting | null>(null);
  const request = useRef<AbortController | null>(null);
  const days = calendarDays(month);
  const refresh = useCallback(async () => {
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const range = calendarDays(month);
    const end = new Date(Date.parse(`${range[41]}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const from = utcTime(`${range[0]}T00:00`, zone), to = utcTime(`${end}T00:00`, zone);
    const [result, next] = await Promise.all([apiFetch(`/meetings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal: controller.signal, cache: 'no-store' }), apiFetch('/meetings/upcoming', { signal: controller.signal, cache: 'no-store' })]);
    if (controller.signal.aborted) return;
    if (result.success && next.success) { setMeetings(result.meetings); setUpcoming(next.meetings); setError(result.hasMore ? 'This month has more than 500 meetings. Choose a narrower view.' : ''); }
    else setError(result.message || next.message || 'Unable to load meetings');
    setLoading(false);
  }, [month, zone]);
  // refresh only updates rendered data after its asynchronous API responses.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 30000); return () => { clearInterval(timer); request.current?.abort(); }; }, [refresh]);
  const dayMeetings = meetings.filter(meeting => wallTime(meeting.startsAt, zone).slice(0, 10) <= selected && wallTime(meeting.endsAt, zone).slice(0, 10) >= selected);
  function move(offset: number) { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); const next = date.toISOString().slice(0, 7); setMonth(next); setSelected(`${next}-01`); }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><button className={button} onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button><h2 className="min-w-36 text-center font-semibold">{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))}</h2><button className={button} onClick={() => move(1)} aria-label="Next month"><ChevronRight size={18} /></button><button className={`${button} hidden sm:inline-flex`} onClick={() => { const today = wallTime(new Date(), zone).slice(0, 10); setSelected(today); setMonth(today.slice(0, 7)); }}>Today</button></div>
      <div className="flex flex-wrap gap-2"><select aria-label="Calendar time zone" value={zone} onChange={event => setZone(event.target.value)} className="rounded-lg border border-[#dadce0] bg-white px-2 py-2 text-xs">{timezones.map(zone => <option key={zone}>{zone}</option>)}</select><button className={`${button} bg-[#1a73e8] text-white`} onClick={() => setForm({})}><Plus size={17} />Schedule meeting</button></div>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0 rounded-2xl border border-[#dadce0] bg-white p-2 sm:p-4" aria-label="Meeting calendar">
      <div className="grid grid-cols-7 text-center text-xs text-[#5f6368]">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="py-2">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">{days.map(day => {
        const events = meetings.filter(meeting => wallTime(meeting.startsAt, zone).slice(0, 10) === day);
        return <button key={day} aria-label={`${day}, ${events.length} meetings`} aria-pressed={selected === day} onClick={() => setSelected(day)} className={`min-h-20 min-w-0 overflow-hidden rounded-lg border p-1 text-left align-top sm:min-h-24 sm:p-2 ${selected === day ? 'border-[#1a73e8] bg-[#1a73e8]/15' : 'border-[#e8eaed] hover:bg-[#f1f3f4]'} ${day.startsWith(month) ? '' : 'opacity-40'}`}><span className={`mb-1 block text-xs ${day === wallTime(new Date(), zone).slice(0, 10) ? 'font-bold text-[#1967d2]' : ''}`}>{Number(day.slice(-2))}</span>{events.slice(0, 2).map(meeting => <span key={meeting._id} className={`mb-1 block truncate rounded px-1 py-0.5 text-[9px] sm:text-[10px] ${meeting.status === 'cancelled' ? 'bg-red-500/10 text-red-700 line-through' : 'bg-[#1a73e8]/20 text-[#1967d2]'}`}>{format(meeting.startsAt, zone, false)} <span className="hidden sm:inline">{meeting.title}</span></span>)}{events.length > 2 && <span className="text-[10px] text-[#5f6368]">+{events.length - 2} more</span>}</button>;
      })}</div>
      <h3 className="mb-3 mt-5 text-sm font-semibold">Meetings on {selected}</h3>{loading ? <p className="text-sm text-[#5f6368]">Loading meetings…</p> : dayMeetings.length ? <div className="space-y-2">{dayMeetings.map(meeting => <button key={meeting._id} onClick={() => setDetails(meeting)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#dadce0] p-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-medium">{meeting.title}</span><span className="text-xs text-[#5f6368]">{format(meeting.startsAt, zone, false)} – {format(meeting.endsAt, zone, false)}</span></span><span className="text-xs capitalize text-[#5f6368]">{statusLabel(meeting.status)}</span></button>)}</div> : <p className="text-sm text-[#5f6368]">No meetings scheduled for this day.</p>}
    </section><aside className="rounded-2xl border border-[#dadce0] bg-white p-4"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Clock size={17} />Upcoming meetings</h2><div className="space-y-3">{upcoming.length ? upcoming.map(meeting => <button key={meeting._id} onClick={() => setDetails(meeting)} className="w-full rounded-lg border border-[#dadce0] p-3 text-left"><span className="block truncate text-sm font-medium">{meeting.title}</span><span className="mt-1 block text-xs text-[#5f6368]">{format(meeting.startsAt, zone)}</span><span className="mt-1 block text-xs text-[#1967d2]">{meeting.status === 'in_progress' ? 'In progress' : +new Date(meeting.startsAt) - now <= 900000 ? 'Starts soon · join available' : `${meeting.participants.length} invited`}</span></button>) : <p className="text-sm text-[#5f6368]">Your upcoming invitations will appear here.</p>}</div></aside></div>
    {details && <MeetingDetails key={details._id} meeting={details} zone={zone} close={() => setDetails(null)} changed={meeting => { setDetails(meeting); void refresh(); }} edit={() => { setForm({ meeting: details }); setDetails(null); }} />}
    {form && <ScheduleForm meeting={form.meeting} day={selected} zone={zone} close={() => setForm(null)} saved={() => { setForm(null); void refresh(); }} />}
  </div>;
}

function HistoryList({ zone }: { zone: string }) {
  const { meeting: liveMeeting } = useCalls();
  const [history, setHistory] = useState<MeetingHistory[]>([]); const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState(''); const request = useRef<AbortController | null>(null);
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const refresh = useCallback(async (before?: string) => {
    setLoading(true); request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const params = new URLSearchParams({ q: search }); if (before) params.set('before', before);
    const result = await apiFetch(`/meetings/history?${params}`, { signal: controller.signal, cache: 'no-store' });
    if (controller.signal.aborted) return;
    if (result.success) { setHistory(current => before ? [...current, ...result.history] : result.history); setHasMore(result.hasMore); setError(''); }
    else setError(result.message || 'Unable to load meeting history');
    setLoading(false);
  }, [search]);
  // The initial history fetch updates state after awaiting the network.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); return () => request.current?.abort(); }, [refresh, liveMeeting?.id]);
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><h2 className="text-lg font-semibold">Your meeting history</h2><button disabled={loading} className={button} onClick={() => void refresh()}>Refresh</button></div><label className="flex items-center gap-2 rounded-lg border border-[#dadce0] bg-white px-3 py-2"><Search size={16} className="text-[#5f6368]" /><input aria-label="Search meeting history" placeholder="Search meeting titles" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 bg-transparent text-sm outline-none" /></label></div>
    <p className="text-xs text-[#5f6368]">Calls are recorded from this update onward. Times are shown in {zone}. Expand a meeting to see attendance.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && !history.length && <div className="rounded-2xl border border-[#dadce0] p-8 text-center text-sm text-[#5f6368]">Your completed, missed and ongoing calls will appear here.</div>}
    {history.map(item => <article key={item._id} className="rounded-2xl border border-[#dadce0] bg-white p-4"><button aria-expanded={expanded === item._id} onClick={() => setExpanded(expanded === item._id ? null : item._id)} className="flex w-full flex-wrap items-center justify-between gap-3 text-left"><span><span className="block font-medium">{item.title}</span><span className="mt-1 block text-xs text-[#5f6368]">{format(item.startedAt, zone)} · Started by {item.startedBy?.name || 'Former teammate'}</span></span><span className="text-right"><span className={`block text-xs capitalize ${item.outcome === 'missed' || item.outcome === 'declined' ? 'text-red-700' : 'text-[#1967d2]'}`}>{statusLabel(item.outcome)}</span><span className="mt-1 block text-xs text-[#5f6368]">Meeting: {duration(item.durationSeconds)} · You: {duration(item.attendanceSeconds)}</span></span></button>
      {expanded === item._id && <div className="mt-4 border-t border-[#dadce0] pt-3 text-xs text-[#5f6368]"><p>{item.mode === 'audio' ? 'Voice call' : 'Video call'} · {item.endedAt ? `Ended ${format(item.endedAt, zone)}` : 'Call in progress'}{item.endReason === 'server_disconnected' ? ' · Server connection ended' : ''}</p><ul className="mt-3 space-y-2">{item.attendance.map((entry, index) => <li key={index}>{entry.user?.name || 'Former teammate'} · {format(entry.joinedAt, zone, false)} – {entry.leftAt ? format(entry.leftAt, zone, false) : item.endedAt ? format(item.endedAt, zone, false) : 'Still in call'}</li>)}</ul><p className="mt-3">Invited: {item.invitedUsers.map(person => person?.name || 'Former teammate').join(', ')}</p></div>}
    </article>)}
    {loading && <p className="text-sm text-[#5f6368]">Loading history…</p>}{hasMore && <button disabled={loading} className={button} onClick={() => { setLoading(true); void refresh(history[history.length - 1]?._id); }}>Load older meetings</button>}
  </section>;
}

export default function MeetingWorkspace({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); const calls = useCalls();
  const params = useSearchParams(); const key = params.toString();
  const defaultView = params.has('conversation') || params.has('meeting') ? 'call' : params.get('view') === 'history' ? 'history' : params.get('view') === 'calendar' ? 'calendar' : 'call';
  const [selection, setSelection] = useState({ key, view: defaultView }); const [zone, setZone] = useState('Asia/Karachi');
  const view = selection.key === key ? selection.view : defaultView;
  return <div className="flex h-full min-h-0 flex-col bg-[#f8fafd] text-[#202124]"><header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#e8eaed] bg-white px-5 py-4 sm:px-8"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f0fe] text-[#1a73e8]"><Video size={25} /></span><span className="text-xl tracking-tight text-[#5f6368]"><strong className="font-semibold text-[#3c4043]">Neximet</strong> Meet</span><div className="ml-auto flex flex-wrap items-center gap-2"><button onClick={() => void calls.toggleRinging()} aria-pressed={calls.ringingEnabled} title="Play a ringtone for incoming calls while this app is open" className="flex items-center gap-2 rounded-xl border border-[#dadce0] px-3 py-2.5 text-xs text-[#3c4043]">{calls.ringingEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}{calls.ringingEnabled ? 'Ringing on' : 'Ringing off'}</button>{user && <ChatNotifications userId={user.id} light />}</div></header><nav aria-label="Meetings workspace" className="flex shrink-0 gap-1 border-b border-[#e8eaed] bg-white px-3 py-2 sm:px-6">{[{ view: 'call', label: 'Start / join', icon: Video }, { view: 'calendar', label: 'Calendar', icon: CalendarDays }, { view: 'history', label: 'History', icon: History }].map(item => <button key={item.view} aria-pressed={view === item.view} onClick={() => setSelection({ key, view: item.view })} className={`${button} border-transparent ${view === item.view ? 'bg-[#1a73e8]/20 text-[#1967d2]' : 'text-[#5f6368]'}`}><item.icon size={17} />{item.label}</button>)}</nav>
    <div className="min-h-0 flex-1 overflow-y-auto">{view === 'call' ? children : <div className="mx-auto max-w-7xl p-3 sm:p-6">{view === 'calendar' ? <MeetingCalendar zone={zone} setZone={setZone} /> : <HistoryList zone={zone} />}</div>}</div>
  </div>;
}
