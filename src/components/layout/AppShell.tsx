'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import MobileBottomNav from './MobileBottomNav';
import PwaInstallBanner from '../pwa/PwaInstallBanner';
import CommunicationShell from './CommunicationShell';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === '/login';
  const [mobileMenu, setMobileMenu] = useState({ pathname, open: false });
  const mobileMenuOpen = mobileMenu.pathname === pathname && mobileMenu.open;
  const closeMobileMenu = useCallback(() => setMobileMenu({ pathname, open: false }), [pathname]);
  // Reset route-specific navigation state before rendering the new screen.
  if (mobileMenu.pathname !== pathname) setMobileMenu({ pathname, open: false });

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      const chat = pathname === '/chat' ? new URLSearchParams(window.location.search).get('conversation') : null;
      router.replace(chat && /^[a-f\d]{24}$/i.test(chat) ? `/login?chat=${chat}` : '/login');
    }
  }, [user, loading, isLoginPage, router, pathname]);

  if (isLoginPage) {
    return (
      <>
        {children}
        <PwaInstallBanner />
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center mb-2">
          <img
            src="/neximet-logo.avif"
            alt="Neximet"
            className="h-12 w-auto object-contain animate-pulse z-10 drop-shadow-xl"
          />
          <div className="absolute w-24 h-24 rounded-full bg-[#5470F4]/15 blur-xl animate-ping" />
        </div>
        <div className="w-8 h-8 rounded-full border-2 border-[#5470F4]/30 border-t-[#5470F4] animate-spin" />
        <p className="text-xs text-gray-400 font-medium tracking-wide">Validating session credentials...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (pathname === '/chat' || pathname === '/mail' || pathname === '/ai') {
    return <CommunicationShell pathname={pathname}>{children}</CommunicationShell>;
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex overflow-x-hidden">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={closeMobileMenu}
      />
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen w-full overflow-x-hidden min-w-0">
        <Navbar onToggleMobileMenu={() => setMobileMenu({ pathname, open: !mobileMenuOpen })} />
        <main className="portal-main flex-1 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileBottomNav
        mobileMenuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenu({ pathname, open: !mobileMenuOpen })}
      />
      <PwaInstallBanner />
    </div>
  );
}
