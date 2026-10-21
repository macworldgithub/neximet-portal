'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { API_URL } from '../lib/api';
import { callCommand, mediaError, MeetingMedia, type Meeting, type Invitation } from '../lib/calls';
import CallOverlay from '../components/calls/CallOverlay';
import { useCallRingtone } from '../components/calls/useCallRingtone';
import { closeCallNotification } from '../lib/push';

type CallContextValue = {
  meeting: Meeting | null; incoming: Invitation | null; engine: MeetingMedia | null; connected: boolean;
  busy: boolean; error: string; notice: string; minimized: boolean; revision: number;
  join: (conversationId: string, video: boolean, microphone: boolean, callId?: string, preview?: MediaStream | null, meetingId?: string) => Promise<boolean>;
  leave: (endForAll?: boolean) => Promise<void>;
  invite: (participantIds: string[]) => Promise<void>;
  answer: () => Promise<boolean>;
  update: (state: Partial<{ microphone: boolean; camera: boolean; sharing: boolean; handRaised: boolean }>) => Promise<void>;
  decline: () => void; dismissIncoming: () => void; setMinimized: (value: boolean) => void;
  report: (message: string) => void; clearNotice: () => void;
  ringingEnabled: boolean; ringingBlocked: boolean; toggleRinging: () => Promise<void>; enableRinging: () => Promise<void>;
};
const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  return <CallState key={user?.id || 'signed-out'} token={token} userId={user?.id || ''}>{children}</CallState>;
}

