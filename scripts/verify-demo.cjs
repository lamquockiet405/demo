// Smoke-check the actual public demo. Tokens stay in memory; no fixture data is created.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { io } = createRequire(path.resolve(__dirname, '../apps/frontend/package.json'))('socket.io-client');

async function main() {
  assert.ok(process.argv[2], 'Usage: node scripts/verify-demo.cjs https://your-demo.trycloudflare.com');
  const origin = new URL(process.argv[2]).origin;
  const checks = [];
  async function request(route, options = {}) {
    const response = await fetch(new URL(route, origin), {
      ...options, signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
    return response;
  }
  const html = await (await request('/')).text();
  assert.match(html, /<html/i);
  const asset = html.match(/<script[^>]+src="([^"]+)"/);
  assert.ok(asset, 'Frontend script was not found');
  await (await request(asset[1])).arrayBuffer();
  await (await request('/login')).text();
  checks.push('Frontend, login route, JavaScript asset: HTTP 200');

  const tenants = await (await request('/api/v1/auth/tenants')).json();
  assert.ok(Array.isArray(tenants.data?.tenants) && tenants.data.tenants.length > 0,
    'Tenant API must return a nonempty school list');
  checks.push('Tenant API: JSON, HTTP 200');
  for (const roleCode of ['SCHOOL_MANAGER', 'NUTRITIONIST', 'TEACHER', 'KITCHEN_STAFF', 'PARENT']) {
    const login = await (await request('/api/v1/auth/quick-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tenant-id': '1' },
      body: JSON.stringify({ roleCode, tenantId: '1' }),
    })).json();
    const token = (login.data ?? login).accessToken;
    assert.equal(typeof token, 'string', `${roleCode}: missing access token`);
    const headers = { Authorization: `Bearer ${token}`, 'x-tenant-id': '1' };
    await (await request('/api/v1/auth/me', { headers })).json();
    if (roleCode === 'NUTRITIONIST') {
      const dishes = await (await request('/api/v1/menus/available-dishes', { headers })).json();
      assert.ok((dishes.data ?? dishes).length > 0, 'Expected dishes from PostgreSQL');
      checks.push('Authenticated dish catalog: PostgreSQL data, HTTP 200');
    }
    checks.push(`Demo login and authenticated profile: ${roleCode}`);
  }

  await new Promise((resolve, reject) => {
    const socket = io(origin, { transports: ['websocket'], reconnection: false, timeout: 20000 });
    const timer = setTimeout(() => finish(new Error('Kitchen joined event timed out')), 25000);
    function finish(error) {
      clearTimeout(timer);
      socket.disconnect();
      error ? reject(error) : resolve();
    }
    socket.on('connect_error', finish);
    socket.once('joined', () => finish());
    socket.on('connect', () => socket.emit('join:kitchen', { tenantId: '1' }));
  });
  checks.push('Secure WebSocket connection and kitchen joined event');
  console.log(JSON.stringify({ origin, passed: true, checks }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
