'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Copy, Link as LinkIcon, Mic, MicOff, Phone, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCalls } from '../../context/CallContext';
import { apiFetch } from '../../lib/api';
import { chatTitle, type ChatConversation } from '../../lib/chat';
import { mediaError } from '../../lib/calls';
import { MediaTile } from '../../components/calls/CallOverlay';
import MeetingWorkspace from '../../components/calls/MeetingWorkspace';
import ParticipantPicker from '../../components/calls/ParticipantPicker';
import type { MeetingPerson, ScheduledMeeting } from '../../lib/meetings';

export default function MeetPage() {
  return <Suspense fallback={<p className="p-8 text-gray-500">Loading meeting…</p>}><MeetingWorkspace><MeetLobby /></MeetingWorkspace></Suspense>;
}

function MeetLobby() {
  const params = useSearchParams(); const router = useRouter();
  const { user } = useAuth(); const calls = useCalls();
  const conversationId = params.get('conversation') || '';
  const callId = params.get('call') || undefined; const scheduledId = params.get('meeting');
  const [room, setRoom] = useState<ChatConversation | null>(null);
  const [participants, setParticipants] = useState<MeetingPerson[]>([]);
  const [title, setTitle] = useState(''); const [link, setLink] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledMeeting | null>(null);
  const [video, setVideo] = useState(params.get('mode') !== 'audio'); const [microphone, setMicrophone] = useState(true);
  const [preview, setPreview] = useState<MediaStream | null>(null); const previewRef = useRef<MediaStream | null>(null);
  const previewRequest = useRef(0); const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false); const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => {
    // Deep links replace the pre-join room and stop any private preview.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoom(null); setScheduled(null); setError(''); setVideo(params.get('mode') !== 'audio');
    previewRequest.current++; previewRef.current?.getTracks().forEach(track => track.stop());
    previewRef.current = null; setPreview(null); setPreviewing(false);
    if (!conversationId) return;
    const controller = new AbortController();
    if (!/^[a-f\d]{24}$/i.test(conversationId)) { setError('Invalid meeting link.'); return; }
    void apiFetch(`/meetings/rooms/${conversationId}`, { signal: controller.signal, cache: 'no-store' }).then(result => {
      if (controller.signal.aborted) return;
      if (result.success) setRoom(result.room); else setError(result.message || 'This meeting is only available to invited users.');
    });
    if (scheduledId) void apiFetch(`/meetings/${encodeURIComponent(scheduledId)}`, { signal: controller.signal, cache: 'no-store' }).then(result => {
      if (controller.signal.aborted) return;
      if (result.success && result.meeting.conversation === conversationId) { setScheduled(result.meeting); setVideo(result.meeting.mode === 'video'); }
      else setError('This invitation changed. Open its latest link from Calendar.');
    });
    return () => controller.abort();
  }, [params, conversationId, scheduledId]);
  useEffect(() => () => { previewRequest.current++; previewRef.current?.getTracks().forEach(track => track.stop()); }, []);
  function chooseVideo(enabled: boolean) {
    previewRequest.current++; previewRef.current?.getTracks().forEach(track => track.stop());
    previewRef.current = null; setPreview(null); setVideo(enabled); setPreviewing(false);
  }
  async function startPreview() {
    const request = ++previewRequest.current; setPreviewing(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Calling requires HTTPS or localhost and a supported browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false });
      if (request !== previewRequest.current) { stream.getTracks().forEach(track => track.stop()); return; }
      previewRef.current?.getTracks().forEach(track => track.stop()); stream.getAudioTracks().forEach(track => { track.enabled = microphone; });
      previewRef.current = stream; setPreview(stream);
    } catch (failure) { setError(mediaError(failure)); }
    finally { if (request === previewRequest.current) setPreviewing(false); }
  }
  async function join() {
    setError(''); setCreating(true);
    try {
      let id = conversationId;
      if (!id) {
        const result = await apiFetch('/meetings/rooms', { method: 'POST', body: JSON.stringify({ title: title.trim() || 'Team meeting', participantIds: participants.map(person => person._id) }) });
        if (!result.success) throw new Error(result.message || 'Unable to create meeting');
        id = result.room._id; setRoom(result.room);
      }
      const stream = previewRef.current; previewRef.current = null; setPreview(null);
      const joined = await calls.join(id, video, microphone, callId, stream, scheduled?._id);
      if (joined && !conversationId) router.replace(`/meet?conversation=${id}&mode=${video ? 'video' : 'audio'}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to start meeting'); }
    finally { setCreating(false); }
  }
  const busy = calls.busy || creating || previewing;
  return <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-8 sm:px-10 sm:py-12 xl:min-h-[70dvh] xl:grid-cols-[1fr_1.12fr] xl:gap-16">
    <section className="min-w-0">
      <p className="mb-3 text-sm font-medium text-[#1a73e8]">{conversationId ? 'Your meeting is ready' : 'Connect with your team'}</p>
      <h1 className="max-w-xl text-3xl font-normal leading-tight tracking-tight text-[#202124] sm:text-[42px]">{scheduled?.title || (conversationId ? 'Ready to join?' : 'Video calls and meetings for everyone.')}</h1>
      <p className="mb-7 mt-4 max-w-lg text-base leading-relaxed text-[#5f6368]">{conversationId ? `Join ${room ? chatTitle(room, user?.id || '') : 'your teammates'} with your microphone and camera set just how you like.` : 'Bring people together with voice, video, and screen sharing. Invite anyone in your organization, all in one place.'}</p>
      {!conversationId && <div className="mb-6 space-y-5">
        <label className="block text-sm text-[#5f6368]">Meeting title<input aria-label="Meeting title" maxLength={120} value={title} placeholder="e.g. Product catch-up" onChange={event => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dadce0] bg-white px-3 py-3 text-[#202124] outline-none focus:border-[#1a73e8]" /></label>
        <ParticipantPicker selected={participants} onChange={setParticipants} disabled={busy} />
      </div>}
      {scheduled && <div className="mb-5 flex flex-wrap gap-2">{scheduled.participants.map(person => <span key={person._id} className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs text-[#1967d2]">{person.name}</span>)}</div>}
      <div className="mb-5 inline-flex rounded-full bg-[#f1f3f4] p-1" aria-label="Meeting type"><button disabled={busy} aria-pressed={video} onClick={() => chooseVideo(true)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${video ? 'bg-white text-[#1967d2] shadow-sm' : 'text-[#5f6368]'}`}><Video size={17} />Video call</button><button disabled={busy} aria-pressed={!video} onClick={() => chooseVideo(false)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${!video ? 'bg-white text-[#1967d2] shadow-sm' : 'text-[#5f6368]'}`}><Phone size={17} />Voice call</button></div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <p className={`mb-3 text-xs ${calls.connected ? 'text-emerald-700' : 'text-amber-700'}`}>{calls.connected ? '● Calling connected' : 'Connecting to call server…'}</p>
      {calls.meeting ? <button onClick={() => calls.setMinimized(false)} className="rounded-full bg-[#1a73e8] px-6 py-3 font-medium text-white">Return to current call</button> : <button disabled={!calls.connected || busy || !!conversationId && !room || !!scheduledId && (!scheduled || !['scheduled', 'in_progress'].includes(scheduled.status))} onClick={() => void join()} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#1765cc] disabled:opacity-40">{video ? <Video size={19} /> : <Phone size={19} />}{busy ? 'Joining…' : callId || scheduledId ? 'Join meeting' : video ? 'Start or join video call' : 'Start or join voice call'}</button>}
      {conversationId ? <button disabled={!room} onClick={() => void navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => setError('Could not copy the meeting link.'))} className="ml-3 inline-flex items-center gap-2 py-3 text-sm text-[#1a73e8]"><Copy size={16} />{copied ? 'Link copied' : 'Copy meeting link'}</button> : <Link href="/meet?view=calendar" className="ml-3 inline-flex items-center gap-2 py-3 text-sm font-medium text-[#1a73e8]"><CalendarDays size={17} />Schedule a meeting</Link>}
      {!conversationId && <form className="mt-6 flex min-w-0 items-center gap-2 border-t border-[#e8eaed] pt-6" onSubmit={event => {
        event.preventDefault(); try { const url = new URL(link, window.location.origin); if (url.origin !== window.location.origin || url.pathname !== '/meet' || !url.searchParams.get('conversation')) throw Error(); router.push(`${url.pathname}${url.search}`); } catch { setError('Paste a Neximet meeting link to join.'); }
      }}><label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#dadce0] px-3 py-3"><LinkIcon size={19} className="shrink-0 text-[#5f6368]" /><input aria-label="Meeting link" placeholder="Enter a meeting link" value={link} onChange={event => setLink(event.target.value)} className="min-w-0 flex-1 text-sm text-[#202124] outline-none" /></label><button disabled={!link.trim()} className="rounded-full px-4 py-3 text-sm font-medium text-[#1a73e8] disabled:opacity-40">Join</button></form>}
      <p className="mt-6 flex items-center gap-2 text-xs text-[#5f6368]"><ShieldCheck size={16} />Private meetings · Up to 8 people · Invited users only</p>
    </section>
    <section className="min-w-0 space-y-4"><div className="relative overflow-hidden rounded-3xl bg-[#202124] p-3 shadow-sm"><MediaTile stream={preview} name={user?.name || 'Your preview'} muted visible={!!preview && video} /><div className="absolute bottom-7 left-0 right-0 flex justify-center gap-3"><button aria-pressed={microphone} onClick={() => { const enabled = !microphone; setMicrophone(enabled); previewRef.current?.getAudioTracks().forEach(track => { track.enabled = enabled; }); }} className={`flex items-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm text-white ${microphone ? 'bg-[#3c4043]' : 'bg-[#ea4335]'}`}>{microphone ? <Mic size={18} /> : <MicOff size={18} />}{microphone ? 'Microphone on' : 'Microphone off'}</button><button disabled={busy} aria-pressed={video} onClick={() => chooseVideo(!video)} className={`flex items-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm text-white ${video ? 'bg-[#3c4043]' : 'bg-[#ea4335]'}`}>{video ? <Video size={18} /> : <VideoOff size={18} />}{video ? 'Camera on' : 'Camera off'}</button></div></div>
      <p className="text-center text-xs text-[#5f6368]">{preview ? 'Preview is private. You have not joined the meeting.' : 'Check your devices before joining. Preview starts only when you choose it.'}</p><div className="text-center"><button disabled={busy || !!calls.meeting} onClick={() => void startPreview()} className="rounded-full px-4 py-2 text-sm font-medium text-[#1a73e8] hover:bg-[#e8f0fe] disabled:opacity-40">{previewing ? 'Starting preview…' : 'Check microphone & camera'}</button></div>
    </section>
  </div>;
}
