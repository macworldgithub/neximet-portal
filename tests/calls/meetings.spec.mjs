import { test, expect } from '@playwright/test';
import { callBrowserOptions } from '../../scripts/call-test-media.mjs';
import { readFile } from 'node:fs/promises';

test('leadership publishes targeted announcements and recipients receive private inbox updates', async ({ browser, request }) => {
  const ceo = await account(browser, request, 4), bob = await account(browser, request, 1, { width: 390, height: 844 }), outsider = await account(browser, request, 2);
  try {
    await ceo.page.goto('/announcements');
    await ceo.page.getByRole('button', { name: 'New announcement', exact: true }).click();
    const form = ceo.page.getByRole('form', { name: 'Publish announcement' });
    const title = `Release announcement ${Date.now()}`;
    await form.getByLabel('Title', { exact: true }).fill(title);
    await form.getByLabel('Announcement', { exact: true }).fill('Please review the release plan.\n<script>This remains plain text.</script>');
    await form.getByRole('combobox', { name: 'Audience', exact: true }).selectOption('users');
    await form.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('important');
    await form.getByRole('button', { name: 'Add recipient', exact: true }).click();
    await form.getByRole('button', { name: 'Add Sam Rivera', exact: true }).click();
    await form.getByRole('button', { name: 'Publish announcement', exact: true }).click();
    await expect(ceo.page.getByText('Announcement published for 1 person.', { exact: true })).toBeVisible();
    await bob.page.goto('/notifications');
    const notification = bob.page.getByRole('button').filter({ hasText: title });
    await expect(notification).toBeVisible(); await notification.click();
    await expect(bob.page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
    await expect(bob.page.getByRole('button', { name: 'New announcement', exact: true })).toHaveCount(0);
    await expect(bob.page.getByText('<script>This remains plain text.</script>', { exact: false }).first()).toBeVisible();
    await bob.page.screenshot({ path: 'test-results/calls/announcements-mobile.png', fullPage: true });
    await outsider.page.goto('/announcements');
    await expect(outsider.page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
    const unauthorized = await request.post(`${api}/announcements`, { headers: { Authorization: `Bearer ${bob.token}` }, data: { title: 'Forged', body: 'No access' } });
    expect(unauthorized.status()).toBe(403);
    await ceo.page.getByRole('button', { name: `Archive ${title}`, exact: true }).click();
    await expect(ceo.page.getByText('Announcement archived.', { exact: true })).toBeVisible();
    await bob.page.goto('/notifications');
    await expect(bob.page.getByRole('button').filter({ hasText: title })).toHaveCount(0);
    expect(ceo.errors).toEqual([]); expect(bob.errors).toEqual([]); expect(outsider.errors).toEqual([]);
  } finally { await ceo.close(); await bob.close(); await outsider.close(); }
});

const api = 'http://127.0.0.1:4012/api';
async function account(browser, request, index, viewport, userAgent) {
  const result = await (await request.post(`${api}/auth/login`, { data: { email: `chat-qa-${index}@example.test`, password: 'chat-qa-only' } })).json();
  // Independent browser processes give each synthetic participant its own
  // capture device, matching calls between separate computers.
  const instance = await browser.browserType().launch(callBrowserOptions);
  const context = await instance.newContext({ permissions: ['camera', 'microphone'], ...(viewport ? { viewport, isMobile: true, hasTouch: true } : {}), ...(userAgent ? { userAgent } : {}) });
  await context.addInitScript(token => localStorage.setItem('neximet_token', token), result.token);
  await context.addInitScript(() => {
    const nativeStop = MediaStreamTrack.prototype.stop;
    window.__stops = [];
    MediaStreamTrack.prototype.stop = function () { window.__stops.push({ kind: this.kind, stack: new Error().stack }); return nativeStop.call(this); };
    const NativePeer = window.RTCPeerConnection;
    window.__peers = [];
    window.RTCPeerConnection = class extends NativePeer {
      constructor(...args) { super(...args); window.__peers.push(this); }
    };
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const chats = await (await request.get(`${api}/chat/conversations`, { headers: { Authorization: `Bearer ${result.token}` } })).json();
  return { context, page, token: result.token, user: result.user, chats: chats.conversations, errors, close: () => instance.close() };
}
async function connected(page) { await expect(page.getByText('● Calling service ready')).toBeVisible({ timeout: 45000 }); }
async function join(page) {
  await connected(page);
  await page.getByRole('button', { name: 'Start or join video call', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeVisible();
}
async function diagnose(person) {
  if (person.page.isClosed()) return;
  console.log(JSON.stringify(await person.page.evaluate(async () => ({
    alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent),
    errors: window.__audioAttempts, blocked: window.__blockCallAudio,
    audio: [...document.querySelectorAll('audio')].map(audio => ({ name: audio.dataset.callAudioFor, paused: audio.paused, state: audio.readyState, error: audio.error?.message, tracks: audio.srcObject?.getTracks().map(track => ({ kind: track.kind, muted: track.muted, state: track.readyState })) })),
    stops: window.__stops,
    videos: [...document.querySelectorAll('video')].map(video => ({ name: video.getAttribute('aria-label'), width: video.videoWidth,
      tracks: video.srcObject?.getTracks().map(track => ({ kind: track.kind, enabled: track.enabled, muted: track.muted, state: track.readyState })) })),
    peers: await Promise.all((window.__peers || []).map(async pc => ({ connection: pc.connectionState, signal: pc.signalingState,
      slots: pc.getTransceivers().map(slot => ({ mid: slot.mid, direction: slot.currentDirection, sender: slot.sender.track && { kind: slot.sender.track.kind, state: slot.sender.track.readyState, enabled: slot.sender.track.enabled }, receiver: slot.receiver.track.kind })),
      stats: [...(await pc.getStats()).values()].filter(stat => ['inbound-rtp', 'outbound-rtp'].includes(stat.type)).map(stat => ({ type: stat.type, kind: stat.kind, frames: stat.framesEncoded || stat.framesDecoded, bytes: stat.bytesSent || stat.bytesReceived })) }))),
  }))));
}

async function monitorSound(page, name) {
  const element = page.locator(`audio[data-call-audio-for="${name}"]`);
  await expect.poll(() => element.evaluate(media => media.srcObject?.getAudioTracks().length || 0)).toBe(1);
  await element.evaluate(async media => {
    const context = new AudioContext(), source = context.createMediaStreamSource(media.srcObject);
    const analyser = context.createAnalyser(); analyser.fftSize = 1024;
    const silentOutput = context.createGain(); silentOutput.gain.value = 0;
    source.connect(analyser); analyser.connect(silentOutput); silentOutput.connect(context.destination);
    await context.resume(); window.__soundProbe = { context, analyser };
  });
  return element;
}
const soundLevel = page => page.evaluate(() => {
  const analyser = window.__soundProbe.analyser, values = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(values);
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
});

test('voice-only audio plays both ways before camera starts and survives toggles, mute, and minimize', async ({ browser, request }) => {
  const alice = await account(browser, request, 0), bob = await account(browser, request, 1, { width: 390, height: 844 });
  try {
    const direct = alice.chats.find(chat => chat.kind === 'direct');
    for (const person of [alice, bob]) {
      await person.page.goto(`/meet?conversation=${direct._id}&mode=audio`); await connected(person.page);
      await person.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
      await expect(person.page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeVisible();
    }
    const aliceOutput = await monitorSound(alice.page, 'Sam Rivera'), bobOutput = await monitorSound(bob.page, 'Alex Morgan');
    for (const person of [alice, bob]) await expect.poll(() => soundLevel(person.page), { timeout: 15000 }).toBeGreaterThan(0.01);
    for (const element of [aliceOutput, bobOutput]) expect(await element.evaluate(media => !media.paused && !media.muted && media.volume > 0)).toBe(true);
    await aliceOutput.evaluate(media => { window.__audioResetCount = 0; media.addEventListener('emptied', () => window.__audioResetCount++); });
    for (const person of [alice, bob]) {
      await person.page.getByRole('button', { name: 'Turn camera on', exact: true }).click();
      await expect(person.page.getByRole('button', { name: 'Turn camera off', exact: true })).toBeVisible();
    }
    for (const person of [alice, bob]) await expect.poll(() => soundLevel(person.page)).toBeGreaterThan(0.01);
    for (const person of [alice, bob]) await person.page.getByRole('button', { name: 'Turn camera off', exact: true }).click();
    await bob.page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    await expect.poll(() => soundLevel(alice.page)).toBeLessThan(0.001);
    await bob.page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
    await expect.poll(() => soundLevel(alice.page)).toBeGreaterThan(0.01);
    await bob.page.locator('video[aria-label="Sam Rivera (you)"]').evaluate(video => {
      const microphone = video.srcObject.getAudioTracks()[0]; microphone.stop(); microphone.dispatchEvent(new Event('ended'));
    });
    await expect(bob.page.getByRole('button', { name: 'Unmute microphone', exact: true })).toBeVisible();
    await expect.poll(() => soundLevel(alice.page)).toBeLessThan(0.001);
    await bob.page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
    await expect.poll(() => soundLevel(alice.page)).toBeGreaterThan(0.01);
    await bob.page.getByRole('button', { name: 'Raise hand', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Minimize meeting', exact: true }).click();
    await alice.page.getByRole('link', { name: 'Chat', exact: true }).click();
    await expect.poll(() => soundLevel(alice.page)).toBeGreaterThan(0.01);
    expect(await aliceOutput.evaluate(media => !media.paused && !media.muted)).toBe(true);
    expect(await alice.page.evaluate(() => window.__audioResetCount)).toBe(0);
    expect(alice.errors).toEqual([]); expect(bob.errors).toEqual([]);
  } catch (error) { await diagnose(alice); await diagnose(bob); throw error; }
  finally { await alice.close(); await bob.close(); }
});

test('blocked incoming sound has an explicit working enable-audio control', async ({ browser, request }) => {
  const alice = await account(browser, request, 0), bob = await account(browser, request, 1);
  try {
    await bob.context.addInitScript(() => {
      const nativePlay = HTMLMediaElement.prototype.play; window.__blockCallAudio = true; window.__audioAttempts = [];
      HTMLMediaElement.prototype.play = function () {
        if (this.tagName === 'AUDIO') window.__audioAttempts.push({ block: window.__blockCallAudio, gesture: navigator.userActivation.isActive });
        if (this.tagName === 'AUDIO' && this.dataset.callAudioFor && window.__blockCallAudio) return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
        return nativePlay.call(this);
      };
    });
    const direct = alice.chats.find(chat => chat.kind === 'direct');
    for (const person of [alice, bob]) {
      await person.page.goto(`/meet?conversation=${direct._id}&mode=audio`); await connected(person.page);
      await person.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    }
    const enable = bob.page.getByRole('button', { name: 'Enable audio from Alex Morgan', exact: true });
    await expect(enable).toBeVisible();
    await enable.evaluate(button => button.addEventListener('click', () => { window.__blockCallAudio = false; }, { capture: true, once: true }));
    await enable.click();
    try { await expect(enable).toBeHidden(); } catch (error) { await diagnose(bob); console.log('Audio page errors:', bob.errors); throw error; }
    const output = await monitorSound(bob.page, 'Alex Morgan');
    expect(await output.evaluate(audio => !audio.paused && !audio.muted)).toBe(true);
    await expect.poll(() => soundLevel(bob.page)).toBeGreaterThan(0.01);
  } finally { await alice.close(); await bob.close(); }
});

test('calendar scheduling, RSVP, calendar export, scheduled join and persistent history', async ({ browser, request }) => {
  const alice = await account(browser, request, 0), bob = await account(browser, request, 1, { width: 390, height: 844 });
  try {
    await alice.page.goto('/meet?view=calendar');
    await alice.page.getByRole('button', { name: 'Schedule meeting', exact: true }).click();
    const form = alice.page.getByRole('dialog', { name: 'Schedule meeting', exact: true });
    await form.getByLabel('Title', { exact: true }).fill('Release planning');
    await form.getByRole('button', { name: 'Add participant', exact: true }).click();
    await form.getByRole('button', { name: 'Add Sam Rivera', exact: true }).click();
    await form.getByRole('button', { name: 'Add Jordan Lee', exact: true }).click();
    const local = minutes => new Date(Date.now() + minutes * 60000).toLocaleString('sv-SE', { timeZone: 'Asia/Karachi' }).slice(0, 16).replace(' ', 'T');
    await form.getByLabel('Starts', { exact: true }).fill(local(10)); await form.getByLabel('Ends', { exact: true }).fill(local(40));
    await form.getByLabel('Call type').selectOption('audio');
    await form.getByRole('button', { name: 'Schedule meeting', exact: true }).click(); await expect(form).toBeHidden();
    await expect(alice.page.getByText('Release planning', { exact: true }).first()).toBeVisible();
    await alice.page.screenshot({ path: 'test-results/calls/calendar.png' });
    await bob.page.goto('/meet?view=calendar');
    await bob.page.getByRole('button', { name: /Release planning/ }).first().click();
    let detail = bob.page.getByRole('dialog', { name: 'Release planning', exact: true });
    await detail.getByRole('button', { name: 'accepted', exact: true }).click();
    await expect(detail.getByRole('button', { name: 'accepted', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(detail.getByRole('button', { name: 'Edit meeting', exact: true })).toBeHidden();
    const downloaded = bob.page.waitForEvent('download'); await detail.getByRole('button', { name: 'Add to calendar', exact: true }).click();
    const ics = await readFile(await (await downloaded).path(), 'utf8'); expect(ics).toContain('SUMMARY:Release planning'); expect(ics).toContain('BEGIN:VEVENT');
    await bob.page.getByRole('button', { name: 'Close meeting dialog' }).click();
    await alice.page.getByRole('button', { name: /Release planning/ }).first().click();
    await alice.page.getByRole('button', { name: 'Edit meeting', exact: true }).click();
    await alice.page.getByLabel('Title', { exact: true }).fill('Final release planning');
    await alice.page.getByRole('button', { name: 'Remove Jordan Lee', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Save changes', exact: true }).click();
    for (const person of [alice, bob]) {
      await person.page.goto('/meet?view=calendar'); await person.page.getByRole('button', { name: /Final release planning/ }).first().click();
      await person.page.getByRole('link', { name: 'Join meeting', exact: true }).click(); await connected(person.page);
      await expect(person.page.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible();
      await person.page.getByRole('button', { name: 'Join meeting', exact: true }).click();
      await expect(person.page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeVisible();
    }
    await bob.page.getByRole('button', { name: 'Minimize meeting', exact: true }).click();
    await bob.page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(bob.page.getByRole('button', { name: /Final release planning/ }).getByText('in progress', { exact: true })).toBeVisible();
    await alice.page.getByRole('button', { name: 'End for all', exact: true }).click();
    await expect(bob.page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeHidden();
    await bob.page.getByRole('button', { name: /Final release planning/ }).click();
    await expect(bob.page.getByRole('button', { name: /Final release planning/ }).getByText('attended', { exact: true })).toBeVisible();
    await expect(bob.page.getByText(/Invited:.*Alex Morgan.*Sam Rivera/)).toBeVisible();
    await bob.page.reload(); await expect(bob.page.getByText('Final release planning', { exact: true })).toBeVisible();
    await bob.page.getByRole('button', { name: 'History', exact: true }).click();
    await bob.page.getByLabel('Search meeting history', { exact: true }).fill('Final release');
    await expect(bob.page.getByText('Team call', { exact: true })).toHaveCount(0);
    await bob.page.screenshot({ path: 'test-results/calls/history-mobile.png' });
    expect(await bob.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(alice.errors).toEqual([]); expect(bob.errors).toEqual([]);
  } catch (error) { await diagnose(alice); await diagnose(bob); throw error; }
  finally { await alice.close(); await bob.close(); }
});

test('real two-browser voice/video, presentation, controls, navigation and host end', async ({ browser, request }) => {
  const alice = await account(browser, request, 0);
  const bob = await account(browser, request, 1);
  try {
    const direct = alice.chats.find(chat => chat.kind === 'direct');
    await Promise.all([alice.page.goto(`/meet?conversation=${direct._id}`), bob.page.goto('/chat')]);
    await connected(alice.page);
    await alice.page.getByRole('button', { name: 'Check microphone & camera' }).click();
    await expect(alice.page.getByText('Preview is private. You have not joined the meeting.')).toBeVisible();
    await join(alice.page);
    await expect(bob.page.getByRole('dialog', { name: 'Incoming video call' })).toBeVisible();
    await bob.page.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(alice.page.getByText('2 / 8 participants', { exact: false })).toBeVisible();
    await expect.poll(() => bob.page.locator('video[aria-label="Alex Morgan"]').evaluate(video => video.videoWidth), { timeout: 30000 }).toBeGreaterThan(0);
    expect(await bob.page.locator('video[aria-label="Alex Morgan"]').evaluate(video => video.srcObject?.getTracks().map(track => track.kind))).toEqual(['video']);
    expect(await bob.page.locator('audio[data-call-audio-for="Alex Morgan"]').evaluate(audio => audio.srcObject?.getTracks().map(track => track.kind))).toEqual(['audio']);
    await alice.page.locator('video[aria-label="Alex Morgan (you)"]').evaluate(video => { window.__localStream = video.srcObject; });
    await bob.page.locator('video[aria-label="Sam Rivera (you)"]').evaluate(video => { window.__localStream = video.srcObject; });
    await bob.page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    await expect(bob.page.getByRole('button', { name: 'Unmute microphone', exact: true })).toBeVisible();
    await bob.page.getByRole('button', { name: 'Turn camera off', exact: true }).click();
    await expect(bob.page.getByRole('button', { name: 'Turn camera on', exact: true })).toBeVisible();
    await bob.page.getByRole('button', { name: 'Turn camera on', exact: true }).click();
    await expect(bob.page.getByRole('button', { name: 'Turn camera off', exact: true })).toBeVisible();
    await expect.poll(() => alice.page.locator('video[aria-label="Sam Rivera"]').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
    await bob.page.getByRole('button', { name: 'Raise hand', exact: true }).click();
    await expect(bob.page.getByRole('button', { name: 'Lower hand', exact: true })).toBeVisible();

    // Supply a synthetic display stream; the real browser capture chooser
    // requires a human. All subsequent RTP signaling and rendering is real.
    await alice.page.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
        const context = canvas.getContext('2d'); context.fillStyle = '#5470f4'; context.fillRect(0, 0, 960, 540);
        window.__testPaint = setInterval(() => { context.fillStyle = '#5470f4'; context.fillRect(0, 0, 960, 540); context.fillStyle = '#ffffff'; context.fillText(String(Date.now()), 20, 20); }, 100);
        const stream = canvas.captureStream(10); window.__testDisplay = stream;
        return stream;
      };
    });
    await alice.page.getByRole('button', { name: 'Share screen', exact: true }).click();
    await expect(bob.page.getByText('Alex Morgan is presenting', { exact: true })).toBeVisible();
    await expect.poll(() => bob.page.locator('video[aria-label="Alex Morgan is presenting"]').evaluate(video => {
      if (!video.videoWidth) return false;
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext('2d'); context.drawImage(video, 0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return Math.abs(r - 84) < 12 && Math.abs(g - 112) < 12 && Math.abs(b - 244) < 12;
    }), { timeout: 30000 }).toBe(true);
    await expect.poll(() => bob.page.locator('video[aria-label="Alex Morgan"]').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
    await bob.page.getByRole('button', { name: 'Focus presentation by Alex Morgan', exact: true }).click();
    await expect(bob.page.getByTestId('participant-gallery')).toBeHidden();
    await expect(bob.page.getByRole('button', { name: 'Back to gallery', exact: true })).toBeVisible();
    expect(await bob.page.locator('video[aria-label="Alex Morgan is presenting"]').evaluate(video => { const box = video.getBoundingClientRect(); return box.height > innerHeight * 0.6 && box.width > innerWidth * 0.7; })).toBe(true);
    await bob.page.screenshot({ path: 'test-results/calls/focused-screen.png' });
    await bob.page.getByRole('button', { name: 'Back to gallery', exact: true }).click();
    await expect(bob.page.getByTestId('participant-gallery')).toBeVisible();
    await bob.page.getByRole('button', { name: 'Focus presentation by Alex Morgan', exact: true }).click();
    await alice.page.evaluate(() => { clearInterval(window.__testPaint); window.__testDisplay.getVideoTracks()[0].dispatchEvent(new Event('ended')); });
    await expect(bob.page.getByText('Alex Morgan is presenting', { exact: true })).toBeHidden();
    await expect(bob.page.getByTestId('participant-gallery')).toBeVisible();
    await bob.page.getByRole('button', { name: 'Minimize meeting', exact: true }).click();
    await bob.page.getByRole('link', { name: 'Chat', exact: true }).click();
    await expect(bob.page.getByRole('button', { name: /Return to call/ })).toBeVisible();
    await bob.page.getByRole('button', { name: /Return to call/ }).click();
    await expect(bob.page.getByRole('button', { name: 'End for all', exact: true })).toBeHidden();
    await alice.page.getByRole('button', { name: 'End for all', exact: true }).click();
    await expect(bob.page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeHidden();
    await expect(bob.page.getByText('The host ended the meeting.')).toBeVisible();
    for (const person of [alice, bob]) {
      expect(await person.page.evaluate(() => window.__localStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
      expect(person.errors).toEqual([]);
    }
  } catch (error) { await diagnose(alice); await diagnose(bob); throw error; }
  finally { await alice.close(); await bob.close(); }
});

test('mobile lobby supports voice-only calls and permission errors', async ({ browser, request }) => {
  const alice = await account(browser, request, 0, { width: 390, height: 844 });
  try {
    const direct = alice.chats.find(chat => chat.kind === 'direct');
    await alice.page.goto(`/meet?conversation=${direct._id}&mode=audio`);
    await connected(alice.page);
    await expect(alice.page.getByRole('button', { name: 'Camera off', exact: true })).toBeVisible();
    await alice.page.evaluate(() => { window.__originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
    await alice.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    await expect(alice.page.getByText(/Permission was denied/)).toBeVisible();
    await alice.page.getByRole('button', { name: 'Dismiss call notification' }).click();
    await alice.page.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__originalGetUserMedia; });
    await connected(alice.page);
    await alice.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    await expect(alice.page.getByRole('button', { name: 'Turn camera on', exact: true })).toBeVisible();
    await alice.page.locator('video[aria-label="Alex Morgan (you)"]').evaluate(video => { window.__localStream = video.srcObject; });
    expect(await alice.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await alice.page.getByRole('button', { name: 'Leave call', exact: true }).click();
    await expect(alice.page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeHidden();
    expect(await alice.page.evaluate(() => window.__localStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
    expect(alice.errors).toEqual([]);
  } finally { await alice.close(); }
});

test('all-user selection starts a multi-invite voice meeting and adds people during the call', async ({ browser, request }) => {
  const alice = await account(browser, request, 0), bob = await account(browser, request, 1), maya = await account(browser, request, 3, { width: 390, height: 844 });
  try {
    expect(maya.chats).toEqual([]);
    await Promise.all([alice.page.goto('/meet'), bob.page.goto('/chat'), maya.page.goto('/meet')]);
    await connected(alice.page);
    await alice.page.getByLabel('Meeting title', { exact: true }).fill('Cross-team voice meeting');
    await alice.page.getByRole('button', { name: 'Add participant', exact: true }).click();
    await alice.page.getByLabel('Search all users', { exact: true }).fill('Maya');
    await alice.page.getByRole('button', { name: 'Add Maya Patel', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Add Jordan Lee', exact: true }).click();
    await expect(alice.page.getByText('2 selected', { exact: true })).toBeVisible();
    await alice.page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Add participant', exact: true }).click();
    await alice.page.locator('h1').scrollIntoViewIfNeeded();
    await alice.page.screenshot({ path: 'test-results/calls/meet-home.png' });
    await alice.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    await expect(maya.page.getByRole('dialog', { name: 'Incoming voice call' })).toBeVisible();
    await maya.page.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(maya.page.getByRole('button', { name: 'Turn camera on', exact: true })).toBeVisible();
    await alice.page.getByRole('button', { name: 'Show participants', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Add participant', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Add Sam Rivera', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Send invitations', exact: true }).click();
    await expect(bob.page.getByRole('dialog', { name: 'Incoming voice call' })).toBeVisible();
    await bob.page.getByRole('button', { name: 'Answer', exact: true }).click();
    for (const person of [alice, bob, maya]) await expect(person.page.getByText('3 / 8 participants', { exact: false })).toBeVisible();
    await monitorSound(maya.page, 'Alex Morgan'); await expect.poll(() => soundLevel(maya.page)).toBeGreaterThan(0.01);
    expect(await maya.page.locator('video[aria-label="Maya Patel (you)"]').evaluate(video => video.srcObject.getVideoTracks().length)).toBe(0);
    expect(await maya.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await maya.page.screenshot({ path: 'test-results/calls/voice-mobile.png' });
    await alice.page.getByRole('button', { name: 'End for all', exact: true }).click();
    await maya.page.goto('/meet?view=history');
    await expect(maya.page.getByText('Cross-team voice meeting', { exact: true })).toBeVisible();
    await expect(maya.page.getByText('attended', { exact: true })).toBeVisible();
    for (const person of [alice, bob, maya]) expect(person.errors).toEqual([]);
  } catch (error) { for (const person of [alice, bob, maya]) await diagnose(person); throw error; }
  finally { await alice.close(); await bob.close(); await maya.close(); }
});

test('incoming ringtone respects mute, stops on decline and answer, and recovers after a fresh launch', async ({ browser, request }) => {
  const alice = await account(browser, request, 0), bob = await account(browser, request, 1);
  try {
    await bob.context.addInitScript(() => {
      window.__ringStarts = 0; window.__ringActive = 0; window.__micRequests = 0;
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) {
        window.__ringStarts++; window.__ringActive++;
        this.addEventListener('ended', () => window.__ringActive--, { once: true });
        return start.apply(this, args);
      };
      const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (...args) => { window.__micRequests++; return capture(...args); };
    });
    const direct = alice.chats.find(chat => chat.kind === 'direct');
    await Promise.all([alice.page.goto(`/meet?conversation=${direct._id}&mode=audio`), bob.page.goto('/meet')]);
    await connected(alice.page); await connected(bob.page);
    await bob.page.getByRole('button', { name: 'Ringing on', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    await expect(bob.page.getByRole('dialog', { name: 'Incoming voice call' })).toBeVisible();
    expect(await bob.page.evaluate(() => window.__ringStarts)).toBe(0);
    await bob.page.getByRole('button', { name: 'Ringing off', exact: true }).click();
    await expect.poll(() => bob.page.evaluate(() => window.__ringStarts)).toBeGreaterThan(0);
    expect(await bob.page.evaluate(() => window.__micRequests)).toBe(0);
    await bob.page.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect.poll(() => bob.page.evaluate(() => window.__ringActive)).toBe(0);
    const stopped = await bob.page.evaluate(() => window.__ringStarts);
    await bob.page.waitForTimeout(3200);
    expect(await bob.page.evaluate(() => window.__ringStarts)).toBe(stopped);
    await expect(alice.page.getByText('The call was declined.', { exact: true })).toBeVisible();
    await bob.page.reload(); await connected(bob.page);
    await alice.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    await expect(bob.page.getByRole('button', { name: 'Enable ringtone', exact: true })).toBeVisible();
    await bob.page.getByRole('button', { name: 'Enable ringtone', exact: true }).click();
    await expect.poll(() => bob.page.evaluate(() => window.__ringStarts)).toBeGreaterThan(0);
    const history = await (await request.get(`${api}/meetings/history`, { headers: { Authorization: `Bearer ${bob.token}` } })).json();
    const ringing = history.history.find(item => !item.endedAt && item.conversation === direct._id);
    const answerLink = `/meet?conversation=${direct._id}&call=${ringing.callId}&mode=audio`, bobId = bob.user.id;
    // The PWA's native Answer action sends this message to the existing app.
    await bob.page.evaluate(({ answerLink, bobId }) => {
      const url = new URL(answerLink, location.origin);
      navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'OPEN_MEETING_NOTIFICATION', userId: bobId, callId: url.searchParams.get('call'), url: url.href } }));
    }, { answerLink, bobId });
    await expect.poll(() => bob.page.evaluate(() => window.__ringActive)).toBe(0);
    await expect(bob.page.getByRole('dialog', { name: 'Incoming voice call' })).toBeHidden();
    await expect(bob.page.getByRole('button', { name: 'Join meeting', exact: true })).toBeVisible();
    await alice.page.getByRole('button', { name: 'End for all', exact: true }).click();
    expect(alice.errors).toEqual([]); expect(bob.errors).toEqual([]);
  } finally { await alice.close(); await bob.close(); }
});

test('phone-like calling requires an invitee, rings before answer, and answers with one tap', async ({ browser, request }) => {
  const alice = await account(browser, request, 0), bob = await account(browser, request, 1, { width: 390, height: 844 });
  try {
    await Promise.all([alice.page.goto('/meet'), bob.page.goto('/meet')]);
    await connected(alice.page); await connected(bob.page);
    await bob.page.setViewportSize({ width: 412, height: 844 });
    expect(await bob.page.locator('nav[aria-label="Communication"]').evaluate(nav => nav.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await bob.page.setViewportSize({ width: 390, height: 844 });
    const start = alice.page.getByRole('button', { name: 'Start or join video call', exact: true });
    await expect(start).toBeDisabled();
    await expect(alice.page.getByText('Add at least one participant to start a call.', { exact: true })).toBeVisible();
    expect(await alice.page.locator('nav[aria-label="Meetings workspace"]').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(17, 24, 39)');
    await alice.page.getByRole('button', { name: 'Add participant', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Add Sam Rivera', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Voice call', exact: true }).click();
    await alice.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    await expect(alice.page.getByRole('region', { name: 'Outgoing call' })).toBeVisible();
    await expect(alice.page.getByText('Calling Sam Rivera', { exact: true })).toBeVisible();
    await expect(alice.page.getByTestId('participant-gallery')).toBeHidden();
    await alice.page.screenshot({ path: 'test-results/calls/outgoing-call.png' });
    const incoming = bob.page.getByRole('dialog', { name: 'Incoming voice call' });
    await expect(incoming).toBeVisible();
    expect(await incoming.getAttribute('aria-modal')).toBe('true');
    const bounds = await incoming.boundingBox(); expect(bounds.width).toBe(390); expect(bounds.height).toBe(844);
    await bob.page.screenshot({ path: 'test-results/calls/incoming-call-mobile.png' });
    await bob.page.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(bob.page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeVisible();
    await expect(alice.page.getByRole('region', { name: 'Outgoing call' })).toBeHidden();
    await monitorSound(alice.page, 'Sam Rivera'); await expect.poll(() => soundLevel(alice.page)).toBeGreaterThan(0.01);
    await bob.page.getByRole('button', { name: 'Leave call', exact: true }).click();
    await expect(alice.page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeHidden();
    await expect(alice.page.getByText('The other person left the call.', { exact: true })).toBeVisible();
    expect(alice.errors).toEqual([]); expect(bob.errors).toEqual([]);
  } finally { await alice.close(); await bob.close(); }
});

test('phone screen sharing uses available capture support and unsupported phones keep receiving audio', async ({ browser, request }) => {
  const alice = await account(browser, request, 0);
  const phone = await account(browser, request, 1, { width: 390, height: 844 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile Safari/604.1');
  try {
    const direct = alice.chats.find(chat => chat.kind === 'direct');
    await phone.context.addInitScript(() => { Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: undefined }); });
    await Promise.all([alice.page.goto(`/meet?conversation=${direct._id}&mode=audio`), phone.page.goto('/meet')]);
    await connected(alice.page); await alice.page.getByRole('button', { name: 'Start or join voice call', exact: true }).click();
    await phone.page.getByRole('button', { name: 'Answer', exact: true }).click();
    await phone.page.getByRole('button', { name: 'Share screen', exact: true }).click();
    await expect(phone.page.getByText(/This browser cannot broadcast your phone’s screen/)).toBeVisible();
    await monitorSound(phone.page, 'Alex Morgan'); await expect.poll(() => soundLevel(phone.page)).toBeGreaterThan(0.01);
    await phone.page.getByRole('button', { name: 'Close screen sharing help' }).click();
    // Simulate a mobile browser's OS capture result. RTP and rendering remain real.
    await phone.page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: async () => {
        const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 844;
        const draw = () => { const ctx = canvas.getContext('2d'); ctx.fillStyle = '#16a34a'; ctx.fillRect(0, 0, 390, 844); };
        draw(); window.__mobilePaint = setInterval(draw, 100); return canvas.captureStream(10);
      } });
    });
    await phone.page.getByRole('button', { name: 'Raise hand', exact: true }).click();
    await expect(phone.page.getByRole('button', { name: 'Lower hand', exact: true })).toBeVisible();
    await phone.page.getByRole('button', { name: 'Share screen', exact: true }).click();
    await expect.poll(() => alice.page.locator('video[aria-label="Sam Rivera is presenting"]').evaluate(video => video.videoWidth), { timeout: 15000 }).toBeGreaterThan(0);
    await alice.page.getByRole('button', { name: 'Focus presentation by Sam Rivera', exact: true }).click();
    await expect(alice.page.getByTestId('participant-gallery')).toBeHidden();
    await phone.page.getByRole('button', { name: 'Stop presenting', exact: true }).click();
    await expect(alice.page.getByTestId('participant-gallery')).toBeVisible();
    await phone.page.evaluate(() => clearInterval(window.__mobilePaint));
    await alice.page.getByRole('button', { name: 'End for all', exact: true }).click();
    expect(alice.errors).toEqual([]); expect(phone.errors).toEqual([]);
  } finally { await alice.close(); await phone.close(); }
});

test('three-person group media connects every peer and host handoff survives a closed tab', async ({ browser, request }) => {
  const people = await Promise.all([0, 1, 2].map(index => account(browser, request, index)));
  try {
    const group = people[0].chats.find(chat => chat.kind === 'group');
    for (const person of people) { await person.page.goto(`/meet?conversation=${group._id}`); await join(person.page); }
    for (const person of people) {
      await expect(person.page.getByText('3 / 8 participants', { exact: false })).toBeVisible();
      await expect.poll(() => person.page.locator('div[role="dialog"][aria-label="Meeting"] video').evaluateAll(videos => videos.filter(video => !video.getAttribute('aria-label').endsWith(' (you)') && video.videoWidth > 0).length), { timeout: 30000 }).toBe(2);
      expect(person.errors).toEqual([]);
    }
    await people[0].page.screenshot({ path: 'test-results/calls/group-meeting.png' });
    await people[0].close();
    await expect(people[1].page.getByRole('button', { name: 'End for all', exact: true })).toBeVisible();
    await expect(people[1].page.getByText('2 / 8 participants', { exact: false })).toBeVisible();
    await people[1].page.getByRole('button', { name: 'End for all', exact: true }).click();
    await expect(people[2].page.getByText('The host ended the meeting.')).toBeVisible();
  } catch (error) { for (const person of people) await diagnose(person); throw error; }
  finally { for (const person of people) await person.close(); }
});
