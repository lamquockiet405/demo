const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const ts = createRequire(path.join(root, 'apps/frontend/package.json'))('typescript');
const source = fs.readFileSync(path.join(root, 'apps/frontend/src/features/menus/utils/substitute-candidates.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
const { buildSubstituteCandidates, detectDishCategory } = context.exports;
const original = { dishId: '1201', portionSizeG: 65, plannedCalories: 130, dish: { name: 'Thịt bò xào khóm', dishType: 'MAIN' } };
const dish = (id, calories = 200, overrides = {}) => ({ id, name: 'Thịt gà rô ti', dishType: 'MAIN', isActive: true, nutritionAvailable: true, standardServingSizeG: 100, totalCalories: calories, totalProteinG: 10, totalFatG: 4, totalCarbG: 20, ...overrides });
test('substitute IDs and nutrition come from the supplied catalog, scaled by actual portion', () => {
  const result = buildSubstituteCandidates([dish('1408')], original, 'ALLERGIES');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1408');
  assert.equal(result[0].name, 'Thịt gà rô ti');
  assert.equal(result[0].calories, 130);
  assert.equal(result[0].proteinG, 6.5);
  assert.equal(result[0].fatG, 2.6);
});
test('has no fallback dishes when the catalog is empty or ineligible', () => {
  const result = buildSubstituteCandidates([dish('1201'), dish('0'), dish('x'), dish('1408', 200, { isActive: false }), dish('1409', 200, { nutritionAvailable: false }), dish('1410', 200, { dishType: 'SOUP' })], original, 'COMMON');
  assert.equal(result.length, 0);
  assert.equal(buildSubstituteCandidates([], original, 'COMMON').length, 0);
});
test('preserves existing category grouping for the replacement dialog', () => {
  assert.equal(detectDishCategory('Thịt gà rô ti', 'MAIN').code, 'MAIN');
  assert.equal(detectDishCategory('Cơm chiên Dương Châu', 'RICE').code, 'STAPLE');
});
test('sorts real calories without manufacturing calorie bonuses or duplicate IDs', () => {
  const catalog = [dish('1408', 200), dish('1409', 100), dish('1408', 200)];
  assert.equal(buildSubstituteCandidates(catalog, original, 'OBESE')[0].id, '1409');
  const result = buildSubstituteCandidates(catalog, original, 'STUNTED');
  assert.equal(result.length, 2);
  assert.equal(result[0].calories, 130);
});
