const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const ts = createRequire(path.join(root, 'apps/frontend/package.json'))('typescript');
const file = path.join(root, 'apps/frontend/src/features/menus/utils/allergy-conflicts.ts');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
const { getDishAllergyConflicts, groupAllergyConflictsByChild } = context.exports;
const conflict = (overrides = {}) => ({ childId: '1', childName: 'Trẻ kiểm thử', className: 'Lớp thử', severity: 'MILD', menuDishId: '50', dishId: '10', allergenDetected: 'Hải sản', matchReasons: ['Nguyên liệu: Nước mắm cá cơm truyền thống'], ...overrides });

test('pork modal excludes beef and other slots, including stale data with a reused slot ID', () => {
  const matches = getDishAllergyConflicts([conflict(), conflict({ menuDishId: '51', dishId: '20', allergenDetected: 'thịt bò' }), conflict({ menuDishId: '51' }), conflict({ dishId: '20', allergenDetected: 'thịt bò' })], { id: '50', dishId: '10' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].allergenDetected, 'Hải sản');
});
test('no matching declaration produces no sample or unrelated children', () => {
  const matches = getDishAllergyConflicts([conflict()], { id: '60', dishId: '30' });
  assert.equal(matches.length, 0);
  assert.equal(groupAllergyConflictsByChild(matches).length, 0);
  assert.equal(getDishAllergyConflicts(undefined, { id: '50', dishId: '10' }).length, 0);
});
test('counts each child once and only merges allergens of that child', () => {
  const rows = [conflict(), conflict(), conflict({ allergenDetected: 'Trứng', severity: 'SEVERE', matchReasons: ['Nguyên liệu: Trứng gà'] }), conflict({ childId: '2', childName: 'Trẻ khác' })];
  const children = groupAllergyConflictsByChild(rows);
  assert.equal(children.length, 2);
  assert.equal(children[0].allergen, 'Hải sản, Trứng');
  assert.equal(children[0].severity, 'SEVERE');
  assert.equal(children[0].matchReasons.length, 2);
  assert.equal(children[1].allergen, 'Hải sản');
});
