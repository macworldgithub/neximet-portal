'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { X, WifiOff, RefreshCw } from 'lucide-react';
import { watchPwaUpdates } from '../../lib/pwa-updates';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isOffline: boolean;
  promptInstall: () => Promise<void>;
  showIOSGuide: boolean;
  setShowIOSGuide: (val: boolean) => void;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  isIOS: false,
  isOffline: false,
  promptInstall: async () => {},
  showIOSGuide: false,
  setShowIOSGuide: () => {},
});

export const usePwa = () => useContext(PwaContext);

const serverFalse = () => false;
const subscribeDevice = () => () => {};
const readIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const readStandalone = () => window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  document.referrer.startsWith('android-app://');
const subscribeStandalone = (notify: () => void) => {
  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const readOffline = () => !navigator.onLine;
const subscribeConnectivity = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [installedThisSession, setInstalledThisSession] = useState(false);
  const isStandalone = useSyncExternalStore(subscribeStandalone, readStandalone, serverFalse);
  const isIOS = useSyncExternalStore(subscribeDevice, readIOS, serverFalse);
  const isOffline = useSyncExternalStore(subscribeConnectivity, readOffline, serverFalse);
  const isInstalled = installedThisSession || isStandalone;
  const isInstallable = !isInstalled && (isIOS || deferredPrompt !== null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const updates = useRef<ReturnType<typeof watchPwaUpdates> | null>(null);
  const updateNotice = useRef<HTMLDivElement>(null);
  const showUpdate = updateAvailable && !updateDismissed && !isOffline;

  useEffect(() => {
    const notice = updateNotice.current;
    if (!notice) return;
    const resize = () => {
      const height = Math.ceil(notice.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--pwa-update-height', `${height ? height + 12 : 0}px`);
      window.dispatchEvent(new Event('pwa-layout-change'));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(notice);
    resize();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--pwa-update-height');
      window.dispatchEvent(new Event('pwa-layout-change'));
    };
  }, [showUpdate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // iOS uses the home-screen guide; Chromium supplies a single-use prompt.
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as InstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Listen for successful installation
    const handleAppInstalled = () => {
      setInstalledThisSession(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Effects may run after window.load; register directly after hydration.
    // Test the PWA with a production build to avoid caching development chunks.
    let disposed = false;
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => {
          if (!disposed) updates.current = watchPwaUpdates(registration, () => setUpdateAvailable(true), () => window.location.reload());
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    }

    return () => {
      disposed = true;
      updates.current?.dispose();
      updates.current = null;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (isInstalled) return;

    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        // appinstalled confirms installation; a prompt is single-use even if dismissed.
      } catch (err) {
        console.error('Error invoking PWA install prompt:', err);
      } finally {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback instruction
      alert('To install Neximet Portal, open your browser menu (⋮ or Share) and select "Install App" or "Add to Home Screen".');
    }
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isIOS,
        isOffline,
        promptInstall,
        showIOSGuide,
        setShowIOSGuide,
      }}
    >
      {children}

      {showUpdate && (
        <div ref={updateNotice} role="status" className="pwa-update fixed z-50 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border border-[#5470F4]/50 bg-[#111827]/95 p-3 sm:p-4 text-sm shadow-2xl backdrop-blur-xl">
          <div className="col-span-2 sm:col-span-1 min-w-0"><p className="font-semibold">Update available</p><p className="mt-1 hidden sm:block text-xs text-gray-400">Finish your work, then refresh to load the latest Neximet Portal.</p></div>
          <button onClick={() => updates.current?.apply()} className="gradient-btn inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold"><RefreshCw size={16} />Refresh</button>
          <button onClick={() => setUpdateDismissed(true)} aria-label="Remind me about the update later" className="min-h-11 min-w-11 rounded-xl p-2 text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
      )}

      {/* Offline Toast Banner */}
      {isOffline && (
        <div role="status" className="fixed top-[calc(6rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50 bg-rose-500/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 border border-rose-400/30">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>You’re offline. Reconnect before submitting attendance, leave requests, or project changes.</span>
        </div>
      )}

      {/* iOS Installation Instruction Modal */}
      {showIOSGuide && (
        <div className="portal-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-label="Install on iPhone or iPad" className="bg-[#111827] border border-[#1F293D] rounded-3xl p-5 sm:p-7 max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center">
                  <img src="/icons/icon-192x192.png" alt="Neximet" className="w-6 h-6 rounded-lg" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white">Install on iPhone / iPad</h3>
                  <p className="text-[11px] text-gray-400">Add to your Home Screen in 3 steps</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close installation instructions"
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Steps list */}
            <div className="space-y-3.5 text-xs text-gray-200">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#0B0F19] border border-[#1F293D]">
                <div className="w-6 h-6 rounded-lg bg-[#5470F4]/20 text-[#5CC5FA] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white">Tap the Safari Share button</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    Look for the <span className="inline-flex items-center px-1.5 py-0.5 bg-[#1F293D] rounded text-white font-mono text-[10px]">Share [↑]</span> icon at the bottom bar of Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#0B0F19] border border-[#1F293D]">
                <div className="w-6 h-6 rounded-lg bg-[#5470F4]/20 text-[#5CC5FA] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white">Select “Add to Home Screen”</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    Scroll down through the options until you see <span className="text-[#5CC5FA] font-medium font-mono text-[10px]">“Add to Home Screen”</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#0B0F19] border border-[#1F293D]">
                <div className="w-6 h-6 rounded-lg bg-[#5470F4]/20 text-[#5CC5FA] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white">Tap “Add” in Top-Right</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    Confirm by tapping <span className="text-emerald-400 font-bold">Add</span>. The Neximet app icon will immediately appear on your home screen!
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#5470F4] to-[#4355DE] text-white font-bold text-xs hover:shadow-lg hover:shadow-[#5470F4]/30 transition-all cursor-pointer"
            >
              Got it, let’s do it!
            </button>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  );
}
