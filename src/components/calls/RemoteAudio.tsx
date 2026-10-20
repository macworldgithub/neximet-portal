'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';

export default function RemoteAudio({ stream, name }: { stream: MediaStream; name: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  const track = stream.getAudioTracks()[0];
  useEffect(() => {
    const element = audio.current;
    if (!element || !track) return;
    // Attaching an empty stream before ontrack can leave Chrome waiting for
    // media indefinitely. Bind a non-empty audio-only stream once per track.
    element.srcObject = new MediaStream([track]); element.muted = false; element.volume = 1;
    let cancelled = false, attempt = 0;
    const play = () => {
      const current = ++attempt;
      void element.play().then(() => { if (!cancelled && current === attempt) setBlocked(false); }).catch(error => {
        if (!cancelled && current === attempt && error?.name !== 'AbortError') setBlocked(true);
      });
    };
    const resume = () => { if (element.paused && document.visibilityState === 'visible') play(); };
    play(); track.addEventListener('unmute', play);
    document.addEventListener('pointerdown', resume); document.addEventListener('keydown', resume);
    document.addEventListener('visibilitychange', resume); window.addEventListener('pageshow', resume);
    return () => {
      cancelled = true; track.removeEventListener('unmute', play);
      document.removeEventListener('pointerdown', resume); document.removeEventListener('keydown', resume);
      document.removeEventListener('visibilitychange', resume); window.removeEventListener('pageshow', resume);
      element.pause(); element.srcObject = null;
    };
  }, [track]);
  return <>
    <audio ref={audio} muted={false} aria-label={`Audio from ${name}`} data-call-audio-for={name} onPlaying={() => setBlocked(false)} />
    {blocked && <button onClick={() => { void audio.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); }} className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-[#332a16] px-4 py-3 text-sm text-amber-100 shadow-xl"><Volume2 size={18} />Enable audio from {name}</button>}
  </>;
}
