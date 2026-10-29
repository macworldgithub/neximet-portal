'use client';

/* eslint-disable @next/next/no-img-element -- Private media uses authenticated blob URLs, which must stay in this browser. */

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Download, Expand, ImageIcon, Loader2, Play, RefreshCw, X } from 'lucide-react';
import { API_URL, getToken } from '../../lib/api';
import { attachmentPath, type ChatMessage } from '../../lib/chat';

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
function keepComposerFocus(event: PointerEvent<HTMLElement>) {
  // Blurring the mobile composer restores the app header. Keep the pressed
  // button in place until its click runs, without intercepting video controls.
  if ((event.target as Element).closest('button') && document.activeElement?.matches('.chat-composer textarea')) event.preventDefault();
}
export function attachmentKind(attachment: ChatMessage['attachment']) {
  if (!attachment) return 'file';
  if (imageTypes.has(attachment.mimeType) || /\.(png|jpe?g|webp|gif)$/i.test(attachment.name)) return 'image';
  if (videoTypes.has(attachment.mimeType) || /\.(mp4|m4v|mov|webm)$/i.test(attachment.name)) return 'video';
  return 'file';
}
function PhotoViewer({ url, name, onClose, onDownload }: { url: string; name: string; onClose: () => void; onDownload: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; root.current?.focus();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Photo: ${name}`} className="fixed inset-0 z-[90] flex flex-col bg-[#0B0F19]/98 text-white outline-none" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') { const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]; const first = controls[0], last = controls.at(-1); if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); } }
  }}><header className="flex shrink-0 items-center gap-3 border-b border-[#23314a] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"><p className="min-w-0 flex-1 truncate text-sm">{name}</p><button onClick={onDownload} aria-label="Download photo" className="rounded-xl p-3 hover:bg-white/10"><Download size={20} /></button><button onClick={onClose} aria-label="Close photo" className="rounded-xl p-3 hover:bg-white/10"><X size={22} /></button></header><div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3" onClick={event => { if (event.target === event.currentTarget) onClose(); }}><img src={url} alt={name} className="max-h-full max-w-full object-contain" /></div></div>, document.body);
}
export default function ChatAttachment({ message, attachmentIndex = 0, onDownload }: { message: ChatMessage; attachmentIndex?: number; onDownload: () => void }) {
  const attachment = message.attachment!; const kind = attachmentKind(attachment);
  const previewPath = attachmentPath(message, attachmentIndex, true);
  const root = useRef<HTMLElement>(null); const player = useRef<HTMLVideoElement>(null);
  const request = useRef<AbortController | null>(null); const resource = useRef(''); const wantedPlay = useRef(false);
  const [visible, setVisible] = useState(false); const [url, setUrl] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [expanded, setExpanded] = useState(false); const [decodeFailed, setDecodeFailed] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element || kind === 'file') return;
    if (!('IntersectionObserver' in window)) { const timer = setTimeout(() => setVisible(true), 0); return () => clearTimeout(timer); }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { root: element.closest('[data-chat-scroll]'), rootMargin: '200px' });
    observer.observe(element); return () => observer.disconnect();
  }, [kind]);
  useEffect(() => () => {
    request.current?.abort(); request.current = null;
    if (resource.current) URL.revokeObjectURL(resource.current);
    resource.current = '';
  }, []);
  const load = useCallback(async (play = false) => {
    if (request.current || resource.current) return;
    wantedPlay.current = play;
    const controller = new AbortController(); request.current = controller; const token = getToken();
    setLoading(true); setError(''); setDecodeFailed(false);
    try {
      const response = await fetch(`${API_URL}${previewPath}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 404 ? 'This media is unavailable. Reopen the chat or sign in again.' : 'Unable to preview this media. Retry or download it.');
      const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() || '';
      if (!(kind === 'image' ? imageTypes : videoTypes).has(type)) throw new Error('This file cannot be previewed here. You can still download it.');
      const blob = await response.blob();
      if (controller.signal.aborted || token !== getToken()) return;
      resource.current = URL.createObjectURL(blob); setUrl(resource.current);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load media.'); }
    finally { if (!controller.signal.aborted) setLoading(false); if (request.current === controller) request.current = null; }
  }, [previewPath, kind]);
  useEffect(() => {
    let cancelled = false;
    if (kind === 'image' && visible) void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [kind, visible, load]);
  const download = () => {
    if (!url) { onDownload(); return; }
    const link = document.createElement('a'); link.href = url; link.download = attachment.name; link.click();
  };
  const size = attachment.size >= 1024 * 1024 ? `${(attachment.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(attachment.size / 1024))} KB`;
  if (kind === 'file') return <button onPointerDown={keepComposerFocus} type="button" onClick={onDownload} className="mt-2 flex max-w-full items-center gap-3 rounded-xl border border-white/15 bg-black/15 p-3 text-left hover:bg-black/25"><Download className="shrink-0" size={18} /><span className="min-w-0"><span className="block truncate text-xs font-medium">{attachment.name}</span><span className="text-[10px] opacity-60">{size} · Download</span></span></button>;
  return <section onPointerDown={keepComposerFocus} ref={root} aria-label={`${kind === 'image' ? 'Photo' : 'Video'} attachment: ${attachment.name}`} className="mt-2 w-64 max-w-full overflow-hidden rounded-xl border border-white/15 bg-black/20">
    {url && !decodeFailed ? kind === 'image' ? <button type="button" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setExpanded(true); }} aria-label={`View photo ${attachment.name}`} className="group relative block aspect-[4/3] w-full overflow-hidden bg-black/30"><img src={url} alt={attachment.name} onError={() => { setDecodeFailed(true); setError('This image cannot be displayed. Download it to open it on your device.'); }} className="h-full w-full object-contain" /><span className="absolute bottom-2 right-2 rounded-lg bg-black/60 p-2 opacity-70 group-hover:opacity-100"><Expand size={16} /></span></button> : <video ref={player} controls playsInline preload="metadata" autoPlay aria-label={`Video: ${attachment.name}`} src={url} className="aspect-video w-full bg-black object-contain" onLoadedMetadata={() => { if (wantedPlay.current) { wantedPlay.current = false; void player.current?.play().catch(() => {}); } }} onError={() => { setDecodeFailed(true); setError('This video format cannot play in this browser. Download it to watch on your device.'); }} /> : <div className={`flex items-center justify-center bg-black/20 ${kind === 'image' ? 'aspect-[4/3]' : 'aspect-video'}`}>
      {loading ? <span role="status" className="flex items-center gap-2 text-xs text-gray-300"><Loader2 size={20} className="animate-spin" />Loading {kind === 'image' ? 'photo' : 'video'}…</span> : !error ? kind === 'video' ? <button type="button" aria-label={`Play video ${attachment.name}`} onClick={event => { event.currentTarget.focus({ preventScroll: true }); void load(true); }} className="flex flex-col items-center gap-2 rounded-xl px-8 py-5 text-sm text-white"><span className="rounded-full bg-[#5470F4] p-4"><Play size={25} fill="currentColor" /></span>Play video</button> : <ImageIcon size={28} className="text-gray-500" /> : <ImageIcon size={28} className="text-gray-500" />}
    </div>}
    {error && <div className="space-y-2 px-3 pt-3"><p role="status" className="text-xs leading-5 text-gray-300">{error}</p>{!decodeFailed && <button type="button" onClick={() => void load(kind === 'video')} className="flex items-center gap-1 text-xs text-[#9db2ff]"><RefreshCw size={13} />Retry preview</button>}</div>}
    <div className="flex items-center gap-2 p-2.5"><span className="min-w-0 flex-1"><span className="block truncate text-[11px]">{attachment.name}</span><span className="block text-[10px] opacity-60">{size}</span></span><button type="button" onClick={download} aria-label={`Download ${attachment.name}`} title="Download" className="rounded-lg p-2 hover:bg-white/10"><Download size={16} /></button></div>
    {expanded && url && <PhotoViewer url={url} name={attachment.name} onClose={() => setExpanded(false)} onDownload={download} />}
  </section>;
}
