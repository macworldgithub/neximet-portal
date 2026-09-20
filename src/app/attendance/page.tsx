'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../lib/api';
import {
  Clock,
  UserCheck,
  Calendar,
  AlertTriangle,
  Coins,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  HelpCircle,
  Filter,
  Layers,
} from 'lucide-react';

export default function AttendancePage() {
  const { user, hasRole } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'self' | 'roster'>('self');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [simulatedHour, setSimulatedHour] = useState('now');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Digital clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const todayRes = await apiGet('/attendance/today');
      if (todayRes.success) {
        setTodayAttendance(todayRes.attendance);
      }

      const histRes = await apiGet('/attendance/history');
      if (histRes.success) {
        setHistory(histRes.records);
      }

      if (hasRole('CEO', 'Super Admin')) {
        const rosterRes = await apiGet('/attendance/roster');
        if (rosterRes.success) {
          setRoster(rosterRes.roster);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [user]);

  // Handle Check-In (with optional simulation time)
  const handleCheckIn = async () => {
    setActionLoading(true);
    setMsg(null);
    let customTime: string | undefined = undefined;

    const today = new Date();
    if (simulatedHour === 'on_time') {
      // 08:50 AM
      today.setHours(8, 50, 0, 0);
      customTime = today.toISOString();
    } else if (simulatedHour === 'grace') {
      // 09:10 AM
      today.setHours(9, 10, 0, 0);
      customTime = today.toISOString();
    } else if (simulatedHour === 'late_35') {
      // 09:35 AM (35 mins late)
      today.setHours(9, 35, 0, 0);
      customTime = today.toISOString();
    } else if (simulatedHour === 'half_day') {
      // 10:15 AM (75 mins late -> half day)
      today.setHours(10, 15, 0, 0);
      customTime = today.toISOString();
    }

    try {
      const res = await apiPost('/attendance/check-in', { customTime });
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Check-in recorded' });
        fetchAttendanceData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Check-in failed' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Check-in error occurred' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await apiPost('/attendance/check-out');
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Check-out recorded' });
        fetchAttendanceData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Check-out failed' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Check-out error occurred' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title & Shift Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-[#5470F4]" />
            <span>Attendance & Clock-In Management</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Automated late arrival tracking, salary deduction calculation, and remaining holiday quotas.
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1F293D] px-4 py-2 rounded-2xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-xs">
            <span className="text-gray-400 block text-[10px]">Active Shift Rule</span>
            <span className="text-white font-bold">09:00 AM - 06:00 PM (15m Grace)</span>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${msg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Terminal & Holiday Balance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Check-In / Check-Out Station */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#5470F4]" />
              <span>Personal Time Terminal</span>
            </h3>
            <span className="text-xs font-mono font-bold text-[#5CC5FA] bg-[#161F30] px-3 py-1 rounded-xl border border-[#1F293D]">
              {currentTime || '09:00:00 AM'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Today's Status Details */}
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Today's State</span>
                <div className="flex items-center gap-2 mt-1">
                  {todayAttendance?.checkIn ? (
                    <span className={`text-sm font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 ${todayAttendance.status === 'present'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : todayAttendance.status === 'half_day'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                      {todayAttendance.isLate ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span className="capitalize">{todayAttendance.status.replace('_', ' ')}</span>
                      {todayAttendance.isLate && ` (${todayAttendance.minutesLate}m late)`}
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-3 py-1 rounded-xl bg-gray-500/20 text-gray-400 border border-gray-500/30">
                      Not Checked In Yet
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D]">
                  <span className="text-gray-400 text-[10px] block font-semibold">Check-In</span>
                  <span className="font-bold text-white text-sm">
                    {todayAttendance?.checkIn
                      ? new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D]">
                  <span className="text-gray-400 text-[10px] block font-semibold">Check-Out</span>
                  <span className="font-bold text-white text-sm">
                    {todayAttendance?.checkOut
                      ? new Date(todayAttendance.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </span>
                </div>
              </div>

              {/* Deduction Indicator for Today */}
              {todayAttendance && todayAttendance.deductionAmount > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Penalty Applied</span>
                    </span>
                    <span className="font-black text-white text-sm">
                      -PKR {todayAttendance.deductionAmount} ({todayAttendance.deductionPercentage}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">{todayAttendance.deductionReason}</p>
                </div>
              )}
            </div>

            {/* Actions & Simulation Trigger */}
            <div className="space-y-4 bg-[#161F30]/70 p-5 rounded-2xl border border-[#1F293D]">
              <div>
                <label className="text-xs font-bold text-white flex items-center justify-between mb-1.5">
                  <span>Simulation Mode:</span>
                  <span className="text-[10px] text-[#5CC5FA] font-mono">Test Deduction Engine</span>
                </label>
                <select
                  value={simulatedHour}
                  onChange={(e) => setSimulatedHour(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="now">Real-Time Clock (Current Machine Time)</option>
                  <option value="on_time">Simulate On-Time Arrival (08:50 AM)</option>
                  <option value="grace">Simulate Grace Window (09:10 AM - 10m late)</option>
                  <option value="late_35">Simulate Late Arrival (09:35 AM - 35m late)</option>
                  <option value="half_day">Simulate Half-Day Penalty (10:15 AM - 75m late)</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                {!todayAttendance?.checkIn ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl text-xs font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/30 flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{actionLoading ? 'Recording...' : 'Mark Check-In Now'}</span>
                  </button>
                ) : !todayAttendance?.checkOut ? (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{actionLoading ? 'Recording...' : 'Mark Check-Out Now'}</span>
                  </button>
                ) : (
                  <div className="p-3 text-center bg-[#0B0F19] rounded-xl border border-[#1F293D] text-xs font-semibold text-emerald-400">
                    ✓ Completed shifts for today ({todayAttendance.totalWorkHours} hrs recorded)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Holidays & Leaves Left Balance Card */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Your Holidays Left</span>
              </h3>
              <span className="text-[11px] font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                2026 Quota
              </span>
            </div>

            <div className="text-center py-2">
              <span className="text-4xl font-black text-white tracking-tight">
                {(user?.leaveBalances?.casual || 0) + (user?.leaveBalances?.sick || 0) + (user?.leaveBalances?.annual || 0)}
              </span>
              <span className="text-xs text-gray-400 block mt-0.5">Total Days Remaining</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Casual Leaves</span>
                <span className="font-bold text-white font-mono">{user?.leaveBalances?.casual || 0} days</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Medical / Sick Leaves</span>
                <span className="font-bold text-white font-mono">{user?.leaveBalances?.sick || 0} days</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Annual Paid Vacations</span>
                <span className="font-bold text-white font-mono">{user?.leaveBalances?.annual || 0} days</span>
              </div>
            </div>
          </div>

          <a
            href="/leaves"
            className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-[#1F293D] hover:bg-[#5470F4] text-white transition-all block"
          >
            Apply for Time Off →
          </a>
        </div>
      </div>

      {/* Toggle View: My Attendance Log vs Daily Team Roster */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F293D] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('self')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'self'
                  ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30'
                  : 'text-gray-400 hover:text-white hover:bg-[#161F30]'
                }`}
            >
              My Attendance History
            </button>

            {hasRole('CEO', 'Super Admin') && (
              <button
                onClick={() => setActiveTab('roster')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'roster'
                    ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#161F30]'
                  }`}
              >
                Today's Company Roster ({roster.length} Staff)
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Personal History Table */}
        {activeTab === 'self' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 uppercase tracking-wider font-bold border-b border-[#1F293D] bg-[#0B0F19]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Late Delay</th>
                  <th className="py-3 px-4">Deduction</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {history && history.length > 0 ? (
                  history.map((record: any) => (
                    <tr key={record._id} className="hover:bg-[#161F30]/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-gray-300 font-semibold">{record.date}</td>
                      <td className="py-3.5 px-4 text-white">
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${record.status === 'present'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : record.status === 'half_day'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300">
                        {record.minutesLate > 0 ? (
                          <span className="text-amber-400 font-bold">{record.minutesLate} mins late</span>
                        ) : (
                          <span className="text-emerald-400">On-Time</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {record.deductionAmount > 0 ? (
                          <span className="text-rose-400 font-bold font-mono">-PKR {record.deductionAmount}</span>
                        ) : (
                          <span className="text-gray-500">PKR 0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400 max-w-xs truncate">
                        {record.deductionReason || record.notes || 'Normal attendance'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No attendance history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab 2: Company Roster View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 uppercase tracking-wider font-bold border-b border-[#1F293D] bg-[#0B0F19]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Today Status</th>
                  <th className="py-3 px-4">Late Minutes</th>
                  <th className="py-3 px-4">Deduction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {roster.map((item: any) => (
                  <tr key={item.user._id} className="hover:bg-[#161F30]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center font-bold text-[11px] text-[#5CC5FA] shrink-0">
                          {item.user?.name ? item.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <p className="font-bold text-white">{item.user.name}</p>
                          <p className="text-[10px] text-gray-400">{item.user.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">{item.user.department}</td>
                    <td className="py-3.5 px-4 font-mono text-white">
                      {item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not yet'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${item.status === 'present'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : item.status === 'half_day'
                            ? 'bg-rose-500/20 text-rose-300'
                            : item.status === 'late'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-gray-500/20 text-gray-400'
                        }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">
                      {item.minutesLate > 0 ? `${item.minutesLate} mins` : '--'}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {item.deductionAmount > 0 ? (
                        <span className="text-rose-400 font-bold">-PKR {item.deductionAmount}</span>
                      ) : (
                        <span className="text-gray-500">PKR 0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
