'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationBell() {
  const { unread, error } = useNotifications();
  return <Link href="/notifications" title={error || 'Notifications'} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="portal-header-action relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1F293D] bg-[#111827] text-gray-300 hover:text-[#5CC5FA]">
    <Bell size={18} />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#5470F4] px-1.5 py-0.5 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
  </Link>;
}
