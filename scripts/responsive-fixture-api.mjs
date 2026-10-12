// Local visual QA only. No database or external services; all data is synthetic.
// Run alongside a production build configured with localhost:4000/api.
import http from 'node:http';

const user = { id: '111111111111111111111111', _id: '111111111111111111111111', name: 'Responsive Test Administrator', email: 'qa@example.test', role: 'CEO', department: 'Executive', designation: 'QA Fixture', isActive: true, dailyWage: 4667, monthlySalary: 140000, leaveBalances: { casual: 10, sick: 8, annual: 14 } };
const teammate = { ...user, id: '222222222222222222222222', _id: '222222222222222222222222', name: 'Synthetic Teammate With A Longer Name', email: 'long-email-for-responsive-testing@example.test', role: 'Team Member', department: 'Software Development', designation: 'Software Engineer' };
const roleUsers = {
  member: { ...user, name: 'Synthetic Team Member', role: 'Team Member', department: teammate.department },
  manager: { ...user, name: 'Synthetic Project Manager', role: 'Project Manager', department: teammate.department },
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
http.createServer((req, res) => {
  if (/^http:\/\/(127\.0\.0\.1|localhost):300[123]$/.test(req.headers.origin || '')) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const path = new URL(req.url, 'http://localhost:4000').pathname;
  const fixtureRole = (req.headers.authorization || '').replace('Bearer local-visual-fixture-', '');
  const currentUser = roleUsers[fixtureRole] || user;
  const fixtures = {
    '/api/auth/me': { user: currentUser },
    '/api/leaves/summary': { leaveBalances: user.leaveBalances, totalHolidaysLeft: 32 },
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
    '/api/attendance/today': { attendance: null },
    '/api/attendance/history': { records: [attendance] },
    '/api/attendance/roster': { roster: [attendance] },
    '/api/deductions/rules': {},
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
  if (path === '/api/auth/login' && req.method === 'POST') {
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
}).listen(4000, '127.0.0.1', () => console.log('Synthetic visual QA API: http://127.0.0.1:4000'));
