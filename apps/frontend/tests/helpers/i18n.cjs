const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function createI18n({ storedLanguage = null, storageDisabled = false } = {}) {
  const storage = new Map([['access_token', 'keep-session']]);
  if (storedLanguage !== null) storage.set('kidmeal.language', storedLanguage);
  const document = { documentElement: { lang: '' }, title: '' };
  const events = new Map();
  const window = { addEventListener: (name, listener) => events.set(name, listener) };
  const localStorage = {
    getItem(key) { if (storageDisabled) throw new Error('Storage disabled'); return storage.get(key) ?? null; },
    setItem(key, value) { if (storageDisabled) throw new Error('Storage disabled'); storage.set(key, value); },
  };
  const context = vm.createContext({ window, document, localStorage });
  const filename = path.join(__dirname, '../../src/core/i18n/language.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const moduleValue = { exports: {} };
  const execute = vm.runInContext(`(function(require, module, exports) { ${code}\n})`, context);
  execute(name => require(path.resolve(path.dirname(filename), name)), moduleValue, moduleValue.exports);
  return {
    api: moduleValue.exports, storage, document,
    emitStorage: (key, newValue) => events.get('storage')?.({ key, newValue }),
  };
}
module.exports = { createI18n };
