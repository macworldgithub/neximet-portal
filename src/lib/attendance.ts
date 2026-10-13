export const COMPANY_TIME_ZONE = 'Asia/Karachi';

export function companyDate(value: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: COMPANY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function attendanceTime(value?: string | Date | null): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '--:--';
  return new Date(value).toLocaleTimeString('en-US', { timeZone: COMPANY_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: true });
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
