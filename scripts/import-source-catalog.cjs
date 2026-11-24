#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { extractCatalog } = require('./lib/source-menu-catalog.cjs');
const { referenceRecipeSql } = require('./lib/reference-recipes.cjs');
const { configurationSql } = require('./lib/nutrition-configuration.cjs');
const root = path.resolve(__dirname, '..');
const reference = require('../database/reference/food-composition.json');
const codepage = require('../database/reference/legacy-codepage.json');
const legacyRecipes = require('../database/reference/unverified-seed-recipes.json');
const quote = (value) => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const categoryNames = {
  CEREAL: 'Ngũ cốc và sản phẩm chế biến', TUBER: 'Khoai củ và sản phẩm chế biến',
  LEGUME: 'Đậu đỗ, hạt giàu đạm và béo', VEGETABLE: 'Rau, củ, quả làm rau',
  FRUIT: 'Quả chín / Trái cây', FAT: 'Dầu, mỡ và bơ', MEAT: 'Thịt và sản phẩm chế biến',
  FISH: 'Thủy sản và sản phẩm chế biến', EGG: 'Trứng và sản phẩm chế biến', MILK: 'Sữa và chế phẩm sữa',
};
const columns = { energyKcal100g: 'energy_kcal_100g', proteinG: 'protein_g', fatG: 'fat_g',
  carbG: 'carb_g', fiberG: 'fiber_g', calciumMg: 'calcium_mg', ironMg: 'iron_mg', zincMg: 'zinc_mg', vitaminAMcg: 'vitamin_a_mcg' };

