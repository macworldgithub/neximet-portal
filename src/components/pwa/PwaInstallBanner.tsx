'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePwa } from './PwaProvider';
import { Download, X, Sparkles } from 'lucide-react';

const subscribeStorage = (notify: () => void) => {
  window.addEventListener('storage', notify);
  return () => window.removeEventListener('storage', notify);
};
const readDismissed = () => {
  try { return !!sessionStorage.getItem('neximet_pwa_banner_dismissed'); }
  catch { return false; }
};
const serverDismissed = () => true;

export default function PwaInstallBanner() {
  const { isInstallable, isInstalled, promptInstall, hasUpdateNotice } = usePwa();
  const [dismissed, setDismissed] = useState(false);
  const savedDismissal = useSyncExternalStore(subscribeStorage, readDismissed, serverDismissed);
  const notice = useRef<HTMLDivElement>(null);
  const visible = !isInstalled && isInstallable && !dismissed && !savedDismissal && !hasUpdateNotice;

  useEffect(() => {
    const element = notice.current;
    if (!element) return;
    const resize = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--pwa-install-height', `${height ? height + 12 : 0}px`);
      window.dispatchEvent(new Event('pwa-layout-change'));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element); resize();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--pwa-install-height');
      window.dispatchEvent(new Event('pwa-layout-change'));
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('neximet_pwa_banner_dismissed', 'true');
    } catch { /* Dismissal still works when browser storage is restricted. */ }
  };

  return (
    <div ref={notice} className="pwa-install fixed z-40 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#111827]/95 backdrop-blur-xl border border-[#5470F4]/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-black/80 flex flex-wrap items-center justify-between gap-3.5 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#5470F4]/20 blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src="/icons/icon-192x192.png"
              alt="Neximet App"
              className="w-11 h-11 rounded-2xl shadow-md border border-[#5470F4]/30 object-cover"
            />
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-[#111827]">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">Install Neximet Portal</h4>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[#5470F4]/20 text-[#5CC5FA] rounded border border-[#5470F4]/30">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Quick home-screen access. Submissions require internet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={promptInstall}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#5470F4] to-[#4355DE] hover:from-[#627CF5] hover:to-[#4F62E6] text-white text-xs font-bold shadow-lg shadow-[#5470F4]/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
            title="Dismiss banner"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
