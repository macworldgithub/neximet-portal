'use client';

import React, { useState } from 'react';
import { Clock, AlertTriangle, X, Check } from 'lucide-react';
import { attendancePost } from '../../lib/attendanceApi';
import { attendanceExpectation } from '../../lib/attendance';

export interface EditableAttendanceRecord {
  _id?: string;
  __v?: number;
  date: string;
  user: { _id: string; name: string; department?: string; designation?: string } | null;
  checkIn?: string;
  checkOut?: string;
  totalWorkHours?: number;
  status: string;
  minutesLate?: number;
  deductionAmount?: number;
  deductionReason?: string;
  notes?: string;
}

interface AdminEditAttendanceModalProps {
  record: EditableAttendanceRecord;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  isCEO?: boolean;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

const formatTimeToHHMM = (val?: string) => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
};

export default function AdminEditAttendanceModal({
  record,
  onClose,
  onSuccess,
  isCEO = false,
  shiftStartTime = '09:00',
  shiftEndTime = '18:00',
}: AdminEditAttendanceModalProps) {
  const [status, setStatus] = useState<string>(
    ['present', 'late', 'half_day', 'absent'].includes(record.status) ? record.status : 'present'
  );
  const [checkInTime, setCheckInTime] = useState<string>(formatTimeToHHMM(record.checkIn) || (record.status !== 'absent' ? shiftStartTime : ''));
  const [checkOutTime, setCheckOutTime] = useState<string>(formatTimeToHHMM(record.checkOut) || (record.status !== 'absent' ? shiftEndTime : ''));
  const [minutesLate, setMinutesLate] = useState<string>(record.minutesLate ? String(record.minutesLate) : '');
  const [totalWorkHours, setTotalWorkHours] = useState<string>(
    record.totalWorkHours !== undefined && record.totalWorkHours !== null ? String(record.totalWorkHours) : ''
  );
  const [deductionAmount, setDeductionAmount] = useState<string>(
    record.deductionAmount !== undefined && record.deductionAmount !== null ? String(record.deductionAmount) : ''
  );
  const [notes, setNotes] = useState<string>(record.deductionReason || record.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setError('');
    if (newStatus === 'present') {
      if (!checkInTime) setCheckInTime(shiftStartTime);
      if (!checkOutTime) setCheckOutTime(shiftEndTime);
      setMinutesLate('0');
      setDeductionAmount('0');
      if (!totalWorkHours) setTotalWorkHours('9');
    } else if (newStatus === 'absent') {
      setCheckInTime('');
      setCheckOutTime('');
      setMinutesLate('0');
      setTotalWorkHours('0');
    } else if (newStatus === 'late') {
      if (!checkInTime || checkInTime === shiftStartTime) setCheckInTime('09:30');
      if (!checkOutTime) setCheckOutTime(shiftEndTime);
      if (!minutesLate || minutesLate === '0') setMinutesLate('30');
    } else if (newStatus === 'half_day') {
      if (!checkInTime) setCheckInTime(shiftStartTime);
      if (!checkOutTime) setCheckOutTime('13:30');
      setMinutesLate('0');
      setTotalWorkHours('4.5');
    }
  };

  const handlePreset = (preset: 'ontime' | 'late30' | 'morning_half' | 'afternoon_half' | 'absent') => {
    if (preset === 'ontime') {
      setStatus('present');
      setCheckInTime(shiftStartTime);
      setCheckOutTime(shiftEndTime);
      setMinutesLate('0');
      setTotalWorkHours('9');
      setDeductionAmount('0');
    } else if (preset === 'late30') {
      setStatus('late');
      setCheckInTime('09:30');
      setCheckOutTime(shiftEndTime);
      setMinutesLate('30');
      setTotalWorkHours('8.5');
    } else if (preset === 'morning_half') {
      setStatus('half_day');
      setCheckInTime(shiftStartTime);
      setCheckOutTime('13:30');
      setMinutesLate('0');
      setTotalWorkHours('4.5');
    } else if (preset === 'afternoon_half') {
      setStatus('half_day');
      setCheckInTime('13:30');
      setCheckOutTime(shiftEndTime);
      setMinutesLate('0');
      setTotalWorkHours('4.5');
    } else if (preset === 'absent') {
      setStatus('absent');
      setCheckInTime('');
      setCheckOutTime('');
      setMinutesLate('0');
      setTotalWorkHours('0');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record.user?._id) {
      setError('Employee information is missing.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        userId: record.user._id,
        date: record.date,
        status,
        notes: notes.trim(),
        ...attendanceExpectation(record),
      };

      if (status !== 'absent') {
        if (checkInTime) payload.checkInTime = checkInTime;
        if (checkOutTime) payload.checkOutTime = checkOutTime;
      } else {
        payload.checkInTime = '';
        payload.checkOutTime = '';
      }

      if (status === 'late' && minutesLate !== '') {
        payload.minutesLate = Number(minutesLate);
      }

      if (totalWorkHours !== '') {
        payload.totalWorkHours = Number(totalWorkHours);
      }

      if (isCEO && deductionAmount !== '') {
        payload.deductionAmount = Number(deductionAmount);
      }

      const res = await attendancePost('/attendance/edit', payload);
      if (res.success) {
        await onSuccess();
        onClose();
      } else {
        setError(res.message || 'Failed to update attendance record.');
      }
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Error occurred while saving attendance.';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="portal-modal fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit Attendance Record"
        className="my-auto w-full max-w-lg space-y-5 rounded-2xl border border-[#1F293D] bg-[#111827] p-5 sm:p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5470F4]/15 text-[#5470F4]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Adjust Employee Attendance</h3>
              <p className="text-xs text-gray-400">
                {record.user?.name || 'Employee'} • {record.user?.department || 'Staff'} • <span className="font-mono text-cyan-300">{record.date}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#161F30] hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Presets */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-300">Quick Presets</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset('ontime')}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                On-Time (09:00 - 18:00)
              </button>
              <button
                type="button"
                onClick={() => handlePreset('late30')}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
              >
                Late 30m (09:30 - 18:00)
              </button>
              <button
                type="button"
                onClick={() => handlePreset('morning_half')}
                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20"
              >
                Half Day (09:00 - 13:30)
              </button>
              <button
                type="button"
                onClick={() => handlePreset('absent')}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                Full Day Absent
              </button>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-300">Attendance Status</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'present', label: 'Present', color: 'border-emerald-500 text-emerald-300 bg-emerald-500/15' },
                { id: 'late', label: 'Late', color: 'border-amber-500 text-amber-300 bg-amber-500/15' },
                { id: 'half_day', label: 'Half Day', color: 'border-indigo-500 text-indigo-300 bg-indigo-500/15' },
                { id: 'absent', label: 'Absent', color: 'border-rose-500 text-rose-300 bg-rose-500/15' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleStatusChange(item.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    status === item.id ? item.color + ' ring-1 ring-current' : 'border-[#1F293D] bg-[#0B0F19] text-gray-400 hover:bg-[#161F30]'
                  }`}
                >
                  {status === item.id && <Check className="h-3.5 w-3.5" />}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time Controls (Check-In & Check-Out) */}
          {status !== 'absent' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-300">
                  Check-In Time <span className="text-gray-500">(HH:mm)</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={e => setCheckInTime(e.target.value)}
                    className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:border-[#5470F4]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-300">
                  Check-Out Time <span className="text-gray-500">(HH:mm)</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={e => setCheckOutTime(e.target.value)}
                    className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:border-[#5470F4]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Work Hours and Lateness Details */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-300">Total Work Hours</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="24"
                value={totalWorkHours}
                onChange={e => setTotalWorkHours(e.target.value)}
                placeholder="e.g. 9.0"
                className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2 text-sm text-white outline-none focus:border-[#5470F4]"
              />
            </div>

            {status === 'late' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-300">Minutes Late</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={minutesLate}
                  onChange={e => setMinutesLate(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2 text-sm text-white outline-none focus:border-[#5470F4]"
                />
              </div>
            )}

            {isCEO && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-300">
                  Deduction Amount (PKR) <span className="text-amber-400 font-normal">CEO Override</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={deductionAmount}
                  onChange={e => setDeductionAmount(e.target.value)}
                  placeholder="Leave blank for automatic rule"
                  className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2 text-sm text-white outline-none focus:border-[#5470F4]"
                />
              </div>
            )}
          </div>

          {/* Reason / Administrative Notes */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">Reason / Audit Trail Note</label>
            <textarea
              rows={2}
              maxLength={500}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Executive approval for official offsite errand or manual time correction..."
              className="w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2 text-xs text-white outline-none focus:border-[#5470F4] placeholder:text-gray-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[#1F293D] pt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-[#1F293D] bg-[#161F30] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#1E293B] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#5470F4] px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-[#435EE0] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Attendance</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
