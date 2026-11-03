const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { repairText, repairValue } = require('./lib/repair-vietnamese.cjs');
const root = path.resolve(__dirname, '..');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client } = backendRequire('pg');
const apply = process.argv.includes('--apply');
const id = name => `"${name.replaceAll('"', '""')}"`;

function sourceChanges() {
  const changes = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(tsx?|json|html|css)$/.test(file)) {
        const before = fs.readFileSync(file, 'utf8');
        const after = repairText(before);
        if (after !== before) changes.push({ file, before, after });
      }
    }
  }
  visit(path.join(root, 'apps/frontend/src'));
  visit(path.join(root, 'apps/backend/src'));
  for (const name of ['schema.sql', 'seed.sql', 'seed_snack_services.sql']) {
    const file = path.join(root, 'database', name);
    const before = fs.readFileSync(file, 'utf8');
    const after = repairText(before);
    if (after !== before) changes.push({ file, before, after });
  }
  return changes;
}

async function main() {
  const env = Object.fromEntries(fs.readFileSync(path.join(root, '.docker-test/test.env'), 'utf8')
    .trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
  const database = env.TEST_POSTGRES_DB || 'kidmeal_test';
  let backup;
  if (apply) {
    const directory = path.join(root, '.docker-test/backups');
    fs.mkdirSync(directory, { recursive: true });
    backup = path.join(directory, `before-vietnamese-repair-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
    const result = spawnSync('docker', ['exec', 'kidmeal-test-postgres-1', 'pg_dump', '-U', 'kidmeal_test', '-d', database,
      '-Fc', '--no-owner', '--no-privileges'], { maxBuffer: 128 * 1024 * 1024, windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.toString('utf8'));
    fs.writeFileSync(backup, result.stdout);
  }
  const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test',
    database, password: env.TEST_POSTGRES_PASSWORD, connectionTimeoutMillis: 10000 });
  const sources = sourceChanges();
  const counts = {};
  let rowCount = 0;
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query("SET LOCAL lock_timeout='5s'");
    const columns = (await client.query(`SELECT c.table_name,c.column_name,c.udt_name
      FROM information_schema.columns c JOIN information_schema.tables t
        ON t.table_schema=c.table_schema AND t.table_name=c.table_name
      WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
        AND c.udt_name IN('text','varchar','bpchar','json','jsonb')
        AND c.table_name NOT LIKE 'source_catalog_%'
      ORDER BY c.table_name,c.ordinal_position`)).rows;
    const tables = new Map();
    for (const column of columns) {
      if (/password|secret|token|email|(?:^|_)url$|(?:^|_)path$/i.test(column.column_name)) continue;
      if (!tables.has(column.table_name)) tables.set(column.table_name, []);
      tables.get(column.table_name).push(column);
    }
    for (const [table, fields] of tables) {
      const rows = (await client.query(`SELECT ctid::text AS __repair_ctid,${fields.map(field => id(field.column_name)).join(',')} FROM ${id(table)}`)).rows;
      for (const row of rows) {
        const changed = [];
        for (const field of fields) {
          const before = row[field.column_name];
          const after = repairValue(before);
          if (JSON.stringify(before) === JSON.stringify(after)) continue;
          changed.push({ ...field, before, after });
          const key = `${table}.${field.column_name}`;
          counts[key] = (counts[key] || 0) + 1;
        }
        if (!changed.length) continue;
        rowCount++;
        if (!apply) continue;
        const params = [row.__repair_ctid];
        const assignments = changed.map(field => {
          const json = ['json', 'jsonb'].includes(field.udt_name);
          params.push(json ? JSON.stringify(field.after) : field.after);
          return `${id(field.column_name)}=$${params.length}${json ? `::${field.udt_name}` : ''}`;
        });
        const guards = changed.map(field => {
          const json = ['json', 'jsonb'].includes(field.udt_name);
          params.push(json ? JSON.stringify(field.before) : field.before);
          return `${id(field.column_name)}${json ? '::jsonb' : ''} IS NOT DISTINCT FROM $${params.length}${json ? '::jsonb' : ''}`;
        });
        const result = await client.query(`UPDATE ${id(table)} SET ${assignments.join(',')} WHERE ctid=$1::tid AND ${guards.join(' AND ')}`, params);
        if (result.rowCount !== 1) throw new Error(`Concurrent change detected in ${table}; rolling back`);
      }
    }
    if (apply && rowCount) {
      await client.query(`INSERT INTO audit_logs(school_id,user_id,action,target_entity,details)
        SELECT min(id),NULL,'VIETNAMESE_ENCODING_REPAIRED','DATABASE',$1::jsonb FROM schools`,
      [JSON.stringify({ actorKind: 'USER_REQUEST_VIA_ASSISTANT', rows: rowCount, fields: counts, backup: path.relative(root, backup) })]);
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    if (apply) for (const change of sources) fs.writeFileSync(change.file, change.after, 'utf8');
    const summary = { applied: apply, databaseRows: rowCount, fields: counts,
      sourceFiles: sources.map(change => path.relative(root, change.file)),
      ...(backup ? { backup: path.relative(root, backup) } : {}) };
    fs.writeFileSync(path.join(root, '.docker-test', apply ? 'encoding-repair-result.json' : 'encoding-check-result.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
