export const COMPANY_TIME_ZONE = 'Asia/Karachi';

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const a = Math.min(1, Math.max(0, Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2));
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function attendanceExpectation(record?: { _id?: string; recordId?: string | null; __v?: number; recordVersion?: number | null } | null) {
  return { expectedRecordId: record?._id ?? record?.recordId ?? null, expectedVersion: record?.__v ?? record?.recordVersion ?? null };
}

export function companyDate(value: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: COMPANY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function attendanceTime(value?: string | Date | null): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '--:--';
  return new Date(value).toLocaleTimeString('en-US', { timeZone: COMPANY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: true });
}

export function attendanceDate(value?: string | Date | null): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '--';
  return new Date(value).toLocaleDateString('en-GB', { timeZone: COMPANY_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' });
}

export function shiftTime(value: string): string {
  return attendanceTime(`2026-01-01T${value}:00+05:00`);
}

export function simulationTimestamp(time: string, date = companyDate()): string {
  return `${date}T${time}:00+05:00`;
}

export function shiftSimulationTimestamp(startTime: string, minutesAfterStart: number, date: string): string {
  return new Date(new Date(simulationTimestamp(startTime, date)).getTime() + minutesAfterStart * 60000).toISOString();
}

export type HistoryPeriod = 'all' | 'today' | 'week' | 'month' | 'custom';

export function rosterIsCurrent(today: { success?: boolean; date?: string }, roster: { success?: boolean; date?: string; roster?: { date?: string }[] } | null) {
  return !!today.success && !!today.date && !!roster?.success && roster.date === today.date && Array.isArray(roster.roster) && roster.roster.every(row => row.date === today.date);
}

export function recordedShiftEnd(record: { scheduledCheckOut?: string | null; policySnapshot?: { shiftEndTime?: string } } | null, policyEnd: string) {
  return record?.scheduledCheckOut ? attendanceTime(record.scheduledCheckOut) : shiftTime(record?.policySnapshot?.shiftEndTime || policyEnd);
}

export function attendanceBlocksCheckIn(record: { status?: string; checkIn?: string | null; recordSource?: string; override?: { type?: string }; quarantine?: { at?: string } } | null) {
  return !!record?.quarantine?.at || record?.override?.type === 'absent' || (record?.status === 'absent' && !record.checkIn && record.recordSource !== 'automatic');
}

export function attendanceDisplay(record?: { status?: string; checkIn?: string | null; isLate?: boolean; minutesLate?: number; financialReviewRequired?: boolean; override?: { type?: string }; quarantine?: { at?: string } } | null): { label: string; tone: 'danger' | 'warning' | 'info' | 'success' | 'neutral' } {
  if (record?.quarantine?.at) return { label: 'Needs Attendance Repair', tone: 'warning' };
  if (record?.status === 'absent') return { label: record.financialReviewRequired ? 'Absence Awaiting Review' : 'Absent', tone: 'danger' };
  if (record?.status === 'on_leave') return { label: 'Approved Leave', tone: 'info' };
  if (record?.status === 'on_holiday') return { label: 'Company Holiday', tone: 'info' };
  if (record?.status === 'day_off') return { label: 'Scheduled Day Off', tone: 'info' };
  if (record?.override?.type === 'present') return { label: 'Verified Present', tone: 'success' };
  if (record?.status === 'half_day') return { label: 'Half-Day Attendance', tone: 'warning' };
  if (record?.isLate || record?.status === 'late') return { label: `Late (+${record.minutesLate || 0}m)`, tone: 'warning' };
  if (record?.checkIn) return { label: 'On Time', tone: 'success' };
  if (record?.status === 'present') return { label: 'Presence Recorded', tone: 'success' };
  return { label: 'Not Clocked In', tone: 'neutral' };
}

// Work from a company-date string so the browser timezone cannot move boundaries.
export function attendanceHistoryRange(period: Exclude<HistoryPeriod, 'custom'>, day = companyDate()) {
  if (period === 'all') return { startDate: '', endDate: '' };
  if (period === 'today') return { startDate: day, endDate: day };
  const date = new Date(`${day}T00:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  if (period === 'week') {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const startDate = iso(date);
    date.setUTCDate(date.getUTCDate() + 6);
    return { startDate, endDate: iso(date) };
  }
  date.setUTCDate(1);
  const startDate = iso(date);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { startDate, endDate: iso(date) };
}
