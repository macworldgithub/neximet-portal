'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/login');
    }
  }, [user, loading, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
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

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex">
      <Sidebar />
      <div className="flex-1 ml-72 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 p-8 pt-28 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
