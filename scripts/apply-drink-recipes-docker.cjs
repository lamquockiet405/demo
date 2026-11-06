const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { buildSql } = require('./prepare-drink-recipes.cjs');
const root = path.resolve(__dirname, '..');
const { Client } = createRequire(path.join(root, 'apps/backend/package.json'))('pg');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.docker-test/test.env'), 'utf8').trim()
  .split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const database = env.TEST_POSTGRES_DB || 'kidmeal_test';
if (!database.startsWith('kidmeal_test')) throw new Error('Only the isolated local test database is supported');
async function main() {
  const backup = spawnSync('docker', ['compose', '--env-file', '.docker-test/test.env', '-f', 'compose.test.yml',
    'exec', '-T', 'postgres', 'pg_dump', '-U', 'kidmeal_test', '-d', database, '--no-owner', '--no-privileges'],
    { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (backup.error || backup.status !== 0) throw new Error(backup.error?.message || backup.stderr);
  const backupFile = path.join(root, 'database/backups', `docker-drinks-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.sql`);
  fs.mkdirSync(path.dirname(backupFile), { recursive: true });
  fs.writeFileSync(backupFile, backup.stdout, 'utf8');
  const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test', database, password: env.TEST_POSTGRES_PASSWORD });
  await client.connect();
  try {
    await client.query(buildSql());
    const summary = await client.query(`SELECT d.name,d.standard_serving_size_g,n.energy_kcal,
      d.source_metadata->>'drinkFamily' AS family FROM dishes d JOIN dish_nutrition n ON n.dish_id=d.id
      WHERE d.source_metadata->>'recipeStatus'='APPROVED_REFERENCE' ORDER BY d.name`);
    console.log(JSON.stringify({ backup: path.relative(root, backupFile), drinks: summary.rows }, null, 2));
  } finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
