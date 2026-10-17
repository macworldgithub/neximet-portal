import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/communicationViewport.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports });

function browser(withVisualViewport = true, chat = null) {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  const frames = new Map(), values = new Map();
  let nextFrame = 0;
  const window = Object.assign(new EventTarget(), {
    innerHeight: 800, visualViewport: withVisualViewport ? viewport : undefined,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const document = { body: { style: { overflow: 'auto' } }, documentElement: { style: { overflow: 'visible' } } };
  const root = { querySelector: () => chat, style: { setProperty: (name, value) => {
    values.set(name, value);
    if (chat && name === '--communication-height') chat.clientHeight = Math.max(0, parseFloat(value) - 120);
  }, removeProperty: name => values.delete(name) } };
  const cleanup = module.exports.bindCommunicationViewport(root, window, document);
  return { viewport, window, document, values, frames, cleanup, flush() {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback());
  } };
}

test('keyboard opening and closing resize the entire workspace without a minimum height', () => {
  const app = browser();
  assert.equal(app.values.get('--communication-height'), '800px');
  app.viewport.height = 245;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(app.values.get('--communication-height'), '245px');
  app.viewport.height = 800;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(app.values.get('--communication-height'), '800px');
  app.cleanup();
});

test('Safari viewport panning keeps the workspace within the visible area', () => {
  const app = browser();
  app.viewport.height = 310; app.viewport.offsetTop = 82;
  app.viewport.dispatchEvent(new Event('resize'));
  app.viewport.dispatchEvent(new Event('scroll')); app.flush();
  assert.equal(app.values.get('--communication-top'), '82px');
  assert.equal(app.values.get('--communication-height'), '310px');
  app.viewport.offsetTop = 0; app.viewport.height = 800;
  app.viewport.dispatchEvent(new Event('scroll')); app.flush();
  assert.equal(app.values.get('--communication-top'), '0px');
  app.cleanup();
});

test('rotation and browser chrome changes use the latest visible height', () => {
  const app = browser();
  app.viewport.height = 355; app.window.innerHeight = 355;
  app.window.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(app.values.get('--communication-height'), '355px');
  app.viewport.height = 720;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(app.values.get('--communication-height'), '720px');
  app.cleanup();
});

test('older browsers follow innerHeight without requiring VisualViewport', () => {
  const app = browser(false);
  app.window.innerHeight = 260;
  app.window.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(app.values.get('--communication-height'), '260px');
  assert.equal(app.values.get('--communication-top'), '0px');
  app.cleanup();
});

test('pinch zoom uses native panning without shrinking and reflowing the app', () => {
  const app = browser();
  app.viewport.scale = 2; app.viewport.height = 400; app.viewport.offsetTop = 70;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(app.values.get('--communication-height'), '800px');
  assert.equal(app.values.get('--communication-top'), '0px');
  app.viewport.scale = 1; app.viewport.height = 800; app.viewport.offsetTop = 0;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(app.values.get('--communication-height'), '800px');
  app.cleanup();
});

test('keyboard animation events are batched and cleanup restores normal page scrolling', () => {
  const app = browser();
  assert.equal(app.document.body.style.overflow, 'hidden');
  assert.equal(app.document.documentElement.style.overflow, 'hidden');
  for (let i = 0; i < 20; i++) {
    app.viewport.dispatchEvent(new Event('resize')); app.viewport.dispatchEvent(new Event('scroll'));
  }
  assert.equal(app.frames.size, 1);
  app.cleanup();
  assert.equal(app.frames.size, 0);
  assert.equal(app.document.body.style.overflow, 'auto');
  assert.equal(app.document.documentElement.style.overflow, 'visible');
  assert.equal(app.values.size, 0);
  app.viewport.dispatchEvent(new Event('resize')); app.window.dispatchEvent(new Event('resize'));
  assert.equal(app.frames.size, 0);
});

test('the latest chat messages remain at the bottom when the keyboard opens', () => {
  let top = 320;
  const chat = { scrollHeight: 1000, clientHeight: 680, get scrollTop() { return top; }, set scrollTop(value) { top = Math.min(value, this.scrollHeight - this.clientHeight); } };
  const app = browser(true, chat);
  app.viewport.height = 300;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(chat.clientHeight, 180); assert.equal(chat.scrollTop, 820);
  app.viewport.height = 800;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(chat.scrollTop, 320);
  app.cleanup();
});

test('opening the keyboard does not jump someone away from earlier chat history', () => {
  const chat = { scrollHeight: 2000, clientHeight: 680, scrollTop: 150 };
  const app = browser(true, chat);
  app.viewport.height = 300;
  app.viewport.dispatchEvent(new Event('resize')); app.flush();
  assert.equal(chat.scrollTop, 150);
  app.cleanup();
});
