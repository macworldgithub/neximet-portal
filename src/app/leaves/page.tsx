'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Calendar,
  X,
} from 'lucide-react';

export default function LeavesPage() {
  const { user, hasRole } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [newLeave, setNewLeave] = useState({
    leaveType: 'casual',
    startDate: '',
    endDate: '',
    totalDays: 1,
    reason: '',
  });

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      const summaryRes = await apiGet('/leaves/summary');
      if (summaryRes.success) {
        setSummary(summaryRes);
      }

      const reqRes = await apiGet('/leaves/requests');
      if (reqRes.success) {
        setRequests(reqRes.requests);
      }

      const holRes = await apiGet('/leaves/holidays');
      if (holRes.success) {
        setHolidays(holRes.holidays);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, [user]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await apiPost('/leaves/apply', newLeave);
      if (res.success) {
        setMsg({ type: 'success', text: 'Leave application submitted successfully!' });
        setShowApplyModal(false);
        setNewLeave({
          leaveType: 'casual',
          startDate: '',
          endDate: '',
          totalDays: 1,
          reason: '',
        });
        fetchLeaveData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Failed to submit application' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Failed to apply for leave' });
    }
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await apiPut(`/leaves/requests/${id}/review`, { status });
      if (res.success) {
        fetchLeaveData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-[#5470F4]" />
            <span>Holidays & Leave Management</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Track annual leave balance, apply for leaves, view company holiday calendar, and manage approvals.
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white flex items-center gap-2 shadow-lg shadow-[#5470F4]/30"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
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

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Holidays Left</span>
          <p className="text-3xl font-black text-white mt-1.5">{summary?.totalRemainingHolidays || 0} Days</p>
          <p className="text-[11px] text-gray-500 mt-2">Combined balance available</p>
        </div>

        <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Casual Leaves</span>
          <p className="text-3xl font-black text-[#5CC5FA] mt-1.5">{summary?.leaveBalances?.casual || 0} Days</p>
          <p className="text-[11px] text-gray-500 mt-2">Short term & personal time</p>
        </div>

        <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Medical / Sick</span>
          <p className="text-3xl font-black text-purple-400 mt-1.5">{summary?.leaveBalances?.sick || 0} Days</p>
          <p className="text-[11px] text-gray-500 mt-2">Health & doctor visits</p>
        </div>

        <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Annual Vacation</span>
          <p className="text-3xl font-black text-emerald-400 mt-1.5">{summary?.leaveBalances?.annual || 0} Days</p>
          <p className="text-[11px] text-gray-500 mt-2">Planned corporate time-off</p>
        </div>
      </div>

      {/* Leave Applications & Approvals Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
            <h3 className="text-base font-bold text-white">
              {hasRole('CEO', 'Project Manager', 'Team Manager') ? 'Team Leave Requests & Approvals' : 'My Leave Applications'}
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#161F30] text-gray-300">
              {requests.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 uppercase tracking-wider font-bold border-b border-[#1F293D] bg-[#0B0F19]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  {hasRole('CEO', 'Project Manager', 'Team Manager') && <th className="py-3 px-4">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {requests && requests.length > 0 ? (
                  requests.map((r: any) => (
                    <tr key={r._id} className="hover:bg-[#161F30]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center font-bold text-[10px] text-[#5CC5FA] shrink-0">
                            {r.user?.name ? r.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                          </div>
                          <span className="font-bold text-white">{r.user?.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 capitalize font-semibold text-gray-300">{r.leaveType}</td>
                      <td className="py-3.5 px-4 text-gray-300 font-mono">
                        {new Date(r.startDate).toLocaleDateString()} - {new Date(r.endDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">{r.totalDays} days</td>
                      <td className="py-3.5 px-4 text-gray-400 max-w-xs truncate">{r.reason}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${r.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : r.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                          {r.status}
                        </span>
                      </td>
                      {hasRole('CEO', 'Project Manager', 'Team Manager') && (
                        <td className="py-3.5 px-4">
                          {r.status === 'pending' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleReview(r._id, 'approved')}
                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                                title="Approve Request"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReview(r._id, 'rejected')}
                                className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                                title="Reject Request"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-500">Reviewed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No leave requests on record.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Company Official Holiday Calendar */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5CC5FA]" />
              <span>Official Company Holidays (2026)</span>
            </h3>
            <span className="text-[10px] text-gray-400">{holidays.length} Days Off</span>
          </div>

          <div className="space-y-2.5">
            {holidays.map((h) => (
              <div
                key={h._id}
                className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D] flex items-center justify-between"
              >
                <div>
                  <h5 className="text-xs font-bold text-white">{h.title}</h5>
                  <span className="text-[10px] text-gray-400">{h.description}</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#5CC5FA] bg-[#0B0F19] px-2.5 py-1 rounded-lg border border-[#1F293D]">
                  {new Date(h.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <h3 className="text-base font-bold text-white">Apply for Leave / Time-Off</h3>
              <button onClick={() => setShowApplyModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Leave Category</label>
                <select
                  value={newLeave.leaveType}
                  onChange={(e) => setNewLeave({ ...newLeave, leaveType: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="casual">Casual Leave ({summary?.leaveBalances?.casual || 0} days left)</option>
                  <option value="sick">Sick / Medical Leave ({summary?.leaveBalances?.sick || 0} days left)</option>
                  <option value="annual">Annual Vacation ({summary?.leaveBalances?.annual || 0} days left)</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={newLeave.startDate}
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={newLeave.endDate}
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Total Days Requested</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  required
                  value={newLeave.totalDays}
                  onChange={(e) => setNewLeave({ ...newLeave, totalDays: Number(e.target.value) })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Reason for Leave</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide context for manager approval..."
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl p-3 text-xs text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
