'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../lib/api';
import {
  Clock,
  UserCheck,
  LogOut,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Bell,
  KeyRound,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import AdminResetPasswordModal from '../employees/AdminResetPasswordModal';

export default function Navbar() {
  const { user, isSuperAdmin, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);

  // Admin Notification State
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [selectedEmployeeForReset, setSelectedEmployeeForReset] = useState<any>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  // Fetch pending password reset requests for Super Admin / CEO
  const fetchPendingPasswordRequests = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await apiGet('/auth/password-requests?status=Pending');
      if (res.success) {
        setPendingRequests(res.requests || []);
      }
    } catch (err) {
      console.error('Error fetching password requests:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTodayStatus();
      if (isSuperAdmin) {
        fetchPendingPasswordRequests();
        const poll = setInterval(fetchPendingPasswordRequests, 15000); // Check every 15s
        return () => clearInterval(poll);
      }
    }
  }, [user, isSuperAdmin]);

  // Handle outside click for notification dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleOpenResetFromNotif = (req: any) => {
    setSelectedEmployeeForReset({
      id: req.user?._id || req.user,
      name: req.name,
      email: req.email,
      role: req.role,
      department: req.department,
      requestId: req._id,
    });
    setShowNotifDropdown(false);
  };

  return (
    <>
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
                <span
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
                    todayAttendance.isLate
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {todayAttendance.isLate ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    In at{' '}
                    {new Date(todayAttendance.checkIn).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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

        {/* Right: Notifications, User details & Sign Out */}
        <div className="flex items-center gap-4">
          {/* Super Admin Notification Bell for Password Resets */}
          {isSuperAdmin && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className={`relative p-2.5 rounded-xl border transition-all ${
                  pendingRequests.length > 0
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                    : 'bg-[#111827] text-gray-400 border-[#1F293D] hover:text-white hover:border-[#5470F4]/40'
                }`}
                title="Super Admin Notifications"
              >
                <Bell className="w-4 h-4" />
                {pendingRequests.length > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-lg shadow-rose-500/40">
                      {pendingRequests.length}
                    </span>
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-400 animate-ping opacity-75" />
                  </>
                )}
              </button>

              {/* Dropdown Menu */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-3 w-84 sm:w-96 bg-[#111827] border border-[#1F293D] rounded-2xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Password Reset Requests
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F293D] text-gray-300 border border-[#2D3A54]">
                      {pendingRequests.length} Pending
                    </span>
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
                      <p className="text-xs text-gray-300 font-medium">All Clear!</p>
                      <p className="text-[11px] text-gray-500">
                        No pending password reset requests from employees.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                      {pendingRequests.map((req) => (
                        <div
                          key={req._id}
                          className="bg-[#0B0F19] border border-[#1F293D] hover:border-amber-500/40 rounded-xl p-3 space-y-2 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-bold text-white">{req.name}</p>
                              <p className="text-[11px] text-[#5CC5FA] font-mono">{req.email}</p>
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                {req.role} • {req.department}
                              </span>
                            </div>
                            <span className="text-[9px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {new Date(req.requestedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => handleOpenResetFromNotif(req)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset Password</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {user && (
            <div className="flex items-center gap-3">
              <span
                className={`text-[11px] px-3 py-1 rounded-full font-bold inline-flex items-center gap-1.5 border ${
                  user.role === 'CEO'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : user.role === 'Project Manager'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    : user.role === 'Team Manager'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>{user.role}</span>
              </span>

              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white leading-tight">{user.name}</p>
                <p className="text-[10px] text-gray-400">{user.email}</p>
              </div>

              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/40 flex items-center justify-center font-bold text-xs text-[#5CC5FA] shadow-sm">
                {user.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
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

      {/* Admin Reset Password Modal from Navbar Notifications */}
      {selectedEmployeeForReset && (
        <AdminResetPasswordModal
          isOpen={!!selectedEmployeeForReset}
          onClose={() => setSelectedEmployeeForReset(null)}
          employee={selectedEmployeeForReset}
          onSuccess={() => {
            fetchPendingPasswordRequests();
          }}
        />
      )}
    </>
  );
}
