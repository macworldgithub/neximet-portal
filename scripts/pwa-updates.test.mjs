import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { generateServiceWorker } from './generate-service-worker.mjs';

const source = ts.transpileModule(readFileSync(new URL('../src/lib/pwa-updates.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup({ waiting = false, firstInstall = false } = {}) {
  const container = Object.assign(new EventTarget(), { controller: firstInstall ? null : {} });
  const worker = Object.assign(new EventTarget(), { messages: [], postMessage(message) { this.messages.push(message); } });
  const registration = Object.assign(new EventTarget(), { waiting: waiting ? worker : null, installing: null, checks: 0, async update() { this.checks++; } });
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const window = Object.assign(new EventTarget(), { setInterval: () => 1, clearInterval: () => {} });
  const navigator = { serviceWorker: container, onLine: true };
  const compiled = { exports: {} };
  vm.runInNewContext(source, { exports: compiled.exports, navigator, window, document, Set });
  let notifications = 0, reloads = 0;
  const watcher = compiled.exports.watchPwaUpdates(registration, () => notifications++, () => reloads++);
  return { registration, worker, container, document, window, navigator, watcher, get notifications() { return notifications; }, get reloads() { return reloads; } };
}

test('a waiting deployment is offered without automatically reloading a form', () => {
  const app = setup({ waiting: true });
  assert.equal(app.notifications, 1);
  assert.equal(app.reloads, 0);
  assert.equal(app.worker.messages.length, 0);
});
test('first installation takes control without suggesting an update or reloading', () => {
  const app = setup({ firstInstall: true });
  app.container.controller = {};
  app.container.dispatchEvent(new Event('controllerchange'));
  assert.equal(app.notifications, 0);
  assert.equal(app.reloads, 0);
});
test('a downloaded update activates only on request and reloads after activation', () => {
  const app = setup();
  app.registration.installing = app.worker;
  app.registration.dispatchEvent(new Event('updatefound'));
  app.registration.waiting = app.worker;
  app.worker.dispatchEvent(new Event('statechange'));
  assert.equal(app.notifications, 1);
  app.watcher.apply();
  assert.equal(JSON.stringify(app.worker.messages), '[{"type":"ACTIVATE_UPDATE"}]');
  assert.equal(app.reloads, 0);
  app.container.controller = {};
  app.container.dispatchEvent(new Event('controllerchange'));
  assert.equal(app.reloads, 1);
});
test('activation from another app window preserves work until this window refreshes', () => {
  const app = setup();
  app.container.controller = {};
  app.container.dispatchEvent(new Event('controllerchange'));
  assert.equal(app.notifications, 1);
  assert.equal(app.reloads, 0);
  app.watcher.apply();
  assert.equal(app.reloads, 1);
});
test('resuming online checks for new releases, while offline and hidden windows do not', () => {
  const app = setup();
  app.window.dispatchEvent(new Event('online'));
  assert.equal(app.registration.checks, 1);
  app.navigator.onLine = false;
  app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.registration.checks, 1);
  app.navigator.onLine = true;
  app.document.visibilityState = 'hidden';
  app.window.dispatchEvent(new Event('online'));
  assert.equal(app.registration.checks, 1);
  app.document.visibilityState = 'visible';
  app.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(app.registration.checks, 2);
});
test('unmount removes subscriptions, including the installing worker', () => {
  const app = setup();
  app.registration.installing = app.worker;
  app.registration.dispatchEvent(new Event('updatefound'));
  app.watcher.dispose();
  app.registration.waiting = app.worker;
  app.worker.dispatchEvent(new Event('statechange'));
  app.container.controller = {};
  app.container.dispatchEvent(new Event('controllerchange'));
  app.window.dispatchEvent(new Event('online'));
  assert.equal(app.notifications, 0);
  assert.equal(app.registration.checks, 0);
});
test('each build gets a distinct service worker so unchanged templates still detect deployments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'neximet-pwa-build-test-'));
  const outputs = [join(directory, 'first.js'), join(directory, 'second.js')];
  try {
    const first = await generateServiceWorker(outputs[0]);
    const second = await generateServiceWorker(outputs[1]);
    assert.notEqual(first, second);
    assert.equal(JSON.parse(await readFile(join(directory, 'app-version.json'), 'utf8')).version, second);
    for (const [index, version] of [first, second].entries()) {
      const generated = await readFile(outputs[index], 'utf8');
      assert.ok(generated.includes(`\${CACHE_PREFIX}${version}`));
      assert.equal(generated.includes('__NEXIMET_BUILD__'), false);
      new vm.Script(generated);
    }
  } finally {
    await Promise.all(outputs.map((path) => unlink(path).catch(() => {})));
    await unlink(join(directory, 'app-version.json')).catch(() => {});
    await rmdir(directory);
  }
});
