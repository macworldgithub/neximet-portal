import { test, expect } from '@playwright/test';
const id = 'ab'.repeat(12), clientId = 'cd'.repeat(12), taskId = 'ef'.repeat(12);
const project = { _id: id, title: 'Brand website', code: 'NX-WEB-01', client: clientId, status: 'in_progress', completionPercentage: 60, totalTasks: 2, doneTasks: 1, deadline: '2026-12-15', milestones: [{ _id: 'm1', title: 'Design approved', status: 'completed', progress: 100, deadline: '2026-11-01' }] };
const invoice = { _id: 'aa'.repeat(12), number: 'NX-2026-TEST', client: clientId, currency: 'USD', status: 'issued', issuedAt: '2026-10-29', dueAt: '2026-11-29', subtotal: 1000, taxRate: 5, tax: 50, total: 1050, items: [{ description: 'Website development', quantity: 2, rate: 500, amount: 1000 }], billTo: { name: 'Client User', email: 'client@example.test', company: 'Acme Studio', address: 'Example billing address' }, paymentDetails: 'Bank transfer, reference invoice number', notes: 'Thank you for working with Neximet.' };
async function mock(page, role = 'Client') {
  const writes = [], requests = [], errors = [];
  const tasks = [{ _id: taskId, title: 'Homepage design', description: 'Responsive landing page', status: 'in_progress', priority: 'High', clientVisible: true, deadline: '2026-11-10', ...(role !== 'Client' ? { assignedTo: { _id: 'bb'.repeat(12), name: 'Internal Designer' } } : {}) }];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('neximet_token', 'portal-ui-test-token'));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, ''), method = request.method();
    requests.push(path);
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/me') return json({ success: true, user: { id: clientId, name: role === 'Client' ? 'Client User' : 'Admin User', role, email: 'client@example.test', department: 'Executive', designation: role } });
    if (path === '/notifications') return json({ success: true, notifications: [], unreadCount: 0, nextCursor: null });
    if (path === '/chat/conversations') return json({ success: true, conversations: [], unreadCount: 0 });
    if (path === '/chat/deliveries') return json({ success: true, messages: [] });
    if (path === '/chat/push/config') return json({ success: true, configured: false });
    if (method !== 'GET') {
      const body = request.postDataJSON(); writes.push({ path, method, body });
      if (path.endsWith('/tasks')) tasks.push({ _id: 'cc'.repeat(12), ...body, status: 'todo', clientVisible: true });
      if (path.startsWith('/portal/tasks/')) Object.assign(tasks[0], body, body.assignedTo ? { assignedTo: { _id: body.assignedTo, name: 'Internal Designer' } } : {});
      return json({ success: true });
    }
    if (path === '/portal/projects') return json({ success: true, projects: [project] });
    if (path === '/portal/invoices') return json({ success: true, invoices: [invoice] });
    if (path === `/portal/projects/${id}/tasks`) return json({ success: true, tasks });
    if (path === '/portal/clients') return json({ success: true, clients: [{ _id: clientId, name: 'Client User', company: 'Acme Studio', email: 'client@example.test', billingAddress: 'Example billing address', phone: '', isActive: true }] });
    if (path === '/auth/users') return json({ success: true, users: [{ _id: 'bb'.repeat(12), name: 'Internal Designer', role: 'Team Member', isActive: true }], count: 1 });
    return json({ success: true, projects: [], users: [], notifications: [], count: 0, unreadCount: 0 });
  });
  return { writes, requests, errors };
}
async function noOverflow(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }
test('client overview submits tasks and keeps staff assignment controls out of the portal', async ({ page }) => {
  const state = await mock(page); await page.goto('/client');
  await expect(page.getByRole('heading', { name: 'Welcome, Client' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Homepage design' })).toBeVisible();
  await expect(page.getByLabel('Brand website progress')).toHaveAttribute('aria-valuenow', '60');
  await expect(page.getByText('Internal assignee')).toHaveCount(0);
  await page.getByRole('button', { name: 'Assign task to Neximet' }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Task title').fill('Add contact form'); await dialog.getByLabel('Description').fill('Please include a company field.');
  await dialog.getByRole('button', { name: 'Submit task' }).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Add contact form' })).toBeVisible();
  expect(state.writes.find(write => write.path.startsWith('/portal/')).path).toBe(`/portal/projects/${id}/tasks`);
  expect(state.requests).not.toContain('/auth/users'); expect(state.requests).not.toContain('/projects'); expect(state.requests).not.toContain('/mail/status');
  await noOverflow(page); expect(state.errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/portal-client-desktop.png', fullPage: true });
});
test('clients redirect away from staff pages and see only their finance controls', async ({ page }) => {
  const state = await mock(page); await page.goto('/employees'); await expect(page).toHaveURL(/\/client$/);
  await page.getByRole('link', { name: 'Finance', exact: true }).first().click(); await expect(page).toHaveURL(/\/client\/finance$/);
  await expect(page.getByRole('heading', { name: 'Your finances' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Create invoice' })).toHaveCount(0);
  await page.getByRole('button', { name: 'View invoice' }).click(); await expect(page.getByRole('dialog').getByText('Website development')).toBeVisible(); await page.keyboard.press('Escape');
  expect(state.requests).not.toContain('/auth/users'); expect(state.errors).toEqual([]);
});
test('super admin creates accounts, assigns tasks, and issues invoices', async ({ page }) => {
  const state = await mock(page, 'Super Admin'); await page.goto('/clients'); await expect(page.getByRole('heading', { name: 'Clients & Finance' })).toBeVisible();
  await page.getByRole('button', { name: 'Create client', exact: true }).click(); let dialog = page.getByRole('dialog'); await dialog.getByLabel('Contact name').fill('New Client'); await dialog.getByLabel('Email', { exact: true }).fill('new@example.test'); await dialog.getByLabel('Initial password').fill('test-new-client-password'); await dialog.getByRole('button', { name: 'Create account' }).click(); await expect(dialog).toHaveCount(0); expect(state.writes.at(-1).path).toBe('/portal/clients');
  await page.getByLabel('Internal assignee').selectOption('bb'.repeat(12)); await expect.poll(() => state.writes.at(-1)?.path).toBe(`/portal/tasks/${taskId}`);
  await page.getByRole('button', { name: 'finance', exact: true }).click(); await page.getByRole('button', { name: 'Create invoice', exact: true }).click(); dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption(clientId); await dialog.getByLabel('Item 1 description').fill('Development services'); await dialog.getByLabel('Item 1 rate').fill('250'); await dialog.getByLabel('Tax rate (%)').fill('5');
  await expect(dialog.getByText(/^Total.*262/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Issue invoice', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const saved = state.writes.at(-1); expect(saved.path).toBe('/portal/invoices'); expect(saved.body.items[0].rate).toBe(250); expect(saved.body.clientId).toBe(clientId); expect(saved.body.taxRate).toBe(5); expect(state.errors).toEqual([]);
});
for (const width of [320, 390, 768]) test(`portal and invoice preview fit ${width}px screens`, async ({ page }) => {
  const state = await mock(page); await page.setViewportSize({ width, height: 844 }); await page.goto('/client'); await expect(page.getByRole('heading', { name: 'Welcome, Client' })).toBeVisible(); await noOverflow(page);
  await page.goto('/client/finance'); await page.getByRole('button', { name: 'View invoice' }).click(); await noOverflow(page); await expect(page.getByRole('dialog').getByRole('table')).toBeVisible(); await page.screenshot({ path: `test-results/portal-client-${width}.png`, fullPage: true }); expect(state.errors).toEqual([]);
});
test('invoice editor fits a narrow mobile screen', async ({ page }) => {
  const state = await mock(page, 'CEO'); await page.setViewportSize({ width: 320, height: 844 }); await page.goto('/clients'); await page.getByRole('button', { name: 'finance', exact: true }).click(); await page.getByRole('button', { name: 'Create invoice', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  const dialog = page.getByRole('dialog'); expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true); await page.screenshot({ path: 'test-results/portal-invoice-editor-mobile.png', fullPage: true }); expect(state.errors).toEqual([]);
});
test('super admin adds an employee to an existing client conversation', async ({ page }) => {
  const state = await mock(page, 'Super Admin');
  const employeeId = 'bb'.repeat(12);
  let conversation = { _id: id, kind: 'direct', members: [{ user: { _id: clientId, name: 'Admin User', role: 'Super Admin', isActive: true } }, { user: { _id: 'dd'.repeat(12), name: 'External Client', role: 'Client', isActive: true } }] };
  await page.route('**/api/chat/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/chat/conversations') return json({ success: true, conversations: [conversation], unreadCount: 0 });
    if (path === `/chat/conversations/${id}`) return json({ success: true, conversation });
    if (path === `/chat/conversations/${id}/messages`) return json({ success: true, conversation, messages: [], hasMore: false });
    if (path === '/chat/people') return json({ success: true, people: [{ _id: employeeId, name: 'Internal Designer', department: 'Graphics Designing', role: 'Team Member', isActive: true }] });
    if (path === `/chat/conversations/${id}/members`) {
      state.writes.push({ path, body: request.postDataJSON() });
      conversation = { ...conversation, kind: 'group', name: 'Client conversation', members: [...conversation.members, { user: { _id: employeeId, name: 'Internal Designer', role: 'Team Member', isActive: true } }] };
      return json({ success: true, conversation });
    }
    return route.fallback();
  });
  await page.goto(`/chat?conversation=${id}`);
  await page.getByRole('button', { name: 'View conversation members' }).click();
  await page.getByRole('button', { name: 'Add members', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add conversation members' });
  await dialog.getByRole('button', { name: 'Choose members' }).click();
  await dialog.getByRole('button', { name: 'Add Internal Designer' }).click();
  await dialog.getByRole('button', { name: 'Add members', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.at(-1).body.participantIds).toEqual([employeeId]);
  await expect(page.getByText('Internal Designer', { exact: false })).toBeVisible();
  expect(state.errors).toEqual([]);
});
