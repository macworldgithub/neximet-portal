'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy, Mic, MicOff, Phone, Users, Video, VideoOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useCalls } from '../../context/CallContext';
import { apiFetch } from '../../lib/api';
import { chatTitle, type ChatConversation } from '../../lib/chat';
import { mediaError } from '../../lib/calls';
import { MediaTile } from '../../components/calls/CallOverlay';
import NewChatModal from '../../components/chat/NewChatModal';
import MeetingWorkspace from '../../components/calls/MeetingWorkspace';
import type { ScheduledMeeting } from '../../lib/meetings';

export default function MeetPage() {
  return <Suspense fallback={<p className="p-8 text-gray-400">Loading meeting…</p>}><MeetingWorkspace><MeetLobby /></MeetingWorkspace></Suspense>;
}

function MeetLobby() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { conversations, refresh } = useChat();
  const calls = useCalls();
  const [conversationId, setConversationId] = useState('');
  const [linkedChat, setLinkedChat] = useState<ChatConversation | null>(null);
  const [callId, setCallId] = useState<string | undefined>();
  const scheduledId = params.get('meeting');
  const [scheduled, setScheduled] = useState<ScheduledMeeting | null>(null);
  const [video, setVideo] = useState(true);
  const [microphone, setMicrophone] = useState(true);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const previewRequest = useRef(0);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const selected = conversations.find(chat => chat._id === conversationId) || linkedChat;

  useEffect(() => {
    const id = params.get('conversation');
    // Read deep links on the client; the page can still be statically rendered.
    if (id && /^[a-f\d]{24}$/i.test(id)) {
      // Synchronize selection when navigation changes the meeting deep link.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConversationId(id);
      previewRequest.current++;
      previewRef.current?.getTracks().forEach(track => track.stop());
      previewRef.current = null; setPreview(null); setPreviewing(false); setLinkedChat(null);
      setScheduled(null); setError('');
      const call = params.get('call');
      setCallId(call && /^[a-f\d-]{36}$/i.test(call) ? call : undefined);
      setVideo(params.get('mode') !== 'audio');
      const controller = new AbortController();
      if (scheduledId) void apiFetch(`/meetings/${encodeURIComponent(scheduledId)}`, { signal: controller.signal, cache: 'no-store' }).then(result => {
        if (controller.signal.aborted) return;
        if (result.success && result.meeting.conversation === id) { setScheduled(result.meeting); setVideo(result.meeting.mode === 'video'); }
        else setError(result.message || 'Meeting invitation not found.');
      });
      void apiFetch(`/chat/conversations/${id}`, { signal: controller.signal }).then(result => {
        if (controller.signal.aborted) return;
        if (result.success) setLinkedChat(result.conversation);
        else setError(result.message || 'This meeting is only available to conversation members.');
      });
      return () => controller.abort();
    }
  }, [params, scheduledId]);
  useEffect(() => () => { previewRequest.current++; previewRef.current?.getTracks().forEach(track => track.stop()); }, []);

  async function startPreview() {
    const request = ++previewRequest.current;
    setPreviewing(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Calling requires HTTPS or localhost and a supported browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false });
      if (request !== previewRequest.current) { stream.getTracks().forEach(track => track.stop()); return; }
      previewRef.current?.getTracks().forEach(track => track.stop());
      stream.getAudioTracks().forEach(track => { track.enabled = microphone; });
      previewRef.current = stream; setPreview(stream);
    } catch (failure) { setError(mediaError(failure)); }
    finally { setPreviewing(false); }
  }
  function toggleVideo() {
    previewRef.current?.getTracks().forEach(track => track.stop());
    previewRef.current = null; setPreview(null); setVideo(!video);
  }
  async function join() {
    if (!conversationId || !selected) { setError('Choose a conversation first.'); return; }
    setError('');
    const stream = previewRef.current;
    // Transfer ownership before joining, so navigation cannot stop call media.
    previewRef.current = null; setPreview(null);
    await calls.join(conversationId, video, microphone, callId, stream, scheduled?._id);
  }

  return <div className="h-full overflow-y-auto px-4 py-8 sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-center gap-3"><span className="rounded-2xl bg-[#5470F4]/15 p-3 text-[#8da6ff]"><Video size={26} /></span><div><h1 className="text-2xl font-bold">Neximet Meet</h1><p className="text-sm text-gray-400">Voice, video and screen sharing with your team.</p></div></div>
      <div className="grid items-start gap-8 lg:grid-cols-[1.25fr_1fr]">
        <section className="space-y-4"><MediaTile stream={preview} name={user?.name || 'Your preview'} muted visible={!!preview && video} /><div className="flex flex-wrap justify-center gap-3"><button aria-pressed={microphone} onClick={() => { const enabled = !microphone; setMicrophone(enabled); previewRef.current?.getAudioTracks().forEach(track => { track.enabled = enabled; }); }} className={`flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm ${microphone ? 'bg-[#182133]' : 'bg-red-500/20'}`}>{microphone ? <Mic size={18} /> : <MicOff size={18} />}{microphone ? 'Microphone on' : 'Microphone off'}</button><button disabled={previewing || calls.busy} aria-pressed={video} onClick={toggleVideo} className={`flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm ${video ? 'bg-[#182133]' : 'bg-red-500/20'}`}>{video ? <Video size={18} /> : <VideoOff size={18} />}{video ? 'Camera on' : 'Camera off'}</button></div><p className="text-center text-xs text-gray-500">{preview ? 'Preview is private. You have not joined the meeting.' : 'Check your devices before joining. Preview starts only when you choose it.'}</p><div className="text-center"><button disabled={previewing || calls.busy || !!calls.meeting} onClick={() => void startPreview()} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[#9db2ff] disabled:opacity-40">{previewing ? 'Starting preview…' : 'Check microphone & camera'}</button></div></section>
        <section className="rounded-2xl border border-[#23314a] bg-[#111827] p-6 sm:p-8"><h2 className="mb-2 text-xl font-semibold">{scheduled?.title || (callId ? 'Ready to join?' : 'Bring your team together')}</h2><p className="mb-6 text-sm leading-relaxed text-gray-400">Start or join a call with the people in a direct or group conversation. Up to 8 people can join.</p>
          <label htmlFor="meeting-conversation" className="mb-2 block text-sm font-medium">Conversation</label><select id="meeting-conversation" value={conversationId} disabled={calls.busy || !!scheduledId} onChange={event => { setConversationId(event.target.value); setLinkedChat(null); setCallId(undefined); setError(''); }} className="mb-3 w-full rounded-xl border border-[#2c3952] bg-[#0B0F19] p-3 text-sm"><option value="">Choose teammates</option>{linkedChat && !conversations.some(chat => chat._id === linkedChat._id) && <option value={linkedChat._id}>{chatTitle(linkedChat, user?.id || '')}</option>}{conversations.map(chat => <option key={chat._id} value={chat._id}>{chatTitle(chat, user?.id || '')}</option>)}</select>
          <button disabled={!!scheduledId} onClick={() => setNewChat(true)} className="mb-6 flex items-center gap-2 text-sm text-[#9db2ff]"><Users size={16} />Choose a person or create a group</button>
          {selected && <p className="mb-5 text-xs text-gray-400">Only members of {chatTitle(selected, user?.id || '')} can join this meeting.</p>}
          {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          <p className={`mb-4 text-xs ${calls.connected ? 'text-emerald-400' : 'text-amber-300'}`}>{calls.connected ? '● Calling connected' : 'Connecting to call server…'}</p>
          {calls.meeting ? <button onClick={() => calls.setMinimized(false)} className="w-full rounded-xl bg-[#5470F4] p-3 font-medium">Return to current call</button> : <button disabled={!selected || !calls.connected || calls.busy || previewing || !!scheduledId && (!scheduled || !['scheduled', 'in_progress'].includes(scheduled.status))} onClick={() => void join()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5470F4] p-3 font-medium disabled:opacity-40"><Phone size={18} />{calls.busy ? 'Joining…' : callId || scheduledId ? 'Join meeting' : video ? 'Start or join video call' : 'Start or join voice call'}</button>}
          <button disabled={!selected} onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/meet?conversation=${conversationId}${callId ? `&call=${callId}` : ''}${scheduledId ? `&meeting=${scheduledId}` : ''}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => setError('Could not copy the link. Copy the address from your browser.')); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 p-3 text-sm text-gray-300 disabled:opacity-40"><Copy size={16} />{copied ? 'Link copied' : 'Copy meeting link'}</button>
          <p className="mt-5 text-xs leading-relaxed text-gray-500">Screen sharing is available from inside the call on supported desktop browsers.</p>
        </section>
      </div>
    </div>
    {newChat && <NewChatModal onClose={() => setNewChat(false)} onCreated={chat => { setConversationId(chat._id); setLinkedChat(chat); setCallId(undefined); setNewChat(false); void refresh(); }} />}
  </div>;
}
