#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { redact } = require('./lib/redact-database-export.cjs');
const { renderDatabaseViewer } = require('./lib/database-viewer.cjs');
const root = path.resolve(__dirname, '..');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const pg = backendRequire('pg');
backendRequire('dotenv').config({ path: path.join(root, '.env'), quiet: true });
// Preserve dates, microseconds, NUMERIC and BIGINT values without JS date/float conversion.
for (const oid of [1082, 1114, 1184]) pg.types.setTypeParser(oid, (value) => value);

const markdownCell = (value) => (value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value))
  .replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');

async function readSnapshot(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    const timestamp = (await client.query('SELECT transaction_timestamp()::text AS captured_at')).rows[0].captured_at;
    const tables = (await client.query(`SELECT ns.nspname AS schema_name, relation.relname AS table_name, relation.relkind AS kind
      FROM pg_class relation JOIN pg_namespace ns ON ns.oid=relation.relnamespace
      WHERE relation.relkind IN ('r','p','v','m') AND NOT relation.relispartition
        AND ns.nspname <> 'information_schema' AND ns.nspname NOT LIKE 'pg_%'
      ORDER BY ns.nspname,relation.relname`)).rows;
    const columns = (await client.query(`SELECT table_schema,table_name,column_name,data_type,udt_name,
      is_nullable,column_default,ordinal_position
      FROM information_schema.columns WHERE table_schema <> 'information_schema' AND table_schema NOT LIKE 'pg_%'
      ORDER BY table_schema,table_name,ordinal_position`)).rows;
    const constraints = (await client.query(`SELECT ns.nspname AS schema_name, relation.relname AS table_name,
      constraint_row.conname AS name, constraint_row.contype AS type,
      pg_get_constraintdef(constraint_row.oid) AS definition,
      ARRAY(SELECT attribute.attname::text FROM unnest(constraint_row.conkey) WITH ORDINALITY key(attnum,position)
        JOIN pg_attribute attribute ON attribute.attrelid=relation.oid AND attribute.attnum=key.attnum ORDER BY key.position) AS columns
      FROM pg_constraint constraint_row JOIN pg_class relation ON relation.oid=constraint_row.conrelid
      JOIN pg_namespace ns ON ns.oid=relation.relnamespace
      WHERE ns.nspname <> 'information_schema' AND ns.nspname NOT LIKE 'pg_%'
      ORDER BY ns.nspname,relation.relname,constraint_row.conname`)).rows;
    const snapshot = { capturedAt: timestamp, timezone: 'Asia/Saigon', readOnly: true, secretsMasked: true,
      tableCount: tables.length, rowCount: 0, maskedFields: 0, tables: [] };
    for (const table of tables) {
      const id = `${table.schema_name}.${table.table_name}`;
      const tableColumns = columns.filter((col) => col.table_schema === table.schema_name && col.table_name === table.table_name);
      const tableConstraints = constraints.filter((item) => item.schema_name === table.schema_name && item.table_name === table.table_name);
      const primaryKey = tableConstraints.find((item) => item.type === 'p')?.columns || [];
      const order = primaryKey.length ? ` ORDER BY ${primaryKey.map((name) => client.escapeIdentifier(name)).join(', ')}` : '';
      const qualified = `${client.escapeIdentifier(table.schema_name)}.${client.escapeIdentifier(table.table_name)}`;
      const rows = (await client.query(`SELECT * FROM ${qualified}${order}`)).rows;
      const stats = { fields: 0 };
      const safeRows = rows.map((row) => redact(row, stats));
      const safeColumns = tableColumns.map((column) => ({ ...column,
        column_default: redact({ [column.column_name]: column.column_default })[column.column_name] }));
      snapshot.tables.push({ id, schema: table.schema_name, name: table.table_name, kind: table.kind,
        archive: table.table_name.startsWith('source_catalog_'), columns: safeColumns,
        constraints: tableConstraints, primaryKey, rowCount: safeRows.length, maskedFields: stats.fields, rows: safeRows });
      snapshot.rowCount += safeRows.length;
      snapshot.maskedFields += stats.fields;
      console.log(`${id}: ${safeRows.length} rows`);
    }
    await client.query('COMMIT');
    return snapshot;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

function writeSnapshot(snapshot, output) {
  fs.mkdirSync(path.join(output, 'tables'), { recursive: true });
  let readme = '# Toàn bộ dữ liệu hiện tại của hệ thống\n\n';
  readme += `Thời điểm chụp: **${snapshot.capturedAt}**, múi giờ Asia/Saigon.\n\n`;
  readme += `Có **${snapshot.tableCount} bảng**, **${snapshot.rowCount.toLocaleString('vi-VN')} dòng**, `;
  readme += `**${snapshot.tables.filter((table) => table.rowCount === 0).length} bảng trống**. `;
  readme += `Đã che ${snapshot.maskedFields} giá trị mật khẩu/token/bí mật; vẫn giữ đủ hàng và cột. `;
  readme += 'Database chỉ được đọc trong cùng một snapshot, không thay đổi dữ liệu.\n\n';
  readme += '[Mở trình xem có tìm kiếm và phân trang](index.html) · [Toàn bộ dữ liệu JSON](all-data.json)\n\n';
  readme += 'Trong trình xem HTML: chọn bảng bên trái, tìm theo giá trị bất kỳ, bấm vào dòng để đọc đầy đủ các cột và JSON lồng nhau. Mục cấu trúc hiển thị kiểu dữ liệu và các ràng buộc. Các bảng source_catalog_* là bản lưu trữ, không phải dữ liệu đang dùng.\n\n';
  readme += '| Bảng | Số dòng | Số cột | Nhóm | Xem dữ liệu | JSON |\n|---|---:|---:|---|---|---|\n';
  for (const table of snapshot.tables) {
    const filename = encodeURIComponent(table.id);
    fs.writeFileSync(path.join(output, 'tables', `${filename}.json`), JSON.stringify(table.rows, null, 2) + '\n');
    let detail = `# ${table.id}\n\n${table.rowCount} dòng; ${table.columns.length} cột. `;
    detail += table.archive ? 'Đây là bảng lưu trữ.\n\n' : 'Dữ liệu trong bảng ứng dụng.\n\n';
    detail += `[Quay về danh sách](../README.md) · [JSON đầy đủ](${filename}.json)\n\n`;
    detail += '## Cấu trúc\n\n| Cột | Kiểu | Cho phép NULL | Giá trị mặc định |\n|---|---|---|---|\n';
    for (const col of table.columns) detail += `| ${col.column_name} | ${col.data_type} (${col.udt_name}) | ${col.is_nullable} | ${markdownCell(col.column_default)} |\n`;
    if (table.constraints.length) detail += '\nRàng buộc:\n\n' + table.constraints.map((item) => `- ${item.name}: ${item.definition}`).join('\n') + '\n';
    detail += '\n## Toàn bộ dữ liệu\n\n';
    if (!table.rowCount) detail += 'Bảng hiện không có dòng dữ liệu.\n';
    else {
      const names = table.columns.map((column) => column.column_name);
      detail += '| ' + names.join(' | ') + ' |\n|' + names.map(() => '---').join('|') + '|\n';
      for (const row of table.rows) detail += '| ' + names.map((name) => markdownCell(row[name])).join(' | ') + ' |\n';
    }
    fs.writeFileSync(path.join(output, 'tables', `${filename}.md`), detail);
    readme += `| ${table.id} | ${table.rowCount} | ${table.columns.length} | ${table.archive ? 'Lưu trữ' : 'Ứng dụng'} | [Mở](tables/${filename}.md) | [JSON](tables/${filename}.json) |\n`;
  }
  fs.writeFileSync(path.join(output, 'README.md'), readme);
  fs.writeFileSync(path.join(output, 'all-data.json'), JSON.stringify(snapshot, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'index.html'), renderDatabaseViewer(snapshot));
}

async function main() {
  if (!process.env.POSTGRES_HOST || !process.env.POSTGRES_DB || !process.env.POSTGRES_USER) throw new Error('Missing database configuration');
  const client = new pg.Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 10000 });
  let snapshot;
  try { await client.connect(); snapshot = await readSnapshot(client); } finally { await client.end(); }
  const output = path.join(root, 'docs/database-snapshot/latest');
  writeSnapshot(snapshot, output);
  console.log(JSON.stringify({ output: path.relative(root, output), tableCount: snapshot.tableCount,
    rowCount: snapshot.rowCount, emptyTables: snapshot.tables.filter((table) => table.rowCount === 0).length,
    maskedFields: snapshot.maskedFields, capturedAt: snapshot.capturedAt }));
}

if (require.main === module) main().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
module.exports = { readSnapshot, writeSnapshot };
