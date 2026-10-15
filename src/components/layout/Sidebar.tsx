'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../lib/api';
import { useChat } from '../../context/ChatContext';
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  Coins,
  CalendarDays,
  Users,
  Code2,
  TrendingUp,
  Palette,
  Globe,
  ShieldCheck,
  Building2,
  X,
  Settings,
  Download,
  MessageSquare,
} from 'lucide-react';
import ProfileSettingsModal from '../profile/ProfileSettingsModal';
import { usePwa } from '../pwa/PwaProvider';
import { isMotoZ3, openMotoZ3Drawer } from '../../lib/motoZ3';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { unreadCount } = useChat();
  const { user, isSuperAdmin } = useAuth();
  const { isInstallable, isInstalled, promptInstall } = usePwa();
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const menu = useRef<HTMLElement>(null);
  const [motoZ3, setMotoZ3] = useState(false);

  useEffect(() => {
    let mounted = true;
    void isMotoZ3(navigator).then(matches => { if (mounted) setMotoZ3(matches); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    if (motoZ3) return openMotoZ3Drawer(menu.current, onCloseMobile);
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) onCloseMobile?.(); };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', closeOnDesktop);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [mobileOpen, onCloseMobile, motoZ3]);

  useEffect(() => {
    if (!user) return;
    const fetchCounts = async () => {
      try {
        const [projRes, usersRes] = await Promise.all([
          apiGet('/projects'),
          apiGet('/auth/users'),
        ]);
        if (projRes.success) {
          setProjectsCount(projRes.count ?? projRes.projects?.length ?? 0);
        }
        if (usersRes.success) {
          setUsersCount(usersRes.count ?? usersRes.users?.length ?? 0);
        }
      } catch (err) {
        console.error('Error fetching sidebar counts:', err);
      }
    };
    fetchCounts();
  }, [user]);

  const isExecutive = isSuperAdmin || user?.role === 'CEO';

  const navItems = [
    { label: 'Team Chat', href: '/chat', icon: MessageSquare, badge: unreadCount ? `${unreadCount} unread` : null },
    {
      label: 'Executive Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'Projects & Scopes',
      href: '/projects',
      icon: FolderKanban,
      badge:
        projectsCount !== null
          ? isExecutive
            ? `${projectsCount} Total`
            : `${projectsCount} Team`
          : null,
    },
    {
      label: 'Attendance & Clock',
      href: '/attendance',
      icon: Clock,
      badge: null,
    },
    {
      label: 'Deduction Rules',
      href: '/deduction-settings',
      icon: Coins,
      badge: user?.role === 'CEO' ? 'CEO' : null,
    },
    {
      label: 'Leaves & Holidays',
      href: '/leaves',
      icon: CalendarDays,
      badge: null,
    },
    {
      label: 'Team Directory',
      href: '/employees',
      icon: Users,
      badge: usersCount !== null ? `${usersCount}` : null,
    },
  ];

  const departments = [
    { name: 'Software Development', icon: Code2, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { name: 'Digital Marketing (SEO)', icon: TrendingUp, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    { name: 'Graphics Designing', icon: Palette, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    { name: 'WordPress Team', icon: Globe, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ];

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          data-moto-z3-backdrop={motoZ3 ? true : undefined}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        ref={menu}
        data-moto-z3={motoZ3 ? true : undefined}
        data-mobile-open={mobileOpen}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Navigation menu"
        onKeyDown={event => {
          if (!mobileOpen) return;
          if (event.key === 'Escape') { event.preventDefault(); onCloseMobile?.(); }
          if (event.key === 'Tab') {
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')).filter(element => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden');
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}
        className={`portal-sidebar w-72 bg-[#0B0F19] border-r border-[#1F293D] flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'visible translate-x-0 shadow-2xl' : 'invisible -translate-x-full lg:visible lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 shrink-0 px-5 flex items-center justify-between gap-2 border-b border-[#1F293D] bg-[#0E1424]">
          <Link href="/dashboard" onClick={handleLinkClick} className="min-w-0 flex items-center gap-2 group">
            <img
              src="/neximet-logo.avif"
              alt="Neximet"
              className="h-8 w-auto max-w-[110px] shrink-0 object-contain drop-shadow group-hover:scale-105 transition-transform"
            />
            <span className="text-[10px] font-bold bg-[#5470F4]/20 text-[#5CC5FA] px-2 py-0.5 rounded-full border border-[#5470F4]/30">
              PORTAL
            </span>
          </Link>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-colors"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Keep every menu section reachable even in a short landscape viewport. */}
        <div className="portal-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* User Persona Card */}
        {user && (
          <div className="px-5 py-4 border-b border-[#1F293D] bg-[#111827]/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-black text-sm text-[#5CC5FA] shadow-md shadow-[#5470F4]/10 shrink-0">
                {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <h4 className="text-sm font-semibold text-white truncate">{user.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${
                    user.role === 'CEO'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : user.role === 'Project Manager'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : user.role === 'Team Manager'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 truncate">
              {user.designation} • {user.department}
            </p>
          </div>
        )}

        {/* Main Navigation */}
        <div className="px-3 py-4 space-y-6">
          <div>
            <p className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Main Management
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#5470F4]/20 to-[#5CC5FA]/10 text-white border border-[#5470F4]/30 shadow-sm'
                        : 'text-gray-400 hover:text-gray-100 hover:bg-[#161F30]'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-[#5CC5FA]' : 'text-gray-400 group-hover:text-gray-200'
                      }`} />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-md font-semibold bg-[#1F293D] text-[#5CC5FA] border border-[#5470F4]/20">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Departments Sub-Section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                {user?.role === 'CEO' || user?.role === 'Super Admin' ? 'Departments' : 'My Team'}
              </p>
              <Building2 className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="space-y-1.5">
              {(user?.role === 'CEO' || user?.role === 'Super Admin'
                ? departments
                : departments.filter((dept) => dept.name === user?.department)
              ).map((dept) => {
                const Icon = dept.icon;
                return (
                  <Link
                    key={dept.name}
                    href={`/projects?dept=${encodeURIComponent(dept.name)}`}
                    onClick={handleLinkClick}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-[#161F30] transition-colors"
                  >
                    <span className={`p-1 rounded-md border ${dept.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">{dept.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* PWA Install Action */}
          {isInstallable && !isInstalled && (
            <div className="px-3 pt-2">
              <button
                onClick={() => {
                  promptInstall();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-[#5470F4]/20 via-[#5CC5FA]/15 to-transparent border border-[#5470F4]/40 hover:border-[#5470F4] text-white text-xs font-semibold transition-all group cursor-pointer shadow-lg shadow-[#5470F4]/10 hover:shadow-[#5470F4]/20"
              >
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#5470F4] to-[#5CC5FA] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold text-white text-xs leading-tight">Install App</p>
                  <p className="text-[10px] text-[#5CC5FA] font-medium truncate">Quick home-screen access</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* User Profile & Security Quick Bar */}
        {user && (
          <div className="p-3 border-t border-[#1F293D] bg-[#0B0F19]/80">
            <button
              onClick={() => {
                setProfileModalOpen(true);
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-[#111827] hover:bg-[#161F30] border border-[#1F293D] hover:border-[#5470F4]/40 transition-all text-left group cursor-pointer"
              title="Edit My Phone & Password"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-bold text-xs text-[#5CC5FA] shrink-0 group-hover:scale-105 transition-transform">
                  {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-white group-hover:text-[#5CC5FA] transition-colors truncate">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">
                    {user.phone || 'Set Phone Number'}
                  </p>
                </div>
              </div>
              <span className="p-1 rounded-lg text-gray-400 group-hover:text-white transition-colors shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-[#1F293D] bg-[#0E1424]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/neximet-logo.avif" alt="Neximet" className="h-4 w-auto object-contain opacity-70" />
              <span className="text-[10px] text-gray-500 font-mono">v2.4 Enterprise</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-2 text-center">© 2026 Neximet Inc. All Rights Reserved.</p>
        </div>
        </div>
      </aside>

      {/* Profile & Security Modal */}
      <ProfileSettingsModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}
