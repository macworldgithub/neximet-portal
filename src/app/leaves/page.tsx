'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceGet as apiGet, attendancePost as apiPost, attendancePut as apiPut } from '../../lib/attendanceApi';
import { attendanceDate } from '../../lib/attendance';
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

const emptyLeave = { leaveType: 'casual', startDate: '', endDate: '', session: 'full', reason: '' };

export default function LeavesPage() {
  const { user, hasRole } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsReady, setRequestsReady] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidaysReady, setHolidaysReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const fetchSequence = useRef(0);
  const sessionVersion = useRef(0);
  const applyPending = useRef(false);
  const reviewPending = useRef(new Set<string>());
  const [reviewing, setReviewing] = useState<string[]>([]);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [newLeave, setNewLeave] = useState(emptyLeave);
  const [duration, setDuration] = useState<{ totalDays: number; workingDates: string[]; key: string } | null>(null);
  const [durationError, setDurationError] = useState('');
  const [durationLoading, setDurationLoading] = useState(false);
  const [durationRevision, setDurationRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const durationKey = `${newLeave.startDate}|${newLeave.endDate}|${newLeave.session}`;
  useEffect(() => {
    let active = true;
    setDuration(null); setDurationError('');
    if (!newLeave.startDate || !newLeave.endDate) { setDurationLoading(false); return; }
    setDurationLoading(true);
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ startDate: newLeave.startDate, endDate: newLeave.endDate, session: newLeave.session });
        const response = await apiGet(`/leaves/duration?${query}`);
        if (!active) return;
        if (response.success) setDuration({ ...response.duration, key: durationKey });
        else setDurationError(response.message || 'Unable to calculate leave duration.');
      } catch (error: any) { if (active) setDurationError(error?.message || 'Unable to calculate leave duration.'); }
      finally { if (active) setDurationLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [durationKey, durationRevision, user?.id, user?.role]);

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLeaveData = async () => {
    const sequence = ++fetchSequence.current;
    setLoading(true);
    setSummary(null); setRequests([]); setRequestsReady(false); setHolidays([]); setHolidaysReady(false); setLoadError('');
    try {
      const [summaryRes, reqRes, holRes] = await Promise.all([apiGet('/leaves/summary'), apiGet('/leaves/requests'), apiGet('/leaves/holidays')]);
      if (sequence !== fetchSequence.current) return;
      if (summaryRes.success) setSummary(summaryRes);
      if (reqRes.success) { setRequests(reqRes.requests); setRequestsReady(true); }
      if (holRes.success) { setHolidays(holRes.holidays); setHolidaysReady(true); }
      const failures = [summaryRes, reqRes, holRes].filter(response => !response.success);
      if (failures.length) setLoadError([...new Set(failures.map(response => response.message || 'Leave data is unavailable. Please retry.'))].join(' '));
    } catch (err) {
      if (sequence !== fetchSequence.current) return;
      setLoadError('Leave data is unavailable. Please retry.');
      console.error(err);
    } finally {
      if (sequence === fetchSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    sessionVersion.current++;
    applyPending.current = false;
    reviewPending.current = new Set();
    setSubmitting(false); setReviewing([]); setNewLeave(emptyLeave);
    setMsg(null); setShowApplyModal(false);
    void fetchLeaveData();
    return () => { fetchSequence.current++; sessionVersion.current++; };
  }, [user?.id, user?.role]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (applyPending.current || submitting || !duration || duration.key !== durationKey || durationLoading) return;
    const session = sessionVersion.current;
    applyPending.current = true;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await apiPost('/leaves/apply', { ...newLeave, totalDays: duration.totalDays });
      if (session !== sessionVersion.current) return;
      if (res.success) {
        setMsg({ type: 'success', text: 'Leave application submitted successfully!' });
        setShowApplyModal(false);
        setNewLeave(emptyLeave);
        await fetchLeaveData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Failed to submit application' });
      }
    } catch (err: any) {
      if (session !== sessionVersion.current) return;
      setMsg({ type: 'error', text: err?.message || 'Failed to apply for leave' });
    } finally { if (session === sessionVersion.current) { applyPending.current = false; setSubmitting(false); } }
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    if (loading || reviewPending.current.has(id)) return;
    const session = sessionVersion.current;
    reviewPending.current.add(id); setReviewing([...reviewPending.current]);
    try {
      const res = await apiPut(`/leaves/requests/${id}/review`, { status });
      if (session !== sessionVersion.current) return;
      if (res.success) {
        await fetchLeaveData();
      } else setMsg({ type: 'error', text: res.message || 'Leave review failed. Reload the current balance before retrying.' });
    } catch (err) {
      if (session !== sessionVersion.current) return;
      setMsg({ type: 'error', text: 'Leave review failed. Please retry.' });
      console.error(err);
    } finally { if (session === sessionVersion.current) { reviewPending.current.delete(id); setReviewing([...reviewPending.current]); } }
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
          disabled={loading || !summary}
          className="px-4 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white flex items-center gap-2 shadow-lg shadow-[#5470F4]/30"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {loadError && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300"><p>{loadError}</p><button disabled={loading} onClick={() => void fetchLeaveData()} className="mt-2 rounded-xl bg-[#161F30] px-3 py-2.5 font-semibold text-white">Retry Leave Data</button></div>}

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
          <p className="text-3xl font-black text-white mt-1.5">{summary ? `${summary.totalRemainingHolidays ?? 0} Days` : loading ? 'Loading…' : 'Unavailable'}</p>
          <p className="text-[11px] text-gray-500 mt-2">Combined balance available</p>
        </div>

        <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Casual Leaves</span>
          <p className="text-3xl font-black text-[#5CC5FA] mt-1.5">{summary ? `${summary.leaveBalances?.casual ?? 0} Days` : loading ? 'Loading…' : 'Unavailable'}</p>
          <p className="text-[11px] text-gray-500 mt-2">Short term & personal time</p>
        </div>

        <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Medical / Sick</span>
          <p className="text-3xl font-black text-purple-400 mt-1.5">{summary ? `${summary.leaveBalances?.sick ?? 0} Days` : loading ? 'Loading…' : 'Unavailable'}</p>
          <p className="text-[11px] text-gray-500 mt-2">Health & doctor visits</p>
        </div>

        <div className="bg-[#111827] border border-[#1F293D] p-5 rounded-2xl">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Annual Vacation</span>
          <p className="text-3xl font-black text-emerald-400 mt-1.5">{summary ? `${summary.leaveBalances?.annual ?? 0} Days` : loading ? 'Loading…' : 'Unavailable'}</p>
          <p className="text-[11px] text-gray-500 mt-2">Planned corporate time-off</p>
        </div>
      </div>

      {/* Leave Applications & Approvals Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
            <h3 className="text-base font-bold text-white">
              {hasRole('CEO', 'Super Admin') ? 'Team Leave Requests & Approvals' : 'My Leave Applications'}
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#161F30] text-gray-300">
              {loading ? 'Loading…' : requestsReady ? `${requests.length} Records` : 'Unavailable'}
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
                  {hasRole('CEO', 'Super Admin') && <th className="py-3 px-4">Actions</th>}
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
                        {attendanceDate(r.startDate)} - {attendanceDate(r.endDate)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">{r.totalDays} days{r.totalDays === 0.5 && <span className="block text-[10px] text-gray-400">{r.session === 'afternoon' ? 'Afternoon' : 'Morning'} leave</span>}</td>
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
                      {hasRole('CEO', 'Super Admin') && (
                        <td className="py-3.5 px-4">
                          {r.status === 'pending' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleReview(r._id, 'approved')}
                                disabled={loading || reviewing.includes(r._id)}
                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                                title="Approve Request"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReview(r._id, 'rejected')}
                                disabled={loading || reviewing.includes(r._id)}
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
                      {loading ? 'Loading leave requests…' : requestsReady ? 'No leave requests on record.' : 'Leave requests unavailable. Retry Leave Data to reload.'}
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
              <span>Official Company Holidays</span>
            </h3>
            <span className="text-[10px] text-gray-400">{loading ? 'Loading…' : holidaysReady ? `${holidays.length} Days Off` : 'Unavailable'}</span>
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
                  {attendanceDate(h.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="portal-modal fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label="Apply for leave" className="bg-[#111827] border border-[#1F293D] rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <h3 className="text-base font-bold text-white">Apply for Leave / Time-Off</h3>
              <button disabled={submitting} onClick={() => setShowApplyModal(false)} aria-label="Close leave application" className="text-gray-400 hover:text-white disabled:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <fieldset disabled={submitting} className="min-w-0 space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    aria-label="Leave start date"
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
                    aria-label="Leave end date"
                    required
                    min={newLeave.startDate || undefined}
                    value={newLeave.endDate}
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#1F293D] focus:border-[#5470F4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Leave Session</label>
                <select aria-label="Leave session" value={newLeave.session} onChange={event => setNewLeave({ ...newLeave, session: event.target.value })} className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2 text-xs text-white"><option value="full">Full working day(s)</option><option value="morning">Morning half-day</option><option value="afternoon">Afternoon half-day</option></select>
                <p aria-live="polite" className="mt-2 text-xs text-gray-300">{durationLoading ? 'Calculating working days…' : duration && duration.key === durationKey ? `${duration.totalDays} working day(s) requested` : 'Choose dates to calculate leave.'}</p>
                <p className="mt-1 text-[11px] text-gray-400">Company working days only; mandatory holidays are excluded. Half-day sessions cover one date.</p>
                {durationError && <div className="mt-2 space-y-2"><p role="alert" className="text-xs text-rose-300">{durationError}</p><button type="button" disabled={durationLoading || submitting} onClick={() => setDurationRevision(value => value + 1)} className="rounded-xl bg-[#161F30] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Retry Duration</button></div>}
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
              </fieldset>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || durationLoading || !duration || duration.key !== durationKey}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold gradient-btn text-white disabled:opacity-50"
                >
                  {submitting ? 'Submitting Application…' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
