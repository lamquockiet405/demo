#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const docker = process.env.DOCKER_BIN || 'docker';

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `Command failed with exit code ${result.status}`);
  return result.stdout;
}

function main() {
  // Regenerate from local source documents; this does not access the host .env database.
  process.stdout.write(run(process.execPath, [path.join(root, 'scripts/import-source-catalog.cjs')]));
  const compose = fs.existsSync(path.join(root, '.docker-test/test.env'))
    ? ['compose', '--env-file', '.docker-test/test.env', '-f', 'compose.test.yml']
    : ['compose'];
  const prefix = [...compose, 'exec', '-T', 'postgres', 'sh', '-c'];
  const backup = run(docker, [...prefix,
    'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges']);
  const backupDir = path.join(root, 'database/backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `docker-catalog-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.sql`);
  fs.writeFileSync(backupFile, backup);
  const sql = fs.readFileSync(path.join(root, 'database/generated/source-catalog.sql'), 'utf8');
  run(docker, [...prefix, 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { input: sql });
  const summary = run(docker, [...prefix,
    'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT json_build_object(\'activeDishes\', (SELECT count(*) FROM dishes WHERE status=\'ACTIVE\'), \'sourcedFoods\', (SELECT count(*) FROM food_ingredients WHERE source_metadata->>\'kind\'=\'FOOD_COMPOSITION_IMAGE\'), \'recipeRows\', (SELECT count(*) FROM dish_recipes), \'archivedSeedRecipes\', (SELECT count(*) FROM source_catalog_legacy_recipes));"']);
  console.log(JSON.stringify({ appliedTo: 'docker compose postgres', backup: path.relative(root, backupFile) }));
  process.stdout.write(summary);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
