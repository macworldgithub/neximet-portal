import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:4012/api';
async function account(browser, request, index, mobile = false) {
  const login = await (await request.post(`${api}/auth/login`, { data: { email: `chat-qa-${index}@example.test`, password: 'chat-qa-only' } })).json();
  const context = await browser.newContext({ ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } }) });
  await context.addInitScript(token => localStorage.setItem('neximet_token', token), login.token);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const chats = await (await request.get(`${api}/chat/conversations`, { headers: { Authorization: `Bearer ${login.token}` } })).json();
  const chat = chats.conversations.find(item => item.kind === 'direct');
  await page.goto(`/chat?conversation=${chat._id}`);
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
  return { context, page, errors, token: login.token, chat: chat._id };
}
async function fixtures(page) {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const paint = canvas.getContext('2d');
    const draw = (frame = 0) => {
      paint.fillStyle = '#111827'; paint.fillRect(0, 0, 640, 360);
      paint.fillStyle = '#5470f4'; paint.fillRect(30 + frame % 180, 100, 130, 130);
      paint.fillStyle = '#5cc5fa'; paint.font = 'bold 32px sans-serif'; paint.fillText('Team media update', 30, 65);
      paint.fillStyle = 'white'; paint.font = '20px sans-serif'; paint.fillText('Photos and videos, right in chat', 30, 300);
    };
    draw(); const image = canvas.toDataURL('image/png').split(',')[1];
    const stream = canvas.captureStream(12), chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.start(); let frame = 0; const timer = setInterval(() => draw(frame += 10), 80);
    await new Promise(resolve => setTimeout(resolve, 1000)); recorder.stop(); await stopped;
    clearInterval(timer); stream.getTracks().forEach(track => track.stop());
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    return { image, video: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')) };
  });
}
async function sendFile(page, name, mimeType, buffer) {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove attachment', exact: true })).toHaveCount(0);
}

for (const mobileSender of [false, true]) {
  test(`inline photos and playable videos reach both participants (${mobileSender ? 'mobile to desktop' : 'desktop to mobile'})`, async ({ browser, request }) => {
    const sender = await account(browser, request, 0, mobileSender), recipient = await account(browser, request, 1, !mobileSender);
    try {
      const fixture = await fixtures(sender.page), suffix = mobileSender ? 'mobile' : 'desktop';
      const photo = `team-${suffix}.png`, video = `team-${suffix}.webm`;
      await sendFile(sender.page, photo, 'application/octet-stream', Buffer.from(fixture.image, 'base64'));
      for (const person of [sender, recipient]) {
        const preview = person.page.getByRole('button', { name: `View photo ${photo}`, exact: true });
        await expect(preview).toBeVisible(); await expect.poll(() => preview.locator('img').evaluate(image => image.naturalWidth)).toBe(640);
        await preview.click(); const viewer = person.page.getByRole('dialog', { name: `Photo: ${photo}`, exact: true });
        await expect(viewer).toBeVisible(); await expect(viewer.locator('img')).toBeVisible();
        if (person === recipient) await person.page.screenshot({ path: `test-results/calls/chat-photo-${suffix}-recipient.png` });
        await person.page.keyboard.press('Escape'); await expect(viewer).toHaveCount(0); await expect(preview).toBeFocused();
      }
      await sendFile(sender.page, video, 'video/webm', Buffer.from(fixture.video, 'base64'));
      for (const person of [sender, recipient]) {
        const play = person.page.getByRole('button', { name: `Play video ${video}`, exact: true });
        await expect(play).toBeVisible(); await play.click();
        const player = person.page.getByLabel(`Video: ${video}`, { exact: true });
        await expect(player).toBeVisible(); await expect(player).toHaveAttribute('controls', '');
        await expect.poll(() => player.evaluate(media => media.videoWidth)).toBe(640);
        await expect.poll(() => player.evaluate(media => media.currentTime)).toBeGreaterThan(0.05);
        await player.evaluate(media => { media.pause(); media.currentTime = 0.2; });
      }
      const downloadPromise = recipient.page.waitForEvent('download');
      await recipient.page.getByRole('button', { name: `Download ${video}`, exact: true }).click();
      expect((await downloadPromise).suggestedFilename()).toBe(video);
      await recipient.page.screenshot({ path: `test-results/calls/chat-media-${suffix}-recipient.png` });
      expect(await recipient.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await recipient.page.reload();
      await expect(recipient.page.getByRole('button', { name: `Play video ${video}`, exact: true })).toBeVisible();
      const photoAfterReload = recipient.page.getByRole('button', { name: `View photo ${photo}`, exact: true });
      await photoAfterReload.scrollIntoViewIfNeeded(); await expect(photoAfterReload).toBeVisible();
      expect(sender.errors).toEqual([]); expect(recipient.errors).toEqual([]);
    } finally { await sender.context.close(); await recipient.context.close(); }
  });
}

test('failed previews can retry and documents retain a private download', async ({ browser, request }) => {
  const person = await account(browser, request, 0, true);
  try {
    const fixture = await fixtures(person.page); let failed = false;
    await person.context.route('**/attachment?preview=1', async route => {
      if (route.request().method() === 'OPTIONS') return route.continue();
      if (!failed) { failed = true; return route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3110' }, json: { message: 'Temporary test failure' } }); }
      return route.continue();
    });
    await sendFile(person.page, 'retry-photo.png', 'image/png', Buffer.from(fixture.image, 'base64'));
    const card = person.page.getByRole('region', { name: 'Photo attachment: retry-photo.png', exact: true });
    await expect(card.getByText('Unable to preview this media. Retry or download it.', { exact: true })).toBeVisible();
    // Sending keeps the mobile composer focused; retry must work on the first
    // tap while the keyboard/header layout is in that state.
    await expect(person.page.getByRole('textbox', { name: 'Message', exact: true })).toBeFocused();
    await card.getByRole('button', { name: 'Retry preview', exact: true }).tap();
    await expect(card.getByRole('button', { name: 'View photo retry-photo.png', exact: true })).toBeVisible();
    await sendFile(person.page, 'notes.txt', 'text/plain', Buffer.from('Private team notes'));
    const download = person.page.waitForEvent('download');
    await person.page.getByRole('button').filter({ hasText: 'notes.txt' }).click();
    expect((await download).suggestedFilename()).toBe('notes.txt');
    expect(person.errors).toEqual([]);
  } finally { await person.context.close(); }
});
