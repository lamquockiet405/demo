#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { readSchema } = require('./generate-erd.cjs');
const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'database/migrations/20261103-relational-integrity.sql');
const migrationSql = () => fs.readFileSync(migrationPath, 'utf8').replace(/^(?:BEGIN|COMMIT);\s*$/gm, '');
const quoteId = (name) => '"' + name.replaceAll('"', '""') + '"';

function graph(tables) {
  const adjacency = new Map(tables.map((table) => [table.id, new Set()]));
  let foreignKeys = 0;
  for (const table of tables) for (const fk of table.constraints.filter((key) => key.type === 'f')) {
    foreignKeys++;
    if (!adjacency.has(fk.target_id)) continue;
    adjacency.get(table.id).add(fk.target_id);
    adjacency.get(fk.target_id).add(table.id);
  }
  const unseen = new Set(adjacency.keys());
  const components = [];
  while (unseen.size) {
    const first = unseen.values().next().value;
    unseen.delete(first);
    const group = [first];
    for (let index = 0; index < group.length; index++) for (const next of adjacency.get(group[index])) {
      if (unseen.delete(next)) group.push(next);
    }
    components.push(group.map((id) => tables.find((table) => table.id === id).name));
  }
  return { tableCount: tables.length, foreignKeys, components, isolated: components.filter((group) => group.length === 1).flat() };
}

async function fingerprint(client, table, names, existingIds) {
  const projection = names.map(quoteId).join(',');
  const filter = existingIds ? ' WHERE id=ANY($1::bigint[])' : '';
  return (await client.query(`SELECT count(*)::int AS count,
    md5(coalesce(string_agg(md5(to_jsonb(original)::text),'' ORDER BY md5(to_jsonb(original)::text)),'')) AS digest
    FROM (SELECT ${projection} FROM ${quoteId(table)}${filter}) original`, existingIds ? [existingIds] : [])).rows[0];
}

async function migrate(client, { apply = false } = {}) {
  const before = await readSchema(client, 'public');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('kidmeal-source-catalog'))");
    // Stabilize the data while validating. Never save or log row contents.
    await client.query(`LOCK TABLE ${before.map((table) => quoteId(table.name)).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    const fingerprints = [];
    for (const table of before) {
      const names = table.columns.map((column) => column.name);
      const existingIds = ['nutrition_conversion_factors','nutrition_rule_codes'].includes(table.name)
        ? (await client.query(`SELECT id FROM ${quoteId(table.name)}`)).rows.map((row) => row.id) : null;
      fingerprints.push({ table: table.name, names, existingIds, value: await fingerprint(client, table.name, names, existingIds) });
    }
    await client.query(migrationSql());
    for (const item of fingerprints) assert.deepEqual(await fingerprint(client, item.table, item.names, item.existingIds), item.value,
      `Original data changed in ${item.table}; rolling back`);
    const invalid = (await client.query(`SELECT conname FROM pg_constraint WHERE contype='f'
      AND connamespace='public'::regnamespace AND NOT convalidated`)).rows;
    assert.equal(invalid.length, 0, 'Unvalidated foreign keys remain');
    const after = graph(await readSchema(client, 'public', false));
    assert.equal(after.components.length, 1, 'The schema still has disconnected table groups');
    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
    return { applied: apply, preservedTables: fingerprints.length, before: graph(before), after };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--apply', '--help'].includes(arg))) throw new Error('Use --apply or --help');
  if (args.includes('--help')) {
    console.log('node scripts/migrate-relations.cjs          # validate in a transaction, then ROLLBACK\nnode scripts/migrate-relations.cjs --apply  # validate, preserve original values, then COMMIT'); return;
  }
  const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
  backendRequire('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const client = new (backendRequire('pg').Client)({ host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432), database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await migrate(client, { apply: args.includes('--apply') });
    const summary = (state) => ({ tableCount: state.tableCount, foreignKeys: state.foreignKeys,
      componentCount: state.components.length, isolated: state.isolated });
    console.log(JSON.stringify({ applied: result.applied, preservedTables: result.preservedTables,
      before: summary(result.before), after: summary(result.after) }, null, 2));
    console.log(result.applied ? 'Committed. Run npm run db:erd to regenerate the diagram.' : 'Validation passed. All changes rolled back; use --apply to commit.');
  } finally { await client.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { migrate, migrationSql, graph };
