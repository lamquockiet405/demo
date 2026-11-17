const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');
const user = { id: '13', fullName: 'Parent', roles: ['PARENT'], tenantId: '1' };
const jwt = (expires, subject = '13') => `e30.${Buffer.from(JSON.stringify({ sub: subject, exp: expires })).toString('base64url')}.signature`;

function setup({ expired = false, empty = false } = {}) {
  let now = Date.now(), nextTimer = 0, refreshCalls = 0;
  const access = jwt(Math.floor(now / 1000) + (expired ? -10 : 900));
  const refresh = jwt(Math.floor(now / 1000) + 86400);
  const values = new Map(empty ? [] : [['access_token', access], ['refresh_token', refresh], ['auth_user', JSON.stringify(user)], ['tenant_id', '1'], ['preference', 'keep']]);
  const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const timers = new Map();
  const window = new EventTarget(), document = new EventTarget();
  window.location = { pathname: '/parent-snack-payment', href: '/parent-snack-payment' };
  document.visibilityState = 'visible';
  const transport = axios.create();
  transport.create = options => axios.create(options);
  let refreshHandler = async () => ({ accessToken: jwt(Math.floor(now / 1000) + 900), refreshToken: jwt(Math.floor(now / 1000) + 86401) });
  transport.defaults.adapter = async config => {
    refreshCalls++;
    return { data: { success: true, data: await refreshHandler(config) }, status: 200, statusText: 'OK', headers: {}, config };
  };
  const context = vm.createContext({
    localStorage, window, document, location: window.location, console, Event, atob,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  function load(relative, imports) {
    const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8').replaceAll('import.meta.env', '({})');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    const execute = vm.runInContext(`(function(require, module, exports) { ${code}\n})`, context);
    execute(name => {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unexpected import: ' + name);
    }, module, module.exports);
    return module.exports;
  }
  const utils = load('core/utils/jwt.ts', {});
  const api = load('core/api/axios.ts', { axios: transport, '../utils/jwt': utils });
  const { useAuthStore: store } = load('core/stores/auth.store.ts', {
    zustand: require('zustand'), '../utils/jwt': utils, '../api/axios': api,
    '../api/auth.api': { fetchCurrentUser: async () => ({ ...user }) },
  });
  api.apiClient.defaults.adapter = async config => ({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config });
  return {
    api, store, localStorage, timers, window, document, access, refresh,
    refreshCalls: () => refreshCalls,
    onRefresh: handler => { refreshHandler = handler; },
    async advance(ms) {
      now += ms;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
      for (const [id, timer] of due) { if (timers.delete(id)) timer.callback(); }
      await new Promise(setImmediate);
    },
  };
}

test('refreshes before expiry and keeps the same page and account', async () => {
  const app = setup();
  app.store.getState().hydrate();
  await app.advance(841000);
  assert.equal(app.refreshCalls(), 1);
  assert.equal(app.store.getState().isAuthenticated, true);
  assert.notEqual(app.store.getState().accessToken, app.access);
  assert.equal(app.store.getState().accessToken, app.localStorage.getItem('access_token'));
  assert.equal(app.window.location.href, '/parent-snack-payment');
  assert.equal(app.timers.size, 1);
});

test('restores an expired access token using its still-valid refresh token', async () => {
  const app = setup({ expired: true });
  assert.equal(app.store.getState().isAuthenticated, true);
  const responses = await Promise.all(Array.from({ length: 6 }, () => app.api.apiClient.get('/payments/my-invoices')));
  assert.equal(app.refreshCalls(), 1);
  assert.equal(responses.length, 6);
  assert.equal(app.store.getState().accessToken, app.localStorage.getItem('access_token'));
});

test('network failure preserves credentials and a later retry restores access', async () => {
  const app = setup();
  app.onRefresh(async () => { throw new Error('Offline'); });
  app.store.getState().hydrate();
  await app.advance(841000);
  assert.equal(app.store.getState().isAuthenticated, true);
  assert.equal(app.localStorage.getItem('refresh_token'), app.refresh);
  app.onRefresh(async () => ({ accessToken: jwt(Math.floor(Date.now() / 1000) + 4000) }));
  await app.advance(30000);
  assert.equal(app.refreshCalls(), 2);
  assert.notEqual(app.store.getState().accessToken, app.access);
});

test('only a rejected refresh ends the session and keeps unrelated preferences', async () => {
  const app = setup();
  app.onRefresh(async () => { throw { response: { status: 401 } }; });
  await assert.rejects(app.api.refreshAccessToken());
  assert.equal(app.store.getState().isAuthenticated, false);
  assert.equal(app.localStorage.getItem('refresh_token'), null);
  assert.equal(app.localStorage.getItem('preference'), 'keep');
});

test('an in-flight refresh never restores an explicitly logged-out session', async () => {
  const app = setup();
  let finish;
  app.onRefresh(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.api.refreshAccessToken();
  await new Promise(setImmediate);
  app.store.getState().logout();
  finish({ accessToken: app.access, refreshToken: app.refresh });
  await assert.rejects(pending);
  assert.equal(app.store.getState().isAuthenticated, false);
  assert.equal(app.localStorage.getItem('access_token'), null);
});

test('a late refresh cannot overwrite a different login', async () => {
  const app = setup();
  let finish;
  app.onRefresh(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.api.refreshAccessToken();
  await new Promise(setImmediate);
  const nextAccess = jwt(Math.floor(Date.now() / 1000) + 1000, '99');
  app.store.getState().setAuth({ ...user, id: '99' }, nextAccess, 'different-refresh');
  finish({ accessToken: app.access, refreshToken: app.refresh });
  assert.equal(await pending, nextAccess);
  assert.equal(app.store.getState().user.id, '99');
  assert.equal(app.localStorage.getItem('access_token'), nextAccess);
});

test('failed public login never triggers refresh or clears an existing session', async () => {
  const app = setup();
  app.api.apiClient.defaults.adapter = async config => { throw { config, response: { status: 401 } }; };
  await assert.rejects(app.api.apiClient.post('/auth/login', {}));
  assert.equal(app.refreshCalls(), 0);
  assert.equal(app.store.getState().isAuthenticated, true);
});

test('API rejection after one refresh is not retried forever', async () => {
  const app = setup();
  let requests = 0;
  app.api.apiClient.defaults.adapter = async config => { requests++; throw { config, response: { status: 401 } }; };
  await assert.rejects(app.api.apiClient.get('/auth/me'));
  assert.equal(requests, 2);
  assert.equal(app.refreshCalls(), 1);
});

test('a delayed 401 reuses the token already refreshed by another request', async () => {
  const app = setup();
  const renewed = jwt(Math.floor(Date.now() / 1000) + 1800);
  app.onRefresh(async () => ({ accessToken: renewed }));
  let release;
  app.api.apiClient.defaults.adapter = async config => {
    if (config.headers.Authorization === `Bearer ${app.access}`) {
      if (config.url === '/slow') await new Promise(resolve => { release = resolve; });
      throw { config, response: { status: 401 } };
    }
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  const slow = app.api.apiClient.get('/slow');
  await app.api.apiClient.get('/fast');
  release();
  await slow;
  assert.equal(app.refreshCalls(), 1);
});

test('storage changes from another tab update the store and cancel its old timer', () => {
  const app = setup();
  app.store.getState().hydrate();
  app.localStorage.removeItem('access_token');
  app.localStorage.removeItem('auth_user');
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: 'auth_user' });
  app.window.dispatchEvent(event);
  assert.equal(app.store.getState().isAuthenticated, false);
  assert.equal(app.timers.size, 0);
});

test('a session without a refresh token does not block a later valid login', async () => {
  const app = setup();
  app.localStorage.removeItem('refresh_token');
  await assert.rejects(app.api.refreshAccessToken());
  app.store.getState().setAuth(user, app.access, app.refresh);
  assert.equal(await app.api.refreshAccessToken(), app.access);
  assert.equal(app.refreshCalls(), 1);
});
