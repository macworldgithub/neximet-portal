import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/attendance.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { module, exports: module.exports, Intl, Date });
const { companyDate, attendanceTime, simulationTimestamp, shiftTime, shiftSimulationTimestamp } = module.exports;
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
