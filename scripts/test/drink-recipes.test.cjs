const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSql, targets } = require('../prepare-drink-recipes.cjs');
const archive = require('../../database/reference/unverified-seed-recipes.json');

test('drink templates have archived quantitative rows and enough distinct families for a week', () => {
  assert.equal(targets.length, 10);
  assert.ok(new Set(targets.map(t => t[3])).size >= 5);
  for (const [key, legacyId, serving, , omitted] of targets) {
    assert.ok(serving > 0, key);
    const rows = archive.rows.filter(row => row.dishId === legacyId && !omitted.includes(row.ingredientId));
    assert.ok(rows.length > 0, key);
    assert.ok(rows.every(row => row.netWeightG > 0 && row.grossWeightG >= row.netWeightG), key);
  }
});

test('migration preserves existing recipes, keeps references unverified, and relies on ingredient computation', () => {
  const sql = buildSql();
  assert.equal(sql, buildSql());
  assert.match(sql, /WHERE NOT EXISTS\(SELECT 1 FROM dish_recipes/);
  assert.match(sql, /nutrition_verified=false/);
  assert.match(sql, /'menuPlanningEnabled',true/);
  assert.match(sql, /'quantitiesIndependentlyVerified',false/);
  assert.match(sql, /'omittedLegacyIngredientIds'/);
  assert.ok(!/SET energy_kcal|nutrition_verified=TRUE|DELETE FROM|TRUNCATE/i.test(sql));
});
