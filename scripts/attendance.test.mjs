import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/attendance.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { module, exports: module.exports, Intl, Date });
const { companyDate, attendanceTime, simulationTimestamp, shiftTime, shiftSimulationTimestamp, attendanceHistoryRange, rosterIsCurrent, recordedShiftEnd, attendanceBlocksCheckIn, distanceMeters, attendanceExpectation, attendanceDisplay } = module.exports;
const compensationModule = { exports: {} };
const compensationCode = ts.transpileModule(fs.readFileSync(new URL('../src/lib/employeeCompensation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(compensationCode, { module: compensationModule, exports: compensationModule.exports });
const { employeeCompensationChanges, creationCompensation } = compensationModule.exports;
test('attendance display uses company timezone even when the browser is elsewhere', () => {
  assert.equal(attendanceTime('2026-10-13T04:30:00Z'), '09:30 AM');
  assert.equal(companyDate('2026-10-31T19:05:00Z'), '2026-11-01');
  assert.equal(shiftTime('18:00'), '06:00 PM');
});
test('CEO simulation timestamps explicitly belong to the company day', () => {
  assert.equal(simulationTimestamp('09:35', '2026-10-13'), '2026-10-13T09:35:00+05:00');
  assert.equal(new Date(simulationTimestamp('09:35', '2026-10-13')).toISOString(), '2026-10-13T04:35:00.000Z');
});
test('shift-relative simulation follows changed start times and crosses midnight correctly', () => {
  assert.equal(attendanceTime(shiftSimulationTimestamp('10:00', 35, '2026-10-13')), '10:35 AM');
  const night = shiftSimulationTimestamp('22:00', 180, '2026-10-13');
  assert.equal(companyDate(night), '2026-10-14'); assert.equal(attendanceTime(night), '01:00 AM');
});
test('missing or invalid attendance timestamps never display the Unix epoch or Invalid Date', () => {
  for (const value of [null, undefined, '', 'invalid-date']) assert.equal(attendanceTime(value), '--:--');
});

test('company history presets cover calendar weeks and months including leap years and year boundaries', () => {
  const check = (period, day, start, end) => {
    const result = attendanceHistoryRange(period, day);
    assert.equal(result.startDate, start); assert.equal(result.endDate, end);
  };
  check('all', '2026-10-13', '', '');
  check('today', companyDate('2026-10-31T19:05:00Z'), '2026-11-01', '2026-11-01');
  check('week', '2026-10-12', '2026-10-12', '2026-10-18');
  check('week', '2026-10-18', '2026-10-12', '2026-10-18');
  check('week', '2027-01-01', '2026-12-28', '2027-01-03');
  check('month', '2024-02-15', '2024-02-01', '2024-02-29');
  check('month', '2026-02-15', '2026-02-01', '2026-02-28');
  check('month', '2026-12-31', '2026-12-01', '2026-12-31');
});

test('failed or cross-day roster responses cannot authorize administrator actions', () => {
  const today = { success: true, date: '2026-10-13' };
  assert.equal(rosterIsCurrent(today, { success: false }), false);
  assert.equal(rosterIsCurrent(today, { success: true, date: '2026-10-12', roster: [{ date: '2026-10-12' }] }), false);
  assert.equal(rosterIsCurrent(today, { success: true, date: today.date, roster: [{ date: '2026-10-12' }] }), false);
  assert.equal(rosterIsCurrent({ success: false }, { success: true, date: today.date, roster: [] }), false);
  assert.equal(rosterIsCurrent(today, { success: true, date: today.date, roster: [{ date: today.date }] }), true);
});

test('an existing shift displays its saved end even after the policy end changes', () => {
  assert.equal(recordedShiftEnd({ scheduledCheckOut: '2026-10-13T13:00:00Z' }, '20:00'), '06:00 PM');
  assert.equal(recordedShiftEnd(null, '20:00'), '08:00 PM');
  assert.equal(recordedShiftEnd({ policySnapshot: { shiftEndTime: '06:00' } }, '20:00'), '06:00 AM');
});

test('an inferred no-show permits a real check-in, while administrator absences remain protected', () => {
  assert.equal(Boolean(attendanceBlocksCheckIn({ status: 'absent', recordSource: 'automatic' })), false);
  assert.equal(Boolean(attendanceBlocksCheckIn({ status: 'absent', recordSource: 'automatic', override: { type: 'absent' } })), true);
  assert.equal(Boolean(attendanceBlocksCheckIn({ status: 'absent', recordSource: 'administrator' })), true);
  assert.equal(Boolean(attendanceBlocksCheckIn({ status: 'absent' })), true);
  assert.equal(Boolean(attendanceBlocksCheckIn({ status: 'absent', checkIn: '2026-10-14T05:00:00Z' })), false);
  assert.equal(Boolean(attendanceBlocksCheckIn({ status: 'present', checkIn: '2026-10-14T05:00:00Z', quarantine: { at: '2026-10-14T06:00:00Z' } })), true);
});

test('dashboard labels never call an absence or administrator waiver on-time attendance', () => {
  assert.equal(attendanceDisplay({ status: 'absent', checkIn: '2026-10-14T05:00:00Z', isLate: false }).label, 'Absent');
  assert.equal(attendanceDisplay({ status: 'present', checkIn: '2026-10-14T05:00:00Z', override: { type: 'present' } }).label, 'Verified Present');
  assert.equal(attendanceDisplay({ status: 'on_leave' }).label, 'Approved Leave');
  assert.equal(attendanceDisplay({ status: 'day_off' }).label, 'Scheduled Day Off');
  assert.equal(attendanceDisplay({ status: 'half_day', checkIn: '2026-10-14T05:00:00Z' }).label, 'Half-Day Attendance');
  assert.equal(attendanceDisplay({ status: 'present', quarantine: { at: '2026-10-14T06:00:00Z' } }).label, 'Needs Attendance Repair');
});

test('unrelated employee edits omit unchanged pay and balances rather than resending stale financial values', () => {
  const original = { baseSalary: 30000, dailyWage: 0, leaveBalances: { casual: 9.5, sick: 8, annual: 14 } };
  assert.equal(Object.keys(employeeCompensationChanges(original, { ...original, baseSalary: '30000', dailyWage: '0' })).length, 0);
});

test('employee financial edits send only changed fields with their viewed values', () => {
  const original = { baseSalary: 30000, dailyWage: 1000, leaveBalances: { casual: 10, sick: 8, annual: 14 } };
  const result = employeeCompensationChanges(original, { ...original, baseSalary: '44000', dailyWage: '', leaveBalances: { casual: 9.5, sick: 8, annual: 14 } });
  assert.equal(result.dailyWage, undefined); assert.equal(result.expectedPay.dailyWage, undefined); assert.equal(result.baseSalary, 44000); assert.equal(result.expectedPay.baseSalary, 30000);
  assert.equal(result.leaveBalances.casual, 9.5); assert.equal(result.expectedLeaveBalances.casual, 10); assert.equal(result.leaveBalances.sick, undefined);
});

test('employee creation preserves explicit zero pay and rejects invalid financial amounts', () => {
  assert.equal(creationCompensation(0).dailyWage, 0); assert.equal(creationCompensation(150000).dailyWage, 6818.18);
  assert.equal(creationCompensation('').dailyWage, null);
  for (const value of [Infinity, -1, 'invalid']) assert.throws(() => creationCompensation(value));
});

test('geofence distance stays finite for antipodal coordinates', () => {
  assert.equal(distanceMeters(24.8607, 67.0011, 24.8607, 67.0011), 0);
  const antipode = distanceMeters(-88.40000000000009, 10, 88.40000000000009, -170);
  assert.ok(Number.isFinite(antipode)); assert.ok(antipode > 20000000);
});

test('confirmations retain the viewed record identity/version, including missing and legacy rows', () => {
  const check = (record, id, version) => { const expected = attendanceExpectation(record); assert.equal(expected.expectedRecordId, id); assert.equal(expected.expectedVersion, version); };
  check({ _id: 'history-record', __v: 0 }, 'history-record', 0);
  check({ recordId: 'roster-record', recordVersion: 3 }, 'roster-record', 3);
  check({ _id: 'legacy-record' }, 'legacy-record', null);
  check(null, null, null);
  check({ recordId: null, recordVersion: null }, null, null);
});
