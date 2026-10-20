'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, Hand, Maximize2, Mic, MicOff, Minimize2, MonitorUp, Phone, PhoneOff, Settings, Users, Video, VideoOff, X } from 'lucide-react';
import { useCalls } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../lib/chat';
import { mediaError } from '../../lib/calls';
import RemoteAudio from './RemoteAudio';

export function MediaTile({ stream, name, muted = false, visible = true, screen = false, fit = false, compact = false }: {
  stream?: MediaStream | null; name: string; muted?: boolean; visible?: boolean; screen?: boolean; revision?: number; fit?: boolean; compact?: boolean;
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
  return <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#182133] ${screen ? 'min-h-44 aspect-video max-h-[55dvh]' : compact ? 'aspect-video max-h-40' : fit ? 'min-h-44 aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-0' : 'min-h-44 aspect-[4/3]'}`}>
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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
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
      if (event.key === 'Escape') calls.setMinimized(true);
      if (event.key !== 'Tab') return;
      const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select') || [])].filter(item => item.getClientRects().length);
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
  const elapsed = meeting ? Math.max(0, Math.floor(((now || Date.parse(meeting.startedAt)) - Date.parse(meeting.startedAt)) / 1000)) : 0;
  const duration = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const button = 'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm disabled:opacity-40';

  return <>
    {(calls.notice || calls.error) && <div role={calls.error ? 'alert' : 'status'} className={`fixed left-4 right-4 top-4 z-[130] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-xl border p-4 text-sm shadow-xl ${calls.error ? 'border-red-500/40 bg-[#3b1823]' : 'border-[#5470F4]/30 bg-[#182444]'}`}>
      <span>{calls.error || calls.notice}</span><button onClick={calls.clearNotice} aria-label="Dismiss call notification"><X size={18} /></button>
    </div>}
    {incoming && !meeting && <div role="dialog" aria-modal="false" aria-label={`Incoming ${incoming.mode === 'video' ? 'video' : 'voice'} call`} className="fixed bottom-6 right-4 z-[120] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[#5470F4]/40 bg-[#111b2d] p-5 text-white shadow-2xl">
      <div className="mb-4 flex items-center gap-3"><span className="rounded-full bg-[#5470F4]/20 p-3 text-[#94acff]"><Phone className="animate-pulse" /></span><div><p className="font-semibold">{incoming.callerName}</p><p className="text-sm text-gray-400">Incoming {incoming.mode === 'video' ? 'video' : 'voice'} call</p></div></div>
      <div className="flex gap-2"><button onClick={calls.decline} className={`${button} flex-1 bg-red-600`}><PhoneOff size={17} />Decline</button><Link onClick={calls.dismissIncoming} href={`/meet?conversation=${incoming.conversationId}&call=${incoming.id}&mode=${incoming.mode}`} className={`${button} flex-1 bg-emerald-600`}><Phone size={17} />Answer</Link></div>
    </div>}
    {meeting && engine && <>
      <div className="fixed left-4 top-20 z-[120] flex max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">{meeting.participants.filter(person => person.socketId !== engine.socket.id).map(person => {
        const stream = engine.peers.get(person.socketId)?.media.audio;
        return stream ? <RemoteAudio key={person.socketId} stream={stream} name={person.name} /> : null;
      })}</div>
      {minimized && <div className="fixed bottom-24 right-4 z-[100] flex items-center gap-3 rounded-2xl border border-[#5470F4]/40 bg-[#13213b] p-3 text-white shadow-xl"><span className="h-2 w-2 animate-pulse rounded-full bg-green-400" /><button onClick={() => calls.setMinimized(false)} className="text-sm">Return to call · {duration}</button><button disabled={busy} onClick={() => void calls.leave()} aria-label="Leave call" className="rounded-lg bg-red-600 p-2"><PhoneOff size={18} /></button></div>}
      <div ref={root} role="dialog" aria-modal={!minimized} aria-label="Meeting" tabIndex={-1} className={`${minimized ? 'hidden' : 'flex'} fixed inset-0 z-[100] flex-col bg-[#0B0F19] text-white outline-none`}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6"><div className="min-w-0"><h2 className="truncate font-semibold">{meeting.title}</h2><p className="text-xs text-gray-400">{duration} · {meeting.participants.length} / 8 participants</p></div><div className="flex gap-1"><button className="rounded-xl p-3 hover:bg-white/10" onClick={() => void action(async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen(); })} aria-label="Toggle full screen"><Maximize2 size={19} /></button><button className="rounded-xl p-3 hover:bg-white/10" onClick={() => calls.setMinimized(true)} aria-label="Minimize meeting"><Minimize2 size={20} /></button></div></header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
          <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
            {meeting.participants.filter(person => person.sharing).map(person => <div key={`screen-${person.socketId}`} className="mx-auto mb-4 max-w-6xl"><MediaTile name={`${person.name} is presenting`} screen muted visible revision={revision} stream={person.socketId === engine.socket.id ? engine.display : engine.peers.get(person.socketId)?.media.screen} /></div>)}
            <div className={`mx-auto grid max-w-6xl gap-3 ${presenting ? '' : 'sm:h-full sm:auto-rows-fr'} ${meeting.participants.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'max-w-3xl grid-cols-1'} ${meeting.participants.length > 4 ? 'xl:grid-cols-3' : ''}`}>
              {meeting.participants.map(person => {
                const local = person.socketId === engine.socket.id;
                const remote = engine.peers.get(person.socketId)?.media;
                return <div key={person.socketId} className="relative min-h-0"><MediaTile name={`${person.name}${local ? ' (you)' : ''}`} fit={!presenting} compact={presenting} muted visible={person.camera} stream={local ? engine.local : remote?.camera} revision={revision} /><div className="absolute right-3 top-3 flex gap-2 rounded-lg bg-black/50 p-2">{person.handRaised && <Hand size={16} className="text-yellow-300" />}{!person.microphone && <MicOff size={16} className="text-red-300" />}{!local && remote?.status !== 'connected' && <span className="text-xs">{remote?.status === 'failed' ? 'Connection failed' : 'Connecting…'}</span>}</div></div>;
              })}
            </div>
            {meeting.participants.length === 1 && <p className="mt-6 text-center text-sm text-gray-400">Waiting for teammates. Conversation members can join using the meeting link.</p>}
          </main>
          {panel && <aside className="shrink-0 border-t border-white/10 bg-[#111827] p-5 md:w-72 md:overflow-y-auto md:border-l md:border-t-0"><div className="mb-5 flex items-center justify-between"><h3 className="font-semibold">{panel === 'people' ? 'Participants' : 'Device settings'}</h3><button onClick={() => setPanel(null)} aria-label="Close panel"><X size={18} /></button></div>
            {panel === 'people' ? <><ul className="space-y-4">{meeting.participants.map(person => <li key={person.socketId} className="flex items-center justify-between gap-2 text-sm"><span>{person.name}{person.userId === meeting.hostId && <span className="ml-2 text-xs text-[#8ea6ff]">Host</span>}</span>{person.handRaised && <Hand size={16} className="text-yellow-300" />}</li>)}</ul><Link className="mt-6 block text-sm text-[#8ea6ff]" href={`/chat?conversation=${meeting.conversationId}`} onClick={() => calls.setMinimized(true)}>Open meeting conversation</Link></> : <div className="space-y-5">{(['audioinput', 'videoinput'] as const).map(kind => <label key={kind} className="block text-sm text-gray-300">{kind === 'audioinput' ? 'Microphone' : 'Camera'}<select aria-label={kind === 'audioinput' ? 'Microphone device' : 'Camera device'} disabled={working} value={(kind === 'audioinput' ? engine.local.getAudioTracks()[0] : engine.local.getVideoTracks()[0])?.getSettings().deviceId || ''} onChange={event => void action(async () => { if (kind === 'audioinput') await engine.microphone(event.target.value); else { await engine.camera(true, event.target.value); await calls.update({ camera: true }); } })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F19] p-3 text-sm"><option value="" disabled>Select device</option>{devices.filter(device => device.kind === kind).map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || `${kind === 'audioinput' ? 'Microphone' : 'Camera'} ${device.deviceId.slice(0, 5)}`}</option>)}</select></label>)}<p className="text-xs text-gray-400">Your browser controls speaker output and screen capture permissions.</p></div>}
          </aside>}
        </div>
        <footer className="shrink-0 border-t border-white/10 bg-[#101725] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"><div className="flex flex-wrap items-center justify-center gap-2">
          <button disabled={working || busy} aria-label={self?.microphone ? 'Mute microphone' : 'Unmute microphone'} aria-pressed={self?.microphone} className={`${button} ${self?.microphone ? 'bg-[#25314a]' : 'bg-red-600/30'}`} onClick={() => void action(async () => { const enabled = !engine.local.getAudioTracks()[0]?.enabled; engine.local.getAudioTracks().forEach(track => { track.enabled = enabled; }); await calls.update({ microphone: enabled }); })}>{self?.microphone ? <Mic size={20} /> : <MicOff size={20} />}<span className="hidden sm:inline">{self?.microphone ? 'Mute' : 'Unmute'}</span></button>
          <button disabled={working || busy} aria-label={self?.camera ? 'Turn camera off' : 'Turn camera on'} aria-pressed={self?.camera} className={`${button} ${self?.camera ? 'bg-[#25314a]' : 'bg-red-600/30'}`} onClick={() => void action(async () => { const camera = !engine.local.getVideoTracks().length; await engine.camera(camera); await calls.update({ camera }); })}>{self?.camera ? <Video size={20} /> : <VideoOff size={20} />}<span className="hidden sm:inline">Camera</span></button>
          <button disabled={working || busy} aria-label={self?.sharing ? 'Stop presenting' : 'Share screen'} aria-pressed={self?.sharing} className={`${button} ${self?.sharing ? 'bg-[#5470F4]' : 'bg-[#25314a]'}`} onClick={() => void action(async () => { const sharing = !engine.display; if (sharing) await engine.share(); else await engine.stopSharing(); await calls.update({ sharing }); })}><MonitorUp size={20} /><span className="hidden sm:inline">{self?.sharing ? 'Stop sharing' : 'Present'}</span></button>
          <button disabled={working || busy} aria-label={self?.handRaised ? 'Lower hand' : 'Raise hand'} aria-pressed={self?.handRaised} className={`${button} ${self?.handRaised ? 'bg-amber-500/30' : 'bg-[#25314a]'}`} onClick={() => void action(() => calls.update({ handRaised: !self?.handRaised }))}><Hand size={20} /></button>
          <button className={`${button} bg-[#25314a]`} aria-label="Show participants" aria-pressed={panel === 'people'} onClick={() => setPanel(panel === 'people' ? null : 'people')}><Users size={20} />{meeting.participants.length}</button>
          <button className={`${button} bg-[#25314a]`} aria-label="Device settings" aria-pressed={panel === 'settings'} onClick={() => setPanel(panel === 'settings' ? null : 'settings')}><Settings size={20} /></button>
          <button className={`${button} bg-[#25314a]`} aria-label="Copy meeting link" onClick={() => void action(async () => { await navigator.clipboard.writeText(`${window.location.origin}/meet?conversation=${meeting.conversationId}&call=${meeting.id}`); setCopied(true); setTimeout(() => setCopied(false), 2500); })}><Copy size={18} /><span className="hidden sm:inline">{copied ? 'Copied' : 'Invite'}</span></button>
          <button disabled={busy || working} onClick={() => void calls.leave()} className={`${button} bg-red-600`} aria-label="Leave call"><PhoneOff size={20} /><span className="hidden sm:inline">Leave</span></button>
          {meeting.hostId === user?.id && <button disabled={busy || working} onClick={() => void calls.leave(true)} className={`${button} text-red-300`}>End for all</button>}
        </div></footer>
      </div>
    </>}
  </>;
}
