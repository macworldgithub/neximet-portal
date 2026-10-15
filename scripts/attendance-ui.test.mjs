import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const attendance = { exports: {} };
vm.runInNewContext(compile('../src/lib/attendance.ts'), { module: attendance, exports: attendance.exports, Intl, Date });

// Exercise the real component's request/effect lifecycle with controlled responses.
function mount(file, api, props = {}) {
  let identity = { id: 'executive', role: 'CEO' }, cursor = 0, dirty = false, tree;
  const slots = [], effects = [];
  const timers = new Map(); let timerId = 0;
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compile(file), {
    module, exports: module.exports, console, URLSearchParams, Date, Intl,
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id), setInterval: () => 1, clearInterval() {},
    window: new EventTarget(), document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
    navigator: { userAgent: 'Test Browser' }, localStorage: { getItem: () => 'test-device' },
    require: name => name === 'react' ? react : name.endsWith('/context/AuthContext')
      ? { useAuth: () => ({ user: identity, hasRole: (...roles) => roles.includes(identity.role) }) }
      : name.endsWith('/lib/attendanceApi') ? api : name.endsWith('/lib/attendance') ? attendance.exports
        : name.endsWith('/attendance/CompanyAttendanceHistory') ? { default: () => null, __esModule: true } : require(name),
  });
  function render() {
    let rounds = 0;
    do {
      dirty = false; cursor = 0; tree = module.exports.default(props);
      effects.splice(0).forEach(effect => effect());
      if (++rounds > 20) throw new Error('Component did not settle.');
    } while (dirty);
    return renderToStaticMarkup(tree);
  }
  render();
  const find = predicate => {
    const visit = node => {
      if (!node || typeof node !== 'object') return undefined;
      if (Array.isArray(node)) return node.map(visit).find(Boolean);
      return predicate(node) ? node : visit(node.props?.children);
    };
    const found = visit(tree);
    assert.ok(found, 'Requested UI control must exist.');
    return found;
  };
  return { render, find, async runTimers() { const callbacks = [...timers.values()]; timers.clear(); for (const callback of callbacks) await callback(); }, switchUser(user) { identity = user; return render(); }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
const nodeText = node => Array.isArray(node) ? node.map(nodeText).join('') : node && typeof node === 'object' ? nodeText(node.props?.children) : node == null ? '' : String(node);
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('leave requests and holidays display their company dates when the browser is in another timezone', async () => {
  const original = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  const app = mount('../src/app/leaves/page.tsx', {
    attendanceGet: async endpoint => endpoint.endsWith('/summary') ? { success: true, leaveBalances: {}, totalRemainingHolidays: 0 }
      : endpoint.endsWith('/requests') ? { success: true, requests: [{ _id: 'leave', user: { name: 'Member' }, startDate: '2026-10-14T19:00:00Z', endDate: '2026-10-14T19:00:00Z', totalDays: 1, status: 'approved' }] }
        : { success: true, holidays: [{ _id: 'holiday', title: 'New Year', date: '2026-12-31T19:00:00Z' }] },
  });
  try {
    await settle();
    const html = app.render();
    assert.match(html, /15 Oct 2026.*15 Oct 2026/);
    assert.match(html, /01 Jan 2027/);
    assert.doesNotMatch(html, /Company Holidays \(2026\)/);
  } finally { app.unmount(); if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('an old policy request cannot overwrite a new session or request its executive ledger', async () => {
  const first = deferred(), second = deferred(), calls = [];
  const policy = { shiftEndTime: '19:00', workingDays: [1, 2, 3, 4, 5], gracePeriodMinutes: 15, halfDayThresholdMinutes: 60, fullDayAbsentThresholdMinutes: 180 };
  const app = mount('../src/app/deduction-settings/page.tsx', {
    attendanceGet(endpoint) { calls.push(endpoint); return calls.length === 1 ? first.promise : second.promise; },
  });
  try {
    app.switchUser({ id: 'member', role: 'Team Member' });
    second.resolve({ success: true, rule: { ...policy, shiftStartTime: '10:00' } });
    await settle();
    assert.match(app.render(), /value="10:00"/);
    first.resolve({ success: true, rule: { ...policy, shiftStartTime: '09:00', shiftEndTime: '18:00' } });
    await settle();
    assert.match(app.render(), /value="10:00"/);
    assert.equal(calls.filter(endpoint => endpoint.includes('monthly-report')).length, 0);
  } finally { app.unmount(); }
});

test('invalid leave/calendar timestamps have a readable empty value', () => {
  for (const value of [null, undefined, '', 'bad-date']) assert.equal(attendance.exports.attendanceDate(value), '--');
});

test('the personal terminal prioritizes quarantined absence review and does not claim its charge was applied', async () => {
  const row = { _id: 'record', date: '2026-10-15', status: 'absent', checkIn: '2026-10-15T04:00:00Z', deductionAmount: 500, quarantine: { at: '2026-10-15T06:00:00Z', reason: 'Needs review' } };
  const app = mount('../src/app/attendance/page.tsx', {
    attendanceGet: async endpoint => endpoint.startsWith('/attendance/history') ? { success: true, pages: 1, records: [row] }
      : endpoint.endsWith('/roster') ? { success: true, date: row.date, roster: [] }
        : { success: true, date: row.date, attendance: row, shiftStartTime: '09:00', shiftEndTime: '18:00', gracePeriodMinutes: 15 },
  });
  try {
    await settle();
    const html = app.render();
    assert.match(html, /Needs Attendance Repair/);
    assert.match(html, /Recorded Amount \(Excluded from Totals\)/);
    assert.doesNotMatch(html, /Absence Threshold Reached|Penalty Applied|>Clock Out<\/button>/);
  } finally { app.unmount(); }
});

for (const action of ['repair', 'absence']) test(`company history releases its ${action} lock after a rejected request and permits retry`, async () => {
  let posts = 0, submitted;
  const row = { _id: 'record', __v: 2, date: '2026-10-13', user: { _id: 'employee', name: 'Member' }, status: 'absent', hasPhoto: false, deductionAmount: 0,
    ...(action === 'repair' ? { quarantine: { at: '2026-10-14', reason: 'Wrong date' }, suggestedRepairDate: '2026-10-13' } : { financialReviewRequired: true }) };
  const app = mount('../src/components/attendance/CompanyAttendanceHistory.tsx', {
    attendanceGet: async () => ({ success: true, records: [row], count: 1, pages: 1, lateCount: 0, totalDeductions: 0 }),
    attendancePost: async (_endpoint, body) => { posts++; submitted = body; if (posts === 1) throw new Error('Connection interrupted'); return { success: true }; },
  }, { workingDay: '2026-10-15' });
  try {
    await settle(); app.render();
    app.find(node => node.type === 'button' && nodeText(node) === (action === 'repair' ? 'Repair working date' : 'Review absence')).props.onClick();
    app.render();
    const submit = async () => {
      if (action === 'repair') await app.find(node => node.type === 'form' && node.props['aria-label'] === 'Repair legacy attendance').props.onSubmit({ preventDefault() {} });
      else { app.find(node => node.type === 'button' && nodeText(node) === 'Confirm Absence Deduction').props.onClick(); await settle(); }
    };
    await assert.doesNotReject(submit);
    assert.match(app.render(), /Connection interrupted/);
    assert.equal(app.find(node => node.type === 'button' && nodeText(node) === 'Cancel').props.disabled, false);
    await submit(); app.render();
    assert.equal(posts, 2);
    assert.equal(submitted.expectedVersion, row.__v);
    assert.equal(submitted.expectedRecordId, row._id);
  } finally { app.unmount(); }
});

test('an old account policy save cannot replace the current account settings or leave its simulator wage behind', async () => {
  const save = deferred();
  let loads = 0;
  const policy = { shiftEndTime: '19:00', workingDays: [1, 2, 3, 4, 5], gracePeriodMinutes: 15, halfDayThresholdMinutes: 60, fullDayAbsentThresholdMinutes: 180 };
  const app = mount('../src/app/deduction-settings/page.tsx', {
    attendanceGet: async endpoint => endpoint.endsWith('/rules') ? { success: true, rule: { ...policy, shiftStartTime: ++loads === 1 ? '09:00' : '10:00' } }
      : { success: true, report: [], grandTotalDeductions: 0 },
    attendancePut: () => save.promise,
  });
  try {
    await settle(); app.render();
    const pending = app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    app.switchUser({ id: 'member', role: 'Team Member', dailyWage: 1234 });
    await settle(); app.render();
    save.resolve({ success: true, rule: { ...policy, shiftStartTime: '09:00' } });
    await pending;
    const html = app.render();
    assert.match(html, /value="10:00"/);
    assert.match(html, /value="1234"/);
    assert.doesNotMatch(html, /Attendance policy saved/);
  } finally { app.unmount(); }
});

const leaveResponse = endpoint => endpoint.startsWith('/leaves/duration') ? { success: true, duration: { totalDays: 1, workingDates: ['2026-10-16'] } }
  : endpoint.endsWith('/summary') ? { success: true, leaveBalances: { casual: 10 }, totalRemainingHolidays: 10 }
    : endpoint.endsWith('/requests') ? { success: true, requests: [] } : { success: true, holidays: [] };
async function fillLeave(app, date = '2026-10-16') {
  await settle(); app.render();
  app.find(node => node.type === 'button' && nodeText(node).includes('Apply for Leave')).props.onClick(); app.render();
  for (const label of ['Leave start date', 'Leave end date']) {
    app.find(node => node.type === 'input' && node.props['aria-label'] === label).props.onChange({ target: { value: date } }); app.render();
  }
  app.find(node => node.type === 'textarea').props.onChange({ target: { value: 'Personal time' } }); app.render();
  await app.runTimers(); app.render();
}

test('rapid leave submissions send one application before React renders the pending state', async () => {
  const response = deferred(); let posts = 0;
  const app = mount('../src/app/leaves/page.tsx', { attendanceGet: async endpoint => leaveResponse(endpoint), attendancePost: () => { posts++; return response.promise; } });
  try {
    await fillLeave(app);
    const submit = app.find(node => node.type === 'form').props.onSubmit;
    const first = submit({ preventDefault() {} }), second = submit({ preventDefault() {} });
    response.resolve({ success: true }); await Promise.all([first, second]);
    assert.equal(posts, 1);
  } finally { app.unmount(); }
});

test('an old leave application response cannot close or overwrite the new account form', async () => {
  const response = deferred();
  const app = mount('../src/app/leaves/page.tsx', { attendanceGet: async endpoint => leaveResponse(endpoint), attendancePost: () => response.promise });
  try {
    await fillLeave(app, '2026-10-15');
    const pending = app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    app.switchUser({ id: 'member', role: 'Team Member' });
    await fillLeave(app, '2026-10-16');
    response.resolve({ success: true }); await pending;
    assert.doesNotMatch(app.render(), /Leave application submitted successfully/);
    assert.equal(app.find(node => node.type === 'input' && node.props['aria-label'] === 'Leave start date').props.value, '2026-10-16');
    assert.equal(app.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
  } finally { app.unmount(); }
});

test('an old leave review response does not refetch data or display an error in the new session', async () => {
  const response = deferred(); let gets = 0;
  const app = mount('../src/app/leaves/page.tsx', {
    attendanceGet: async endpoint => { gets++; return endpoint.endsWith('/requests') ? { success: true, requests: [{ _id: 'request', status: 'pending', totalDays: 1, startDate: '2026-10-15', endDate: '2026-10-15' }] } : leaveResponse(endpoint); },
    attendancePut: () => response.promise,
  });
  try {
    await settle(); app.render();
    const pending = app.find(node => node.type === 'button' && node.props.title === 'Approve Request').props.onClick();
    app.switchUser({ id: 'member', role: 'Team Member' }); await settle(); app.render();
    const before = gets;
    response.resolve({ success: false, message: 'Old review failed' }); await pending;
    assert.doesNotMatch(app.render(), /Old review failed/);
    assert.equal(gets, before);
  } finally { app.unmount(); }
});

test('a failed leave-duration quote can be retried with the selected dates unchanged', async () => {
  let quotes = 0;
  const app = mount('../src/app/leaves/page.tsx', {
    attendanceGet: async endpoint => endpoint.startsWith('/leaves/duration') && ++quotes === 1 ? { success: false, message: 'Duration service temporarily unavailable' } : leaveResponse(endpoint),
  });
  try {
    await fillLeave(app);
    app.find(node => node.type === 'button' && nodeText(node) === 'Retry Duration').props.onClick(); app.render();
    await app.runTimers();
    assert.match(app.render(), /1 working day\(s\) requested/);
    assert.equal(quotes, 2);
    assert.equal(app.find(node => node.type === 'input' && node.props['aria-label'] === 'Leave start date').props.value, '2026-10-16');
  } finally { app.unmount(); }
});

test('the deduction simulator cannot select minutes beyond the backend-supported daily maximum', async () => {
  const policy = { shiftStartTime: '09:00', shiftEndTime: '18:00', workingDays: [1, 2, 3, 4, 5], gracePeriodMinutes: 15, halfDayThresholdMinutes: 60, fullDayAbsentThresholdMinutes: 1440 };
  const app = mount('../src/app/deduction-settings/page.tsx', { attendanceGet: async endpoint => endpoint.endsWith('/rules') ? { success: true, rule: policy } : { success: true, report: [], grandTotalDeductions: 0 } });
  try {
    await settle(); app.render();
    assert.equal(app.find(node => node.type === 'input' && node.props.type === 'range').props.max, 1440);
  } finally { app.unmount(); }
});

test('reducing the configured threshold also clamps the simulator value to its new range', async () => {
  const policy = { shiftStartTime: '09:00', shiftEndTime: '18:00', workingDays: [1, 2, 3, 4, 5], gracePeriodMinutes: 15, halfDayThresholdMinutes: 60, fullDayAbsentThresholdMinutes: 600 };
  const app = mount('../src/app/deduction-settings/page.tsx', { attendanceGet: async endpoint => endpoint.endsWith('/rules') ? { success: true, rule: policy } : { success: true, report: [], grandTotalDeductions: 0 } });
  try {
    await settle(); app.render();
    app.find(node => node.type === 'input' && node.props.type === 'range').props.onChange({ target: { value: '660' } }); app.render();
    app.find(node => node.type === 'input' && node.props.type === 'number' && node.props.value === 600).props.onChange({ target: { value: '180' } }); app.render();
    const slider = app.find(node => node.type === 'input' && node.props.type === 'range');
    assert.equal(slider.props.max, 240);
    assert.equal(slider.props.value, 240);
  } finally { app.unmount(); }
});
