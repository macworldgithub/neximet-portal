'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Hand, LayoutGrid, Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Pin, Settings, Users, Video, VideoOff, X } from 'lucide-react';
import { useCalls } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../lib/chat';
import { mediaError } from '../../lib/calls';
import RemoteAudio from './RemoteAudio';
import IncomingCallScreen from './IncomingCallScreen';
import ParticipantPicker from './ParticipantPicker';
import type { MeetingPerson } from '../../lib/meetings';

export function MediaTile({ stream, name, muted = false, visible = true, screen = false, fit = false, compact = false, expanded = false }: {
  stream?: MediaStream | null; name: string; muted?: boolean; visible?: boolean; screen?: boolean; revision?: number; fit?: boolean; compact?: boolean; expanded?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const track = stream?.getVideoTracks()[0];
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream || null;
    return () => { element.srcObject = null; };
  }, [stream, track]);
  useEffect(() => {
    const element = video.current;
    if (!element || !track) return;
    let cancelled = false;
    void element.play().then(() => { if (!cancelled) setBlocked(false); }).catch(error => { if (!cancelled && error?.name !== 'AbortError') setBlocked(true); });
    return () => { cancelled = true; };
  }, [stream, track]);
  return <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-[#182133] ${expanded ? 'h-full min-h-0 w-full' : screen ? 'min-h-44 aspect-video max-h-[55dvh]' : compact ? 'aspect-video max-h-40' : fit ? 'h-full min-h-0' : 'min-h-44 aspect-[4/3]'}`}>
    <video ref={video} autoPlay playsInline muted={muted} aria-label={name} className={`h-full w-full ${screen ? 'object-contain' : 'object-cover'} ${visible ? '' : 'opacity-0'}`} />
    {!visible && <span className="absolute flex h-20 w-20 items-center justify-center rounded-full bg-[#5470F4]/25 text-2xl font-semibold text-[#afc5ff]">{initials(name)}</span>}
    <span className="absolute bottom-3 left-3 max-w-[85%] truncate rounded-lg bg-black/60 px-2 py-1 text-xs text-white">{name}</span>
    {blocked && <button onClick={() => void video.current?.play().then(() => setBlocked(false)).catch(() => {})} className="absolute rounded-xl bg-[#5470F4] px-3 py-2 text-sm">Play video</button>}
  </div>;
}

