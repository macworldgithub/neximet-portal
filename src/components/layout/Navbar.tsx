'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../lib/api';
import {
  Clock,
  UserCheck,
  LogOut,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);

  // Live real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's attendance status
  const fetchTodayStatus = async () => {
    try {
      const res = await apiGet('/attendance/today');
      if (res.success) {
        setTodayAttendance(res.attendance);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTodayStatus();
    }
  }, [user]);

  const handleQuickCheckIn = async () => {
    setClockActionLoading(true);
    try {
      if (!todayAttendance || !todayAttendance.checkIn) {
        // Clock In
        const res = await apiPost('/attendance/check-in');
        if (res.success) {
          setTodayAttendance(res.attendance);
        }
      } else if (!todayAttendance.checkOut) {
        // Clock Out
        const res = await apiPost('/attendance/check-out');
        if (res.success) {
          setTodayAttendance(res.attendance);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClockActionLoading(false);
    }
  };

  return (
    <header className="h-20 bg-[#0B0F19]/90 backdrop-blur-md border-b border-[#1F293D] fixed top-0 left-72 right-0 z-30 px-8 flex items-center justify-between">
      {/* Left: Real-time clock & shift info */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 bg-[#111827] px-4 py-2 rounded-xl border border-[#1F293D]">
          <Clock className="w-4 h-4 text-[#5CC5FA] animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white font-mono">{timeStr || '09:00:00 AM'}</span>
            <span className="text-[10px] text-gray-400">Shift: 09:00 AM - 06:00 PM (PKR Currency)</span>
          </div>
        </div>

        {/* Quick Attendance Pill */}
        <div className="flex items-center gap-2">
          {todayAttendance?.checkIn ? (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${todayAttendance.isLate
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}>
                {todayAttendance.isLate ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>
                  In at {new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {todayAttendance.isLate ? ` (${todayAttendance.minutesLate}m Late)` : ' (On Time)'}
                </span>
              </span>

              {!todayAttendance.checkOut && (
                <button
                  onClick={handleQuickCheckIn}
                  disabled={clockActionLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
                >
                  {clockActionLoading ? 'Saving...' : 'Check Out'}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleQuickCheckIn}
              disabled={clockActionLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn text-white flex items-center gap-2 shadow-lg shadow-[#5470F4]/20 hover:scale-[1.02] transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>{clockActionLoading ? 'Marking...' : 'Mark Check-In'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: User details & Sign Out */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <span className={`text-[11px] px-3 py-1 rounded-full font-bold inline-flex items-center gap-1.5 border ${user.role === 'CEO'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : user.role === 'Project Manager'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : user.role === 'Team Manager'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
              <ShieldCheck className="w-3 h-3" />
              <span>{user.role}</span>
            </span>

            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white leading-tight">{user.name}</p>
              <p className="text-[10px] text-gray-400">{user.email}</p>
            </div>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-bold text-xs text-[#5CC5FA] shadow-sm">
              {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
          </div>
        )}

        <button
          onClick={logout}
          title="Sign Out of Portal"
          className="p-2.5 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20 flex items-center gap-1.5 text-xs font-semibold"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
