const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { MASK, redact } = require('../lib/redact-database-export.cjs');
const { renderDatabaseViewer } = require('../lib/database-viewer.cjs');

test('masks nested credentials and secret key/value settings while preserving ordinary data', () => {
  const stats = { fields: 0 };
  const original = { id: '9007199254740993', email: 'owner@example.test', password_hash: 'do-not-export',
    password_changed_at: '2026-11-03 10:00:00+07', source_key: 'canh rau',
    audit: { before: { refreshToken: 'private-refresh' }, flags: { two_factor_enabled: true } },
    settings: [{ config_key: 'SMTP_PASSWORD', config_value: 'private-mail-password' }],
    raw_json: '{"apiKey":"private-api-key","enabled":true}' };
  const safe = redact(original, stats);
  assert.equal(safe.id, original.id);
  assert.equal(safe.email, original.email);
  assert.equal(safe.password_changed_at, original.password_changed_at);
  assert.equal(safe.source_key, 'canh rau');
  assert.equal(safe.password_hash, MASK);
  assert.equal(safe.audit.before.refreshToken, MASK);
  assert.equal(safe.settings[0].config_value, MASK);
  assert.equal(JSON.parse(safe.raw_json).apiKey, MASK);
  assert.equal(stats.fields, 4);
  assert.equal(original.password_hash, 'do-not-export');
  assert.ok(!JSON.stringify(safe).includes('private-'));
});

test('preserves JSON text formatting without secrets and masks credentials in text', () => {
  assert.equal(redact('{ "nutrients": [1, 2], "note": "đạm" }'), '{ "nutrients": [1, 2], "note": "đạm" }');
  const text = redact('Authorization: Bearer abc.DEF.ghi');
  assert.equal(text, `Authorization: Bearer ${MASK}`);
  assert.equal(redact(null), null);
  assert.deepEqual(redact([]), []);
});

test('HTML embeds hostile database text as inert JSON and keeps empty tables', () => {
  const payload = { tableCount: 2, rowCount: 1, maskedFields: 0, capturedAt: '2026-11-03',
    tables: [{ id: 'public.example', name: 'example', rowCount: 1, columns: [], constraints: [],
      rows: [{ note: '</script><script>alert(1)</script>' }] },
    { id: 'public.empty', name: 'empty', rowCount: 0, columns: [], constraints: [], rows: [] }] };
  const html = renderDatabaseViewer(payload);
  assert.ok(!html.includes('</script><script>alert(1)</script>'));
  const embedded = html.match(/<script id="snapshot" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(embedded), payload);
  assert.ok(html.includes('textContent=JSON.stringify(row,null,2)'));
  const script = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
});
