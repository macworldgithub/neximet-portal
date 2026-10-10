// Local visual QA only. No database or external services; all data is synthetic.
// Run alongside a production build configured with localhost:4000/api.
import http from 'node:http';

const user = { id: 'qa-user', _id: 'qa-user', name: 'Responsive Test User', email: 'qa@example.test', role: 'Project Manager', department: 'Software Development', designation: 'QA Fixture', leaveBalances: { casual: 10, sick: 8, annual: 14 } };
const project = { _id: 'qa-project', title: 'Responsive QA Project', code: 'QA-001', clientName: 'Local Test', department: user.department, status: 'planning', priority: 'Medium', completionPercentage: 0, deadline: '2026-12-31', members: [], teamMembers: [], milestones: [], scopes: [], credentials: [] };
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3001');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const path = new URL(req.url, 'http://localhost:4000').pathname;
  const fixtures = {
    '/api/auth/me': { user },
    '/api/leaves/summary': { leaveBalances: user.leaveBalances, totalHolidaysLeft: 32 },
    '/api/leaves/requests': { requests: [] },
    '/api/leaves/holidays': { holidays: [] },
    '/api/projects': { projects: [project] },
    '/api/projects/qa-project': { project },
    '/api/tasks/project/qa-project': { tasks: [] },
    '/api/tasks/timelogs/project/qa-project': { timeLogs: [] },
    '/api/users': { users: [user] },
  };
  if (path === '/api/auth/login' && req.method === 'POST') {
    req.resume();
    res.end(JSON.stringify({ success: true, user, token: 'local-visual-fixture-only' }));
  } else if (req.method === 'GET' && fixtures[path]) {
    res.end(JSON.stringify({ success: true, ...fixtures[path] }));
  } else {
    req.resume();
    res.end(JSON.stringify({ success: false, message: 'No fixture for this operation. No data was changed.' }));
  }
}).listen(4000, '127.0.0.1', () => console.log('Synthetic visual QA API: http://127.0.0.1:4000'));
