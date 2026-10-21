'use client';
import { useEffect, useRef, useState } from 'react';
import { CallRingtone } from '../../lib/callRingtone';

export function useCallRingtone(userId: string, incomingId?: string, outgoingId?: string) {
  const sound = useRef<CallRingtone | null>(null); const current = useRef<string | undefined>(undefined);
  const kind = useRef<'incoming' | 'outgoing'>('incoming');
  const allowed = useRef(true);
  const [ringingEnabled, setEnabled] = useState(true); const [ringingBlocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const ringtone = new CallRingtone(); sound.current = ringtone; let disposed = false;
    try { allowed.current = localStorage.getItem(`neximet-ringing:${userId}`) !== 'off'; } catch { allowed.current = true; }
    // Synchronize the saved sound preference when the signed-in account changes.
    setEnabled(allowed.current);
    const unlock = () => {
      if (!allowed.current) return;
      void ringtone.unlock().then(ready => { if (!disposed && current.current) setBlocked(!ready || !ringtone.start(kind.current)); });
    };
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
    return () => { disposed = true; document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); ringtone.close(); if (sound.current === ringtone) sound.current = null; };
  }, [userId]);
  useEffect(() => {
    current.current = incomingId || outgoingId; kind.current = incomingId ? 'incoming' : 'outgoing';
    const ringtone = sound.current;
    // Incoming-call state drives the browser audio player and its recovery button.
    setBlocked(!!current.current && ringingEnabled && !ringtone?.start(kind.current));
    if (!current.current || !ringingEnabled) ringtone?.stop();
    return () => ringtone?.stop();
  }, [incomingId, outgoingId, ringingEnabled]);
  async function change(enabled: boolean) {
    allowed.current = enabled; setEnabled(enabled);
    try { localStorage.setItem(`neximet-ringing:${userId}`, enabled ? 'on' : 'off'); } catch { /* Sound still works without storage. */ }
    if (!enabled) { sound.current?.stop(); setBlocked(false); return; }
    const ready = await sound.current?.unlock();
    setBlocked(!!current.current && (!ready || !sound.current?.start(kind.current)));
  }
  return { ringingEnabled, ringingBlocked, toggleRinging: () => change(!ringingEnabled), enableRinging: () => change(true) };
}
