// Local visual QA only. No database or external services; all data is synthetic.
// Run alongside a production build configured with localhost:4000/api.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DEFAULT_RULE, companyDate, addDays, atCompanyTime, validDate, isWorkingDay, calculateDeduction } = require('../../backend/src/services/attendancePolicy');
const port = Number(process.env.QA_API_PORT || 4000);
const qaOrigin = process.env.QA_APP_ORIGIN || 'http://127.0.0.1:3001';
const fixturePhoto = 'data:image/png;base64,' + readFileSync(new URL('../public/icons/icon-192x192.png', import.meta.url)).toString('base64');

const user = { id: '111111111111111111111111', _id: '111111111111111111111111', name: 'Responsive Test Administrator', email: 'qa@example.test', role: 'CEO', department: 'Executive', designation: 'QA Fixture', isActive: true, dailyWage: 4667, monthlySalary: 140000, leaveBalances: { casual: 10, sick: 8, annual: 14 } };
const teammate = { ...user, id: '222222222222222222222222', _id: '222222222222222222222222', name: 'Synthetic Teammate With A Longer Name', email: 'long-email-for-responsive-testing@example.test', role: 'Team Member', department: 'Software Development', designation: 'Software Engineer' };
const roleUsers = {
  member: { ...user, name: 'Synthetic Team Member', role: 'Team Member', department: teammate.department },
  manager: { ...user, name: 'Synthetic Project Manager', role: 'Project Manager', department: teammate.department },
  'team-manager': { ...user, name: 'Synthetic Team Manager', role: 'Team Manager', department: teammate.department },
  admin: { ...user, name: 'Synthetic Super Administrator', role: 'Super Admin' },
};
const project = { _id: 'qa-project', title: 'Responsive QA Project With A Long Portfolio Title', code: 'QA-001', clientName: 'Synthetic Client', department: teammate.department, status: 'in_progress', priority: 'Medium', completionPercentage: 35, deadline: '2026-12-31', createdAt: new Date().toISOString(), members: [], teamMembers: [teammate], milestones: [], scopes: [], credentials: [], description: 'Synthetic content for viewport testing only.', createdBy: user };
Object.assign(project, {
  startDate: '2026-10-01', estimatedHours: 160, spentHours: 2,
  assignedMembers: [{ user: teammate, roleInProject: 'Synthetic lead engineer with a longer project role', allocatedHoursPerWeek: 32, assignedAt: '2026-10-01' }],
  milestones: [{ _id: 'qa-milestone', title: 'Synthetic milestone with a longer deliverable title', deadline: '2026-12-15', status: 'in_progress' }],
  credentials: [{ _id: 'qa-credential', platform: 'Synthetic platform with a longer credential title', environment: 'QA', usernameOrEmail: teammate.email, passwordOrKey: 'synthetic-fixture-not-a-real-secret', endpointUrl: 'https://example.test/a-long-endpoint-for-layout-testing', notes: 'Synthetic credential for layout testing only.', visibleToRoles: ['CEO', 'Project Manager', 'Team Manager', 'Team Member'] }],
});
const timeLogs = [{ _id: 'qa-work-log', user: teammate, date: '2026-10-12', hours: 2, description: 'Synthetic work log with a longer description for responsive testing.', billable: true }];
const departmentBreakdown = [teammate.department, 'Digital Marketing (SEO)', 'Graphics Designing', 'WordPress Team'].map((department) => ({ department, totalProjects: 4, activeProjects: 2, avgProgress: 35 }));
const tasks = ['todo', 'in_progress', 'review', 'done'].map((status, index) => ({ _id: `qa-task-${index}`, project: project._id, title: `Synthetic work item ${index + 1} with a longer summary for responsive testing`, issueKey: `QA-${index + 1}`, issueType: 'task', status, priority: 'Medium', assignedTo: teammate, createdBy: user, labels: ['responsive', 'synthetic-fixture'], subtasks: [], comments: [], deadline: project.deadline, estimatedHours: 8, spentHours: 2 }));
const conversation = { _id: '333333333333333333333333', kind: 'direct', members: [user, teammate].map((person) => ({ user: person })), unreadCount: 0, updatedAt: new Date().toISOString(), lastMessage: { text: 'Synthetic message for layout testing', createdAt: new Date().toISOString() } };
const messages = [user, teammate].map((person, index) => ({ _id: `44444444444444444444444${index}`, conversation: conversation._id, sender: person, text: index ? 'A long message can wrap on a narrow phone: https://example.test/a-very-long-continuous-path-to-check-message-wrapping' : 'Hello from the local QA fixture.', createdAt: new Date().toISOString(), readBy: [user._id], deliveredBy: [user._id], clientId: `qa-${index}` }));
const attendance = { _id: 'qa-attendance', user: teammate, date: '2026-10-12', checkIn: '2026-10-12T05:15:00Z', status: 'late', minutesLate: 15, deductionAmount: 250, deductionReason: 'Synthetic late arrival to check the populated audit table.', checkedIn: true, location: { distanceMeters: 12 } };
const leaveRequest = { _id: 'qa-leave', user: teammate, leaveType: 'annual', startDate: '2026-11-10', endDate: '2026-11-12', totalDays: 3, reason: 'Synthetic annual leave request with a longer reason for responsive testing.', status: 'pending' };
let attendanceScenario = 'normal';
let lastAttendanceOverride = null;
let lastEmployeeMutation = null;
http.createServer((req, res) => {
  if (req.headers.origin === qaOrigin || /^http:\/\/(127\.0\.0\.1|localhost):300[123]$/.test(req.headers.origin || '')) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const requested = new URL(req.url, 'http://localhost:4000');
  const path = requested.pathname;
  if (path === '/__qa/attendance' && req.method === 'GET') {
    const scenario = requested.searchParams.get('scenario');
    if (['normal','open','roster-failure','quarantine','review','no-show','half-shift','leave-failure','history-failure','stale-confirmation','dashboard-failure','dashboard-absence','quarantined-today','employee-edit'].includes(scenario)) attendanceScenario = scenario;
    res.end(JSON.stringify({ success: true, scenario: attendanceScenario })); return;
  }
  if (path === '/__qa/last-attendance-override' && req.method === 'GET') { res.end(JSON.stringify({ success: true, payload: lastAttendanceOverride })); return; }
  if (path === '/__qa/last-employee-mutation' && req.method === 'GET') { res.end(JSON.stringify({ success: true, payload: lastEmployeeMutation })); return; }
  if (path === '/api/leaves/duration' && req.method === 'GET') {
    const start = requested.searchParams.get('startDate'), end = requested.searchParams.get('endDate'), session = requested.searchParams.get('session') || 'full';
    if (!validDate(start) || !validDate(end) || start > end || (new Date(end) - new Date(start)) / 86400000 > 365 || (session !== 'full' && start !== end)) { res.end(JSON.stringify({ success: false, message: 'Choose valid dates; half-day leave covers one date.' })); return; }
    const workingDates = [];
    for (let day = start; day <= end; day = addDays(day, 1)) if (isWorkingDay(day, DEFAULT_RULE)) workingDates.push(day);
    res.end(JSON.stringify(workingDates.length ? { success: true, duration: { totalDays: session === 'full' ? workingDates.length : 0.5, workingDates, session } } : { success: false, message: 'No working days in this range.' })); return;
  }
  const fixtureRole = (req.headers.authorization || '').replace('Bearer local-visual-fixture-', '');
  const currentUser = roleUsers[fixtureRole] || user;
  const fixtures = {
    '/api/auth/me': { user: currentUser },
    '/api/leaves/summary': { leaveBalances: user.leaveBalances, totalRemainingHolidays: 32 },
    '/api/leaves/requests': { requests: [leaveRequest] },
    '/api/leaves/holidays': { holidays: [] },
    '/api/projects': { projects: [project] },
    '/api/projects/qa-project': { project },
    '/api/tasks/project/qa-project': { tasks },
    '/api/tasks/timelogs/project/qa-project': { timeLogs },
    '/api/users': { users: [user] },
    '/api/auth/users': { users: [user, teammate] },
    '/api/auth/password-requests': { requests: [] },
    '/api/dashboard/stats': { projects: { total: 4, active: 2, completed: 1, planning: 1, inReview: 0, departmentBreakdown }, tasks: { total: 4, active: 1, review: 1, done: 1, todo: 1, myRecentTasks: tasks }, upcomingDeadlines: [project], squadMembers: [teammate] },
    '/api/dashboard/admin-notifications': { totalCount: 0, counts: { leaves: 0, passwords: 0, attendance: 0, tasks: 0 }, notifications: { leaves: [], passwords: [], attendance: [], tasks: [] } },
    '/api/attendance/today': { attendance: null, date: companyDate(), shiftStartTime: '09:00', shiftEndTime: '18:00', gracePeriodMinutes: 15, halfDayThresholdMinutes: 60, fullDayAbsentThresholdMinutes: 180, leaveBalances: currentUser.leaveBalances, officeLocation: { ...DEFAULT_RULE.officeLocation, enforceLocation: false }, antiProxySettings: { ...DEFAULT_RULE.antiProxySettings, requireSelfieVerification: true } },
    '/api/attendance/history': { records: [{ ...attendance, hasPhoto: true }], count: 1, lateCount: 1, totalDeductions: 250, pages: 1, page: 1, limit: 20 },
    '/api/attendance/records/qa-attendance/photo': { attendance: { ...attendance, photo: fixturePhoto, deviceInfo: { deviceId: 'synthetic-browser-profile-identifier-for-layout-checks', browser: 'Synthetic Browser / Test Operating System' } } },
    '/api/attendance/roster': { date: companyDate(), roster: [{ ...attendance, date: companyDate(), recordId: attendance._id, hasPhoto: false }] },
    '/api/deductions/rules': { rule: DEFAULT_RULE },
    '/api/deductions/monthly-report': { grandTotalDeductions: 250, report: [{ user: teammate, totalLateIncidents: 1, totalMinutesLate: 15, totalDeductions: 250, incidents: [{ reason: attendance.deductionReason }] }] },
    '/api/chat/conversations': { conversations: [conversation] },
    '/api/chat/conversations/333333333333333333333333': { conversation },
    '/api/chat/conversations/333333333333333333333333/messages': { messages, conversation, hasMore: false },
    '/api/chat/conversations/333333333333333333333333/typing': { members: conversation.members },
    '/api/chat/users': { users: [teammate] },
    '/api/chat/people': { people: [teammate] },
    '/api/chat/deliveries': { messages: [] },
    '/api/chat/push/config': { configured: false },
  };
  if (attendanceScenario === 'open') {
    fixtures['/api/attendance/today'].openAttendance = { ...attendance, date: addDays(companyDate(), -1), checkIn: atCompanyTime(addDays(companyDate(), -1), '22:00'), scheduledCheckOut: atCompanyTime(companyDate(), '06:00'), status: 'present', isLate: false, deductionAmount: 0 };
    fixtures['/api/attendance/today'].shiftEndTime = '20:00';
  }
  if (attendanceScenario === 'roster-failure' && path === '/api/attendance/roster') { res.statusCode = 503; res.end(JSON.stringify({ success: false, message: 'Synthetic roster unavailable. Please refresh.' })); return; }
  if (attendanceScenario === 'history-failure' && path === '/api/attendance/history') { res.statusCode = 503; res.end(JSON.stringify({ success: false, message: 'Synthetic history unavailable. Please refresh.' })); return; }
  if (attendanceScenario === 'dashboard-failure' && path === '/api/dashboard/stats') { res.statusCode = 503; res.end(JSON.stringify({ success: false, message: 'Synthetic dashboard unavailable. Please retry.' })); return; }
  if (attendanceScenario === 'dashboard-absence') fixtures['/api/dashboard/stats'].attendance = { myTodayStatus: { status: 'absent', checkIn: atCompanyTime(companyDate(), '09:30'), isLate: false, deductionAmount: 1000, override: { type: 'absent' } }, myLeaveBalances: { casual: 9, sick: 8, annual: 14 }, myMonthlyPresentCount: 1, myMonthlyLateCount: 0, myMonthlyDeductions: 1000 };
  if (attendanceScenario === 'quarantined-today') {
    const record = { ...attendance, date: companyDate(), checkIn: new Date(Date.now() - 60000), checkOut: null, status: 'present', isLate: false, minutesLate: 0, deductionAmount: 0, deductionReason: 'Synthetic record retained for evidence review.', quarantine: { at: new Date(), reason: 'Synthetic invalid legacy scheduled end.' } };
    fixtures['/api/attendance/today'].attendance = record; fixtures['/api/attendance/today'].repairRequired = [{ _id: record._id, date: record.date, quarantine: record.quarantine }];
    fixtures['/api/attendance/roster'] = { date: record.date, roster: [{ ...record, recordId: record._id, recordVersion: 0 }] };
    fixtures['/api/attendance/history'] = { records: [{ ...record, hasPhoto: false }], count: 1, lateCount: 0, totalDeductions: 0, pages: 1 };
  }
  if (attendanceScenario === 'employee-edit' && ['/api/auth/users','/api/auth/users/222222222222222222222222'].includes(path) && ['POST','PUT'].includes(req.method)) {
    let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => { lastEmployeeMutation = JSON.parse(body || '{}'); res.statusCode = 409; res.end(JSON.stringify({ success: false, message: 'Synthetic compensation review conflict. No data was changed.' })); }); return;
  }
  if (attendanceScenario === 'leave-failure' && ['/api/leaves/summary','/api/leaves/requests','/api/leaves/holidays'].includes(path)) { res.statusCode = 503; res.end(JSON.stringify({ success: false, message: 'Synthetic leave data unavailable.' })); return; }
  if (attendanceScenario === 'no-show') fixtures['/api/attendance/today'].attendance = { date: companyDate(), status: 'absent', recordSource: 'automatic', deductionAmount: 0, financialReviewRequired: true };
  if (attendanceScenario === 'half-shift') fixtures['/api/attendance/today'].personalSchedule = { expectedCheckIn: atCompanyTime(companyDate(), '13:30'), scheduledCheckOut: atCompanyTime(companyDate(), '18:00'), halfDaySession: 'morning' };
  if (attendanceScenario === 'quarantine') {
    const legacy = { ...attendance, _id: 'qa-legacy', date: 'legacy-invalid-date', quarantine: { at: new Date(), reason: 'Synthetic legacy row awaiting administrator repair.' }, suggestedRepairDate: addDays(companyDate(), -1), hasPhoto: false };
    fixtures['/api/attendance/history'] = { records: [legacy], count: 1, lateCount: 0, totalDeductions: 0, pages: 1 };
    fixtures['/api/attendance/today'].repairRequired = [legacy];
  }
  if (attendanceScenario === 'review') fixtures['/api/attendance/history'] = { records: [{ ...attendance, date: addDays(companyDate(), -1), status: 'absent', checkIn: null, deductionAmount: 0, hasPhoto: false, financialReviewRequired: true, deductionReason: 'Synthetic no-show awaiting administrator review.' }], count: 1, lateCount: 0, totalDeductions: 0, pages: 1 };
  if (attendanceScenario === 'stale-confirmation') {
    const record = { ...attendance, _id: '333333333333333333333333', __v: 2, date: companyDate(), status: 'absent', checkIn: null, deductionAmount: 0, hasPhoto: false, recordSource: 'automatic', financialReviewRequired: true };
    fixtures['/api/attendance/history'] = { records: [record], count: 1, lateCount: 0, totalDeductions: 0, pages: 1 };
    fixtures['/api/attendance/roster'] = { date: companyDate(), roster: [{ ...record, recordId: record._id, recordVersion: 2 }] };
    if (req.method === 'POST' && ['/api/attendance/mark-absent','/api/attendance/mark-present'].includes(path)) {
      let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => { lastAttendanceOverride = JSON.parse(body || '{}'); res.statusCode = 409; res.end(JSON.stringify({ success: false, message: 'Attendance changed since you opened this action. Refresh and review it again.' })); }); return;
    }
  }
  if (path === '/api/deductions/simulate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const inputs = JSON.parse(body || '{}');
      const result = calculateDeduction(inputs.minutesLate, inputs.dailyWage, { ...DEFAULT_RULE, ...inputs.ruleOverrides }, inputs.priorLateCount || 0);
      res.end(JSON.stringify({ success: true, simulation: { ...result, deduction: result.deductionAmount, explanation: result.deductionReason } }));
    });
  } else if (path === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let role = 'only';
      try { const email = JSON.parse(body).email; role = Object.keys(roleUsers).find((key) => email === `${key}@example.test`) || role; } catch { /* Synthetic default account. */ }
      res.end(JSON.stringify({ success: true, user: roleUsers[role] || user, token: `local-visual-fixture-${role}` }));
    });
  } else if (req.method === 'GET' && fixtures[path]) {
    res.end(JSON.stringify({ success: true, ...fixtures[path] }));
  } else {
    req.resume();
    res.end(JSON.stringify({ success: false, message: 'No fixture for this operation. No data was changed.' }));
  }
}).listen(port, '127.0.0.1', () => console.log(`Synthetic visual QA API: http://127.0.0.1:${port}`));
