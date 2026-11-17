const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { extractCatalog, normalizeName } = require('../lib/source-menu-catalog.cjs');
const { buildSql } = require('../import-source-catalog.cjs');
const reference = require('../../database/reference/food-composition.json');
const directory = path.resolve(__dirname, '../../docs/dử liệu chính');

test('reads all ten weeks in document order and retains every meal occurrence', () => {
  const catalog = extractCatalog(directory);
  assert.equal(catalog.sourceFileCount, 5);
  assert.deepEqual(catalog.weeks.map((week) => week.weekNumber), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(catalog.weeks[0].days[0].date, '2025-09-08');
  assert.equal(catalog.weeks.at(-1).days.at(-1).date, '2025-11-14');
  assert.equal(catalog.occurrences, 347);
  assert.equal(catalog.dishes.length, 172);
  assert.equal(catalog.duplicateOccurrencesSkipped, 175);
  for (const week of catalog.weeks) for (const day of week.days) {
    assert.equal(day.meals.length, 3);
    for (const meal of day.meals) for (const key of meal.dishes) assert.ok(catalog.dishes.some((dish) => dish.key === key));
  }
});

test('deduplication keeps accents and distinct ingredients, preserving source spelling', () => {
  assert.equal(normalizeName('  Cá Ngừ chiên sốt cà chua. '), normalizeName('Cá ngừ chiên sốt cà chua'));
  assert.notEqual(normalizeName('Cá rô'), normalizeName('Cà rốt'));
  const catalog = extractCatalog(directory);
  const milk = catalog.dishes.find((dish) => dish.key === normalizeName('Sữa dinh dưỡng'));
  assert.equal(milk.sources.length, 50);
  assert.equal(milk.categoryCode, 'SNACK_MORNING');
  const rice = catalog.dishes.find((dish) => dish.name.startsWith('Cơm Dương Châu ('));
  assert.ok(rice.name.includes('lạp xưởng'));
  assert.ok(!catalog.dishes.some((dish) => dish.name.startsWith('(đậu')));
});

test('reference units distinguish unknown cells from measured zero', () => {
  assert.equal(new Set(reference.rows.map((row) => row[0])).size, reference.rows.length);
  for (const row of reference.rows) {
    assert.equal(row.length, reference.columns.length);
    assert.ok(row[3] > 0 && row[3] <= 100);
    for (const number of row.slice(3)) assert.ok(number === null || Number.isFinite(number) && number >= 0);
  }
  const rice = reference.rows.find((row) => row[0] === 2);
  assert.equal(rice[4], 346);
  assert.equal(rice[5], 7.9);
  const tuna = reference.rows.find((row) => row[0] === 121);
  assert.equal(tuna[3], 58);
  assert.equal(tuna[7], 0);
  assert.equal(reference.rows.find((row) => row[0] === 120)[10], null);
});

test('generated import is deterministic, atomic, retains existing IDs and records unknown quantities', () => {
  const catalog = extractCatalog(directory);
  const sql = buildSql(catalog);
  assert.equal(sql, buildSql(extractCatalog(directory)));
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /WHERE NOT EXISTS/);
  assert.match(sql, /MISSING_SOURCE_QUANTITIES/);
  assert.match(sql, /missingNutrients/);
  assert.ok(!/TRUNCATE|DELETE FROM food_ingredients/i.test(sql));
  assert.match(sql, /Source dish selection is incomplete; refusing deletion/);
  assert.match(sql, /source_catalog_removed_dish_references/);
  assert.match(sql, /DELETE FROM dishes dish USING source_dish_cleanup/);
  assert.match(sql, /source_catalog_legacy_recipes/);
  assert.match(sql, /r.id = baseline.id/);
  assert.match(sql, /r.net_weight_g = baseline."netWeightG"/);
});
