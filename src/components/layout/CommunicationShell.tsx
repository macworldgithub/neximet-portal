'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Home, Mail, Menu, MessageSquare, Sparkles, Video } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useMail } from '../../context/MailContext';
import { bindCommunicationViewport } from '../../lib/communicationViewport';
import Sidebar from './Sidebar';
import NotificationBell from '../notifications/NotificationBell';

export default function CommunicationShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { unreadCount } = useChat();
  const { unread } = useMail();
  useEffect(() => {
    if (root.current) return bindCommunicationViewport(root.current);
  }, []);

  return <div ref={root} className="communication-shell bg-[#0B0F19] text-gray-100">
    <Sidebar drawerOnly mobileOpen={menuOpen} onCloseMobile={closeMenu} />
    <header className="communication-header flex shrink-0 items-center justify-between gap-2 border-b border-[#1F293D] bg-[#0E1424] px-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button onClick={() => setMenuOpen(true)} aria-label="Open navigation menu" className="communication-icon"><Menu size={20} /></button>
        <Link href="/dashboard" title="Back to dashboard" aria-label="Back to dashboard" className="communication-icon"><Home size={19} /></Link>
        <span className="hidden text-sm font-semibold text-gray-300 sm:inline">Neximet</span>
      </div>
      <nav aria-label="Communication" className="flex items-center gap-1">
        <NotificationBell />
        {[{ href: '/chat', label: 'Chat', icon: MessageSquare, unread: unreadCount }, { href: '/meet', label: 'Meet', icon: Video, unread: 0 }, { href: '/mail', label: 'Mail', icon: Mail, unread }, { href: '/ai', label: 'AI', icon: Sparkles, unread: 0 }].map(item => <Link
          key={item.href} href={item.href} aria-label={item.label} onClick={() => setMenuOpen(false)} aria-current={pathname === item.href ? 'page' : undefined}
          className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium sm:gap-2 sm:px-3 ${pathname === item.href ? 'bg-[#5470F4]/20 text-[#5CC5FA]' : 'text-gray-400 hover:bg-[#161F30]'}`}
        ><item.icon size={17} /><span className="hidden min-[480px]:inline">{item.label}</span>{item.unread > 0 && <span className="rounded-full bg-[#5470F4] px-1.5 text-[10px] text-white" aria-label={`${item.unread} unread`}>{item.unread > 99 ? '99+' : item.unread}</span>}</Link>)}
      </nav>
    </header>
    <main className="communication-main min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
  </div>;
}