function buildSql(catalog, { actorId = null } = {}) {
  if (actorId !== null && !/^[1-9][0-9]*$/.test(String(actorId))) throw new Error('actorId must be a positive integer');
  const vietnameseUpper = 'ĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ';
  const statements = [
    '-- Generated from source .doc files and user-supplied food composition images.\nBEGIN;',
    "SELECT pg_advisory_xact_lock(hashtext('kidmeal-source-catalog'));",
    fs.readFileSync(path.join(root, 'database/migrations/20261103-source-catalog.sql'), 'utf8'),
    fs.readFileSync(path.join(root, 'database/migrations/20261103-archive-unverified-seed-recipes.sql'), 'utf8'),
    fs.readFileSync(path.join(root, 'database/migrations/20261103-remove-non-source-dishes.sql'), 'utf8'),
    fs.readFileSync(path.join(root, 'database/migrations/20261103-reference-recipe-provenance.sql'), 'utf8'),
    fs.readFileSync(path.join(root, 'database/migrations/20261103-nutrition-configuration.sql'), 'utf8'),
    fs.readFileSync(path.join(root, 'database/migrations/20261103-relational-integrity.sql'), 'utf8')
      .replace(/^(?:BEGIN|COMMIT);\s*$/gm, ''),
    `WITH run AS (INSERT INTO source_catalog_import_runs(run_key,initiated_by,note)
      VALUES ('catalog_import_' || txid_current()::text || '_' || extract(epoch FROM clock_timestamp())::text,
        ${actorId === null ? 'NULL' : quote(actorId)},
        ${quote(actorId === null ? 'Source catalog CLI import; operator identity was not supplied' : 'Source catalog CLI import with an identified operator')}) RETURNING id)
      SELECT set_config('kidmeal.import_run_id',id::text,true) FROM run;`,
    `CREATE OR REPLACE FUNCTION pg_temp.catalog_key(value TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
      SELECT trim(regexp_replace(regexp_replace(lower(translate(normalize(value, NFC), ${quote(vietnameseUpper)}, ${quote(vietnameseUpper.toLowerCase())})), '[.,;:]+', ' ', 'g'), '\\s+', ' ', 'g'));
    $$;`,
    `CREATE OR REPLACE FUNCTION pg_temp.repair_name(value TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
      DECLARE c TEXT; code INTEGER; encoded TEXT := ''; cp TEXT := ${quote(codepage)};
      BEGIN
        IF value IS NULL THEN RETURN NULL; END IF;
        FOR i IN 1..char_length(value) LOOP
          c := substr(value, i, 1); code := ascii(c);
          IF code >= 128 THEN
            code := strpos(cp, c) + 127;
            IF code = 127 THEN RETURN value; END IF;
          END IF;
          encoded := encoded || lpad(to_hex(code), 2, '0');
        END LOOP;
        RETURN convert_from(decode(encoded, 'hex'), 'UTF8');
      EXCEPTION WHEN character_not_in_repertoire OR untranslatable_character THEN RETURN value;
      END;
    $$;`,
    'UPDATE food_categories SET name = pg_temp.repair_name(name);',
    'UPDATE food_ingredients SET name = pg_temp.repair_name(name);',
    'UPDATE dishes SET name = pg_temp.repair_name(name), description = pg_temp.repair_name(description);',
  ];
  for (const name of Object.values(categoryNames)) {
    statements.push(`INSERT INTO food_categories(name) SELECT ${quote(name)} WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = ${quote(name)});`);
  }
  const ingredientAliases = {
    'Gạo tẻ máy (gạo trắng)': 'Gạo tẻ máy', 'Gạo nếp cái hoa vàng': 'Gạo nếp (loại thường)',
    'Bột mì đa dụng': 'Bột mì', 'Bánh phở tươi': 'Bánh phở', 'Bún tươi': 'Bún',
    'Ngô ngọt bắp non tươi': 'Ngô bắp tươi', 'Miến dong / Bún tàu': 'Miến dong',
    'Khoai tây Đà Lạt': 'Khoai tây', 'Đậu phộng (lạc nhân)': 'Lạc hạt',
    'Đậu xanh hạt tiêu': 'Đậu xanh (đậu tắt)', 'Đậu phụ mơ (tàu hũ trắng)': 'Đậu phụ',
    'Rau ngót lá tươi': 'Rau ngót', 'Rau mồng tơi tươi': 'Rau mồng tơi',
    'Rau cải cúc (tần ô)': 'Cải cúc', 'Rau cải ngọt': 'Cải ngọt',
    'Rau bắp cải trắng': 'Cải bắp', 'Bông cải xanh (súp lơ xanh)': 'Súp lơ xanh',
    'Bí xanh (bí đao)': 'Bí đao (bí xanh)', 'Bầu non tươi': 'Bầu', 'Mướp hương': 'Mướp',
    'Cà rốt Đà Lạt': 'Cà rốt (củ đỏ, vàng)', 'Cà chua chín': 'Cà chua',
    'Dưa hấu ruột đỏ': 'Dưa hấu', 'Cá lóc đồng': 'Cá quả',
  };
  for (const [oldName, newName] of Object.entries(ingredientAliases)) {
    statements.push(`UPDATE food_ingredients SET name = ${quote(newName)} WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key(${quote(oldName)}) AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key(${quote(newName)}));`);
  }
  statements.push(`UPDATE food_ingredients SET status = 'INACTIVE', source_metadata = ${json({ kind: 'LEGACY_UNVERIFIED', missingNutrients: Object.keys(columns) })};`);
  for (const row of reference.rows) {
    if (row.length !== reference.columns.length) throw new Error(`Invalid reference row ${row[0]}`);
    const item = Object.fromEntries(reference.columns.map((name, index) => [name, row[index]]));
    const metadata = { kind: 'FOOD_COMPOSITION_IMAGE', source: reference.source, sourceRow: item.sourceRow,
      basisGrams: 100, ediblePercent: item.ediblePercent,
      missingNutrients: Object.keys(columns).filter((key) => item[key] === null), values: item };
    const values = Object.entries(columns).map(([key, column]) => [column, item[key] ?? 0]);
    const category = `(SELECT id FROM food_categories WHERE name = ${quote(categoryNames[item.category])} ORDER BY id LIMIT 1)`;
    statements.push(`INSERT INTO food_ingredients(name, category_id) SELECT ${quote(item.name)}, ${category} WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key(${quote(item.name)}));`);
    statements.push(`UPDATE food_ingredients SET name = ${quote(item.name)}, category_id = ${category}, unit = 'g', status = 'ACTIVE', ${values.map(([key, value]) => `${key} = ${value}`).join(', ')}, refuse_rate_percent = ${100 - item.ediblePercent}, source_metadata = ${json(metadata)} WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key(${quote(item.name)}) ORDER BY id LIMIT 1);`);
  }
  const categoryLabels = { MAIN: 'Món chính', SOUP: 'Canh / Súp', RICE: 'Cơm', DESSERT: 'Tráng miệng',
    SNACK_MORNING: 'Phụ sáng', SNACK_AFTERNOON: 'Xế + Phụ chiều', DRINK: 'Thức uống / Sữa chua' };
  for (const [code, name] of Object.entries(categoryLabels)) {
    statements.push(`INSERT INTO dish_categories(code, name) VALUES (${quote(code)}, ${quote(name)}) ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;`);
  }
  statements.push(`CREATE TEMP TABLE source_dish_ids(id BIGINT PRIMARY KEY) ON COMMIT DROP;`);
  for (const dish of catalog.dishes) {
    const category = `(SELECT id FROM dish_categories WHERE code = ${quote(dish.categoryCode)})`;
    const metadata = { kind: 'SOURCE_MENU_DOC', key: dish.key, sources: dish.sources,
      recipeStatus: 'MISSING_SOURCE_QUANTITIES', servingSizeStatus: 'UNKNOWN' };
    statements.push(`INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT ${quote(dish.name)}, ${category}, 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = ${quote(dish.key)});`);
    // Keep the existing ID and references when an exact name already exists.
    // Re-importing preserves recipes subsequently verified by a user.
    statements.push(`WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = ${quote(dish.key)} ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = ${quote(dish.name)}, category_id = ${category},
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = ${json(metadata)} || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;`);
  }
  // Mark leftovers unverified before handling old recipe caches.
  statements.push("UPDATE dishes SET status = 'INACTIVE', nutrition_verified = FALSE WHERE id NOT IN (SELECT id FROM source_dish_ids);");
  // Only remove unchanged, identifiable seed rows. Manually entered recipes,
  // modified weights, new recipe IDs and verified dishes are preserved.
  statements.push(`CREATE TEMP TABLE seed_recipe_cleanup ON COMMIT DROP AS
    SELECT r.*, d.name AS dish_name, f.name AS ingredient_name
    FROM dish_recipes r JOIN dishes d ON d.id = r.dish_id
    JOIN food_ingredients f ON f.id = r.ingredient_id
    JOIN jsonb_to_recordset(${json(legacyRecipes.rows)}) AS baseline(
      id BIGINT, "dishId" BIGINT, "ingredientId" BIGINT,
      "grossWeightG" NUMERIC, "netWeightG" NUMERIC, note TEXT)
    ON r.id = baseline.id AND r.dish_id = baseline."dishId"
      AND r.ingredient_id = baseline."ingredientId"
      AND r.gross_weight_g = baseline."grossWeightG" AND r.net_weight_g = baseline."netWeightG"
      AND pg_temp.repair_name(r.note) IS NOT DISTINCT FROM baseline.note
    WHERE d.nutrition_verified = FALSE;`);
  statements.push(`INSERT INTO source_catalog_legacy_recipes(original_recipe_id, dish_name, ingredient_name, recipe)
    SELECT id, dish_name, ingredient_name,
      jsonb_build_object('id', id, 'dish_id', dish_id, 'ingredient_id', ingredient_id,
        'gross_weight_g', gross_weight_g, 'net_weight_g', net_weight_g, 'note', note)
    FROM seed_recipe_cleanup ON CONFLICT(original_recipe_id) DO NOTHING;`);
  statements.push(`INSERT INTO source_catalog_legacy_nutrition(original_dish_id, dish_name, nutrition)
    SELECT dn.dish_id, d.name, to_jsonb(dn) FROM dish_nutrition dn JOIN dishes d ON d.id=dn.dish_id
    WHERE dn.dish_id IN (SELECT dish_id FROM seed_recipe_cleanup)
    ON CONFLICT(original_dish_id) DO NOTHING;`);
  statements.push(`DELETE FROM dish_recipes r USING seed_recipe_cleanup old WHERE r.id = old.id;`);
  statements.push(`DELETE FROM dish_nutrition dn WHERE dn.dish_id IN (SELECT dish_id FROM seed_recipe_cleanup)
    AND NOT EXISTS (SELECT 1 FROM dish_recipes r WHERE r.dish_id = dn.dish_id);`);
  statements.push('DROP TABLE seed_recipe_cleanup;');
  const documents = [...new Map(catalog.dishes.flatMap((dish) => dish.sources)
    .map((source) => [source.file, { file: source.file, sha256: source.sourceSha256 }])).values()];
  statements.push(`UPDATE source_catalog_import_runs SET source_documents=${json(documents)}
    WHERE id=NULLIF(current_setting('kidmeal.import_run_id',true),'')::bigint;`);
  statements.push(`DO $$ BEGIN
    IF (SELECT COUNT(*) FROM source_dish_ids) <> ${catalog.dishes.length} OR ${catalog.dishes.length} = 0 THEN
      RAISE EXCEPTION 'Source dish selection is incomplete; refusing deletion';
    END IF;
  END $$;`);
  statements.push(`CREATE TEMP TABLE source_dish_cleanup ON COMMIT DROP AS
    SELECT d.id, to_jsonb(d) AS dish FROM dishes d
    WHERE NOT EXISTS (SELECT 1 FROM source_dish_ids source WHERE source.id = d.id);`);
  statements.push(`INSERT INTO source_catalog_removed_dishes(original_dish_id, dish, source_documents)
    SELECT id, dish, ${json(documents)} FROM source_dish_cleanup
    ON CONFLICT(original_dish_id) DO NOTHING;`);
  // Snapshot every actual FK-dependent row, including runtime-added tables.
  statements.push(`DO $$
    DECLARE dependency RECORD;
    BEGIN
      FOR dependency IN
        SELECT ns.nspname AS schema_name, relation.relname AS table_name, attribute.attname AS column_name
        FROM pg_constraint constraint_row
        JOIN pg_class relation ON relation.oid = constraint_row.conrelid
        JOIN pg_namespace ns ON ns.oid = relation.relnamespace
        JOIN pg_attribute attribute ON attribute.attrelid = constraint_row.conrelid
          AND attribute.attnum = constraint_row.conkey[1]
        WHERE constraint_row.contype = 'f' AND constraint_row.confrelid = 'dishes'::regclass
          AND array_length(constraint_row.conkey, 1) = 1
      LOOP
        EXECUTE format(
          'INSERT INTO source_catalog_removed_dish_references(original_dish_id, table_schema, table_name, column_name, row_hash, row_data)
           SELECT child.%I, %L, %L, %L, md5(to_jsonb(child)::text), to_jsonb(child)
           FROM %I.%I child JOIN source_dish_cleanup removed ON removed.id = child.%I
           ON CONFLICT DO NOTHING',
          dependency.column_name, dependency.schema_name, dependency.table_name, dependency.column_name,
          dependency.schema_name, dependency.table_name, dependency.column_name);
      END LOOP;
    END;
  $$;`);
  // Remove recipes first so their recalculation trigger still sees the parent dish.
  statements.push('DELETE FROM dish_recipes recipe USING source_dish_cleanup removed WHERE recipe.dish_id = removed.id;');
  statements.push('DELETE FROM dishes dish USING source_dish_cleanup removed WHERE dish.id = removed.id;');
  statements.push('DROP TABLE source_dish_cleanup;');
  statements.push(referenceRecipeSql(catalog));
  statements.push(configurationSql(catalog));
  statements.push('COMMIT;');
  return statements.join('\n\n') + '\n';
}

