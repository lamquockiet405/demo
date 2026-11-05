const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(
  path.join(__dirname, '../src/features/kitchen/utils/kitchen-operations.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const moduleValue = { exports: {} };
new Function('module', 'exports', compiled)(moduleValue, moduleValue.exports);
const {
  calculateGrossWeight,
  getSampleState,
  sampleDueAt,
  makeCsv,
  formatDateTime,
} = moduleValue.exports;

test('gross suggestion applies refuse yield rather than adding loss to net weight', () => {
  assert.deepEqual(calculateGrossWeight(80, 100, 20), {
    netGrams: 8000,
    grossGrams: 10000,
    grossKg: 10,
  });
  assert.equal(calculateGrossWeight(50, 0, 10).grossKg, 0);
  assert.equal(calculateGrossWeight(120, 10, 0).grossGrams, 1200);
});
test('invalid, negative, fractional portion and 100 percent refuse inputs are rejected', () => {
  for (const args of [
    [-1, 10, 0],
    [10, -1, 0],
    [10, 2.5, 0],
    [10, 1, -1],
    [10, 1, 100],
    [NaN, 1, 0],
    [10, Infinity, 0],
  ])
    assert.throws(() => calculateGrossWeight(...args));
  assert.throws(() => calculateGrossWeight(1e308, 10, 20));
});
test('sample cannot be disposed before 24 hours and becomes due at exactly 24 hours', () => {
  const sample = { status: 'STORED', storedAt: '2026-11-03T07:00:00Z' };
  assert.equal(
    getSampleState(sample, Date.parse('2026-11-04T06:59:59Z')),
    'STORED',
  );
  assert.equal(
    getSampleState(sample, Date.parse('2026-11-04T07:00:00Z')),
    'DUE',
  );
  assert.equal(
    getSampleState(
      { ...sample, status: 'DISPOSED' },
      Date.parse('2026-11-05T07:00:00Z'),
    ),
    'DISPOSED',
  );
  assert.equal(getSampleState({ status: 'STORED' }), 'UNKNOWN');
  assert.equal(getSampleState({ storedAt: 'not-a-date' }), 'UNKNOWN');
  assert.equal(sampleDueAt('2026-11-03T07:00:00Z'), '2026-11-04T07:00:00.000Z');
  assert.equal(sampleDueAt('not-a-date'), null);
});
test('CSV preserves Vietnamese, quotes and line breaks while escaping spreadsheet formulas', () => {
  const csv = makeCsv([
    ['Món', 'Ghi chú'],
    ['Cá "hồi"', 'Dòng 1\nDòng 2'],
    ['=HYPERLINK("x")', '  +SUM(1,2)'],
  ]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Cá ""hồi"""'));
  assert.ok(csv.includes('"Dòng 1\nDòng 2"'));
  assert.ok(csv.includes('"\'=HYPERLINK'));
  assert.ok(csv.includes('"\'  +SUM'));
});
test('missing and invalid timestamps never produce an invalid date label', () => {
  assert.equal(formatDateTime(null), '—');
  assert.equal(formatDateTime('invalid'), '—');
});
