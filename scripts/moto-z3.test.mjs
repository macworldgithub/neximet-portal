import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync(new URL('../src/lib/motoZ3.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function browser() {
  const values = new Map(), listeners = new Map(), focusCalls = [];
  const control = name => ({
    isConnected: true,
    focus(options) {
      if (options) throw new TypeError('Legacy focus accepts no options');
      focusCalls.push(name);
    },
  });
  const trigger = control('trigger'), close = control('close');
  const document = { activeElement: trigger, body: { style: { overflow: 'auto' } } };
  const window = {
    innerWidth: 360, innerHeight: 640,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { assert.equal(listeners.get(name), fn); listeners.delete(name); },
    // No matchMedia, so using the newer MediaQueryList API would fail here.
  };
  const menu = {
    querySelector: () => close,
    style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) },
  };
  const loaded = { exports: {} };
  vm.runInNewContext(source, { module: loaded, exports: loaded.exports, window, document });
  return { ...loaded.exports, window, document, menu, values, listeners, focusCalls, trigger };
}

test('Moto Z3 detection excludes other devices, including the Z3 Play', async () => {
  const { isMotoZ3 } = browser();
  for (const model of ['moto z3', 'Moto Z3', 'moto z(3)', 'motorola z3']) {
    assert.equal(await isMotoZ3({ userAgent: `Mozilla/5.0 (Linux; Android 9; ${model} Build/PCX) Chrome/103.0 Mobile Safari/537.36` }), true, model);
  }
  for (const model of ['moto z3 play', 'moto z(3) play', 'moto z30', 'moto z4', 'Pixel 7', 'SM-G960F', 'iPhone']) {
    assert.equal(await isMotoZ3({ userAgent: `Mozilla/5.0 (Linux; Android 9; ${model} Build/PCX) Chrome/103.0 Mobile Safari/537.36` }), false, model);
  }
});

test('reduced Chrome user agents can identify the Z3 through model hints', async () => {
  const { isMotoZ3 } = browser();
  const device = model => ({ userAgent: 'Mozilla/5.0 (Linux; Android 10; K)', userAgentData: {
    getHighEntropyValues: async hints => { assert.equal(hints.join(','), 'model'); return { model }; },
  } });
  assert.equal(await isMotoZ3(device('moto z3')), true);
  assert.equal(await isMotoZ3(device('Pixel 7')), false);
  assert.equal(await isMotoZ3(device('')), false);
  assert.equal(await isMotoZ3({ userAgent: 'Other', userAgentData: { getHighEntropyValues: async () => { throw new Error('Denied'); } } }), false);
});

test('legacy drawer opening, repeated closing and unmount cleanup restore scrolling and focus', () => {
  const app = browser();
  for (let i = 0; i < 3; i++) {
    const cleanup = app.openMotoZ3Drawer(app.menu);
    assert.equal(app.document.body.style.overflow, 'hidden');
    assert.equal(app.values.get('--moto-z3-height'), '640px');
    cleanup();
    assert.equal(app.document.body.style.overflow, 'auto');
    assert.equal(app.listeners.size, 0);
    assert.equal(app.values.size, 0);
  }
  assert.deepEqual(app.focusCalls, ['close', 'trigger', 'close', 'trigger', 'close', 'trigger']);
});

test('drawer height follows browser chrome/rotation and leaving mobile closes the drawer', () => {
  const app = browser();
  let closed = 0;
  const cleanup = app.openMotoZ3Drawer(app.menu, () => closed++);
  app.window.innerWidth = 720;
  app.window.innerHeight = 360;
  app.listeners.get('resize')();
  assert.equal(app.values.get('--moto-z3-height'), '360px');
  assert.equal(closed, 0);
  app.window.innerWidth = 1024;
  app.listeners.get('resize')();
  assert.equal(closed, 1);
  cleanup();
});

test('route unmount does not focus a disconnected menu trigger', () => {
  const app = browser();
  const cleanup = app.openMotoZ3Drawer(app.menu);
  app.trigger.isConnected = false;
  cleanup();
  assert.deepEqual(app.focusCalls, ['close']);
  assert.equal(app.document.body.style.overflow, 'auto');
});
