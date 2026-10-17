import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: name => dependencies[name] || require(name) });
  return module.exports;
}
const document = load('../src/lib/mailDocument.ts');
const { default: MailBody } = load('../src/components/mail/MailBody.tsx', { '../../lib/mailDocument': document });

test('formatted email keeps original paragraphs, quotes and lists in the application theme', () => {
  const html = '<p>Appreciate that</p><blockquote><p>Me again,</p><ul><li><b>Only continue</b></li></ul></blockquote>';
  const result = document.mailDocument(html);
  assert.ok(result.includes(html)); assert.match(result, /color-scheme: dark/); assert.match(result, /background: #111827/);
  assert.match(result, /color: #F3F4F6/); assert.match(result, /color: #5CC5FA/);
  assert.match(result, /overflow-wrap: anywhere/); assert.match(result, /max-width: 100%/);
});

test('frame CSP blocks scripts, forms, external styles, and network access by default', () => {
  const result = document.mailDocument('<p>Email</p>');
  for (const rule of ["default-src 'none'", "script-src 'none'", "style-src 'unsafe-inline'", "img-src data:;", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) assert.ok(result.includes(rule), rule);
  const enabled = document.mailDocument('<p>Email</p>', true);
  assert.match(enabled, /img-src data: https: http:;/);
  assert.ok(enabled.includes("script-src 'none'")); assert.ok(enabled.includes("connect-src 'none'"));
});

test('the real reader uses formatted HTML instead of its plaintext quote-marked alternative', () => {
  const markup = renderToStaticMarkup(React.createElement(MailBody, { html: '<p>Hello</p><blockquote><p>Original reply</p></blockquote>', text: '> THIS_PLAINTEXT_SHOULD_NOT_RENDER', hasRemoteImages: true }));
  assert.match(markup, /title="Formatted email message"/); assert.match(markup, /Show external images/);
  assert.match(markup, /sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"/);
  assert.doesNotMatch(markup, /allow-scripts|THIS_PLAINTEXT_SHOULD_NOT_RENDER/);
  assert.match(markup, /&lt;blockquote&gt;/); assert.match(markup, /referrerPolicy="no-referrer"/);
});

test('older API responses retain readable escaped text until the backend is deployed', () => {
  const markup = renderToStaticMarkup(React.createElement(MailBody, { text: 'Readable <script>literal</script> text' }));
  assert.match(markup, /&lt;script&gt;literal&lt;\/script&gt;/); assert.doesNotMatch(markup, /<script>/);
});
