'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function AIDialog({ title, children, onClose, busy = false }: { title: string; children: React.ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby="ai-dialog-title" className="ai-dialog m-auto w-[calc(100%-1rem)] max-w-xl overflow-hidden rounded-2xl border border-[#1F293D] bg-[#111827] p-0 text-gray-100 shadow-2xl backdrop:bg-black/65"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="flex max-h-[inherit] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1F293D] px-5 py-3"><h2 id="ai-dialog-title" className="font-semibold">{title}</h2><button type="button" disabled={busy} className="communication-icon" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-5">{children}</div>
    </div>
  </dialog>;
}
