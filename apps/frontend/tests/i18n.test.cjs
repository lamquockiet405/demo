const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createI18n } = require('./helpers/i18n.cjs');
const en = require('../src/core/i18n/locales/en.json');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('defaults to Vietnamese, restores English and rejects unsupported preferences', () => {
  assert.equal(createI18n().api.getLanguage(), 'vi');
  assert.equal(createI18n({ storedLanguage: 'en' }).api.getLocale(), 'en-GB');
  assert.equal(createI18n({ storedLanguage: 'fr' }).api.getLanguage(), 'vi');
});

test('switching persists the preference, updates document language and preserves the session', () => {
  const { api, storage, document } = createI18n();
  let calls = 0;
  const unsubscribe = api.subscribeLanguage(() => { calls++; });
  api.setLanguage('en');
  assert.equal(storage.get('kidmeal.language'), 'en');
  assert.equal(storage.get('access_token'), 'keep-session');
  assert.equal(document.documentElement.lang, 'en');
  assert.match(document.title, /Preschool/);
  assert.equal(api.t('Lưu thay đổi'), 'Save changes');
  api.setLanguage('en');
  assert.equal(calls, 1);
  api.setLanguage('de');
  assert.equal(api.getLanguage(), 'en');
  unsubscribe();
  api.setLanguage('vi');
  assert.equal(calls, 1);
  assert.equal(api.t('Lưu thay đổi'), 'Lưu thay đổi');
});

test('switching remains available when browser storage is disabled', () => {
  const { api } = createI18n({ storageDisabled: true });
  api.setLanguage('en');
  assert.equal(api.getLanguage(), 'en');
  assert.equal(api.t('Đóng'), 'Close');
});

test('another tab synchronizes the language without rewriting storage', () => {
  const { api, emitStorage, storage, document } = createI18n();
  let changes = 0;
  api.subscribeLanguage(() => changes++);
  emitStorage('access_token', 'other');
  assert.equal(changes, 0);
  emitStorage('kidmeal.language', 'en');
  assert.equal(api.getLanguage(), 'en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(storage.has('kidmeal.language'), false);
  emitStorage(null, null);
  assert.equal(api.getLanguage(), 'vi');
  assert.equal(changes, 2);
});

test('dynamic notices preserve interpolation values, punctuation and whitespace', () => {
  const { api } = createI18n({ storedLanguage: 'en' });
  assert.equal(api.t('Menu tài khoản Nguyễn Văn An'), 'Account menu Nguyễn Văn An');
  assert.equal(api.t('  Lưu thay đổi  '), '  Save changes  ');
  assert.equal(api.t('Phiên bản v2.0'), 'Version v2.0');
  assert.equal(api.t('Nội dung riêng chưa có trong từ điển'), 'Nội dung riêng chưa có trong từ điển');
  const data = { name: 'Nguyễn Văn An', notes: 'Ghi chú riêng' };
  assert.equal(api.t(data), data);
  assert.equal(api.t(0), 0);
  assert.equal(api.t(null), null);
  assert.equal(api.t('constructor'), 'constructor');
  assert.equal(api.t('toString'), 'toString');
});

test('every catalog entry has a nonempty translation and preserves its interpolation slots', () => {
  const slots = value => [...value.matchAll(/\{\{\d+\}\}/g)].map(match => match[0]).sort();
  for (const [source, target] of Object.entries(en)) {
    assert.equal(typeof target, 'string', source);
    assert.ok(target.trim(), source);
    assert.deepEqual(slots(target), slots(source), source);
  }
});

test('translated select labels keep explicit values for API filters and forms', () => {
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(filename);
      else if (filename.endsWith('.tsx')) {
        const tree = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
        function visit(node) {
          if (ts.isCallExpression(node) && node.expression.getText(tree) === 'translateText') {
            const parent = node.parent;
            if (ts.isCallExpression(parent)) {
              assert.ok(!/\.(includes|startsWith|endsWith|indexOf)$/.test(parent.expression.getText(tree)), `Business comparisons must use original text: ${filename}`);
            }
          }
          if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'option') {
            const localized = node.children.some(child => ts.isJsxExpression(child) && child.expression?.getText(tree).includes('translateText('));
            const explicitValue = node.openingElement.attributes.properties.some(attribute => attribute.name?.text === 'value');
            assert.ok(!localized || explicitValue, `Localized option needs a stable value: ${filename}`);
          }
          ts.forEachChild(node, visit);
        }
        visit(tree);
      }
    }
  }
  inspect(path.join(__dirname, '../src'));
});