export default function CallOverlay() {
  const calls = useCalls();
  const { user } = useAuth();
  const { meeting, incoming, engine, minimized, busy, revision } = calls;
  const [panel, setPanel] = useState<'people' | 'settings' | null>(null);
  const [invitees, setInvitees] = useState<MeetingPerson[]>([]);
  const [focusScreen, setFocusScreen] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const [shareHelp, setShareHelp] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!meeting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [meeting]);
  useEffect(() => {
    if (!meeting || minimized) return;
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (root.current?.dataset.presentationFocused === 'true') setFocusScreen(null); else calls.setMinimized(true); }
      if (event.key !== 'Tab') return;
      const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select, input:not(:disabled)') || [])].filter(item => item.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  // The focus trap follows whether the call dialog is visible.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, minimized]);
  useEffect(() => {
    if (panel !== 'settings' || !meeting) return;
    let cancelled = false;
    const refresh = () => { void navigator.mediaDevices.enumerateDevices().then(value => { if (!cancelled) setDevices(value); }).catch(() => {}); };
    refresh(); navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => { cancelled = true; navigator.mediaDevices.removeEventListener('devicechange', refresh); };
  }, [panel, meeting]);

  async function action(task: () => Promise<void>) {
    if (working || busy) return;
    setWorking(true); calls.report('');
    try { await task(); } catch (error) { calls.report(mediaError(error)); }
    finally { setWorking(false); }
  }
  const self = meeting?.participants.find(person => person.userId === user?.id);
  const presenting = meeting?.participants.some(person => person.sharing);
  const focused = meeting?.participants.find(person => person.sharing && `${meeting.id}:${person.socketId}` === focusScreen);
  const dialing = !!meeting?.oneToOne && meeting.phase === 'ringing';
  const target = meeting?.invitedPeople?.find(person => person.id !== user?.id)?.name || 'your teammate';
  const connectedMedia = !!engine && [...engine.peers.values()].some(peer => peer.media.status === 'connected');
  const phase = meeting?.participants.length === 1 ? dialing ? 'Ringing…' : 'Waiting for participants' : connectedMedia ? 'Connected' : 'Connecting media…';
  const since = meeting?.connectedAt || (meeting?.phase ? null : meeting?.startedAt);
  const elapsed = since ? Math.max(0, Math.floor(((now || Date.parse(since)) - Date.parse(since)) / 1000)) : 0;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  const duration = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const button = 'flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm transition-colors disabled:opacity-40';

  return <>
    {(calls.notice || calls.error) && <div role={calls.error ? 'alert' : 'status'} className={`fixed left-4 right-4 top-4 z-[130] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-xl border p-4 text-sm shadow-xl ${calls.error ? 'border-red-500/40 bg-[#3b1823]' : 'border-[#5470F4]/30 bg-[#182444]'}`}>
      <span>{calls.error || calls.notice}</span><button onClick={calls.clearNotice} aria-label="Dismiss call notification"><X size={18} /></button>
    </div>}
    {incoming && !meeting && <IncomingCallScreen key={incoming.id} />}
    {meeting && engine && <>
      <div className="fixed left-4 top-20 z-[120] flex max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">{meeting.participants.filter(person => person.socketId !== engine.socket.id).map(person => {
        const stream = engine.peers.get(person.socketId)?.media.audio;
        return stream ? <RemoteAudio key={person.socketId} stream={stream} name={person.name} /> : null;
      })}</div>
      {minimized && <div className="fixed bottom-24 right-4 z-[100] flex items-center gap-3 rounded-2xl border border-[#5470F4]/40 bg-[#13213b] p-3 text-white shadow-xl"><span className="h-2 w-2 animate-pulse rounded-full bg-green-400" /><button onClick={() => calls.setMinimized(false)} className="text-sm">Return to call · {duration}</button><button disabled={busy} onClick={() => void calls.leave()} aria-label="Leave call" className="rounded-lg bg-red-600 p-2"><PhoneOff size={18} /></button></div>}
      <div ref={root} role="dialog" aria-modal={!minimized} aria-label="Meeting" tabIndex={-1} data-presentation-focused={!!focused} className={`${minimized ? 'hidden' : 'flex'} fixed inset-0 z-[100] flex-col bg-[#0B0F19] text-white outline-none`}>
        <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="min-w-0"><h2 className="truncate font-semibold">{meeting.title}</h2><p className="text-xs text-gray-400" role="status">{phase}{since ? ` · ${duration}` : ''} · {meeting.participants.length} / 8 participants</p></div><div className="flex gap-1"><button className="rounded-xl p-3 hover:bg-[#111827]/10" onClick={() => void action(async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen(); })} aria-label="Toggle full screen"><Maximize2 size={19} /></button><button className="rounded-xl p-3 hover:bg-[#111827]/10" onClick={() => calls.setMinimized(true)} aria-label="Minimize meeting"><Minimize2 size={20} /></button></div></header>
            {shareHelp === meeting.id && <section role="status" className="mx-3 mb-2 shrink-0 rounded-xl border border-[#5470F4]/30 bg-[#111827] p-4 text-sm"><div className="flex justify-between gap-3"><p>This browser cannot broadcast your phone’s screen. You can still view and focus on other people’s shared screens. Screen sharing will become available here when your browser provides screen capture support.</p><button aria-label="Close screen sharing help" onClick={() => setShareHelp(null)} className="self-start p-1"><X size={18} /></button></div></section>}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
          <main className={`min-w-0 min-h-0 flex-1 p-3 sm:p-5 ${focused ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
            {dialing && <section aria-label="Outgoing call" className="flex h-full min-h-64 flex-col items-center justify-center gap-4 text-center"><span className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#5470F4]/30 bg-[#5470F4]/15 text-3xl font-semibold text-[#afc5ff]">{initials(target)}</span><h3 className="text-2xl font-semibold">Calling {target}</h3><p role="status" className="text-[#5CC5FA]">Ringing…</p><p className="max-w-sm text-sm text-gray-400">Your call connects when the other person answers.</p>{calls.ringingBlocked && <button onClick={() => void calls.enableRinging()} className="rounded-xl bg-[#5470F4] px-4 py-2 text-sm">Enable ringtone</button>}</section>}
            {focused && <div className="mb-3 flex shrink-0 items-center justify-between gap-2 rounded-xl bg-[#182133] px-3 py-2"><span className="flex min-w-0 items-center gap-2 text-sm"><Pin size={16} className="shrink-0 text-[#9db2ff]" /><span className="truncate">{focused.name}’s presentation</span></span><button onClick={() => setFocusScreen(null)} className="flex shrink-0 items-center gap-2 rounded-full bg-[#5470F4]/20 px-3 py-2 text-xs font-medium text-[#afc5ff]" aria-label="Back to gallery"><LayoutGrid size={16} />Back to gallery</button></div>}
            {meeting.participants.filter(person => person.sharing).map(person => <div key={`screen-${person.socketId}`} className={`${focused && focused.socketId !== person.socketId ? 'hidden' : focused ? 'relative min-h-0 flex-1' : 'relative mx-auto mb-4 max-w-6xl'}`}><MediaTile name={`${person.name} is presenting`} screen expanded={!!focused} muted visible revision={revision} stream={person.socketId === engine.socket.id ? engine.display : engine.peers.get(person.socketId)?.media.screen} />{!focused && <button onClick={() => { setFocusScreen(`${meeting.id}:${person.socketId}`); setPanel(null); }} aria-label={`Focus presentation by ${person.name}`} className="absolute inset-0 flex items-start justify-end rounded-2xl p-3 ring-inset hover:ring-2 hover:ring-[#5470F4] focus-visible:ring-2 focus-visible:ring-[#5470F4]"><span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs"><Maximize2 size={16} />Focus presentation</span></button>}</div>)}
            <div data-testid="participant-gallery" className={`${focused || dialing ? 'hidden' : 'grid'} mx-auto max-w-6xl gap-3 ${presenting ? '' : 'h-full auto-rows-fr'} ${meeting.participants.length > 2 ? 'grid-cols-2' : meeting.participants.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'max-w-3xl grid-cols-1'} ${meeting.participants.length > 4 ? 'xl:grid-cols-3' : ''}`}>
              {meeting.participants.map(person => {
                const local = person.socketId === engine.socket.id;
                const remote = engine.peers.get(person.socketId)?.media;
                return <div key={person.socketId} className="relative min-h-0"><MediaTile name={`${person.name}${local ? ' (you)' : ''}`} fit={!presenting} compact={presenting} muted visible={person.camera} stream={local ? engine.local : remote?.camera} revision={revision} />{(person.handRaised || !person.microphone || !local && remote?.status !== 'connected') && <div className="absolute right-3 top-3 flex gap-2 rounded-lg bg-black/50 p-2">{person.handRaised && <Hand size={16} className="text-yellow-300" />}{!person.microphone && <MicOff size={16} className="text-red-300" />}{!local && remote?.status !== 'connected' && <span className="text-xs">{remote?.status === 'failed' ? 'Connection failed' : 'Connecting…'}</span>}</div>}</div>;
              })}
            </div>
            {meeting.participants.length === 1 && !focused && !dialing && <p className="mt-6 text-center text-sm text-gray-400">Waiting for invited participants. Audio/video connects when someone joins.</p>}

          </main>
          {panel && <aside className="shrink-0 border-t border-white/10 bg-[#111827] p-5 md:w-80 md:overflow-y-auto md:border-l md:border-t-0"><div className="mb-5 flex items-center justify-between"><h3 className="font-semibold">{panel === 'people' ? 'Participants' : 'Device settings'}</h3><button onClick={() => setPanel(null)} aria-label="Close panel"><X size={18} /></button></div>
            {panel === 'people' ? <><ul className="space-y-4">{meeting.participants.map(person => <li key={person.socketId} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25314a] text-xs">{initials(person.name)}</span>{person.name}{person.userId === meeting.hostId && <span className="text-xs text-[#9db2ff]">Host</span>}</span>{person.handRaised && <Hand size={16} className="text-yellow-300" />}</li>)}</ul>{meeting.hostId === user?.id && <div className="mt-6 border-t border-white/10 pt-5"><ParticipantPicker dark selected={invitees} onChange={setInvitees} disabled={working} excludeIds={meeting.invitedUserIds || meeting.participants.map(person => person.userId)} limit={Math.max(0, 8 - (meeting.invitedUserIds?.length || meeting.participants.length))} /><button disabled={working || !invitees.length} onClick={() => void action(async () => { await calls.invite(invitees.map(person => person._id)); setInvitees([]); })} className="mt-3 w-full rounded-full bg-[#5470F4] px-3 py-2 text-sm font-medium text-[#F3F4F6] disabled:opacity-40">Send invitations</button></div>}</> : <div className="space-y-5">{(['audioinput', 'videoinput'] as const).map(kind => <label key={kind} className="block text-sm text-gray-300">{kind === 'audioinput' ? 'Microphone' : 'Camera'}<select aria-label={kind === 'audioinput' ? 'Microphone device' : 'Camera device'} disabled={working} value={(kind === 'audioinput' ? engine.local.getAudioTracks()[0] : engine.local.getVideoTracks()[0])?.getSettings().deviceId || ''} onChange={event => void action(async () => { if (kind === 'audioinput') await engine.microphone(event.target.value); else { await engine.camera(true, event.target.value); await calls.update({ camera: true }); } })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-sm"><option value="" disabled>Select device</option>{devices.filter(device => device.kind === kind).map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || `${kind === 'audioinput' ? 'Microphone' : 'Camera'} ${device.deviceId.slice(0, 5)}`}</option>)}</select></label>)}<p className="text-xs text-gray-400">Your browser controls speaker output and screen capture permissions.</p></div>}
          </aside>}
        </div>
        <footer className="shrink-0 bg-[#0B0F19] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"><div className="flex flex-wrap items-center justify-center gap-2">
          <button disabled={working || busy} aria-label={self?.microphone ? 'Mute microphone' : 'Unmute microphone'} aria-pressed={self?.microphone} className={`${button} ${self?.microphone ? 'bg-[#182133]' : 'bg-red-600'}`} onClick={() => void action(async () => { const enabled = !engine.local.getAudioTracks()[0]?.enabled; await engine.setMicrophone(enabled); await calls.update({ microphone: enabled }); })}>{self?.microphone ? <Mic size={20} /> : <MicOff size={20} />}<span className="sr-only">{self?.microphone ? 'Mute' : 'Unmute'}</span></button>
          <button disabled={working || busy} aria-label={self?.camera ? 'Turn camera off' : 'Turn camera on'} aria-pressed={self?.camera} className={`${button} ${self?.camera ? 'bg-[#182133]' : 'bg-red-600'}`} onClick={() => void action(async () => { const camera = !engine.local.getVideoTracks().length; await engine.camera(camera); await calls.update({ camera }); })}>{self?.camera ? <Video size={20} /> : <VideoOff size={20} />}<span className="sr-only">Camera</span></button>
          <button disabled={working || busy} aria-label={self?.sharing ? 'Stop presenting' : 'Share screen'} aria-pressed={self?.sharing} title={canShare ? 'Share your screen' : 'Screen sharing support on this device'} className={`${button} ${self?.sharing ? 'bg-[#5470F4]' : 'bg-[#182133]'}`} onClick={() => { if (!canShare && !engine.display) { setShareHelp(meeting.id); return; } void action(async () => { const sharing = !engine.display; if (sharing) await engine.share(); else await engine.stopSharing(); await calls.update({ sharing: !!engine.display }); }); }}><MonitorUp size={20} /><span className="sr-only">{self?.sharing ? 'Stop sharing' : 'Present'}</span></button>
          <button disabled={working || busy} aria-label={self?.handRaised ? 'Lower hand' : 'Raise hand'} aria-pressed={self?.handRaised} className={`${button} ${self?.handRaised ? 'bg-amber-500/30' : 'bg-[#182133]'}`} onClick={() => void action(() => calls.update({ handRaised: !self?.handRaised }))}><Hand size={20} /></button>
          <button className={`${button} bg-[#182133]`} aria-label="Show participants" aria-pressed={panel === 'people'} onClick={() => setPanel(panel === 'people' ? null : 'people')}><Users size={20} />{meeting.participants.length}</button>
          <button className={`${button} bg-[#182133]`} aria-label="Device settings" aria-pressed={panel === 'settings'} onClick={() => setPanel(panel === 'settings' ? null : 'settings')}><Settings size={20} /></button>
          <button className={`${button} bg-[#182133]`} aria-label="Copy meeting link" title={copied ? 'Link copied' : 'Copy meeting link'} onClick={() => void action(async () => { await navigator.clipboard.writeText(`${window.location.origin}/meet?conversation=${meeting.conversationId}&call=${meeting.id}&mode=${meeting.mode}${meeting.meetingId ? `&meeting=${meeting.meetingId}` : ''}`); setCopied(true); setTimeout(() => setCopied(false), 2500); })}><Copy size={18} /><span className="sr-only">{copied ? 'Copied' : 'Invite'}</span></button>
          <button disabled={busy || working} onClick={() => void calls.leave()} className={`${button} bg-red-600`} aria-label="Leave call"><PhoneOff size={20} /><span className="sr-only">Leave</span></button>
          {meeting.hostId === user?.id && <button disabled={busy || working} onClick={() => void calls.leave(true)} className={`${button} text-red-300`}>End for all</button>}
        </div></footer>
      </div>
    </>}
  </>;
}
