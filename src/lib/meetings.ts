export type MeetingPerson = { _id: string; name: string };
export type ScheduledMeeting = {
  _id: string; conversation: string; organizer: MeetingPerson; participants: MeetingPerson[];
  title: string; description: string; startsAt: string; endsAt: string; timezone: string;
  mode: 'audio' | 'video'; status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'; activeCallId?: string | null;
  responses: { user: string; response: 'accepted' | 'declined' | 'tentative' }[];
};
export type MeetingHistory = {
  _id: string; callId: string; conversation: string; meeting?: string; title: string; mode: 'audio' | 'video';
  startedBy: MeetingPerson | null; invitedUsers: (MeetingPerson | null)[];
  attendance: { user: MeetingPerson | null; joinedAt: string; leftAt: string | null }[];
  startedAt: string; endedAt: string | null; durationSeconds: number; attendanceSeconds: number;
  endReason: string | null; outcome: 'unanswered' | 'attended' | 'in_progress' | 'ringing' | 'missed' | 'declined' | 'invited';
};
export const timezones = ['Asia/Karachi', 'UTC', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney'];
export function wallTime(value: Date | string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function utcTime(value: string, timezone: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) throw new Error('Choose a valid date and time.');
  const target = Date.parse(`${value}:00Z`);
  let candidate = target;
  for (let i = 0; i < 4; i++) {
    const rendered = Date.parse(`${wallTime(new Date(candidate), timezone)}:00Z`);
    const difference = target - rendered;
    if (!difference) {
      if (wallTime(new Date(candidate), timezone) !== value) throw new Error('Choose a valid calendar date.');
      return new Date(candidate).toISOString();
    }
    candidate += difference;
  }
  throw new Error('This local time does not exist because the clocks change. Choose another time.');
}
export function meetingLink(meeting: ScheduledMeeting) {
  return `/meet?conversation=${meeting.conversation}&meeting=${meeting._id}&mode=${meeting.mode}`;
}
export function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
}
export function calendarDays(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => new Date(+start + index * 86400000).toISOString().slice(0, 10));
}
export function meetingCalendarFile(meeting: ScheduledMeeting, origin: string) {
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r/g, '');
  const date = (value: string | Date) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Neximet//Meetings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${meeting._id}@neximet.com`, `DTSTAMP:${date(new Date())}`, `DTSTART:${date(meeting.startsAt)}`, `DTEND:${date(meeting.endsAt)}`,
    `SUMMARY:${escape(meeting.title)}`, `DESCRIPTION:${escape(`${meeting.description}\nJoin: ${origin}${meetingLink(meeting)}`)}`,
    `URL:${origin}${meetingLink(meeting)}`, `STATUS:${meeting.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR'];
  // RFC 5545 lines are at most 75 octets, including continuation whitespace.
  const encoder = new TextEncoder();
  return lines.map(line => {
    let result = '', count = 0;
    for (const character of line) {
      const bytes = encoder.encode(character).length;
      if (count + bytes > 75) { result += '\r\n '; count = 1; }
      result += character; count += bytes;
    }
    return result;
  }).join('\r\n') + '\r\n';
}
