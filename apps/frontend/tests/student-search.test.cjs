const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, stubs = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const compiled = new Module(filename, module);
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = compiled.require.bind(compiled);
  compiled.require = name => Object.hasOwn(stubs, name) ? stubs[name] : normalRequire(name);
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText, filename);
  return compiled.exports;
}
const { filterNutritionStudents } = load('features/nutrition/utils/student-search.ts', {
  '../../kitchen/utils/kds-data': load('features/kitchen/utils/kds-data.ts'),
});
const students = [
  { fullName: 'Bùi Khánh Vy', studentCode: 'HS-001', allergies: [{ isActive: true }] },
  { fullName: 'Đặng Minh Đức', studentCode: 'HS-002', allergies: [] },
  { fullName: 'Nguyễn An', studentCode: 'HS-003', allergies: [{ isActive: false }] },
];

test('finds accented Vietnamese names with or without accents and regardless of case', () => {
  for (const query of ['bui khanh vy', 'BÙI KHÁNH VY', '  bui   khanh\tvy  ', 'Bùi Khánh Vy'.normalize('NFD'), 'khanh vy']) {
    assert.deepEqual(filterNutritionStudents(students, query, 'ALL'), [students[0]]);
  }
  assert.deepEqual(filterNutritionStudents(students, 'dang minh duc', 'ALL'), [students[1]]);
});

test('searches student codes and combines name searches with the allergy filter', () => {
  assert.deepEqual(filterNutritionStudents(students, ' hs-002 ', 'ALL'), [students[1]]);
  assert.deepEqual(filterNutritionStudents(students, 'vy', 'ALLERGIC'), [students[0]]);
  assert.deepEqual(filterNutritionStudents(students, 'vy', 'SAFE'), []);
  assert.deepEqual(filterNutritionStudents(students, 'an', 'SAFE'), [students[1], students[2]]);
});

test('clearing search restores the full list and no match returns an empty list', () => {
  assert.deepEqual(filterNutritionStudents(students, ' \t ', 'ALL'), students);
  assert.deepEqual(filterNutritionStudents(students, 'khong ton tai', 'ALL'), []);
  assert.deepEqual(filterNutritionStudents([{}], 'vy', 'ALL'), []);
});

test('finds students on later loaded pages before display pagination', () => {
  const allPages = [...Array.from({ length: 200 }, (_, i) => ({ fullName: `Học sinh ${i}`, studentCode: `HS${i}` })), students[0]];
  assert.deepEqual(filterNutritionStudents(allPages, 'bui khanh vy', 'ALL'), [students[0]]);
  assert.equal(allPages.length, 201);
});
