'use client';

import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Volume2, VolumeX } from 'lucide-react';
import { useCalls } from '../../context/CallContext';
import { initials } from '../../lib/chat';

export default function IncomingCallScreen() {
  const calls = useCalls(); const incoming = calls.incoming;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; root.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  if (!incoming) return null;
  return <div ref={root} role="dialog" aria-modal="true" aria-label={`Incoming ${incoming.mode === 'video' ? 'video' : 'voice'} call`} tabIndex={-1}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
    }}
    className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-y-auto bg-[#0B0F19] px-6 py-10 text-center text-white outline-none">
    <p className="mb-10 flex items-center gap-2 text-sm font-medium text-[#5CC5FA]">{incoming.mode === 'video' ? <Video size={19} /> : <Phone size={19} />}Neximet · Incoming {incoming.mode === 'video' ? 'video' : 'voice'} call</p>
    <div className="relative mb-8 flex h-32 w-32 shrink-0 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-[#5470F4]/15 motion-reduce:animate-none" /><span className="relative flex h-full w-full items-center justify-center rounded-full border-4 border-[#5470F4]/40 bg-[#182133] text-4xl font-semibold text-[#afc5ff]">{initials(incoming.callerName)}</span></div>
    <h2 className="max-w-xl break-words text-3xl font-semibold sm:text-4xl">{incoming.callerName}</h2><p className="mt-3 text-gray-400" role="status">{calls.busy ? 'Answering…' : 'Calling you…'}</p>
    <button onClick={() => void calls.toggleRinging()} className="mt-5 flex items-center gap-2 rounded-full px-4 py-2 text-sm text-gray-400">{calls.ringingEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}{calls.ringingEnabled ? 'Ringing on' : 'Ringing off'}</button>
    {calls.ringingBlocked && <button onClick={() => void calls.enableRinging()} className="mt-6 flex items-center gap-2 rounded-full border border-[#5470F4]/50 px-4 py-2 text-sm text-[#afc5ff]"><Volume2 size={17} />Enable ringtone</button>}
    <div className="mt-14 flex w-full max-w-sm justify-around gap-10">
      <button disabled={calls.busy} onClick={calls.decline} className="group flex flex-col items-center gap-3 disabled:opacity-40"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-950/40 transition-transform group-hover:scale-105"><PhoneOff size={31} /></span><span className="text-sm font-medium">Decline</span></button>
      <button disabled={calls.busy} onClick={() => void calls.answer()} className="group flex flex-col items-center gap-3 disabled:opacity-40"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-950/40 transition-transform group-hover:scale-105">{incoming.mode === 'video' ? <Video size={31} /> : <Phone size={31} />}</span><span className="text-sm font-medium">{calls.busy ? 'Answering…' : 'Answer'}</span></button>
    </div>
  </div>;
}
