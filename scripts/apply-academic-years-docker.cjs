const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client } = backendRequire('pg');
const env = backendRequire('dotenv').parse(fs.readFileSync(path.join(root, '.docker-test/test.env')));
const database = env.TEST_POSTGRES_DB || 'kidmeal_test';
if (!database.startsWith('kidmeal_test')) throw new Error('Only the local Docker test database is supported');

async function main() {
  const backup = spawnSync('docker', ['compose', '--env-file', '.docker-test/test.env', '-f', 'compose.test.yml',
    'exec', '-T', 'postgres', 'pg_dump', '-U', 'kidmeal_test', '-d', database, '--no-owner', '--no-privileges'],
    { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (backup.error || backup.status !== 0) throw new Error(backup.error?.message || backup.stderr);
  const directory = path.join(root, 'database/backups');
  fs.mkdirSync(directory, { recursive: true });
  const backupFile = path.join(directory, `before-academic-years-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
  fs.writeFileSync(backupFile, backup.stdout, 'utf8');
  const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test', database, password: env.TEST_POSTGRES_PASSWORD });
  await client.connect();
  try {
    await client.query(fs.readFileSync(path.join(root, 'database/migrations/20261107-academic-years.sql'), 'utf8'));
    const result = await client.query(`SELECT y.name,y.status,
      (SELECT count(*)::int FROM classes c WHERE c.academic_year_id=y.id) AS classes,
      (SELECT count(*)::int FROM student_academic_enrollments e WHERE e.academic_year_id=y.id) AS students
      FROM academic_year y ORDER BY y.start_date DESC`);
    console.log(JSON.stringify({ backup: path.relative(root, backupFile), years: result.rows }, null, 2));
  } finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
