import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/lib/push.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function device({ permission = 'default', denyServer = false, permissionPromise, optedOut = false } = {}) {
  const userId = 'a'.repeat(24), tokenFor = id => `header.${Buffer.from(JSON.stringify({ id })).toString('base64url')}.signature`;
  let token = tokenFor(userId), subscribed = false;
  const calls = { permission: 0, subscriptions: 0, unsubscribed: 0, bound: [], registered: 0 };
  const subscription = { options: {}, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fixture' }), unsubscribe: async () => { calls.unsubscribed++; subscribed = false; return true; } };
  const registration = { active: { postMessage: data => calls.bound.push(data) }, waiting: { postMessage: () => { throw Error('Notification permission must not activate an app update'); } }, pushManager: { getSubscription: async () => subscribed ? subscription : null, subscribe: async () => { calls.subscriptions++; subscribed = true; return subscription; } } };
  const notification = { permission, requestPermission: async () => { calls.permission++; return permissionPromise || 'granted'; } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: () => ({ API_URL: 'https://api.example.test/api', getToken: () => token, apiPost: async () => ({ success: !denyServer }), apiFetch: async () => ({ success: true }) }),
    window: { isSecureContext: true, Notification: notification, PushManager: function () {} }, navigator: { serviceWorker: { getRegistration: async () => registration, register: async () => { calls.registered++; return registration; }, ready: Promise.resolve(registration) } },
    Notification: notification, localStorage: { getItem: () => optedOut ? 'off' : null }, atob, btoa, Uint8Array, setTimeout, clearTimeout, AbortSignal,
  });
  return { api: module.exports, calls, userId, key: Buffer.from([4, ...Array(64).fill(1)]).toString('base64url'), switchAccount: () => { token = tokenFor('b'.repeat(24)); } };
}
test('app-wide permission creates a subscription without activating a waiting deployment', async () => {
  const h = device(); await h.api.enablePush(h.userId, h.key); assert.equal(h.calls.permission, 1); assert.equal(h.calls.subscriptions, 1); assert.equal(h.calls.bound.at(-1).userId, h.userId);
});
test('already-approved devices recover their subscription without another permission dialog', async () => {
  const h = device({ permission: 'granted' }); await h.api.enablePush(h.userId, h.key); assert.equal(h.calls.permission, 0); assert.equal(h.calls.subscriptions, 1);
});
test('failed server registration unsubscribes and cannot falsely report successful permission setup', async () => {
  const h = device({ denyServer: true }); await assert.rejects(h.api.enablePush(h.userId, h.key), /Unable to register/); assert.equal(h.calls.unsubscribed, 1); assert.equal(h.calls.bound.length, 0);
});
test('an account switch during the native permission dialog cannot register the previous user', async () => {
  let resolve; const permissionPromise = new Promise(done => { resolve = done; }); const h = device({ permissionPromise });
  const enabling = h.api.enablePush(h.userId, h.key); h.switchAccount(); resolve('granted');
  await assert.rejects(enabling, /account changed/); assert.equal(h.calls.registered, 0); assert.equal(h.calls.bound.length, 0);
});
test('chat reconnect cannot rebind a device that was turned off in app-wide settings', async () => {
  const h = device({ permission: 'granted', optedOut: true }); await h.api.bindPushAccount(h.userId); assert.equal(h.calls.bound.length, 0); assert.equal(h.calls.subscriptions, 0);
});
