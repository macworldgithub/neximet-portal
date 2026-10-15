import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(fs.readFileSync(new URL('../src/components/pwa/PwaInstallBanner.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
function render(context = {}, dismissed = false) {
  const module = { exports: {} };
  const browserReact = { ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
  vm.runInNewContext(source, {
    module, exports: module.exports,
    sessionStorage: { getItem: () => dismissed ? 'true' : null },
    require: name => name === 'react' ? browserReact : name === './PwaProvider'
      ? { usePwa: () => ({ isInstalled: false, isInstallable: true, hasUpdateNotice: false, promptInstall() {}, ...context }) }
      : require(name),
  });
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
test('an installable browser shows usable install and dismissal controls', () => {
  const html = render();
  assert.match(html, /Install Neximet Portal/);
  assert.match(html, />Install<\/span>/);
  assert.match(html, /aria-label="Dismiss"/);
});
test('a deployment update takes priority over installation so notices cannot overlap', () => {
  assert.equal(render({ hasUpdateNotice: true }), '');
  assert.notEqual(render({ hasUpdateNotice: false }), '');
});
test('installed, unsupported and dismissed sessions do not show an install banner', () => {
  assert.equal(render({ isInstalled: true }), '');
  assert.equal(render({ isInstallable: false }), '');
  assert.equal(render({}, true), '');
});
