'use client';

import { useEffect, useState, useRef } from 'react';
import { Camera, Search } from 'lucide-react';
import { attendanceGet, attendancePost } from '../../lib/attendanceApi';
import { attendanceHistoryRange, attendanceTime, companyDate, attendanceExpectation, type HistoryPeriod } from '../../lib/attendance';

type Record = {
  _id: string; __v?: number; date: string; user: { _id: string; name: string; department: string; designation?: string } | null;
  checkIn?: string; checkOut?: string; totalWorkHours?: number; status: string;
  minutesLate: number; deductionAmount: number; deductionReason?: string; notes?: string;
  hasPhoto: boolean; isSimulated?: boolean;
  quarantine?: { reason: string; at: string }; suggestedRepairDate?: string; financialReviewRequired?: boolean;
};
type Result = { records: Record[]; count: number; lateCount: number; totalDeductions: number; pages: number };
const empty: Result = { records: [], count: 0, lateCount: 0, totalDeductions: 0, pages: 0 };
const periods: { value: HistoryPeriod; label: string }[] = [
  { value: 'all', label: 'All Time' }, { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' }, { value: 'custom', label: 'Custom Range' },
];
const inputClass = 'min-w-0 w-full rounded-xl border border-[#1F293D] bg-[#0B0F19] px-3 py-2.5 text-sm text-white [color-scheme:dark]';
const buttonClass = 'rounded-xl bg-[#161F30] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40';

export default function CompanyAttendanceHistory({ workingDay, inspectPhoto, refreshToken = 0, onChanged }: {
  workingDay: string;
  refreshToken?: number;
  onChanged?: () => Promise<void>;
  inspectPhoto: (id: string, name: string, department: string) => Promise<void>;
}) {
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const [draft, setDraft] = useState({ startDate: '', endDate: '' });
  const [range, setRange] = useState(draft);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateError, setDateError] = useState('');
  const [repairTarget, setRepairTarget] = useState<Record | null>(null);
  const [repairDate, setRepairDate] = useState('');
  const [repairBusy, setRepairBusy] = useState(false);
  const [absenceTarget, setAbsenceTarget] = useState<Record | null>(null);
  const pendingAction = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (period === 'custom') return;
    const next = attendanceHistoryRange(period, workingDay || companyDate());
    setRange(next); setDraft(next); setPage(1); setDateError('');
  }, [period, workingDay]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ userId: 'all', page: String(page), limit: '20' });
    if (range.startDate) params.set('startDate', range.startDate);
    if (range.endDate) params.set('endDate', range.endDate);
    if (query) params.set('search', query);
    void attendanceGet(`/attendance/history?${params}`).then(response => {
      if (!active) return;
      if (response.success) {
        // A refreshed history can shrink if an employee record is removed.
        if (page > Math.max(1, response.pages)) { setPage(Math.max(1, response.pages)); return; }
        setResult({ records: response.records, count: response.count, lateCount: response.lateCount, totalDeductions: response.totalDeductions, pages: response.pages });
      } else { setResult(empty); setError(response.message || 'Unable to load company history. Please retry.'); }
    }).catch(() => {
      if (active) { setResult(empty); setError('Unable to load company history. Please retry.'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.startDate, range.endDate, query, page, revision, refreshToken]);

  const repair = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!repairTarget || pendingAction.current) return;
    pendingAction.current = true;
    setRepairBusy(true); setError('');
    try {
      const response = await attendancePost(`/attendance/records/${repairTarget._id}/repair`, { date: repairDate, ...attendanceExpectation(repairTarget) });
      if (response.success) { setRepairTarget(null); setRevision(value => value + 1); await onChanged?.(); }
      else setError(response.message || 'Legacy record could not be repaired.');
    } catch (error: any) { setError(error?.message || 'Legacy record could not be repaired. Please retry.'); }
    finally { setRepairBusy(false); pendingAction.current = false; }
  };

  const reviewAbsence = async (present = false) => {
    if (!absenceTarget?.user || pendingAction.current) return;
    pendingAction.current = true; setRepairBusy(true); setError('');
    try {
      const response = await attendancePost(present ? '/attendance/mark-present' : '/attendance/mark-absent', { userId: absenceTarget.user._id, date: absenceTarget.date, ...attendanceExpectation(absenceTarget), ...(present ? { verifyPresence: true } : {}) });
      if (response.success) { setAbsenceTarget(null); setRevision(value => value + 1); await onChanged?.(); }
      else setError(response.message || 'Absence review failed.');
    } catch (error: any) { setError(error?.message || 'Absence review failed. Please retry.'); }
    finally { pendingAction.current = false; setRepairBusy(false); }
  };

  const applyDates = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.startDate || !draft.endDate || draft.startDate > draft.endDate) {
      setDateError('Choose both dates, with the start date on or before the end date.'); return;
    }
    setDateError(''); setRange(draft); setPage(1);
  };

  return <section className="min-w-0 space-y-4" aria-label="Company attendance history">
    <div>
      <h2 className="text-base font-bold text-white">Complete Company Attendance History</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-400">Search all recorded attendance, including former employees. Dates follow the company working day in Asia/Karachi. This Week runs Monday to Sunday. Totals exclude simulations and records awaiting repair; their original amounts remain visible below.</p>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="History period">
      {periods.map(item => <button key={item.value} aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}
        className={`${buttonClass} ${period === item.value ? 'bg-[#5470F4] shadow-md' : 'hover:bg-[#1F293D]'}`}>{item.label}</button>)}
    </div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <label className="min-w-0 space-y-2 text-xs font-semibold text-gray-300">
        <span>Search employee name</span>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Type an employee name..." className={`${inputClass} pl-9`} />
        </div>
      </label>
      {period === 'custom' ? <form onSubmit={applyDates} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0 space-y-2 text-xs font-semibold text-gray-300"><span>Start date</span>
          <input type="date" required value={draft.startDate} onChange={event => setDraft(value => ({ ...value, startDate: event.target.value }))} className={inputClass} />
        </label>
        <label className="min-w-0 space-y-2 text-xs font-semibold text-gray-300"><span>End date</span>
          <input type="date" required min={draft.startDate || undefined} value={draft.endDate} onChange={event => setDraft(value => ({ ...value, endDate: event.target.value }))} className={inputClass} />
        </label>
        <button type="submit" className={`${buttonClass} sm:col-span-2 bg-[#5470F4]`}>Apply Date Range</button>
        {dateError && <p role="alert" className="text-xs text-rose-300 sm:col-span-2">{dateError}</p>}
      </form> : <p className="self-end rounded-xl border border-[#1F293D] p-3 text-xs text-gray-400">
        {range.startDate ? `${range.startDate} to ${range.endDate} (inclusive)` : 'All recorded dates'}
      </p>}
    </div>
    {period === 'custom' && <p className="text-xs text-gray-400">Showing: {range.startDate ? `${range.startDate} to ${range.endDate} (inclusive)` : 'All recorded dates'}. Use Apply Date Range to update the results.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <p className="text-gray-300" aria-live="polite">{loading ? 'Loading history...' : `${result.count.toLocaleString()} records · ${result.lateCount.toLocaleString()} late incidents · PKR ${result.totalDeductions.toLocaleString()} deductions`}</p>
      <button className={buttonClass} disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh History</button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
    <div className="max-w-full overflow-x-auto rounded-xl border border-[#1F293D]" aria-busy={loading}>
      <table className="w-full min-w-[1000px] text-left text-xs">
        <caption className="sr-only">Company attendance records matching the applied date range and employee name</caption>
        <thead className="bg-[#0B0F19] text-gray-400"><tr>
          {['Date', 'Employee', 'Selfie', 'Check-In', 'Check-Out', 'Hours', 'Status', 'Late', 'Deduction', 'Reason / Notes'].map(label => <th scope="col" key={label} className="px-3 py-3">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-[#1F293D] text-gray-300">
          {loading ? <tr><td colSpan={10} className="p-6 text-center">Loading attendance records...</td></tr> : result.records.length ? result.records.map(record => <tr key={record._id} className="hover:bg-[#161F30]">
            <td className="whitespace-nowrap px-3 py-3 font-mono">{record.date}</td>
            <td className="px-3 py-3"><span className="block font-semibold text-white">{record.user?.name || 'Deleted employee'}</span><span className="text-[10px] text-gray-400">{record.user?.department || '--'}</span></td>
            <td className="px-3 py-3">{record.hasPhoto ? <button className="rounded-xl border border-purple-400/40 p-2.5 text-purple-300" aria-label={`View selfie for ${record.user?.name || 'deleted employee'} on ${record.date}`} onClick={() => void inspectPhoto(record._id, record.user?.name || 'Deleted employee', record.user?.department || '')}><Camera className="h-4 w-4" /></button> : '--'}</td>
            <td className="whitespace-nowrap px-3 py-3">{attendanceTime(record.checkIn)}</td>
            <td className="whitespace-nowrap px-3 py-3">{record.checkOut ? attendanceTime(record.checkOut) : record.checkIn ? 'Open shift' : '--'}</td>
            <td className="px-3 py-3">{record.checkOut ? (record.totalWorkHours ?? 0).toFixed(2) : '--'}</td>
            <td className="px-3 py-3"><span className="capitalize">{record.quarantine?.at ? 'Needs Attendance Repair' : record.status.replaceAll('_', ' ')}</span>{record.isSimulated && <span className="mt-1 block text-[10px] text-amber-300">CEO simulation</span>}</td>
            <td className="whitespace-nowrap px-3 py-3">{record.minutesLate > 0 ? `${record.minutesLate} min` : '--'}</td>
            <td className="whitespace-nowrap px-3 py-3 font-mono">PKR {(record.deductionAmount || 0).toLocaleString()}{(record.quarantine?.at || record.isSimulated) && <span className="mt-1 block text-[10px] text-amber-300">Excluded from totals</span>}</td>
            <td className="min-w-[180px] max-w-xs break-words px-3 py-3">{record.deductionReason || record.notes || '--'}{record.financialReviewRequired && !record.quarantine?.at && <><span className="mt-1 block text-amber-300">Absence deduction requires administrator review.</span>{record.user && <button disabled={repairBusy} onClick={() => setAbsenceTarget(record)} className={`${buttonClass} mt-2`}>Review absence</button>}</>}{record.quarantine?.at && <><p className="mt-2 text-amber-300">{record.quarantine.reason}</p><button className={`${buttonClass} mt-2`} disabled={!record.suggestedRepairDate || repairBusy} onClick={() => { setRepairTarget(record); setRepairDate(record.suggestedRepairDate || ''); }}>Repair working date</button></>}</td>
          </tr>) : <tr><td colSpan={10} className="p-6 text-center">{error ? 'History unavailable.' : 'No attendance records match these filters.'}</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
      <span>Page {page} of {Math.max(1, result.pages)} · 20 records per page</span>
      <div className="flex gap-2"><button className={buttonClass} disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button>
        <button className={buttonClass} disabled={loading || page >= result.pages} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </div>
    {repairTarget && <div className="portal-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3"><form onSubmit={repair} role="dialog" aria-modal="true" aria-label="Repair legacy attendance" className="my-auto w-full max-w-md space-y-4 rounded-2xl border border-[#1F293D] bg-[#111827] p-5"><h3 className="font-bold">Repair attendance for {repairTarget.user?.name || 'former employee'}</h3><p className="text-xs text-gray-400">Correct the working date. Original arrival, photo and financial evidence are retained with an audit trail.</p><label className="block text-xs">Working date<input aria-label="Repair working date" type="date" required max={companyDate()} value={repairDate} onChange={event => setRepairDate(event.target.value)} className={`${inputClass} mt-2`} /></label>{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={repairBusy} onClick={() => setRepairTarget(null)} className={buttonClass}>Cancel</button><button disabled={repairBusy} className={buttonClass}>{repairBusy ? 'Repairing…' : 'Confirm Repair'}</button></div></form></div>}
    {absenceTarget && <div className="portal-modal fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3"><div role="dialog" aria-modal="true" aria-label="Review unrecorded absence" className="my-auto w-full max-w-md space-y-4 rounded-2xl border border-[#1F293D] bg-[#111827] p-5"><h3 className="font-bold">Review {absenceTarget.user?.name} on {absenceTarget.date}</h3><p className="text-xs text-gray-300">Confirm the unexcused absence before applying its configured daily-wage deduction. Approved half-day leave caps the charge at half a wage; full-day leave, holidays and days off receive no absence charge. You can instead verify presence without a deduction. Both decisions are audited.</p>{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><button autoFocus disabled={repairBusy} onClick={() => setAbsenceTarget(null)} className={buttonClass}>Cancel</button><button disabled={repairBusy} onClick={() => void reviewAbsence(true)} className={buttonClass}>Mark Present Without Deduction</button><button disabled={repairBusy} onClick={() => void reviewAbsence()} className={buttonClass}>{repairBusy ? 'Applying…' : 'Confirm Absence Deduction'}</button></div></div></div>}
  </section>;
}
