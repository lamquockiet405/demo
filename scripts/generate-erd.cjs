#!/usr/bin/env node
// Generate an editable draw.io ERD from PostgreSQL metadata, without reading rows.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { layoutErd, HEADER } = require('./lib/erd-layout.cjs');

const root = path.resolve(__dirname, '..');
const xml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]);

function options(args) {
  const result = { schema: 'public', output: path.join(root, 'docs/diagrams/erd'), tables: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') return { help: true };
    const key = { '--schema': 'schema', '--out': 'output', '--tables': 'tables' }[args[i]];
    if (!key || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid argument: ${args[i]}. Use --help.`);
    result[key] = args[++i];
  }
  result.output = path.resolve(result.output);
  if (result.tables) result.tables = result.tables.split(',').map((name) => name.trim()).filter(Boolean);
  return result;
}

async function readSchema(client, schema, manageTransaction = true) {
  if (manageTransaction) await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    const columns = (await client.query(`
      SELECT c.oid::text AS table_id, c.relname AS table_name,
        a.attnum AS position, a.attname AS name,
        format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull AS not_null
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND NOT c.relispartition
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY c.relname, a.attnum`, [schema])).rows;
    const constraints = (await client.query(`
      SELECT k.conrelid::text AS table_id, k.conname AS name, k.contype AS type,
        k.conkey AS columns, k.confrelid::text AS target_id, k.confkey AS target_columns,
        target_ns.nspname AS target_schema, target.relname AS target_table
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_class target ON target.oid = k.confrelid
      LEFT JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND NOT c.relispartition
        AND k.contype IN ('p', 'u', 'f')
      ORDER BY c.relname, k.conname`, [schema])).rows;
    // Also account for standalone, non-partial unique indexes when determining cardinality.
    const uniqueIndexes = (await client.query(`
      SELECT i.indrelid::text AS table_id,
        ARRAY(SELECT key.attnum::int FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS key(attnum, pos)
          WHERE key.pos <= i.indnkeyatts ORDER BY key.pos) AS columns
      FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND NOT c.relispartition
        AND i.indisunique AND i.indisvalid AND i.indisready
        AND i.indpred IS NULL AND i.indexprs IS NULL`, [schema])).rows;
    if (manageTransaction) await client.query('COMMIT');
    const tables = [];
    for (const column of columns) {
      let table = tables.find((item) => item.id === column.table_id);
      if (!table) {
        table = { id: column.table_id, name: column.table_name, schema, columns: [],
          constraints: constraints.filter((item) => item.table_id === column.table_id),
          uniqueKeys: uniqueIndexes.filter((item) => item.table_id === column.table_id).map((item) => item.columns) };
        tables.push(table);
      }
      table.columns.push({ position: column.position, name: column.name, type: column.data_type, notNull: column.not_null });
    }
    return tables;
  } catch (error) {
    if (manageTransaction) await client.query('ROLLBACK');
    throw error;
  }
}

function keys(table, column) {
  return ['p', 'f', 'u'].filter((type) => table.constraints.some((key) => key.type === type && key.columns.includes(column.position)))
    .map((type) => ({ p: 'PK', f: 'FK', u: 'UQ' })[type]).join(', ');
}

function selectTables(tables, names) {
  if (!names) return tables;
  const missing = names.filter((name) => !tables.some((table) => table.name === name));
  if (missing.length) throw new Error(`Unknown tables: ${missing.join(', ')}`);
  const selected = tables.filter((table) => names.includes(table.name));
  const ids = new Set(selected.map((table) => table.id));
  // Include direct FK targets so selected tables retain their relationship context.
  for (const table of selected) for (const key of table.constraints) if (key.type === 'f') ids.add(key.target_id);
  return tables.filter((table) => ids.has(table.id));
}

function renderPage(name, tables, pageId) {
  const headerHeight = HEADER;
  const cells = ['<mxCell id="0"/><mxCell id="1" parent="0"/>'];
  const layout = layoutErd(tables);
  const { positions, width, nameWidth } = layout;
  for (const table of tables) {
    const { x, y, height } = positions.get(table.id);
    cells.push(`<mxCell id="t${table.id}" value="${xml(table.name)}" style="swimlane;html=0;startSize=${headerHeight};horizontal=1;rounded=0;fillColor=#6DAFCE;swimlaneFillColor=#FFFFFF;strokeColor=#657681;fontColor=#102332;fontStyle=1;fontSize=13;collapsible=0;container=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`);
    table.columns.forEach((column, index) => {
      const rowId = `t${table.id}c${column.position}`;
      const marker = keys(table, column);
      const { top, height: rowHeight } = positions.get(table.id).columns.get(column.position);
      const style = `text;html=0;align=left;verticalAlign=middle;spacingLeft=7;fontSize=11;overflow=hidden;whiteSpace=nowrap;strokeColor=none;fillColor=${index % 2 ? '#F5F8FA' : '#FFFFFF'};`;
      cells.push(`<mxCell id="${rowId}" value="" style="${style}" vertex="1" parent="t${table.id}"><mxGeometry x="0" y="${top}" width="${width}" height="${rowHeight}" as="geometry"/></mxCell>`);
      const fields = [
        { suffix: 'k', text: marker, x: 0, width: 78, extra: 'fontColor=#996F18;' },
        { suffix: 'n', text: column.name, x: 78, width: nameWidth, extra: marker.includes('PK') ? 'fontStyle=1;' : '' },
        { suffix: 'd', text: column.type, x: 78 + nameWidth, width: width - 78 - nameWidth, extra: 'align=right;spacingRight=7;fontColor=#53616B;' },
      ];
      for (const field of fields) cells.push(`<mxCell id="${rowId}${field.suffix}" value="${xml(field.text)}" style="${style}fillColor=none;${field.extra}" vertex="1" parent="${rowId}"><mxGeometry x="${field.x}" y="0" width="${field.width}" height="${rowHeight}" as="geometry"/></mxCell>`);
    });
  }
  let edges = 0;
  for (const route of layout.edges) {
    const { child, parent, fk } = route;
    const required = fk.columns.every((pos) => child.columns.find((col) => col.position === pos)?.notNull);
    const unique = child.uniqueKeys.some((key) => key.length && key.every((pos) => fk.columns.includes(pos)));
    const tooltip = `${fk.name}: ${child.name}(${fk.columns.map((pos) => child.columns.find((col) => col.position === pos)?.name).join(', ')}) -> ${parent.name}(${fk.target_columns.map((pos) => parent.columns.find((col) => col.position === pos)?.name).join(', ')})`;
    const style = `edgeStyle=none;noEdgeStyle=1;orthogonal=1;rounded=0;html=0;jumpStyle=arc;jumpSize=8;strokeColor=#52616B;strokeWidth=1;startArrow=${required ? 'ERone' : 'ERzeroToOne'};startFill=0;endArrow=${unique ? 'ERzeroToOne' : 'ERzeroToMany'};endFill=0;exitX=${route.sourceSide};exitY=${route.sourceFraction};entryX=${route.targetSide};entryY=${route.targetFraction};exitPerimeter=0;entryPerimeter=0;`;
    const waypoints = route.points.slice(1, -1).map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
    cells.push(`<object id="e${edges++}" label="" tooltip="${xml(tooltip)}"><mxCell style="${style}" edge="1" parent="1" source="t${parent.id}c${fk.target_columns[0]}" target="t${child.id}c${fk.columns[0]}"><mxGeometry relative="1" as="geometry"><Array as="points">${waypoints}</Array></mxGeometry></mxCell></object>`);
  }
  const legend = `${name} | ${tables.length} tables | ${edges} foreign keys | PK: primary key; FK: foreign key; UQ: unique constraint | Hover a relationship for column mapping`;
  cells.push(`<mxCell id="legend" value="${xml(legend + ' | Crossings: arc jumps; routes stay outside tables')}" style="text;html=0;align=left;fontSize=13;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="60" y="20" width="${layout.totalWidth - 100}" height="55" as="geometry"/></mxCell>`);
  return `<diagram id="${pageId}" name="${xml(name)}"><mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="0" page="0" background="#FFFFFF"><root>${cells.join('\n')}</root></mxGraphModel></diagram>`;
}

function renderDrawio(tables, selectedNames) {
  const selected = selectTables(tables, selectedNames);
  const pages = [renderPage(selectedNames ? 'Selected tables' : 'All tables', selected, 'all')];
  if (!selectedNames) {
    const groups = [
      ['Users and school', /^(users|roles|user_roles|staff_profiles|parent_profiles|school|classes|children|child_|student|allergen)/],
      ['Food and nutrition', /^(food|dish|recipe|nutrition|allergen|tenant_food)/],
      ['Menus', /^(menu|weekly_menu|nutritional_standard)/],
      ['Daily meals and payments', /^(daily_|meal_|weekly_nutrition|snack_|breakfast_|payment|class_meal|parent_evaluation|evaluation_repl|physical_measurement|growth_|who_)/],
      ['Inspections and system', /^(food_inspection|food_sample|inspection|audit|system_|ui_|language|notification|rule_violation)/],
      ['Source archives', /^source_catalog_/],
    ];
    groups.forEach(([name, pattern], index) => {
      const names = tables.filter((table) => pattern.test(table.name)).map((table) => table.name);
      if (names.length) pages.push(renderPage(name, selectTables(tables, names), `group${index}`));
    });
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" compressed="false">\n${pages.join('\n')}\n</mxfile>\n`;
}

async function main(args = process.argv.slice(2)) {
  const opt = options(args);
  if (opt.help) {
    console.log('Usage: node scripts/generate-erd.cjs [--schema public] [--tables users,roles] [--out docs/diagrams/erd]\nReads POSTGRES_HOST/PORT/DB/USER/PASSWORD from .env. Outputs kidmeal.drawio and schema.json.');
    return;
  }
  const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
  backendRequire('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  for (const key of ['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER']) {
    if (!process.env[key]) throw new Error(`Missing ${key} in environment or .env`);
  }
  const { Client } = backendRequire('pg');
  const client = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: 10000, application_name: 'kidmeal-erd' });
  let tables;
  try { await client.connect(); tables = await readSchema(client, opt.schema); } finally { await client.end(); }
  if (!tables.length) throw new Error(`No tables found in schema ${opt.schema}`);
  const drawing = renderDrawio(tables, opt.tables);
  const selected = selectTables(tables, opt.tables);
  fs.mkdirSync(opt.output, { recursive: true });
  fs.writeFileSync(path.join(opt.output, 'kidmeal.drawio'), drawing);
  fs.writeFileSync(path.join(opt.output, 'schema.json'), JSON.stringify({ schema: opt.schema, tables: selected }, null, 2) + '\n');
  const foreignKeys = selected.flatMap((table) => table.constraints).filter((key) => key.type === 'f');
  const missing = foreignKeys.filter((key) => !selected.some((table) => table.id === key.target_id));
  console.log(`Created ${path.join(opt.output, 'kidmeal.drawio')}\n${selected.length} tables; ${foreignKeys.length} foreign keys. Open in draw.io, then File > Export as > PNG/PDF/SVG.`);
  if (missing.length) console.warn(`${missing.length} relationships to tables outside this schema/selection were omitted from the drawing; see schema.json.`);
}

if (require.main === module) main().catch((error) => {
  // Avoid emitting connection objects or environment values in error logs.
  console.error(`ERD generation failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
module.exports = { options, readSchema, keys, selectTables, renderDrawio };
