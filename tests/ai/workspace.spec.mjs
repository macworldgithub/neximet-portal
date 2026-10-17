import { test, expect } from '@playwright/test';

const id = 'ab'.repeat(12);
const models = provider => [{ id: `${provider}-test`, name: `${provider === 'openai' ? 'GPT' : provider} Test` }];
const now = '2026-10-17T10:00:00.000Z';
const reply = '## Project plan\n\nStart with **clear goals**.\n\n| Task | Owner |\n| --- | --- |\n| Design | Team |\n\n```js\nconst greeting = "Hello";\n```\n\n<script>window.__aiInjected = true</script>\n\n[Unsafe](javascript:alert(1))\n\n![Remote image](https://untrusted.test/tracker.png)';
const runtimeErrors = new WeakMap();
test.beforeEach(async ({ page }) => { const errors = []; runtimeErrors.set(page, errors); page.on('pageerror', error => errors.push(error.message)); });
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
async function mockAPI(page, connected = false, billingFailure = false) {
  const connections = ['openai', 'claude', 'gemini'].map(provider => ({ provider, connected, models: connected ? models(provider) : [], defaultModel: connected ? models(provider)[0].id : '' }));
  const chats = new Map();
  const requests = [];
  await page.addInitScript(() => localStorage.setItem('neximet_token', 'ui-test-token'));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, ''), method = request.method();
    requests.push({ path, method });
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/me') return json({ success: true, user: { id: 'cd'.repeat(12), name: 'Neximet User', email: 'user@example.com', role: 'Team Member', department: 'Software Development' } });
    if (path === '/chat/conversations') return json({ success: true, conversations: [] });
    if (path === '/chat/deliveries') return json({ success: true, messages: [] });
    if (path === '/mail/status') return json({ success: true, connected: false, unread: 0 });
    if (path === '/ai/connections') return json({ success: true, serverConfigured: true, connections });
    if (path.startsWith('/ai/connections/')) {
      const provider = path.split('/').at(-1), connection = connections.find(item => item.provider === provider);
      if (method === 'DELETE') Object.assign(connection, { connected: false, models: [], defaultModel: '' });
      else Object.assign(connection, { connected: true, models: models(provider), defaultModel: models(provider)[0].id });
      return json({ success: true, connection });
    }
    if (path === '/ai/conversations' && method === 'POST') {
      const { provider, model } = request.postDataJSON();
      const chat = { _id: id, title: 'New conversation', provider, model, messages: [], generating: false, updatedAt: now };
      chats.set(id, chat); return json({ success: true, conversation: chat });
    }
    if (path === '/ai/conversations') {
      const search = (url.searchParams.get('q') || '').toLowerCase();
      return json({ success: true, hasMore: false, conversations: [...chats.values()].filter(chat => chat.title.toLowerCase().includes(search)).map(chat => ({ _id: chat._id, title: chat.title, provider: chat.provider, model: chat.model, updatedAt: chat.updatedAt })) });
    }
    if (path.endsWith('/messages')) {
      const chat = chats.get(id), { text, requestId } = request.postDataJSON();
      const userMessage = { id: 'user-message', requestId, role: 'user', content: text, status: 'complete', createdAt: now };
      const assistantMessage = { id: 'assistant-message', requestId, role: 'assistant', content: '', status: 'pending', createdAt: now };
      const quotaFailure = billingFailure === 'quota';
      const errorMessage = quotaFailure ? 'Gemini request or token quota has been reached. Wait for the applicable limit to reset, then send again.' : 'OpenAI API credits are insufficient or API billing is not enabled. Check your API billing balance before sending again.';
      const errorCode = quotaFailure ? 'ai_quota_exhausted' : 'ai_billing_required';
      chat.title = text.slice(0, 80); chat.messages.push(userMessage, billingFailure ? { ...assistantMessage, status: 'error', errorCode, errorMessage } : { ...assistantMessage, content: reply, status: 'complete' });
      const events = [{ type: 'start', conversationId: id, title: chat.title, userMessage, assistantMessage }, billingFailure ? { type: 'error', message: errorMessage, code: errorCode } : { type: 'delta', text: reply }, { type: 'done', message: chat.messages.at(-1) }];
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') });
    }
    if (path === `/ai/conversations/${id}`) {
      if (method === 'DELETE') { chats.delete(id); return json({ success: true }); }
      if (method === 'PATCH') chats.get(id).title = request.postDataJSON().title;
      return json({ success: true, conversation: chats.get(id) });
    }
    return json({ success: true, projects: [], users: [], count: 0 });
  });
  return { chats, requests };
}
async function checkOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test('connect personal providers, send a formatted reply, and reload saved history on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await mockAPI(page);
  await page.goto('/ai');
  await expect(page.getByRole('heading', { name: 'What are we working on?' })).toBeVisible();
  await page.getByRole('button', { name: 'Connect an AI provider' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('API key', { exact: true }).fill('test-private-api-key');
  await dialog.getByRole('button', { name: 'Connect & verify' }).click();
  await expect(dialog.getByRole('status')).toContainText('Connected');
  await expect(dialog.getByLabel('API key', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Plan my project');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('heading', { name: 'Project plan', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('const greeting = "Hello";')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy code' })).toBeVisible();
  expect(await page.evaluate(() => window.__aiInjected)).toBeUndefined();
  await expect(page.locator('.ai-markdown img')).toHaveCount(0);
  await expect(page.locator('.ai-markdown a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Message AI' })).toBeEnabled();
  await checkOverflow(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plan my project', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project plan', exact: true })).toBeVisible();
  expect(state.chats.get(id).messages.length).toBe(2);
  await expect(page.getByRole('button', { name: /Plan my project GPT/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/ai-desktop.png', fullPage: true });
});

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
  test(`responsive chat and keyboard-sized viewport at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size); await mockAPI(page, true); await page.goto('/ai');
    await expect(page.getByRole('heading', { name: 'What are we working on?' })).toBeVisible();
    await checkOverflow(page);
    if (size.width < 1024) {
      await page.getByRole('button', { name: 'Open conversation history' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.getByRole('combobox', { name: 'AI provider' }).selectOption('gemini');
    await page.getByRole('textbox', { name: 'Message AI' }).fill('Plan a responsive website');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('heading', { name: 'Project plan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await checkOverflow(page);
    await page.setViewportSize({ width: size.width, height: 360 });
    await page.getByRole('textbox', { name: 'Message AI' }).focus();
    await page.getByRole('textbox', { name: 'Message AI' }).fill('Continue with the next step');
    const composer = await page.getByRole('textbox', { name: 'Message AI' }).boundingBox();
    const send = await page.getByRole('button', { name: 'Send message' }).boundingBox();
    expect(composer.y).toBeGreaterThanOrEqual(0); expect(send.y + send.height).toBeLessThanOrEqual(360);
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await checkOverflow(page);
    await page.screenshot({ path: `test-results/ai-${size.width}-keyboard.png`, fullPage: true });
  });
}

test('rename, search, and delete a conversation without deleting the provider connection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockAPI(page, true); await page.goto('/ai');
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Original title');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('button', { name: 'Rename conversation' })).toBeEnabled();
  await page.getByRole('button', { name: 'Rename conversation' }).click();
  await page.getByRole('textbox', { name: 'Conversation title' }).fill('Website planning');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Website planning', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search conversations' }).fill('Website');
  await expect(page.getByRole('button', { name: /Website planning GPT/ })).toBeVisible();
  await page.getByRole('button', { name: 'Delete conversation' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What are we working on?' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'AI model' })).toHaveValue('openai-test');
});

test('personal connection settings remain usable on a small keyboard-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await mockAPI(page); await page.goto('/ai');
  await page.getByRole('combobox', { name: 'AI provider' }).selectOption('gemini');
  await page.getByRole('button', { name: 'Connect provider', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Gemini', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 360 });
  await dialog.getByLabel('API key', { exact: true }).fill('test-gemini-api-key');
  const box = await dialog.boundingBox(); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(361);
  await dialog.getByRole('button', { name: 'Connect & verify' }).click();
  await expect(dialog.getByRole('status')).toContainText('Connected');
  await checkOverflow(page);
  await page.screenshot({ path: 'test-results/ai-mobile-settings.png', fullPage: true });
});

test('billing errors show the provider billing link and survive a conversation reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAPI(page, true, true); await page.goto('/ai');
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Hello');
  await page.getByRole('button', { name: 'Send message' }).click();
  const reply = page.getByRole('article', { name: 'GPT reply' });
  await expect(reply.getByRole('alert')).toContainText('OpenAI API credits');
  await expect(page.getByRole('link', { name: 'Open GPT API billing' })).toHaveAttribute('href', 'https://platform.openai.com/settings/organization/billing');
  await expect(reply.getByRole('alert')).not.toContainText('provider is unavailable');
  await page.reload();
  await expect(reply.getByRole('alert')).toContainText('OpenAI API credits');
  await expect(page.getByRole('link', { name: 'Open GPT API billing' })).toBeVisible();
  await checkOverflow(page);
});
test('free-tier setup opens Gemini and exhausted quota shows a reset message without paid fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockAPI(page, true, 'quota'); await page.goto('/ai');
  await page.getByRole('button', { name: 'Set up Gemini free-tier access' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: "Use Gemini's free API allowance" })).toBeVisible();
  await expect(dialog.getByText(/no billing account linked/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'AI provider' })).toHaveValue('gemini');
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Hello');
  await page.getByRole('button', { name: 'Send message' }).click();
  const reply = page.getByRole('article', { name: 'Gemini reply' });
  await expect(reply.getByRole('alert')).toContainText('quota');
  await expect(reply.getByRole('alert')).toContainText('reset');
  await expect(reply.getByRole('link', { name: 'Check Gemini quota & usage' })).toBeVisible();
  await expect(reply.getByRole('link', { name: /API billing/ })).toHaveCount(0);
  expect(state.requests.filter(request => request.path.endsWith('/messages')).length).toBe(1);
  await page.reload();
  await expect(reply.getByRole('alert')).toContainText('quota');
  await checkOverflow(page);
});