function CallState({ children, token, userId }: { children: React.ReactNode; token: string | null; userId: string }) {
  const router = useRouter();
  const socket = useRef<Socket | null>(null);
  const media = useRef<MeetingMedia | null>(null);
  const [engine, setEngine] = useState<MeetingMedia | null>(null);
  const joining = useRef(false);
  const generation = useRef(0);
  const endedWhileJoining = useRef(new Set<string>());
  const pendingSignals = useRef<{ callId: string; from: string; signal: Parameters<MeetingMedia['signal']>[1] }[]>([]);
  const latestMeeting = useRef<Meeting | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [incoming, setIncoming] = useState<Invitation | null>(null);
  const ringtone = useCallRingtone(userId, incoming?.id, meeting?.oneToOne && meeting.phase === 'ringing' && meeting.hostId === userId ? meeting.id : undefined);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => setRevision(value => value + 1), []);
  const cleanup = useCallback(() => {
    media.current?.close(); media.current = null; latestMeeting.current = null;
    pendingSignals.current = []; setMeeting(null); setEngine(null); setMinimized(false); changed();
  }, [changed]);

  useEffect(() => {
    if (!token) return;
    generation.current++;
    const client = io(new URL(API_URL).origin, { path: '/api/socket.io', transports: ['websocket'], auth: { token }, reconnectionDelayMax: 5000 });
    socket.current = client;
    client.on('connect', () => setConnected(true));
    client.on('disconnect', () => {
      generation.current++;
      setConnected(false); setIncoming(null);
      if (media.current) { cleanup(); setNotice('The call disconnected. Your microphone, camera and screen sharing have stopped. Rejoin when connected.'); }
    });
    client.on('connect_error', () => setConnected(false));
    client.on('call:incoming', (invitation: Invitation) => { if (!media.current && invitation.expiresAt > Date.now()) setIncoming(invitation); });
    client.on('call:updated', (value: Meeting) => {
      if (joining.current) latestMeeting.current = value;
      const current = media.current;
      if (current && current.meeting.id === value.id) { current.sync(value); setMeeting(value); }
    });
    client.on('call:signal', (value) => {
      const current = media.current;
      if (current && current.meeting.id === value.callId) current.signal(value.from, value.signal);
      else if (joining.current && pendingSignals.current.length < 100) pendingSignals.current.push(value);
    });
    client.on('call:ended', ({ callId, reason }) => {
      if (joining.current) endedWhileJoining.current.add(callId);
      void closeCallNotification(callId);
      setIncoming(current => current?.id === callId ? null : current);
      if (media.current?.meeting.id === callId) { cleanup(); setNotice(reason === 'no_answer' ? 'No answer. The call has ended.' : reason === 'declined' ? 'The call was declined.' : reason === 'participant_left' ? 'The other person left the call.' : 'The host ended the meeting.'); }
    });
    client.on('call:dismissed', ({ callId }) => { setIncoming(current => current?.id === callId ? null : current); void closeCallNotification(callId); });
    client.on('call:declined', ({ callId, name }) => { if (media.current?.meeting.id === callId) setNotice(`${name} declined the call.`); });
    return () => { client.removeAllListeners(); client.disconnect(); socket.current = null; media.current?.close(); media.current = null; };
  }, [token, cleanup]);

  useEffect(() => {
    if (!token || !('serviceWorker' in navigator)) return;
    const message = (event: MessageEvent) => {
      if (event.data?.type === 'DISMISS_CALL_NOTIFICATION') {
        setIncoming(current => current?.id === event.data.callId ? null : current); return;
      }
      if (event.data?.type !== 'OPEN_MEETING_NOTIFICATION' || event.data.userId !== userId) return;
      if (event.data.callId) { setIncoming(current => current?.id === event.data.callId ? null : current); void closeCallNotification(event.data.callId); }
      try { const url = new URL(event.data.url, window.location.origin); if (url.origin === window.location.origin && url.pathname === '/meet') router.push(`${url.pathname}${url.search}`); } catch { /* Invalid links are ignored. */ }
    };
    navigator.serviceWorker.addEventListener('message', message);
    return () => navigator.serviceWorker.removeEventListener('message', message);
  }, [router, token, userId]);

  useEffect(() => {
    if (!incoming) return;
    const timer = setTimeout(() => { setIncoming(null); void closeCallNotification(incoming.id); }, Math.max(0, incoming.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [incoming]);

  const join = useCallback(async (conversationId: string, video: boolean, microphone: boolean, callId?: string, preview?: MediaStream | null, meetingId?: string) => {
    if (joining.current || media.current) { if (preview && preview !== media.current?.local) preview.getTracks().forEach(track => track.stop()); return false; }
    const request = generation.current;
    joining.current = true; setBusy(true); setError(''); setNotice(''); latestMeeting.current = null;
    endedWhileJoining.current.clear();
    let stream: MediaStream | null = null;
    let client: Socket | null = null;
    try {
      client = socket.current;
      if (!client?.connected) throw new Error('Calling is offline. Wait for the connection and try again.');
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Calling requires HTTPS or localhost and a browser with microphone support.');
      const config = await callCommand<{ iceServers: RTCIceServer[]; relayConfigured: boolean }>(client, 'call:config', {});
      stream = preview || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false });
      stream.getAudioTracks().forEach(track => { track.enabled = microphone; });
      if (!video) stream.getVideoTracks().forEach(track => { stream!.removeTrack(track); track.stop(); });
      if (request !== generation.current || !client.connected || client !== socket.current) throw new Error('The call disconnected. Please try again.');
      const result = await callCommand<{ call: Meeting }>(client, 'call:join', { conversationId, callId, meetingId, mode: video ? 'video' : 'audio', microphone, camera: video });
      if (request !== generation.current || !client.connected || client !== socket.current) throw new Error('The call disconnected. Please try again.');
      if (endedWhileJoining.current.has(result.call.id)) throw new Error('The call ended before you could join.');
      const engine = new MeetingMedia(client, result.call, stream, { iceServers: config.iceServers }, changed, setError,
        () => { void callCommand(client!, 'call:state', { conversationId, callId: result.call.id, sharing: false }).catch(failure => setError(failure.message)); },
        kind => { void callCommand(client!, 'call:state', { conversationId, callId: result.call.id, ...(kind === 'audio' ? { microphone: false } : { camera: false }) }).catch(failure => setError(failure.message)); });
      media.current = engine;
      setEngine(engine);
      const received = latestMeeting.current as Meeting | null;
      const current = received?.id === result.call.id ? received : result.call;
      engine.sync(current); setMeeting(current); setIncoming(null); setMinimized(false);
      void closeCallNotification(current.id);
      for (const value of pendingSignals.current.splice(0)) if (value.callId === current.id) engine.signal(value.from, value.signal);
      return true;
    } catch (failure) {
      stream?.getTracks().forEach(track => track.stop());
      // An acknowledgement can be lost after the server joins. Disconnecting
      // also removes that membership before a subsequent retry.
      if (client?.connected && stream && !(failure instanceof Error && 'acknowledged' in failure)) { client.disconnect(); client.connect(); }
      setError(mediaError(failure)); return false;
    } finally { joining.current = false; setBusy(false); }
  }, [changed]);
  const answer = useCallback(async () => {
    if (!incoming || incoming.expiresAt <= Date.now()) return false;
    return join(incoming.conversationId, incoming.mode === 'video', true, incoming.id, undefined, incoming.meetingId);
  }, [incoming, join]);

  const leave = useCallback(async (endForAll = false) => {
    const engine = media.current;
    if (!engine) return;
    setBusy(true);
    try {
      await callCommand(engine.socket, endForAll ? 'call:end' : 'call:leave', { conversationId: engine.meeting.conversationId, callId: engine.meeting.id });
      cleanup(); setError(''); setNotice(endForAll ? 'Meeting ended for everyone.' : 'You left the meeting.');
    } catch (failure) {
      if (!endForAll) { cleanup(); engine.socket.disconnect(); engine.socket.connect(); }
      setError(mediaError(failure));
    } finally { setBusy(false); }
  }, [cleanup]);
  const update = useCallback(async (state: Partial<{ microphone: boolean; camera: boolean; sharing: boolean; handRaised: boolean }>) => {
    const engine = media.current;
    if (!engine) return;
    await callCommand(engine.socket, 'call:state', { conversationId: engine.meeting.conversationId, callId: engine.meeting.id, ...state });
    changed();
  }, [changed]);
  const decline = useCallback(() => {
    if (incoming && socket.current) void callCommand(socket.current, 'call:decline', { conversationId: incoming.conversationId, callId: incoming.id }).catch(() => {});
    setIncoming(null);
    if (incoming) void closeCallNotification(incoming.id);
  }, [incoming]);
  const invite = useCallback(async (participantIds: string[]) => {
    const engine = media.current;
    if (!engine) throw new Error('Join a meeting first.');
    await callCommand(engine.socket, 'call:invite', { conversationId: engine.meeting.conversationId, callId: engine.meeting.id, participantIds });
    setNotice('Meeting invitations sent.');
  }, []);
  const dismissIncoming = () => { if (incoming) void closeCallNotification(incoming.id); setIncoming(null); };

  return <CallContext.Provider value={{ meeting, incoming, engine, connected, busy, error, notice, minimized, revision,
    ...ringtone, join, leave, update, invite, answer, decline, dismissIncoming, setMinimized, report: setError, clearNotice: () => { setNotice(''); setError(''); } }}>
    {children}<CallOverlay />
  </CallContext.Provider>;
}
export function useCalls() {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCalls must be used inside CallProvider');
  return context;
}
