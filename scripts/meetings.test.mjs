import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/meetings.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, TextEncoder, Intl, Date });

test('scheduled wall-clock times convert independently of the browser time zone', () => {
  assert.equal(exports.utcTime('2026-12-10T10:30', 'Asia/Karachi'), '2026-12-10T05:30:00.000Z');
  assert.equal(exports.wallTime('2026-12-10T05:30:00Z', 'Asia/Karachi'), '2026-12-10T10:30');
  assert.equal(exports.utcTime('2026-07-10T10:30', 'America/New_York'), '2026-07-10T14:30:00.000Z');
  assert.equal(exports.utcTime('2026-12-10T10:30', 'America/New_York'), '2026-12-10T15:30:00.000Z');
  assert.throws(() => exports.utcTime('2026-03-08T02:30', 'America/New_York'), /does not exist/);
  assert.throws(() => exports.utcTime('2026-02-30T10:30', 'Asia/Karachi'), /valid calendar date/);
});
test('calendar month includes complete Monday-first weeks across year boundaries', () => {
  const days = exports.calendarDays('2027-01');
  assert.equal(days.length, 42); assert.equal(days[0], '2026-12-28'); assert.equal(days[41], '2027-02-07');
});
test('calendar export uses UTC, escapes content, and folds Unicode lines safely', () => {
  const meeting = { _id: 'abc123', conversation: 'chat123', title: 'Review; team, updates', description: 'Line one\n' + '日本語'.repeat(50), startsAt: '2026-12-10T05:30:00Z', endsAt: '2026-12-10T06:00:00Z', status: 'scheduled', mode: 'audio' };
  const result = exports.meetingCalendarFile(meeting, 'https://portal.example.test');
  assert.match(result, /DTSTART:20261210T053000Z\r\n/);
  assert.match(result, /SUMMARY:Review\\; team\\, updates/);
  assert.match(result.replace(/\r\n /g, ''), /DESCRIPTION:Line one\\n日本語/);
  assert.ok(result.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75));
  assert.match(result.replace(/\r\n /g, ''), /meeting=abc123&mode=audio/);
  assert.ok(result.endsWith('END:VCALENDAR\r\n'));
});
