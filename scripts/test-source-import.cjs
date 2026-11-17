#!/usr/bin/env node
// Integration check on the configured PostgreSQL server. Everything is rolled back.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { buildSql } = require('./import-source-catalog.cjs');
const { extractCatalog, normalizeName } = require('./lib/source-menu-catalog.cjs');
const legacy = require('../database/reference/unverified-seed-recipes.json');
const root = path.resolve(__dirname, '..');
const r = createRequire(path.join(root, 'apps/backend/package.json'));
r('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const client = new (r('pg').Client)({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 10000 });
const withoutTransaction = (sql) => sql.replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '');

(async () => {
  try {
    await client.connect();
    await client.query('BEGIN');
    const schema = `source_import_test_${process.pid}`;
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};`);
    await client.query(withoutTransaction(fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8')));
    await client.query(withoutTransaction(fs.readFileSync(path.join(root, 'database/seed.sql'), 'utf8')));
    const isFresh = process.argv.includes('--fresh');
    const legacyConfig = process.argv.includes('--legacy-config');
    if (legacyConfig) {
      await client.query(fs.readFileSync(path.join(root, 'scripts/test/fixtures/legacy-nutrition-configuration.sql'), 'utf8'));
    }
    if (!isFresh) {
      // Simulate an existing volume created with the old sample recipes.
      for (const row of legacy.rows) {
        await client.query('INSERT INTO dish_recipes(id,dish_id,ingredient_id,gross_weight_g,net_weight_g,note) VALUES ($1,$2,$3,$4,$5,$6)',
          [row.id,row.dishId,row.ingredientId,row.grossWeightG,row.netWeightG,row.note]);
      }
    }
    const catalog = extractCatalog(path.join(root, 'docs/dử liệu chính'));
    const sourceKeys = new Set(catalog.dishes.map((dish) => dish.key));
    const beforeDishes = (await client.query('SELECT id,name FROM dishes')).rows;
    const outsideIds = beforeDishes.filter((dish) => !sourceKeys.has(normalizeName(dish.name))).map((dish) => dish.id);
    const linkedMenuCount = Number((await client.query('SELECT count(*) FROM menu_dishes WHERE dish_id=ANY($1::bigint[])', [outsideIds])).rows[0].count);
    // Simulate a runtime-added FK table absent from schema.sql.
    await client.query('CREATE TABLE extra_dish_consumer(id BIGINT PRIMARY KEY, dish_id BIGINT REFERENCES dishes(id) ON DELETE CASCADE)');
    await client.query('INSERT INTO extra_dish_consumer(id,dish_id) VALUES (1,$1)', [outsideIds[0]]);
    const sql = withoutTransaction(buildSql(catalog)).replace('ON COMMIT DROP', '');
    await client.query(sql);
    const configCounts = async () => (await client.query(`SELECT
      (SELECT count(*)::int FROM dish_frequency_rules WHERE source_metadata ? 'seedKey') AS frequency,
      (SELECT count(*)::int FROM dish_spacing_rules WHERE source_metadata ? 'seedKey') AS spacing,
      (SELECT count(*)::int FROM nutrition_intake_standards WHERE source_metadata ? 'seedKey') AS intake,
      (SELECT count(*)::int FROM audit_logs WHERE action='INITIALIZE_NUTRITION_CONFIGURATION') AS audit`)).rows[0];
    assert.deepEqual(await configCounts(), { frequency: 7, spacing: 7, intake: 4, audit: 1 });
    const nursery = (await client.query(`SELECT energy_kcal_min,energy_kcal_max,carbohydrate_ratio_max,calcium_mg_min
      FROM nutrition_intake_standards WHERE source_metadata ? 'seedKey' AND age_group='NHA_TRE' AND meal_scope='DAYBOARDING'`)).rows[0];
    assert.equal(Number(nursery.energy_kcal_min), 600);
    assert.equal(Number(nursery.energy_kcal_max), 651);
    assert.equal(Number(nursery.carbohydrate_ratio_max), 50);
    assert.equal(nursery.calcium_mg_min, null, 'Unspecified requirements must remain unknown, not zero');
    assert.equal(Number((await client.query('SELECT count(*) FROM dish_spacing_rules WHERE source_metadata IS NOT NULL AND is_active=TRUE')).rows[0].count), 0);
    if (legacyConfig) {
      assert.deepEqual((await client.query("SELECT min_occurrences,max_occurrences,period_type FROM dish_frequency_rules WHERE target_code='MANUAL_TEST'")).rows[0],
        { min_occurrences: 1, max_occurrences: 3, period_type: 'PER_WEEK' });
      assert.equal(Number((await client.query("SELECT calcium_mg_min FROM nutrition_intake_standards WHERE standard_name='Manual legacy standard'")).rows[0].calcium_mg_min), 321);
      assert.equal(Number((await client.query("SELECT target_id FROM dish_spacing_rules WHERE rule_name='Manual legacy spacing'")).rows[0].target_id),
        Number((await client.query("SELECT id FROM dish_categories WHERE code='MAIN'")).rows[0].id));
    }
    await client.query("UPDATE dish_frequency_rules SET max_occurrences=9 WHERE source_metadata->>'seedKey'='DOC_FREQUENCY_MAIN_V1'");
    assert.equal(Number((await client.query('SELECT count(*) FROM dishes')).rows[0].count), catalog.dishes.length);
    assert.equal(Number((await client.query('SELECT count(*) FROM source_catalog_removed_dishes')).rows[0].count), outsideIds.length);
    assert.equal(Number((await client.query("SELECT count(*) FROM source_catalog_removed_dish_references WHERE table_name='menu_dishes'")).rows[0].count), linkedMenuCount);
    assert.equal(Number((await client.query("SELECT count(*) FROM source_catalog_removed_dish_references WHERE table_name='extra_dish_consumer'")).rows[0].count), 1);
    assert.equal(Number((await client.query('SELECT count(*) FROM extra_dish_consumer')).rows[0].count), 0);
    for (const dish of (await client.query('SELECT name FROM dishes')).rows) {
      assert.ok(sourceKeys.has(normalizeName(dish.name)), `Dish not found in DOC source: ${dish.name}`);
    }
    assert.equal(Number((await client.query('SELECT count(*) FROM dish_recipes')).rows[0].count), 177);
    assert.equal(Number((await client.query('SELECT count(*) FROM source_catalog_legacy_recipes')).rows[0].count), isFresh ? 0 : legacy.rows.length);
    assert.equal(Number((await client.query('SELECT count(*) FROM dish_nutrition')).rows[0].count), 59);
    const papaya = (await client.query("SELECT n.energy_kcal,n.protein_g,n.calcium_mg,n.source_metadata FROM dish_nutrition n JOIN dishes d ON d.id=n.dish_id WHERE d.name='Đu đủ chín'")).rows[0];
    assert.equal(Number(papaya.energy_kcal), 22.8); // 60 g * 38 kcal / 100 g
    assert.equal(Number(papaya.protein_g), 0.6);
    assert.equal(Number(papaya.calcium_mg), 24);
    assert.equal(papaya.source_metadata.status, 'REFERENCE_UNVERIFIED');
    const before = (await client.query('SELECT count(*)::int AS count FROM dishes')).rows[0].count;
    const firstIds = (await client.query('SELECT id FROM dishes')).rows.map((row) => row.id);
    await client.query('DROP TABLE source_dish_ids');
    await client.query(sql);
    assert.deepEqual(await configCounts(), { frequency: 7, spacing: 7, intake: 4, audit: 1 });
    assert.equal((await client.query("SELECT max_occurrences FROM dish_frequency_rules WHERE source_metadata->>'seedKey'='DOC_FREQUENCY_MAIN_V1'")).rows[0].max_occurrences, 9,
      'Import must preserve manual configuration edits');
    const after = (await client.query('SELECT count(*)::int AS count FROM dishes')).rows[0].count;
    const newRows = (await client.query('SELECT id,name FROM dishes WHERE NOT (id = ANY($1::bigint[]))', [firstIds])).rows;
    assert.equal(after, before, `Reimport added duplicate dishes: ${JSON.stringify(newRows)}`);
    const active = (await client.query("SELECT count(*)::int AS count FROM dishes WHERE status='ACTIVE'")).rows[0].count;
    assert.equal(active, catalog.dishes.length);
    const food = (await client.query("SELECT energy_kcal_100g, protein_g, refuse_rate_percent FROM food_ingredients WHERE name='Gạo tẻ máy'")).rows[0];
    assert.equal(Number(food.energy_kcal_100g), 346);
    assert.equal(Number(food.protein_g), 7.9);
    const missing = (await client.query("SELECT count(*)::int AS count FROM dishes WHERE status='ACTIVE' AND nutrition_verified=FALSE")).rows[0].count;
    assert.equal(missing, catalog.dishes.length);
    const referenceAfterRepeat = (await client.query("SELECT count(*) FROM dishes WHERE source_metadata->>'recipeStatus'='REFERENCE_RESTORED'")).rows[0];
    assert.equal(Number(referenceAfterRepeat.count), 59, 'Reimport reset reference provenance');
    const preservedId = (await client.query("SELECT id FROM dishes WHERE status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM dish_recipes r WHERE r.dish_id=dishes.id) ORDER BY id LIMIT 1")).rows[0].id;
    await client.query("UPDATE dishes SET status='INACTIVE', nutrition_verified=TRUE WHERE id=$1", [preservedId]);
    await client.query('DROP TABLE source_dish_ids');
    await client.query(sql);
    const preserved = (await client.query('SELECT status,nutrition_verified FROM dishes WHERE id=$1', [preservedId])).rows[0];
    assert.equal(preserved.status, 'INACTIVE', 'Reimport reactivated a manually paused dish');
    assert.equal(preserved.nutrition_verified, true, 'Reimport reset manual recipe verification');
    // A manually supplied recipe must survive re-import, and its cache must refresh.
    const rice = (await client.query("SELECT id FROM food_ingredients WHERE name='Gạo tẻ máy'")).rows[0].id;
    const manualRecipe = (await client.query('INSERT INTO dish_recipes(dish_id,ingredient_id,gross_weight_g,net_weight_g,note) VALUES ($1,$2,50,50,$3) RETURNING id',
      [preservedId, rice, 'Manually entered integration-test quantities'])).rows[0];
    await client.query('DROP TABLE source_dish_ids');
    await client.query(sql);
    assert.equal(Number((await client.query('SELECT count(*) FROM dish_recipes WHERE id=$1', [manualRecipe.id])).rows[0].count), 1);
    await client.query('UPDATE food_ingredients SET energy_kcal_100g=400 WHERE id=$1', [rice]);
    const cache = (await client.query('SELECT energy_kcal FROM dish_nutrition WHERE dish_id=$1', [preservedId])).rows[0];
    assert.equal(Number(cache.energy_kcal), 200);
    console.log(JSON.stringify({ passed: true, scenario: isFresh ? 'fresh-database' : 'existing-volume', activeDishes: active,
      removedNonSourceDishes: outsideIds.length, archivedMenuLinks: linkedMenuCount,
      restoredRecipeRows: 177, calculatedNutritionRows: 59, papaya60gKcal: Number(papaya.energy_kcal),
      archivedSeedRecipes: isFresh ? 0 : legacy.rows.length, configuration: await configCounts(), legacyConfigMigrated: legacyConfig,
      idempotent: true, manualRecipePreserved: true, ingredientCacheRefresh: true, rolledBack: true }));
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
