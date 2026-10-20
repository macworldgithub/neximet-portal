import { test, expect } from '@playwright/test';
import { callBrowserOptions } from '../../scripts/call-test-media.mjs';

const api = 'http://127.0.0.1:4012/api';
async function account(browser, request, index, viewport) {
  const result = await (await request.post(`${api}/auth/login`, { data: { email: `chat-qa-${index}@example.test`, password: 'chat-qa-only' } })).json();
  // Independent browser processes give each synthetic participant its own
  // capture device, matching calls between separate computers.
  const instance = await browser.browserType().launch(callBrowserOptions);
  const context = await instance.newContext({ permissions: ['camera', 'microphone'], ...(viewport ? { viewport } : {}) });
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
  return { context, page, chats: chats.conversations, errors, close: () => instance.close() };
}
async function connected(page) { await expect(page.getByText('● Calling connected')).toBeVisible({ timeout: 45000 }); }
async function join(page) {
  await connected(page);
  await page.getByRole('button', { name: 'Start or join video call', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Meeting', exact: true })).toBeVisible();
}
async function diagnose(person) {
  if (person.page.isClosed()) return;
  console.log(JSON.stringify(await person.page.evaluate(async () => ({
    alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent),
    stops: window.__stops,
    videos: [...document.querySelectorAll('video')].map(video => ({ name: video.getAttribute('aria-label'), width: video.videoWidth,
      tracks: video.srcObject?.getTracks().map(track => ({ kind: track.kind, enabled: track.enabled, muted: track.muted, state: track.readyState })) })),
    peers: await Promise.all((window.__peers || []).map(async pc => ({ connection: pc.connectionState, signal: pc.signalingState,
      slots: pc.getTransceivers().map(slot => ({ mid: slot.mid, direction: slot.currentDirection, sender: slot.sender.track && { kind: slot.sender.track.kind, state: slot.sender.track.readyState, enabled: slot.sender.track.enabled }, receiver: slot.receiver.track.kind })),
      stats: [...(await pc.getStats()).values()].filter(stat => ['inbound-rtp', 'outbound-rtp'].includes(stat.type)).map(stat => ({ type: stat.type, kind: stat.kind, frames: stat.framesEncoded || stat.framesDecoded, bytes: stat.bytesSent || stat.bytesReceived })) }))),
  }))));
}

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
    await bob.page.getByRole('link', { name: 'Answer', exact: true }).click();
    await connected(bob.page);
    await bob.page.getByRole('button', { name: 'Join meeting', exact: true }).click();
    await expect(alice.page.getByText('2 / 8 participants', { exact: false })).toBeVisible();
    await expect.poll(() => bob.page.locator('video[aria-label="Alex Morgan"]').evaluate(video => video.videoWidth), { timeout: 30000 }).toBeGreaterThan(0);
    expect(await bob.page.locator('video[aria-label="Alex Morgan"]').evaluate(video => video.srcObject?.getTracks().map(track => track.kind).sort())).toEqual(['audio', 'video']);
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
    await alice.page.evaluate(() => { clearInterval(window.__testPaint); window.__testDisplay.getVideoTracks()[0].dispatchEvent(new Event('ended')); });
    await expect(bob.page.getByText('Alex Morgan is presenting', { exact: true })).toBeHidden();
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

test('three-person group media connects every peer and host handoff survives a closed tab', async ({ browser, request }) => {
  const people = await Promise.all([0, 1, 2].map(index => account(browser, request, index)));
  try {
    const group = people[0].chats.find(chat => chat.kind === 'group');
    for (const person of people) { await person.page.goto(`/meet?conversation=${group._id}`); await join(person.page); }
    for (const person of people) {
      await expect(person.page.getByText('3 / 8 participants', { exact: false })).toBeVisible();
      await expect.poll(() => person.page.locator('div[role="dialog"][aria-label="Meeting"] video').evaluateAll(videos => videos.filter(video => !video.muted && video.videoWidth > 0).length), { timeout: 30000 }).toBe(2);
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
