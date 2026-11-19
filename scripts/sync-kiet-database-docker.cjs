const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.docker-test/test.env');
const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const container = 'kidmeal-test-postgres-1';
const user = 'kidmeal_test';
const previousDatabase = env.TEST_POSTGRES_DB || 'kidmeal_test';
if (!process.argv.includes('--apply')) throw new Error('Use --apply to back up and migrate a copy of the local test database.');
function docker(args, input) {
  const result = spawnSync('docker', args, { input, maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.toString('utf8').slice(-4000));
  return result.stdout;
}
function sql(db, text) {
  return docker(['exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', db], text).toString('utf8');
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, '.docker-test/backups');
fs.mkdirSync(backupDir, { recursive: true });
const backup = docker(['exec', container, 'pg_dump', '-U', user, '-d', previousDatabase, '-Fc', '--no-owner', '--no-privileges']);
const backupPath = path.join(backupDir, `before-kiet-${stamp}.dump`);
fs.writeFileSync(backupPath, backup);
const database = `kidmeal_test_kiet_${Date.now()}`;
docker(['exec', container, 'createdb', '-U', user, database]);
docker(['exec', '-i', container, 'pg_restore', '-U', user, '-d', database, '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction'], backup);
const migrationLog = sql(database, fs.readFileSync(path.join(root, 'database/generated/source-catalog.sql')));
fs.writeFileSync(path.join(backupDir, `migration-${stamp}.log`), migrationLog);
sql(database, fs.readFileSync(path.join(root, 'database/docker-test-runtime.sql')));
const query = `SELECT json_build_object(
 'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
 'dishes',(SELECT count(*) FROM dishes), 'activeDishes',(SELECT count(*) FROM dishes WHERE status='ACTIVE'),
 'sourcedFoods',(SELECT count(*) FROM food_ingredients WHERE source_metadata->>'kind'='FOOD_COMPOSITION_IMAGE'),
 'recipes',(SELECT count(*) FROM dish_recipes), 'nutrition',(SELECT count(*) FROM dish_nutrition),
 'unvalidatedForeignKeys',(SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND NOT convalidated));`;
const summary = JSON.parse(docker(['exec', container, 'psql', '-X', '-At', '-U', user, '-d', database, '-c', query]).toString('utf8'));
assert.equal(Number(summary.dishes), 172);
assert.equal(Number(summary.activeDishes), 172);
assert.equal(Number(summary.sourcedFoods), 91);
assert.equal(Number(summary.recipes), 177);
assert.equal(Number(summary.nutrition), 59);
assert.equal(Number(summary.unvalidatedForeignKeys), 0);
env.TEST_POSTGRES_DB = database;
fs.writeFileSync(envPath, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
const report = { previousDatabase, database, backup: path.relative(root, backupPath), ...summary };
fs.writeFileSync(path.join(root, '.docker-test/database-sync-result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
