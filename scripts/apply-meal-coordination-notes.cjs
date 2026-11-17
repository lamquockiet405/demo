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
const migration = path.join(root, 'database/migrations/20261105-meal-coordination-notes.sql');
if (!process.argv.includes('--apply')) { console.log('Ready: ' + migration + '. Use --apply to back up and apply.'); process.exit(0); }
(async () => {
  const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test', password: env.TEST_POSTGRES_PASSWORD, database });
  await client.connect();
  try {
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('meal_notes','meal_coordination_notes') ORDER BY tablename")).rows.map(r => r.tablename);
    const directory = path.join(root, '.docker-test/backups'); fs.mkdirSync(directory, { recursive: true });
    const backup = path.join(directory, 'meal-notes-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sql');
    const fd = fs.openSync(backup, 'wx');
    try { execFileSync('docker', ['exec', 'kidmeal-test-postgres-1', 'pg_dump', '-U', 'kidmeal_test', '-d', database, ...tables.flatMap(t => ['-t', t])], { stdio: ['ignore', fd, 'pipe'] }); }
    finally { fs.closeSync(fd); }
    await client.query('BEGIN');
    const snapshots = {};
    for (const table of tables) {
      await client.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
      snapshots[table] = (await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
    }
    const sql = fs.readFileSync(migration, 'utf8');
    await client.query(sql);
    await client.query(sql);
    for (const table of tables) assert.deepEqual((await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows, snapshots[table]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ applied: true, preservedTables: tables, idempotent: true, backup }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
