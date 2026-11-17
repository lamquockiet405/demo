const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { Client } = createRequire(path.join(root, 'apps/backend/package.json'))('pg');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.docker-test/test.env'), 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const database = env.TEST_POSTGRES_DB || 'kidmeal_test';
assert.ok(database.startsWith('kidmeal_test'), 'Only the local test database is supported.');
const migration = path.join(root, 'database/migrations/20261105-parent-evaluation-editing.sql');
if (!process.argv.includes('--apply')) { console.log('Ready: ' + migration + '. Use --apply to back up and apply.'); process.exit(0); }
(async () => {
  const directory = path.join(root, '.docker-test/backups'); fs.mkdirSync(directory, { recursive: true });
  const backup = path.join(directory, 'parent-evaluations-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sql');
  const fd = fs.openSync(backup, 'wx');
  try { execFileSync('docker', ['exec', 'kidmeal-test-postgres-1', 'pg_dump', '-U', 'kidmeal_test', '-d', database, '-t', 'parent_evaluations', '-t', 'evaluation_replies'], { stdio: ['ignore', fd, 'pipe'] }); }
  finally { fs.closeSync(fd); }
  const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test', password: env.TEST_POSTGRES_PASSWORD, database });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE parent_evaluations IN ACCESS EXCLUSIVE MODE');
    const original = await client.query('SELECT id, student_id, menu_id, rating, comment, created_at FROM parent_evaluations ORDER BY id');
    await client.query(fs.readFileSync(migration, 'utf8'));
    const after = await client.query('SELECT id, student_id, menu_id, rating, comment, created_at FROM parent_evaluations ORDER BY id');
    assert.deepEqual(after.rows, original.rows, 'Original evaluations must remain unchanged.');
    // Reapplication must preserve the migrated and original values.
    const first = await client.query('SELECT * FROM parent_evaluations ORDER BY id');
    await client.query(fs.readFileSync(migration, 'utf8'));
    const second = await client.query('SELECT * FROM parent_evaluations ORDER BY id');
    assert.deepEqual(second.rows, first.rows);
    await client.query('COMMIT');
    console.log(JSON.stringify({ applied: true, preservedEvaluations: after.rowCount, idempotent: true, backup }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
