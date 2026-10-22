'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Archive, Megaphone, Plus, Send, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, apiPost } from '../../lib/api';
import { useNotifications } from '../../context/NotificationContext';
import type { MeetingPerson } from '../../lib/meetings';
import ParticipantPicker from '../../components/calls/ParticipantPicker';

type Announcement = { _id: string; title: string; body: string; priority: string; audience: string; department?: string; author: { name: string; role: string } | null; createdAt: string };
const departments = ['Executive', 'Software Development', 'Digital Marketing (SEO)', 'Graphics Designing', 'WordPress Team'];
const field = 'w-full rounded-xl border border-[#23314a] bg-[#0B0F19] p-3 text-sm text-white outline-none focus:border-[#5470F4]';
export default function AnnouncementsPage() { return <Suspense fallback={<p className="p-6 text-gray-400">Loading announcements…</p>}><AnnouncementsWorkspace /></Suspense>; }
function AnnouncementsWorkspace() {
  const search = useSearchParams(); const selectedId = search.get('id');
  const { user } = useAuth(); const { refresh: refreshNotifications } = useNotifications();
  const executive = !!user && ['CEO', 'Super Admin'].includes(user.role);
  const [items, setItems] = useState<Announcement[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Announcement | null>(null); const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [audience, setAudience] = useState('everyone');
  const [priority, setPriority] = useState('normal'); const [department, setDepartment] = useState(departments[0]); const [people, setPeople] = useState<MeetingPerson[]>([]);
  const load = useCallback(async (before?: string, signal?: AbortSignal) => {
    const response = await apiFetch(`/announcements${before ? `?before=${before}` : ''}`, { signal, cache: 'no-store' });
    if (signal?.aborted) return;
    if (response.success) { setItems(old => before ? [...old, ...response.announcements] : response.announcements); setCursor(response.nextCursor); setError(''); }
    else setError(response.message || 'Unable to load announcements.');
    setLoading(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // Updates state only after the asynchronous API response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(undefined, controller.signal);
    const id = selectedId;
    if (id && /^[a-f\d]{24}$/i.test(id)) void apiFetch(`/announcements/${id}`, { signal: controller.signal, cache: 'no-store' }).then(response => {
      if (controller.signal.aborted) return;
      if (response.success) setSelected(response.announcement); else setError(response.message || 'Announcement unavailable.');
    });
    return () => controller.abort();
  }, [load, selectedId]);
  const publish = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const response = await apiPost('/announcements', { title, body, audience, priority, department, userIds: people.map(person => person._id) });
    if (response.success) { setComposing(false); setTitle(''); setBody(''); setPeople([]); setNotice(`Announcement published for ${response.recipientCount} ${response.recipientCount === 1 ? 'person' : 'people'}.`); await load(); }
    else setError(response.message || 'Unable to publish announcement.');
    setBusy(false);
  };
  const archive = async (id: string) => {
    setBusy(true); setError('');
    const response = await apiPost(`/announcements/${id}/archive`, {});
    if (response.success) { setItems(old => old.filter(item => item._id !== id)); if (selected?._id === id) setSelected(null); setNotice('Announcement archived.'); await refreshNotifications(); }
    else setError(response.message || 'Unable to archive announcement.');
    setBusy(false);
  };
  return <div className="space-y-6 p-4 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-3 text-2xl font-semibold"><Megaphone className="text-[#5CC5FA]" />Announcements</h1><p className="mt-2 text-sm text-gray-400">Company news and updates from your leadership team.</p></div>{executive && <button onClick={() => setComposing(value => !value)} aria-expanded={composing} className="flex items-center gap-2 rounded-xl bg-[#5470F4] px-4 py-3 text-sm"><Plus size={18} />New announcement</button>}</div>
    {error && <p role="alert" className="rounded-xl border border-rose-500/30 p-3 text-sm text-rose-300">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {executive && composing && <form onSubmit={publish} className="space-y-4 rounded-2xl border border-[#23314a] bg-[#111827] p-5 sm:p-6" aria-label="Publish announcement">
      <div className="flex justify-between"><h2 className="font-semibold">New announcement</h2><button type="button" disabled={busy} onClick={() => setComposing(false)} aria-label="Close announcement editor"><X size={20} /></button></div>
      <label className="block space-y-2 text-sm"><span>Title</span><input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} className={field} /></label>
      <label className="block space-y-2 text-sm"><span>Announcement</span><textarea required maxLength={10000} rows={6} value={body} onChange={event => setBody(event.target.value)} className={field} placeholder="Write your announcement…" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm"><span>Audience</span><select value={audience} onChange={event => setAudience(event.target.value)} className={field}><option value="everyone">Everyone</option><option value="department">A department</option><option value="users">Selected users</option></select></label><label className="space-y-2 text-sm"><span>Priority</span><select value={priority} onChange={event => setPriority(event.target.value)} className={field}><option value="normal">Normal</option><option value="important">Important</option></select></label></div>
      {audience === 'department' && <label className="block space-y-2 text-sm"><span>Department</span><select value={department} onChange={event => setDepartment(event.target.value)} className={field}>{departments.map(name => <option key={name}>{name}</option>)}</select></label>}
      {audience === 'users' && <ParticipantPicker selected={people} onChange={setPeople} disabled={busy} limit={500} label="Announcement recipients" addLabel="Add recipient" />}
      <p className="text-xs text-gray-400">Publishes immediately to active users in the selected audience. Recipients receive an inbox update and a device notification when enabled.</p>
      <button disabled={busy || !title.trim() || !body.trim() || audience === 'users' && !people.length} className="flex items-center gap-2 rounded-xl bg-[#5470F4] px-5 py-3 text-sm disabled:opacity-40"><Send size={17} />{busy ? 'Publishing…' : 'Publish announcement'}</button>
    </form>}
    {selected && !items.some(item => item._id === selected._id) && <section aria-label="Selected announcement" className="rounded-2xl border border-[#5470F4]/50 bg-[#182133] p-6"><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{selected.title}</h2><button onClick={() => setSelected(null)} aria-label="Close selected announcement"><X size={18} /></button></div><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">{selected.body}</p></section>}
    {loading ? <p className="text-sm text-gray-400">Loading announcements…</p> : !items.length ? <div className="rounded-2xl border border-[#23314a] bg-[#111827] p-10 text-center text-gray-400">No announcements yet.</div> : <div className="space-y-4">{items.map(item => <article key={item._id} className={`rounded-2xl border bg-[#111827] p-5 sm:p-6 ${item.priority === 'important' ? 'border-amber-500/40' : 'border-[#23314a]'}`}>
      <div className="flex items-start justify-between gap-4"><div className="min-w-0">{item.priority === 'important' && <span className="mb-2 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">Important</span>}<h2 className="break-words text-lg font-semibold">{item.title}</h2><p className="mt-2 text-xs text-gray-400">{item.author?.name || 'Leadership'} · {new Date(item.createdAt).toLocaleString()} · {item.audience === 'department' ? item.department : item.audience === 'users' ? 'Selected users' : 'Everyone'}</p></div>{executive && <button disabled={busy} onClick={() => void archive(item._id)} aria-label={`Archive ${item.title}`} title="Archive announcement" className="rounded-lg p-2 text-gray-400 hover:bg-[#23314a]"><Archive size={18} /></button>}</div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">{item.body}</p>
    </article>)}</div>}
    <div className="flex gap-3"><button onClick={() => void load()} className="rounded-xl border border-[#23314a] px-4 py-2 text-sm">Refresh</button>{cursor && <button onClick={() => void load(cursor)} className="rounded-xl border border-[#23314a] px-4 py-2 text-sm">Older announcements</button>}</div>
  </div>;
}
