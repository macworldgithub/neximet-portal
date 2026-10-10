'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Download,
  Share2,
  PlusSquare,
  X,
  Smartphone,
  CheckCircle2,
  WifiOff,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

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

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Detect if running as installed standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // 2. Detect iOS / iPadOS
    const ua = window.navigator.userAgent;
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    if (isIOSDevice && !isStandalone) {
      // iOS doesn't fire beforeinstallprompt, but can be added to home screen
      setIsInstallable(true);
    }

    // 3. Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 5. Online / Offline network listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 6. Register Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    } else if ('serviceWorker' in navigator) {
      // Also register in dev mode so testing works seamlessly
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA-Dev] Service Worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA-Dev] SW registration notice:', err);
        });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setIsInstallable(false);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('Error invoking PWA install prompt:', err);
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

      {/* Offline Toast Banner */}
      {isOffline && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-50 bg-rose-500/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 border border-rose-400/30 animate-bounce">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>You are currently offline. Running on cached telemetry.</span>
        </div>
      )}

      {/* iOS Installation Instruction Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center">
                  <img src="/icons/icon-192x192.png" alt="Neximet" className="w-6 h-6 rounded-lg" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Install on iPhone / iPad</h3>
                  <p className="text-[11px] text-gray-400">Add to your Home Screen in 3 steps</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
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
                  <p className="font-semibold text-white">Select "Add to Home Screen"</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    Scroll down through the options until you see <span className="text-[#5CC5FA] font-medium font-mono text-[10px]">"Add to Home Screen"</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#0B0F19] border border-[#1F293D]">
                <div className="w-6 h-6 rounded-lg bg-[#5470F4]/20 text-[#5CC5FA] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white">Tap "Add" in Top-Right</p>
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
              Got it, let's do it!
            </button>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  );
}
