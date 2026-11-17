// Verifies the isolated local Docker database and API. Deletes only its own fixture.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { buildSql, targets } = require('./prepare-drink-recipes.cjs');
const root = path.resolve(__dirname, '..');
const { Client } = createRequire(path.join(root, 'apps/backend/package.json'))('pg');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.docker-test/test.env'), 'utf8').trim()
  .split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const database = env.TEST_POSTGRES_DB || 'kidmeal_test';
assert.ok(database.startsWith('kidmeal_test'));
const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test', database, password: env.TEST_POSTGRES_PASSWORD });
const title = `drink-rotation-qa-${Date.now()}`;
async function request(route, token, body, expected = body === undefined ? 200 : 201) {
  const response = await fetch(`http://127.0.0.1:3001/api/v1/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(result.message)}`);
  return result.data ?? result;
}
async function main() {
  await client.connect();
  try {
    const snapshot = async () => (await client.query(`SELECT (SELECT count(*) FROM dish_recipes)::int AS recipes,
      (SELECT count(*) FROM audit_logs WHERE action='DRINK_RECIPES_RESTORED')::int AS events,
      (SELECT md5(string_agg(row_to_json(r)::text,',' ORDER BY id)) FROM dish_recipes r) AS fingerprint`)).rows[0];
    const before = await snapshot();
    await client.query(buildSql());
    assert.deepEqual(await snapshot(), before, 'Reapplying migration changed recipes or duplicated audit events');
    const computed = await client.query(`SELECT d.id,d.name,d.nutrition_verified,d.source_metadata,
      n.energy_kcal,n.protein_g,n.fat_g,n.carb_g,
      round(sum(f.energy_kcal_100g*r.net_weight_g/100),2) AS expected_kcal,
      round(sum(f.protein_g*r.net_weight_g/100),2) AS expected_protein,
      round(sum(f.fat_g*r.net_weight_g/100),2) AS expected_fat,
      round(sum(f.carb_g*r.net_weight_g/100),2) AS expected_carb
      FROM dishes d JOIN dish_nutrition n ON n.dish_id=d.id
      JOIN dish_recipes r ON r.dish_id=d.id JOIN food_ingredients f ON f.id=r.ingredient_id
      WHERE d.source_metadata->>'recipeStatus'='APPROVED_REFERENCE'
      GROUP BY d.id,n.dish_id ORDER BY d.id`);
    assert.equal(computed.rows.length, targets.length);
    for (const row of computed.rows) {
      assert.equal(row.nutrition_verified, false);
      assert.equal(row.energy_kcal, row.expected_kcal);
      assert.equal(row.protein_g, row.expected_protein);
      assert.equal(row.fat_g, row.expected_fat);
      assert.equal(row.carb_g, row.expected_carb);
    }
    const familyById = new Map(computed.rows.map(row => [String(row.id), row.source_metadata.drinkFamily]));
    const token = (await request('auth/quick-login', null, { roleCode: 'NUTRITIONIST' }, 200)).accessToken;
    const available = await request('menus/available-dishes', token);
    for (const row of computed.rows) {
      const item = available.find(d => String(d.id) === String(row.id));
      assert.ok(item?.nutritionAvailable && item.nutritionReference, row.name);
    }
    let lastPreview;
    for (const includeBreakfast of [true, false]) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const preview = await request('menus/auto-generate', token, {
          title, weekStartDate: '2026-11-09', ageGroup: 'MAU_GIAO', daysCount: 5, includeBreakfast, previewOnly: true,
        });
        const families = [];
        for (const day of preview.dailySummary) {
          const afternoon = day.dishes.filter(d => d.mealTime === 'AFTERNOON_SNACK');
          assert.equal(afternoon.filter(d => d.dishType === 'DRINK').length, 1);
          assert.equal(afternoon.filter(d => d.dishType === 'SNACK_AFTERNOON').length, 1);
          assert.equal(new Set(day.dishes.map(d => d.dishId)).size, day.dishes.length);
          const selected = afternoon.find(d => d.dishType === 'DRINK');
          families.push(familyById.get(selected.dishId) || selected.dishId);
        }
        assert.equal(new Set(families).size, 5, 'Expected five distinct drink families');
        assert.ok(preview.antiFatigueReport.violations.some(v => v.startsWith('REFERENCE_NUTRITION:')));
        lastPreview = preview;
      }
    }
    const saved = await request('menus/auto-generate', token, { title, weekStartDate: '2026-11-09',
      ageGroup: 'MAU_GIAO', dailyPlan: lastPreview.dailySummary, includeBreakfast: false });
    assert.equal(saved.nutritionReference, true);
    const listed = await request(`menus?search=${encodeURIComponent(title)}`, token);
    const listedMenu = listed.items.find(menu => menu.id === saved.id);
    assert.equal(listedMenu.nutritionReference, true);
    assert.equal(listedMenu.dailyAverageCalories, saved.dailyAverageCalories);
    const savedDrinks = saved.menuDishes.filter(d => d.mealTime === 'AFTERNOON_SNACK' && d.dish.dishType === 'DRINK');
    assert.equal(savedDrinks.length, 5);
    assert.ok(savedDrinks.some(d => d.nutritionReference));
    console.log(JSON.stringify({ recipes: computed.rows.length, previewsChecked: 10,
      idempotent: true, calculatedNutritionMatches: true, savedReferenceLabels: true,
      example: lastPreview.dailySummary.map(day => ({ day: day.dayName,
        drink: day.dishes.find(d => d.dishType === 'DRINK').dishName })) }, null, 2));
  } finally {
    await client.query('DELETE FROM menus WHERE title=$1', [title]);
    await client.end();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
