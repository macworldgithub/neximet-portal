'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
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
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
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
      badge: '5 Active',
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
      badge: '10',
    },
  ];

  const departments = [
    { name: 'Software Development', icon: Code2, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { name: 'Digital Marketing (SEO)', icon: TrendingUp, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    { name: 'Graphics Designing', icon: Palette, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    { name: 'WordPress Team', icon: Globe, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  ];

  return (
    <aside className="w-72 bg-[#0B0F19] border-r border-[#1F293D] flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* Brand Header */}
      <div className="h-20 px-6 flex items-center justify-between border-b border-[#1F293D] bg-[#0E1424]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <img
            src="/neximet-logo.avif"
            alt="Neximet"
            className="h-8 w-auto max-w-[130px] object-contain drop-shadow group-hover:scale-105 transition-transform"
          />
          <span className="text-[10px] font-bold bg-[#5470F4]/20 text-[#5CC5FA] px-2 py-0.5 rounded-full border border-[#5470F4]/30">
            PORTAL
          </span>
        </Link>
      </div>

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
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
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
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-[#5470F4]/20 to-[#5CC5FA]/10 text-white border border-[#5470F4]/30 shadow-sm'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-[#161F30]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-[#5CC5FA]' : 'text-gray-400 group-hover:text-gray-200'
                    }`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-[#1F293D] text-[#5CC5FA] border border-[#5470F4]/20">
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
      </div>

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
    </aside>
  );
}
