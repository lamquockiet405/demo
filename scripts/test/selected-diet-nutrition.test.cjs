const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const frontendRequire = createRequire(path.join(root, 'apps/frontend/package.json'));
const ts = frontendRequire('typescript');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const context = { exports: {}, require: name => {
    if (name.endsWith('/weekly-menus.api')) return { weeklyMenusApi: {} };
    if (name === './RecipeInspectionModal') return { RecipeInspectionModal: () => null };
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
    return frontendRequire(name);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, context, { filename });
  cache.set(filename, context.exports);
  return context.exports;
}
const { calculateSelectedDietNutrition: calculate } = load('apps/frontend/src/features/menus/utils/selected-diet-nutrition.ts');
const item = (id, name, calories, overrides = {}) => ({
  id: String(id), dishId: String(id), dayOfWeek: 1, mealTime: 'LUNCH',
  portionSizeG: 100, plannedCalories: calories, nutritionAvailable: true,
  dish: { id: String(id), name, standardServingSizeG: 100, totalCalories: calories,
    totalProteinG: 10, totalFatG: 5, totalCarbG: 20, nutritionAvailable: true },
  ...overrides,
});
const original = item(1, 'Món gốc', 600);
const rice = item(2, 'Cơm', 200);
const selected = item(3, 'Món riêng', 300, {
  specialDietNotes: '[Loại 1: SDD] Thay cho: Món gốc -> Đổi sang: Món riêng',
});

test('common meals do not imply a selection or fabricate group nutrition', () => {
  const result = calculate([original, rice], []);
  assert.equal(result.statusText, 'Chưa chọn món');
  assert.equal(result.statusType, 'empty');
  for (const field of ['calo', 'p', 'l', 'g', 'pPct', 'lPct', 'gPct']) assert.equal(result[field], 0);
  assert.equal(result.isOptimal, false);
});

test('saved selection replaces its original and uses real portion quantities', () => {
  const result = calculate([original, rice], [{ ...selected, portionSizeG: 50, plannedCalories: 150 }]);
  assert.equal(result.calo, 350);
  assert.equal(result.p, 15);
  assert.equal(result.l, 7.5);
  assert.equal(result.g, 30);
  assert.equal(result.statusText, 'Đã chọn 1 món riêng');
  assert.equal(result.isOptimal, false);
  assert.equal(result.pPct + result.lPct + result.gPct, 100);
});

test('a replacement only removes the matching meal when a dish appears twice in a day', () => {
  const breakfast = { ...original, id: '4', mealTime: 'BREAKFAST' };
  assert.equal(calculate([breakfast, original, rice], [selected]).calo, 1100);
});

test('deleted selections return to the unselected state', () => {
  assert.equal(calculate([original, rice], [{ ...selected, deletedAt: '2026-11-05' }]).statusText, 'Chưa chọn món');
});

test('missing recipe or portion data never produces a partial daily total', () => {
  assert.equal(calculate([original, rice], [{ ...selected, nutritionAvailable: false }]).statusText, 'Chưa đủ định lượng');
  assert.equal(calculate([original, { ...rice, nutritionAvailable: false }], [selected]).statusType, 'empty');
  assert.equal(calculate([original, rice], [{ ...selected, portionSizeG: 0 }]).statusType, 'empty');
});

test('a replaced original with unknown nutrition does not hide a fully quantified replacement', () => {
  assert.equal(calculate([{ ...original, nutritionAvailable: false }, rice], [selected]).calo, 500);
});

test('unmatched selections cannot be added on top of the common plan', () => {
  assert.equal(calculate([rice], [selected]).statusType, 'empty');
  assert.equal(calculate([original, rice], [{ ...selected, mealTime: 'BREAKFAST' }]).calo, 0);
});

const React = frontendRequire('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server');
const { WeeklyGridTable } = load('apps/frontend/src/features/menus/components/WeeklyGridTable.tsx');
function renderFooter(dishes) {
  const html = renderToStaticMarkup(React.createElement(WeeklyGridTable, {
    menu: { id: '1', title: 'Test', targetAgeGroup: 'MAU_GIAO', menuDishes: dishes },
    readOnly: true, onOpenDishDrawer() {}, async onRemoveDish() {},
  }));
  return html.slice(html.indexOf('<tfoot'));
}
test('the table shows pending labels and no calorie/macronutrient totals for all three unselected groups', () => {
  const footer = renderFooter([original, rice]);
  const groups = footer.slice(footer.indexOf('Nhóm 1 ·'));
  assert.equal((groups.match(/Chưa chọn món/g) || []).length, 3);
  assert.doesNotMatch(groups, /\d+(?:\.\d+)? Kcal|P: \d|L: \d|G: \d/);
  assert.doesNotMatch(groups, /Phục hồi SDD|Giảm béo TT 28|an toàn dị ứng|Đạm \+18%/i);
  assert.match(footer, /800\.0 Kcal/);
});

test('saving one group selection leaves the other two groups pending', () => {
  const footer = renderFooter([original, rice, selected]);
  const groups = footer.slice(footer.indexOf('Nhóm 1 ·'));
  assert.match(groups, /500\.0 Kcal/);
  assert.equal((groups.match(/Chưa chọn món/g) || []).length, 2);
  assert.equal((groups.match(/Đã chọn 1 món riêng/g) || []).length, 1);
});
