const test = require('node:test');
const assert = require('node:assert/strict');
const { renderDrawio, selectTables, readSchema } = require('../generate-erd.cjs');

const fixture = () => [
  { id: '1', name: 'parents', schema: 'public', uniqueKeys: [[1, 2]],
    columns: [{ position: 1, name: 'id', type: 'bigint', notNull: true }, { position: 2, name: 'code', type: 'text', notNull: true }],
    constraints: [{ type: 'p', columns: [1, 2] }] },
  { id: '2', name: 'children', schema: 'public', uniqueKeys: [[1]],
    columns: [{ position: 1, name: 'id', type: 'bigint', notNull: true },
      { position: 2, name: 'parent_id', type: 'bigint', notNull: true },
      { position: 3, name: 'parent_code', type: 'text', notNull: true }],
    constraints: [{ type: 'p', columns: [1] }, { name: 'parent_fk', type: 'f', columns: [2, 3], target_id: '1', target_columns: [1, 2] }] },
  { id: '3', name: 'unrelated', schema: 'public', uniqueKeys: [], columns: [], constraints: [] },
];

test('selected ERD includes direct FK targets and rejects unknown tables', () => {
  assert.deepEqual(selectTables(fixture(), ['children']).map((table) => table.name), ['parents', 'children']);
  assert.throws(() => selectTables(fixture(), ['missing']), /Unknown tables/);
});

test('composite FK renders one edge with every column in the tooltip', () => {
  const drawing = renderDrawio(fixture(), ['children']);
  assert.equal((drawing.match(/edge="1"/g) || []).length, 1);
  assert.match(drawing, /children\(parent_id, parent_code\).*parents\(id, code\)/);
  assert.match(drawing, /startArrow=ERone;.*endArrow=ERzeroToMany;/);
  assert.match(drawing, /source="t1c1" target="t2c2"/);
});

test('nullable unique FK renders optional one-to-one cardinality', () => {
  const tables = fixture();
  tables[1].columns[1].notNull = false;
  tables[1].uniqueKeys.push([2, 3]);
  assert.match(renderDrawio(tables, ['children']), /startArrow=ERzeroToOne;.*endArrow=ERzeroToOne;/);
  // An index with additional key columns does not make the FK itself unique.
  tables[1].uniqueKeys = [[1, 2, 3]];
  assert.match(renderDrawio(tables, ['children']), /endArrow=ERzeroToMany;/);
});

test('quoted identifiers are escaped in labels and tooltips', () => {
  const tables = fixture();
  tables[1].name = 'child<&"';
  tables[1].columns[1].name = 'parent<&"';
  const drawing = renderDrawio(tables, ['child<&"']);
  assert.match(drawing, /value="child&lt;&amp;&quot;"/);
  assert.match(drawing, /parent&lt;&amp;&quot;/);
  assert.ok(!drawing.includes('child<&"'));
});

test('schema inspection uses a read-only transaction and parameterized schema', async () => {
  const calls = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    return { rows: [] };
  } };
  assert.deepEqual(await readSchema(client, "quoted'schema"), []);
  assert.match(calls[0].sql, /REPEATABLE READ READ ONLY/);
  assert.equal(calls.at(-1).sql, 'COMMIT');
  const reads = calls.filter((call) => call.params);
  assert.equal(reads.length, 3);
  for (const call of reads) {
    assert.deepEqual(call.params, ["quoted'schema"]);
    assert.ok(!call.sql.includes("quoted'schema"));
  }
});

test('catalog failures roll back the read-only transaction', async () => {
  const calls = [];
  const client = { async query(sql) {
    calls.push(sql);
    if (sql.includes('FROM pg_class')) throw new Error('catalog unavailable');
    return { rows: [] };
  } };
  await assert.rejects(readSchema(client, 'public'), /catalog unavailable/);
  assert.equal(calls.at(-1), 'ROLLBACK');
});
