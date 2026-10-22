import { test, expect } from '@playwright/test';

async function mailbox(page, { sourceError = false } = {}) {
  const sent = [];
  const email = (folder = 'inbox') => ({ uid: folder === 'sent' ? 7 : 42, subject: folder === 'sent' ? 'Fwd: Existing forward' : 'Quarterly report',
    from: [{ name: 'Original Sender', address: 'sender@example.test' }], to: [{ name: 'Owner', address: 'owner@example.test' }], cc: [{ name: '', address: 'old-copy@example.test' }],
    date: '2026-10-22T10:00:00.000Z', seen: true, hasRemoteImages: true, text: 'Please find the quarterly report attached.', html: '<p>Please find the <b>quarterly report</b> attached.</p>',
    attachments: [{ filename: 'report.pdf', size: 1200, contentType: 'application/pdf' }, { filename: 'diagram.png', size: 800, contentType: 'image/png', inline: true }] });
  await page.addInitScript(() => localStorage.setItem('neximet_token', 'forwarding-ui-token'));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
    const respond = (body, status = 200) => route.fulfill({ status, json: body });
    if (path === '/auth/me') return respond({ success: true, user: { id: 'ab'.repeat(12), name: 'Mail Owner', email: 'owner@example.test', role: 'Team Member', department: 'Software Development' } });
    if (path === '/auth/users') return respond({ success: true, users: [] });
    if (path === '/projects') return respond({ success: true, projects: [] });
    if (path === '/chat/conversations') return respond({ success: true, conversations: [] });
    if (path === '/chat/deliveries') return respond({ success: true, messages: [] });
    if (path === '/chat/push/config') return respond({ success: true, configured: false });
    if (path === '/notifications') return respond({ success: true, notifications: [], unreadCount: 0, nextCursor: null });
    if (path === '/mail/status') return respond({ success: true, connected: true, unread: 1, notificationsEnabled: true });
    if (path === '/mail/settings') return respond({ success: true, settings: { connected: true, email: 'owner@example.test', displayName: 'Mail Owner', notificationsEnabled: true, serverConfigured: true } });
    if (path === '/mail/messages') return respond({ success: true, messages: [email(url.searchParams.get('folder'))], total: 1, page: 1, hasMore: false, uidValidity: '123' });
    if (path.startsWith('/mail/messages/')) return respond({ success: true, emailMessage: email(url.searchParams.get('folder')) });
    if (path === '/mail/send') {
      sent.push(request.postDataJSON());
      if (sourceError) return respond({ success: false, safeToEdit: true, message: 'Original message not found. Refresh the mailbox.' }, 404);
      return respond({ success: true, messageId: 'forward-fixture', sentCopySaved: true, rejected: [] });
    }
    return respond({ success: true });
  });
  await page.goto('/mail');
  return sent;
}
test('forward from Inbox on mobile includes an editable note, multiple recipients and optional attachments', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const sent = await mailbox(page);
  await page.getByRole('button', { name: /Original Sender.*Quarterly report/ }).click();
  await page.getByRole('button', { name: 'Forward email', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Forward email', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'To', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Subject', exact: true })).toHaveValue('Fwd: Quarterly report');
  await expect(page.getByRole('checkbox', { name: 'Include original attachments (2)', exact: true })).toBeChecked();
  expect(sent.length).toBe(0);
  await page.getByRole('textbox', { name: 'To', exact: true }).fill('new@example.test; second@example.test');
  await page.getByRole('button', { name: 'Show external images', exact: true }).click(); expect(sent.length).toBe(0);
  await page.getByRole('textbox', { name: 'Cc', exact: true }).fill('new-copy@example.test');
  await page.getByRole('textbox', { name: 'Add a note (optional)', exact: true }).fill('Please review this report.');
  await page.getByRole('checkbox', { name: 'Include original attachments (2)', exact: true }).uncheck();
  await page.getByRole('heading', { name: 'Forward email', exact: true }).click();
  await page.screenshot({ path: 'test-results/calls/mail-forward-mobile.png', animations: 'disabled', timeout: 15000 });
  await page.getByRole('button', { name: 'Send email', exact: true }).click();
  await expect(page.getByText('Email forwarded.', { exact: true })).toBeVisible();
  expect(sent.length).toBe(1); expect(sent[0].forward).toEqual({ folder: 'inbox', uid: '42', uidValidity: '123', includeAttachments: false });
  expect(sent[0].to).toBe('new@example.test; second@example.test'); expect(sent[0].text).toBe('Please review this report.');
  expect(sent[0].forwardPreview).toBeUndefined(); expect(sent[0].attachments).toBeUndefined(); expect(sent[0].html).toBeUndefined();
  expect(errors).toEqual([]);
});
test('forward from Sent retains an existing Fwd subject and allows no additional note', async ({ page }) => {
  const sent = await mailbox(page);
  await page.getByRole('button', { name: 'Sent', exact: true }).click();
  await page.getByRole('button', { name: /Fwd: Existing forward/ }).click();
  await page.getByRole('button', { name: 'Forward email', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Subject', exact: true })).toHaveValue('Fwd: Existing forward');
  await page.getByRole('textbox', { name: 'To', exact: true }).fill('new@example.test');
  await page.getByRole('button', { name: 'Send email', exact: true }).click();
  await expect(page.getByText('Email forwarded.', { exact: true })).toBeVisible(); expect(sent[0].text).toBe(''); expect(sent[0].forward.folder).toBe('sent'); expect(sent[0].forward.includeAttachments).toBe(true);
});
test('a missing original keeps a forward draft editable and discarding never sends', async ({ page }) => {
  const sent = await mailbox(page, { sourceError: true });
  await page.getByRole('button', { name: /Quarterly report/ }).click(); await page.getByRole('button', { name: 'Forward email', exact: true }).click();
  await page.getByRole('textbox', { name: 'To', exact: true }).fill('new@example.test'); await page.getByRole('button', { name: 'Send email', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Original message not found.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'To', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Discard', exact: true }).click(); await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Forward email', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard', exact: true }).click(); await page.getByRole('button', { name: 'Discard message', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quarterly report', exact: true })).toBeVisible(); expect(sent.length).toBe(1);
});
