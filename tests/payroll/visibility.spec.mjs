import { test, expect } from '@playwright/test';

const employee = { _id: 'ab'.repeat(12), name: 'Payroll Employee', email: 'payroll@example.test', role: 'Team Member', department: 'Software Development', designation: 'Developer', baseSalary: 44000, dailyWage: 2000, leaveBalances: { casual: 10, sick: 8, annual: 14 } };
const rule = { shiftStartTime: '09:00', shiftEndTime: '18:00', workingDays: [1,2,3,4,5], gracePeriodMinutes: 15, currencySymbol: 'PKR', officeLocation: { latitude: 24.8607, longitude: 67.0011, radiusMeters: 200, enforceLocation: true }, antiProxySettings: { requireSelfieVerification: true, enforceSingleDevicePerDay: true } };

async function mockAPI(page, role) {
  const requests = [];
  await page.addInitScript(() => localStorage.setItem('neximet_token', 'payroll-ui-test'));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    requests.push({ path, method: request.method(), body: request.postDataJSON() });
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    // Include pay even for non-CEOs to verify the UI's independent role checks.
    if (path === '/auth/me') return json({ success: true, user: { ...employee, id: 'cd'.repeat(12), name: 'Signed In User', role } });
    if (path === '/auth/users') return json({ success: true, users: [employee] });
    if (path.startsWith('/auth/users/')) return json({ success: true, user: { ...employee, ...request.postDataJSON() } });
    if (path === '/deductions/rules') return json({ success: true, rule });
    if (path === '/deductions/monthly-report') return json({ success: true, report: [], grandTotalDeductions: 0, employeesPenalizedCount: 0 });
    if (path === '/deductions/simulate') return json({ success: true, simulation: { status: 'late', deductionPercentage: 0, deduction: 0, explanation: 'First late of a pair; no deduction yet.' } });
    if (path === '/mail/status') return json({ success: true, connected: false, unread: 0 });
    return json({ success: true, users: [], requests: [], conversations: [], messages: [], notifications: {}, counts: {}, count: 0 });
  });
  return requests;
}

for (const width of [1440, 390]) {
  for (const role of ['CEO', 'Super Admin', 'Team Member']) {
    test(`${role} payroll visibility at ${width}px`, async ({ page }) => {
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      const requests = await mockAPI(page, role);
      await page.goto('/employees');
      await expect(page.getByText('Payroll Employee', { exact: true })).toBeVisible();
      if (role === 'CEO') {
        await expect(page.getByText('PKR 44,000', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Edit & Salary', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Edit employee', exact: true });
        await expect(dialog.getByLabel('Daily Wage Rate (PKR)', { exact: true })).toHaveValue('2000');
        await expect(dialog.getByLabel('Daily Wage Rate (PKR)', { exact: true })).toHaveAttribute('readonly', '');
        await dialog.getByLabel('Base Monthly Salary (PKR)', { exact: true }).fill('66000');
        await expect(dialog.getByLabel('Daily Wage Rate (PKR)', { exact: true })).toHaveValue('3000');
        await dialog.getByRole('button', { name: 'Save Compensation & Profile' }).click();
        await expect(dialog).toHaveCount(0);
        const saved = requests.find(item => item.path.startsWith('/auth/users/') && item.method === 'PUT').body;
        expect(saved.baseSalary).toBe(66000); expect(saved.dailyWage).toBeUndefined();
      } else {
        await expect(page.getByText('PKR 44,000', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Base Salary', { exact: true })).toHaveCount(0);
        if (role === 'Super Admin') {
          await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Edit employee', exact: true });
          await expect(dialog.getByLabel('Base Monthly Salary (PKR)', { exact: true })).toHaveCount(0);
          await expect(dialog.locator('option[value="CEO"]')).toHaveCount(0);
          await dialog.getByRole('button', { name: 'Save Profile', exact: true }).click();
          await expect(dialog).toHaveCount(0);
          const saved = requests.find(item => item.path.startsWith('/auth/users/') && item.method === 'PUT').body;
          for (const key of ['baseSalary', 'dailyWage', 'expectedPay']) expect(saved[key]).toBeUndefined();
        }
      }
      if (role !== 'Team Member') {
        await page.getByRole('button', { name: 'Add New Employee', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Create employee', exact: true });
        if (role === 'CEO') {
          await dialog.getByLabel('Base Salary (PKR)', { exact: true }).fill('66000');
          await expect(dialog.getByLabel('Daily Wage (PKR)', { exact: true })).toHaveValue('3000');
          await expect(dialog.getByLabel('Daily Wage (PKR)', { exact: true })).toHaveAttribute('readonly', '');
        } else await expect(dialog.getByLabel('Base Salary (PKR)', { exact: true })).toHaveCount(0);
        await dialog.getByRole('button', { name: 'Close employee creation' }).click();
      }
      await page.goto('/deduction-settings');
      await expect(page.getByText('Active salary deduction policy', { exact: true })).toBeVisible();
      await expect(page.getByText(/Every two late arrivals in a calendar month/)).toBeVisible();
      await expect(page.getByText(/Daily wage = monthly salary/)).toBeVisible();
      await expect(page.getByText('Monthly Deductions Ledger & Penalty Audit', { exact: true })).toHaveCount(role === 'CEO' ? 1 : 0);
      if (role !== 'CEO') expect(requests.filter(item => item.path === '/deductions/monthly-report')).toHaveLength(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
