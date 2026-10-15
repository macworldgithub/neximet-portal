'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  MessageSquare,
  Menu,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

interface MobileBottomNavProps {
  onToggleMenu: () => void;
  onCloseMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export default function MobileBottomNav({
  onToggleMenu,
  onCloseMenu,
  mobileMenuOpen,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const { unreadCount } = useChat();

  const handleLinkClick = () => {
    if (onCloseMenu) {
      onCloseMenu();
    } else if (mobileMenuOpen) {
      onToggleMenu();
    }
  };

  const navItems = [
    {
      label: 'Home',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Projects',
      href: '/projects',
      icon: FolderKanban,
    },
    {
      label: 'Clock-In',
      href: '/attendance',
      icon: Clock,
      isCenter: true,
    },
    {
      label: 'Chat',
      href: '/chat',
      icon: MessageSquare,
    },
  ];

  return (
    <nav
      className="portal-mobile-nav lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/90 backdrop-blur-xl border-t border-[#1F293D] px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className="relative -top-2 flex flex-col items-center group cursor-pointer min-h-[44px] min-w-[44px] justify-center"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                    isActive
                      ? 'bg-gradient-to-tr from-[#5470F4] to-[#5CC5FA] text-white shadow-[#5470F4]/40 scale-105'
                      : 'bg-gradient-to-tr from-[#161F30] to-[#1E293D] text-[#5CC5FA] border border-[#5470F4]/40 hover:border-[#5470F4]'
                  }`}
                >
                  <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                </div>
                <span
                  className={`text-[10px] font-bold mt-1 tracking-tight ${
                    isActive ? 'text-[#5CC5FA]' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all relative cursor-pointer min-h-[44px] min-w-[44px] justify-center ${
                isActive
                  ? 'text-[#5CC5FA]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.href === '/chat' && unreadCount > 0 && <span className="absolute -right-3 -top-2 rounded-full bg-[#5470F4] px-1 text-[9px] text-white" aria-label={`${unreadCount} unread messages`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5CC5FA]" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Menu Toggle Button */}
        <button
          type="button"
          onClick={onToggleMenu}
          className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer min-h-[44px] min-w-[44px] justify-center ${
            mobileMenuOpen ? 'text-[#5CC5FA]' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
        >
          <Menu className={`w-5 h-5 transition-transform ${mobileMenuOpen ? 'scale-110 text-[#5CC5FA]' : ''}`} />
          <span className={`text-[10px] mt-1 font-semibold ${mobileMenuOpen ? 'text-white' : 'text-gray-400'}`}>
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}
