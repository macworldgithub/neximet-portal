'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiPut } from '../../lib/api';
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
  CalendarDays,
  Check,
  X,
  FolderKanban,
  ExternalLink,
  AlertTriangle,
  Menu,
} from 'lucide-react';
import AdminResetPasswordModal from '../employees/AdminResetPasswordModal';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export default function Navbar({ onToggleMobileMenu }: NavbarProps) {
  const { user, isSuperAdmin, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);

  // Consolidated Admin Notifications State
  const [notificationsData, setNotificationsData] = useState<any>({
    totalCount: 0,
    counts: { leaves: 0, passwords: 0, attendance: 0, tasks: 0 },
    notifications: { leaves: [], passwords: [], attendance: [], tasks: [] },
  });
  const [activeTab, setActiveTab] = useState<'all' | 'leaves' | 'passwords' | 'other'>('all');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [selectedEmployeeForReset, setSelectedEmployeeForReset] = useState<any>(null);
  const [leaveActionLoading, setLeaveActionLoading] = useState<string | null>(null);
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

  // Fetch consolidated notifications for Super Admin / CEO
  const fetchAdminNotifications = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await apiGet('/dashboard/admin-notifications');
      if (res.success) {
        setNotificationsData(res);
      }
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTodayStatus();
      if (isSuperAdmin) {
        fetchAdminNotifications();
        const poll = setInterval(fetchAdminNotifications, 15000); // Poll every 15s
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
        const res = await apiPost('/attendance/check-in');
        if (res.success) {
          setTodayAttendance(res.attendance);
        }
      } else if (!todayAttendance.checkOut) {
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

  const handleReviewLeave = async (id: string, status: 'approved' | 'rejected') => {
    setLeaveActionLoading(id);
    try {
      const res = await apiPut(`/leaves/requests/${id}/review`, { status });
      if (res.success) {
        await fetchAdminNotifications();
      }
    } catch (err) {
      console.error('Error reviewing leave:', err);
    } finally {
      setLeaveActionLoading(null);
    }
  };

  const handleOpenResetFromNotif = (req: any) => {
    setSelectedEmployeeForReset({
      id: req.user?._id || req.user || req.id,
      name: req.name,
      email: req.email,
      role: req.role,
      department: req.department,
      requestId: req._id,
    });
    setShowNotifDropdown(false);
  };

  const totalUnread = notificationsData.totalCount || 0;
  const leaveRequests = notificationsData.notifications?.leaves || [];
  const passwordRequests = notificationsData.notifications?.passwords || [];
  const attendanceAlerts = notificationsData.notifications?.attendance || [];
  const taskAlerts = notificationsData.notifications?.tasks || [];

  return (
    <>
      <header className="h-20 bg-[#0B0F19]/90 backdrop-blur-md border-b border-[#1F293D] fixed top-0 left-0 lg:left-72 right-0 z-30 px-3.5 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Mobile Toggle & Real-time clock & shift info */}
        <div className="flex items-center gap-2.5 sm:gap-6">
          {/* Mobile Drawer Trigger */}
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] border border-[#1F293D] transition-colors"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 sm:gap-3 bg-[#111827] px-3 sm:px-4 py-2 rounded-xl border border-[#1F293D]">
            <Clock className="w-4 h-4 text-[#5CC5FA] animate-pulse shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white font-mono">{timeStr || '09:00:00 AM'}</span>
              <span className="text-[10px] text-gray-400 hidden sm:block">Shift: 09:00 AM - 06:00 PM (PKR Currency)</span>
            </div>
          </div>

          {/* Quick Attendance Pill (hidden on very small screens to avoid header squish) */}
          <div className="hidden sm:flex items-center gap-2">
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
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Super Admin Unified Notification Center */}
          {isSuperAdmin && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className={`relative p-2 sm:p-2.5 rounded-xl border transition-all ${
                  totalUnread > 0
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                    : 'bg-[#111827] text-gray-400 border-[#1F293D] hover:text-white hover:border-[#5470F4]/40'
                }`}
                title="Super Admin Notifications & Approvals"
              >
                <Bell className="w-4 h-4" />
                {totalUnread > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose-500 text-white font-mono text-[9px] sm:text-[10px] font-bold flex items-center justify-center shadow-lg shadow-rose-500/40">
                      {totalUnread}
                    </span>
                    <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose-400 animate-ping opacity-75" />
                  </>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-3 w-[calc(100vw-32px)] sm:w-[440px] max-w-[440px] bg-[#111827] border border-[#1F293D] rounded-3xl shadow-2xl shadow-black/90 p-4 space-y-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#5CC5FA]" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Executive Notifications
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F293D] text-[#5CC5FA] border border-[#5470F4]/30">
                      {totalUnread} Action Items
                    </span>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#1F293D]/60 text-[11px]">
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                        activeTab === 'all'
                          ? 'bg-[#5470F4] text-white shadow-sm'
                          : 'bg-[#0B0F19] text-gray-400 hover:text-white'
                      }`}
                    >
                      All ({totalUnread})
                    </button>
                    <button
                      onClick={() => setActiveTab('leaves')}
                      className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                        activeTab === 'leaves'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-[#0B0F19] text-gray-400 hover:text-white'
                      }`}
                    >
                      Leaves ({leaveRequests.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('passwords')}
                      className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                        activeTab === 'passwords'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-[#0B0F19] text-gray-400 hover:text-white'
                      }`}
                    >
                      Passwords ({passwordRequests.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('other')}
                      className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                        activeTab === 'other'
                          ? 'bg-purple-500 text-white shadow-sm'
                          : 'bg-[#0B0F19] text-gray-400 hover:text-white'
                      }`}
                    >
                      Alerts ({attendanceAlerts.length + taskAlerts.length})
                    </button>
                  </div>

                  {/* Content List */}
                  {totalUnread === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto opacity-80" />
                      <p className="text-xs text-gray-300 font-semibold">Everything Caught Up!</p>
                      <p className="text-[11px] text-gray-500">
                        No pending leaves, password resets, or executive alerts.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                      {/* 1. Pending Leave Approvals */}
                      {(activeTab === 'all' || activeTab === 'leaves') &&
                        leaveRequests.map((req: any) => (
                          <div
                            key={req._id}
                            className="bg-[#0B0F19] border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5 hover:border-amber-500/60 transition-all shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                                  <p className="text-xs font-bold text-white">
                                    {req.user?.name || 'Staff Member'}
                                  </p>
                                </div>
                                <span className="text-[10px] text-gray-400 block mt-0.5">
                                  {req.user?.department} • Applied {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                                {req.leaveType} ({req.totalDays}d)
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-300 bg-[#111827] p-2 rounded-xl border border-[#1F293D] italic">
                              "{req.reason}"
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-[#1F293D] pt-2">
                              <span>
                                {new Date(req.startDate).toLocaleDateString()} →{' '}
                                {new Date(req.endDate).toLocaleDateString()}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleReviewLeave(req._id, 'rejected')}
                                  disabled={leaveActionLoading === req._id}
                                  className="px-2.5 py-1 rounded-lg text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                                <button
                                  onClick={() => handleReviewLeave(req._id, 'approved')}
                                  disabled={leaveActionLoading === req._id}
                                  className="px-3 py-1 rounded-lg text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 font-bold flex items-center gap-1 transition-all shadow-sm disabled:opacity-50"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                      {/* 2. Pending Password Reset Requests */}
                      {(activeTab === 'all' || activeTab === 'passwords') &&
                        passwordRequests.map((req: any) => (
                          <div
                            key={req._id}
                            className="bg-[#0B0F19] border border-blue-500/30 rounded-2xl p-3.5 space-y-2 hover:border-blue-500/60 transition-all shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                                  <p className="text-xs font-bold text-white">{req.name}</p>
                                </div>
                                <p className="text-[11px] text-[#5CC5FA] font-mono mt-0.5">{req.email}</p>
                                <span className="text-[10px] text-gray-400 block mt-0.5">
                                  {req.role} • {req.department}
                                </span>
                              </div>
                              <span className="text-[9px] text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                Password Reset
                              </span>
                            </div>

                            <div className="pt-1 flex justify-end">
                              <button
                                onClick={() => handleOpenResetFromNotif(req)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Reset Password</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}

                      {/* 3. Today's Attendance Alerts */}
                      {(activeTab === 'all' || activeTab === 'other') &&
                        attendanceAlerts.map((att: any) => (
                          <div
                            key={att._id}
                            className="bg-[#0B0F19] border border-amber-500/20 rounded-2xl p-3 space-y-1.5 hover:border-amber-500/40 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="text-xs font-bold text-white">{att.name}</span>
                                </div>
                                <p className="text-[10px] text-gray-400">{att.department}</p>
                              </div>
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {att.minutesLate}m Late Today
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-[#1F293D]">
                              <span>Deduction: PKR {Number(att.deductionAmount || 0).toLocaleString()}</span>
                              <Link
                                href="/attendance"
                                onClick={() => setShowNotifDropdown(false)}
                                className="text-[#5CC5FA] hover:underline flex items-center gap-0.5"
                              >
                                <span>View Roster</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            </div>
                          </div>
                        ))}

                      {/* 4. Urgent Tasks & Reviews */}
                      {(activeTab === 'all' || activeTab === 'other') &&
                        taskAlerts.map((task: any) => (
                          <div
                            key={task._id}
                            className="bg-[#0B0F19] border border-purple-500/20 rounded-2xl p-3 space-y-1.5 hover:border-purple-500/40 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
                                  <span className="text-xs font-bold text-white truncate max-w-[200px]">
                                    {task.title}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-400">
                                  {task.project?.title || 'Project'} • Assignee: {task.assignedTo?.name || 'Unassigned'}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 uppercase">
                                {task.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-[#1F293D]">
                              <span className="text-rose-400 font-semibold">Priority: {task.priority}</span>
                              <Link
                                href={`/projects/${task.project?._id || ''}`}
                                onClick={() => setShowNotifDropdown(false)}
                                className="text-[#5CC5FA] hover:underline flex items-center gap-0.5"
                              >
                                <span>Open Kanban</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Dropdown Footer */}
                  <div className="pt-2 border-t border-[#1F293D] flex items-center justify-between text-[11px]">
                    <Link
                      href="/leaves"
                      onClick={() => setShowNotifDropdown(false)}
                      className="text-[#5CC5FA] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <CalendarDays className="w-3 h-3" />
                      <span>Leaves Center</span>
                    </Link>
                    <Link
                      href="/employees"
                      onClick={() => setShowNotifDropdown(false)}
                      className="text-gray-400 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <span>Team Directory</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
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
                    : user.role === 'Super Admin'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
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
            fetchAdminNotifications();
          }}
        />
      )}
    </>
  );
}