async function main() {
  process.chdir(root);
  const catalog = extractCatalog(path.join(root, 'docs', 'dử liệu chính'));
  const actorIndex = process.argv.indexOf('--actor-id');
  const actorId = actorIndex < 0 ? null : process.argv[actorIndex + 1];
  const sql = buildSql(catalog, { actorId });
  const output = path.join(root, 'database/generated');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'source-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'source-catalog.sql'), sql);
  const summary = { files: catalog.sourceFileCount, weeks: catalog.weeks.length, days: catalog.weeks.reduce((n, w) => n + w.days.length, 0),
    occurrences: catalog.occurrences, uniqueDishes: catalog.dishes.length, duplicateOccurrencesSkipped: catalog.duplicateOccurrencesSkipped,
    referenceFoods: reference.rows.length };
  console.log(JSON.stringify(summary));
  if (!process.argv.includes('--apply')) {
    console.log('Generated SQL and source inventory. Use --apply to update the configured database.');
    return;
  }
  const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
  backendRequire('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  if (!process.env.POSTGRES_HOST || !process.env.POSTGRES_DB || !process.env.POSTGRES_USER) {
    throw new Error('POSTGRES_HOST, POSTGRES_DB and POSTGRES_USER must be configured');
  }
  const client = new (backendRequire('pg').Client)({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const backup = {};
    for (const table of ['food_categories', 'food_ingredients', 'dish_categories', 'dishes', 'dish_recipes', 'dish_nutrition',
      'dish_frequency_rules', 'dish_spacing_rules', 'nutrition_intake_standards', 'audit_logs',
      'food_samples', 'food_inspections', 'menus', 'menu_rule_violations', 'nutrition_rule_codes',
      'nutritional_standards', 'nutrition_conversion_factors', 'schools', 'languages', 'system_configs',
      'growth_zscores', 'who_growth_standards']) {
      backup[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
    }
    for (const table of ['source_catalog_legacy_recipes', 'source_catalog_legacy_nutrition',
      'source_catalog_removed_dishes', 'source_catalog_removed_dish_references', 'source_catalog_import_runs']) {
      const exists = (await client.query('SELECT to_regclass($1) AS name', [table])).rows[0].name;
      if (exists) backup[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
    }
    const dependentTables = (await client.query(`SELECT DISTINCT format('%I.%I', ns.nspname, relation.relname) AS table_name
      FROM pg_constraint constraint_row JOIN pg_class relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace ns ON ns.oid = relation.relnamespace
      WHERE constraint_row.contype = 'f' AND constraint_row.confrelid = 'dishes'::regclass`)).rows;
    for (const { table_name: tableName } of dependentTables) {
      backup[tableName] = (await client.query(`SELECT * FROM ${tableName}`)).rows;
    }
    const backupDir = path.join(root, 'database/backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `catalog-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2) + '\n');
    await client.query(sql);
    const rows = (await client.query(`SELECT c.code, COUNT(*)::int AS count FROM dishes d
      JOIN dish_categories c ON c.id = d.category_id WHERE d.status = 'ACTIVE' GROUP BY c.code ORDER BY c.code`)).rows;
    console.log(JSON.stringify({ applied: true, backup: path.relative(root, backupFile), categories: rows }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildSql };
