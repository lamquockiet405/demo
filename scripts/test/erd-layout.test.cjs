const test = require('node:test');
const assert = require('node:assert/strict');
const { layoutErd } = require('../lib/erd-layout.cjs');
const { renderDrawio } = require('../generate-erd.cjs');

function fixture() {
  return Array.from({ length: 18 }, (_, i) => ({ id: String(i + 1), name: `table_${i + 1}`,
    uniqueKeys: [[1]], columns: [
      { position: 1, name: 'id', type: 'bigint', notNull: true },
      { position: 2, name: 'parent_id', type: 'bigint', notNull: true },
      ...Array.from({ length: i % 6 }, (_, j) => ({ position: j + 3, name: `field_${j}`, type: 'text', notNull: false })),
    ], constraints: [{ type: 'p', columns: [1] },
      { name: `fk_${i + 1}`, type: 'f', columns: [2], target_id: String(i === 0 ? 1 : i % 3 + 1), target_columns: [1] }],
  }));
}

function auditRoutes(tables) {
  const layout = layoutErd(tables);
  const segments = [];
  for (const edge of layout.edges) {
    assert.ok(edge.points.length >= 2);
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1], b = edge.points[i];
      assert.ok(a.x === b.x || a.y === b.y, `${edge.fk.name}: non-orthogonal segment`);
      assert.ok(a.x !== b.x || a.y !== b.y, 'Zero length segment');
      const horizontal = a.y === b.y;
      for (const [id, box] of layout.positions) {
        const enters = horizontal
          ? a.y > box.y && a.y < box.y + box.height && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width
          : a.x > box.x && a.x < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height;
        assert.ok(!enters, `${edge.fk.name} enters table ${id}`);
      }
      for (const other of segments) if (other.edge !== edge && other.horizontal === horizontal) {
        const sameLine = horizontal ? a.y === other.a.y : a.x === other.a.x;
        const axis = horizontal ? 'x' : 'y';
        const overlaps = Math.min(Math.max(a[axis],b[axis]),Math.max(other.a[axis],other.b[axis]))
          > Math.max(Math.min(a[axis],b[axis]),Math.min(other.a[axis],other.b[axis]));
        assert.ok(!sameLine || !overlaps, `${edge.fk.name} overlaps ${other.edge.fk.name}`);
      }
      segments.push({ a, b, horizontal, edge });
    }
  }
  const boxes = [...layout.positions.values()];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
      'Overlapping tables');
  }
  return layout;
}

test('dense fan-outs, uneven table heights and self-references avoid every table and one another', () => {
  const tables = fixture();
  const layout = auditRoutes(tables);
  assert.equal(layout.edges.length, 18);
  assert.deepEqual(layoutErd(tables), layout, 'Routing must be deterministic');
});

test('every serialized edge has arc jumps and explicit orthogonal waypoints', () => {
  const drawing = renderDrawio(fixture(), ['table_1','table_2','table_3','table_4']);
  const edges = [...drawing.matchAll(/<mxCell style="([^"]+)" edge="1"[^>]*>(.*?)<\/mxCell>/gs)];
  assert.equal(edges.length, 4);
  for (const [, style, geometry] of edges) {
    assert.match(style, /jumpStyle=arc;jumpSize=8;/);
    assert.match(geometry, /<Array as="points"><mxPoint/);
  }
});

test('uneven table sizes pack into compact rows instead of reserving a tall row for each short table', () => {
  const tables = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: `packed_${index}`,
    constraints: [], uniqueKeys: [], columns: Array.from({ length: index % 2 ? 40 : 3 }, (_, c) => ({
      position: c + 1, name: `column_${c}`, type: 'text', notNull: false,
    })),
  }));
  const layout = auditRoutes(tables);
  const tallest = Math.max(...[...layout.positions.values()].map((box) => box.height));
  assert.ok(layout.totalHeight < tallest * 3, 'Short tables leave too much unused vertical space');
});

module.exports = { auditRoutes };
