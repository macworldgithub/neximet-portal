'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-[#5470F4]/30 border-t-[#5470F4] animate-spin mb-4" />
      <p className="text-gray-400 text-sm font-medium">Entering Neximet Enterprise Portal...</p>
    </div>
  );
}
