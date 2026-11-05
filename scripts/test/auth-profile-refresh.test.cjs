const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const ts = createRequire(path.join(root, 'apps/backend/package.json'))('typescript');

function loadStore(fetchCurrentUser) {
  const values = new Map();
  const localStorage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const exports = {};
  const context = { exports, localStorage, window: { location: {}, addEventListener() {} }, document: { addEventListener() {} }, console,
    setTimeout: () => 1, clearTimeout: () => {},
    require: name => {
      if (name === 'zustand') return { create: initialize => {
        let state;
        const get = () => state;
        const set = update => { state = { ...state, ...update }; };
        state = initialize(set, get);
        return { getState: get };
      } };
      if (name === '../utils/jwt') return { isJwtExpired: () => false, getJwtRemainingTimeMs: () => 60000 };
      if (name === '../api/auth.api') return { fetchCurrentUser };
      if (name === '../api/axios') return { refreshAccessToken: async () => 'new-access', authTokensChangedEvent: 'tokens-changed', authSessionExpiredEvent: 'session-expired' };
      throw new Error(`Unexpected import: ${name}`);
    } };
  const source = fs.readFileSync(path.join(root, 'apps/frontend/src/core/stores/auth.store.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(compiled.outputText, context);
  return { store: exports.useAuthStore, localStorage };
}
const user = { id: '3', fullName: 'L├¬ Ho├ái Nam', email: 'test@example.com',
  phone: null, avatarUrl: null, roles: ['NUTRITIONIST', 'PRINCIPAL'], tenantId: '1' };

test('refreshes the cached display name while preserving login roles and tokens', async () => {
  const { store, localStorage } = loadStore(async () => ({ id: '3', fullName: 'Lê Hoài Nam', phone: null, avatarUrl: null, roles: [{ code: 'NUTRITIONIST' }] }));
  store.getState().setAuth(user, 'access', 'refresh');
  await store.getState().refreshProfile();
  assert.equal(store.getState().user.fullName, 'Lê Hoài Nam');
  assert.equal(JSON.parse(localStorage.getItem('auth_user')).fullName, 'Lê Hoài Nam');
  assert.deepEqual(store.getState().user.roles, user.roles);
  assert.equal(store.getState().accessToken, 'access');
});
test('does not overwrite a different account with a late profile response', async () => {
  let resolve;
  const { store } = loadStore(() => new Promise(done => { resolve = done; }));
  store.getState().setAuth(user, 'access', 'refresh');
  const pending = store.getState().refreshProfile();
  store.getState().setAuth({ ...user, id: '8', fullName: 'Nguyễn An' }, 'other-access', 'other-refresh');
  resolve({ id: '3', fullName: 'Lê Hoài Nam' });
  await pending;
  assert.equal(store.getState().user.id, '8');
  assert.equal(store.getState().user.fullName, 'Nguyễn An');
});
test('keeps the current login when a profile refresh has a network failure', async () => {
  const { store } = loadStore(async () => { throw new Error('Network unavailable'); });
  store.getState().setAuth(user, 'access', 'refresh');
  await store.getState().refreshProfile();
  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(store.getState().accessToken, 'access');
});
