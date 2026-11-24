-- Generated from source .doc files and user-supplied food composition images.
BEGIN;

SELECT pg_advisory_xact_lock(hashtext('kidmeal-source-catalog'));

-- Applied before deploying the API changes; also included by the source importer.
ALTER TABLE food_ingredients ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS nutrition_verified BOOLEAN NOT NULL DEFAULT TRUE;

-- Refresh caches when ingredient composition changes, not only recipe weights.
CREATE OR REPLACE FUNCTION refresh_ingredient_dish_nutrition()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dish_recipes SET net_weight_g = net_weight_g WHERE ingredient_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_refresh_ingredient_nutrition ON food_ingredients;
CREATE TRIGGER trg_refresh_ingredient_nutrition
AFTER UPDATE OF energy_kcal_100g, protein_g, fat_g, carb_g, fiber_g, calcium_mg, iron_mg, zinc_mg
ON food_ingredients FOR EACH ROW EXECUTE FUNCTION refresh_ingredient_dish_nutrition();


-- Retain original sample data for inspection without presenting it as a recipe.
CREATE TABLE IF NOT EXISTS source_catalog_legacy_recipes (
    original_recipe_id BIGINT PRIMARY KEY,
    dish_name TEXT,
    ingredient_name TEXT,
    recipe JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT 'UNVERIFIED_SEED_RECIPE',
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_catalog_legacy_nutrition (
    original_dish_id BIGINT PRIMARY KEY,
    dish_name TEXT,
    nutrition JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT 'DERIVED_FROM_UNVERIFIED_SEED_RECIPE',
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Audit copies do not belong to the application's live dish catalog.
CREATE TABLE IF NOT EXISTS source_catalog_removed_dishes (
    original_dish_id BIGINT PRIMARY KEY,
    dish JSONB NOT NULL,
    source_documents JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT 'NOT_IN_SOURCE_DOC',
    removed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_catalog_removed_dish_references (
    original_dish_id BIGINT NOT NULL,
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    row_hash TEXT NOT NULL,
    row_data JSONB NOT NULL,
    PRIMARY KEY (original_dish_id, table_schema, table_name, column_name, row_hash)
);


ALTER TABLE dish_recipes ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dish_nutrition ADD COLUMN IF NOT EXISTS source_metadata JSONB;


-- Align existing volumes with the current nutrition-engine entities, preserving rows.
CREATE OR REPLACE FUNCTION pg_temp.rename_config_column(tab TEXT, old_name TEXT, new_name TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass(tab) AND attname=old_name AND NOT attisdropped)
     AND NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass(tab) AND attname=new_name AND NOT attisdropped) THEN
    EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', tab, old_name, new_name);
  END IF;
END $$;

SELECT pg_temp.rename_config_column('dish_frequency_rules', 'food_group', 'target_code');
SELECT pg_temp.rename_config_column('dish_frequency_rules', 'target_age_group', 'age_group');
SELECT pg_temp.rename_config_column('dish_frequency_rules', 'min_occurrences_per_week', 'min_occurrences');
SELECT pg_temp.rename_config_column('dish_frequency_rules', 'max_occurrences_per_week', 'max_occurrences');
SELECT pg_temp.rename_config_column('dish_frequency_rules', 'description', 'note');
ALTER TABLE dish_frequency_rules
  ADD COLUMN IF NOT EXISTS school_id BIGINT NOT NULL DEFAULT 1 REFERENCES schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rule_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS meal_slot VARCHAR(30) NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS target_id BIGINT,
  ADD COLUMN IF NOT EXISTS target_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS period_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_required_in_meal BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='dish_frequency_rules'::regclass AND attname='dish_category_id' AND NOT attisdropped) THEN
    UPDATE dish_frequency_rules r SET target_id=r.dish_category_id,
      target_type=CASE WHEN r.dish_category_id IS NULL THEN 'FOOD_GROUP' ELSE 'DISH_CATEGORY' END,
      period_type='PER_WEEK'
    WHERE r.target_type IS NULL;
  END IF;
END $$;
UPDATE dish_frequency_rules r SET
  rule_name=COALESCE(r.rule_name, r.target_code),
  target_type=COALESCE(r.target_type, 'FOOD_GROUP'),
  target_name=COALESCE(r.target_name, (SELECT name FROM dish_categories WHERE id=r.target_id), r.target_code),
  period_type=COALESCE(r.period_type, 'PER_WEEK');
ALTER TABLE dish_frequency_rules
  ALTER COLUMN rule_name SET NOT NULL,
  ALTER COLUMN target_type SET NOT NULL,
  ALTER COLUMN target_name SET NOT NULL,
  ALTER COLUMN period_type SET NOT NULL,
  ALTER COLUMN period_type SET DEFAULT 'PER_CYCLE_4_WEEKS';

SELECT pg_temp.rename_config_column('dish_spacing_rules', 'scope', 'target_type');
SELECT pg_temp.rename_config_column('dish_spacing_rules', 'description', 'note');
ALTER TABLE dish_spacing_rules
  ADD COLUMN IF NOT EXISTS school_id BIGINT NOT NULL DEFAULT 1 REFERENCES schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS meal_slot VARCHAR(30) NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS target_id BIGINT,
  ADD COLUMN IF NOT EXISTS target_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS age_group VARCHAR(30) NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS no_repeat_in_same_week BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS no_repeat_in_same_day BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS priority_order INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS severity VARCHAR(15) NOT NULL DEFAULT 'WARNING',
  ADD COLUMN IF NOT EXISTS source_metadata JSONB;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='dish_spacing_rules'::regclass AND attname='dish_id' AND NOT attisdropped) THEN
    UPDATE dish_spacing_rules r SET
      target_type=CASE WHEN dish_id IS NOT NULL THEN 'SPECIFIC_DISH' ELSE 'DISH_CATEGORY' END,
      target_id=COALESCE(dish_id, dish_category_id),
      target_name=CASE WHEN dish_id IS NOT NULL THEN (SELECT name FROM dishes WHERE id=r.dish_id)
        ELSE (SELECT name FROM dish_categories WHERE id=r.dish_category_id) END
    WHERE target_id IS NULL;
  END IF;
END $$;
ALTER TABLE dish_spacing_rules
  ALTER COLUMN min_spacing_days SET DEFAULT 1,
  ALTER COLUMN no_repeat_in_same_week SET DEFAULT TRUE,
  ALTER COLUMN no_repeat_in_same_day SET DEFAULT TRUE;

SELECT pg_temp.rename_config_column('nutrition_intake_standards', 'protein_pct_min', 'protein_ratio_min');
SELECT pg_temp.rename_config_column('nutrition_intake_standards', 'protein_pct_max', 'protein_ratio_max');
SELECT pg_temp.rename_config_column('nutrition_intake_standards', 'fat_pct_min', 'lipid_ratio_min');
SELECT pg_temp.rename_config_column('nutrition_intake_standards', 'fat_pct_max', 'lipid_ratio_max');
SELECT pg_temp.rename_config_column('nutrition_intake_standards', 'carb_pct_min', 'carbohydrate_ratio_min');
SELECT pg_temp.rename_config_column('nutrition_intake_standards', 'carb_pct_max', 'carbohydrate_ratio_max');
SELECT pg_temp.rename_config_column('nutrition_intake_standards', 'vitamin_a_mcg_min', 'vitamin_a_rae_mcg_min');
ALTER TABLE nutrition_intake_standards
  ADD COLUMN IF NOT EXISTS school_id BIGINT NOT NULL DEFAULT 1 REFERENCES schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS meal_scope VARCHAR(30) NOT NULL DEFAULT 'DAYBOARDING',
  ADD COLUMN IF NOT EXISTS fiber_g_max NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS iron_absorption_rate VARCHAR(10) DEFAULT '10%',
  ADD COLUMN IF NOT EXISTS zinc_absorption_level VARCHAR(10) DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB,
  ALTER COLUMN standard_name TYPE VARCHAR(200),
  ALTER COLUMN fiber_g_min DROP NOT NULL,
  ALTER COLUMN fiber_g_min DROP DEFAULT,
  ALTER COLUMN calcium_mg_min DROP NOT NULL,
  ALTER COLUMN calcium_mg_min DROP DEFAULT,
  ALTER COLUMN iron_mg_min DROP NOT NULL,
  ALTER COLUMN iron_mg_min DROP DEFAULT,
  ALTER COLUMN zinc_mg_min DROP NOT NULL,
  ALTER COLUMN zinc_mg_min DROP DEFAULT,
  ALTER COLUMN vitamin_a_rae_mcg_min DROP NOT NULL,
  ALTER COLUMN vitamin_a_rae_mcg_min DROP DEFAULT;
-- Retain obsolete gram columns for compatibility, but do not populate unknowns with zero.
DO $$ DECLARE col TEXT; BEGIN
  FOREACH col IN ARRAY ARRAY['protein_g_min','protein_g_max'] LOOP
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='nutrition_intake_standards'::regclass AND attname=col AND NOT attisdropped) THEN
      EXECUTE format('ALTER TABLE nutrition_intake_standards ALTER COLUMN %I DROP NOT NULL, ALTER COLUMN %I DROP DEFAULT', col, col);
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_freq_rules_school ON dish_frequency_rules(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_freq_rules_slot ON dish_frequency_rules(meal_slot, target_code);
CREATE INDEX IF NOT EXISTS idx_spacing_rules_school ON dish_spacing_rules(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_intake_std_school ON nutrition_intake_standards(school_id, age_group, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_frequency_source_key ON dish_frequency_rules(school_id, (source_metadata->>'seedKey')) WHERE source_metadata ? 'seedKey';
CREATE UNIQUE INDEX IF NOT EXISTS idx_spacing_source_key ON dish_spacing_rules(school_id, (source_metadata->>'seedKey')) WHERE source_metadata ? 'seedKey';
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_source_key ON nutrition_intake_standards(school_id, (source_metadata->>'seedKey')) WHERE source_metadata ? 'seedKey';


-- Make application relationships explicit without deleting or rewriting historical data.
-- Run inside a transaction; safe to run again.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE relation_backfill_flags(table_name TEXT PRIMARY KEY, required BOOLEAN) ON COMMIT DROP;
INSERT INTO relation_backfill_flags
SELECT tab,NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass(tab) AND attname=col AND NOT attisdropped)
FROM (VALUES ('food_samples','dish_id'),('menus','nutritional_standard_id'),('schools','default_language_id'),
  ('source_catalog_legacy_recipes','import_run_id'),('source_catalog_legacy_nutrition','import_run_id'),
  ('source_catalog_removed_dishes','import_run_id'),('source_catalog_removed_dish_references','import_run_id')) AS fields(tab,col);

CREATE OR REPLACE FUNCTION pg_temp.ensure_relation(
  child_table TEXT, constraint_name TEXT, child_columns TEXT[],
  parent_table TEXT, parent_columns TEXT[], delete_action TEXT DEFAULT 'RESTRICT'
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE child_keys SMALLINT[]; parent_keys SMALLINT[]; existing_name TEXT; existing_delete "char"; child_sql TEXT; parent_sql TEXT;
BEGIN
  SELECT array_agg(a.attnum ORDER BY k.ord), string_agg(format('%I', k.name), ', ' ORDER BY k.ord)
    INTO child_keys, child_sql FROM unnest(child_columns) WITH ORDINALITY k(name,ord)
    JOIN pg_attribute a ON a.attrelid=to_regclass(child_table) AND a.attname=k.name AND NOT a.attisdropped;
  SELECT array_agg(a.attnum ORDER BY k.ord), string_agg(format('%I', k.name), ', ' ORDER BY k.ord)
    INTO parent_keys, parent_sql FROM unnest(parent_columns) WITH ORDINALITY k(name,ord)
    JOIN pg_attribute a ON a.attrelid=to_regclass(parent_table) AND a.attname=k.name AND NOT a.attisdropped;
  IF cardinality(child_keys) IS DISTINCT FROM cardinality(child_columns)
    OR cardinality(parent_keys) IS DISTINCT FROM cardinality(parent_columns) THEN
    RAISE EXCEPTION 'Missing columns for relation %', constraint_name;
  END IF;
  IF delete_action NOT IN ('RESTRICT', 'SET NULL', 'CASCADE') THEN RAISE EXCEPTION 'Invalid delete action'; END IF;
  SELECT conname,confdeltype INTO existing_name,existing_delete FROM pg_constraint
    WHERE conrelid=to_regclass(child_table) AND contype='f' AND confrelid=to_regclass(parent_table)
      AND conkey=child_keys AND confkey=parent_keys LIMIT 1;
  IF existing_name IS NOT NULL AND existing_delete::text <> (CASE delete_action WHEN 'RESTRICT' THEN 'r' WHEN 'SET NULL' THEN 'n' ELSE 'c' END) THEN
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',to_regclass(child_table),existing_name);
    existing_name := NULL;
  END IF;
  IF existing_name IS NULL THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s (%s) ON DELETE %s NOT VALID',
      to_regclass(child_table), constraint_name, child_sql, to_regclass(parent_table), parent_sql, delete_action);
    existing_name := constraint_name;
  END IF;
  EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', to_regclass(child_table), existing_name);
END $$;

-- 1. Existing identity columns: validation fails and rolls everything back on orphans.
SELECT pg_temp.ensure_relation('audit_logs', 'fk_audit_logs_school', ARRAY['school_id'], 'schools', ARRAY['id']);
SELECT pg_temp.ensure_relation('audit_logs', 'fk_audit_logs_user', ARRAY['user_id'], 'users', ARRAY['id'], 'SET NULL');

-- 2. Food samples retain their historical name, even after the dish is removed.
ALTER TABLE food_samples ADD COLUMN IF NOT EXISTS dish_id BIGINT,
  ADD COLUMN IF NOT EXISTS inspection_id BIGINT;
SELECT pg_temp.ensure_relation('food_samples', 'fk_food_samples_dish', ARRAY['dish_id'], 'dishes', ARRAY['id'], 'SET NULL');
SELECT pg_temp.ensure_relation('food_samples', 'fk_food_samples_inspection', ARRAY['inspection_id'], 'food_inspections', ARRAY['id'], 'SET NULL');
WITH matches AS (
  SELECT f.id, min(d.id) AS dish_id FROM food_samples f JOIN dishes d
    ON lower(btrim(f.dish_name))=lower(btrim(d.name))
  WHERE f.dish_id IS NULL AND (SELECT required FROM relation_backfill_flags WHERE table_name='food_samples')
  GROUP BY f.id HAVING count(*)=1
)
UPDATE food_samples f SET dish_id=m.dish_id FROM matches m WHERE f.id=m.id;
COMMENT ON COLUMN food_samples.dish_id IS 'Optional current dish; dish_name remains the historical snapshot. Unmatched/ambiguous legacy samples keep NULL.';
CREATE INDEX IF NOT EXISTS idx_food_samples_dish ON food_samples(dish_id);
CREATE INDEX IF NOT EXISTS idx_food_samples_inspection ON food_samples(inspection_id);
CREATE OR REPLACE FUNCTION link_food_sample_dish() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.dish_name IS DISTINCT FROM OLD.dish_name AND NEW.dish_id IS NOT DISTINCT FROM OLD.dish_id THEN
    NEW.dish_id := NULL;
  END IF;
  IF NEW.dish_id IS NULL AND (TG_OP='INSERT' OR NEW.dish_name IS DISTINCT FROM OLD.dish_name) THEN
    SELECT min(id) INTO NEW.dish_id FROM dishes
      WHERE lower(btrim(name))=lower(btrim(NEW.dish_name)) HAVING count(*)=1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_link_food_sample_dish ON food_samples;
CREATE TRIGGER trg_link_food_sample_dish BEFORE INSERT OR UPDATE OF dish_name,dish_id ON food_samples
FOR EACH ROW EXECUTE FUNCTION link_food_sample_dish();

-- 3. Rule code catalog. Preserve existing definitions; register legacy codes without changing violations.
INSERT INTO nutrition_rule_codes(code,severity,description)
SELECT rule_code, CASE WHEN bool_or(severity='ERROR') THEN 'ERROR'
  WHEN bool_or(severity='WARNING') THEN 'WARNING' ELSE 'INFO' END,
  'Existing rule code retained during relational migration'
FROM menu_rule_violations GROUP BY rule_code ON CONFLICT(code) DO NOTHING;
SELECT pg_temp.ensure_relation('menu_rule_violations', 'fk_menu_violations_rule_code', ARRAY['rule_code'], 'nutrition_rule_codes', ARRAY['code']);
CREATE INDEX IF NOT EXISTS idx_menu_violations_rule_code ON menu_rule_violations(rule_code);
-- The application also emits dynamic codes; registering them preserves that existing behavior.
CREATE OR REPLACE FUNCTION register_menu_rule_code() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO nutrition_rule_codes(code,severity,description)
    VALUES(NEW.rule_code,NEW.severity,'Observed application rule code') ON CONFLICT(code) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_register_menu_rule_code ON menu_rule_violations;
CREATE TRIGGER trg_register_menu_rule_code BEFORE INSERT OR UPDATE OF rule_code ON menu_rule_violations
FOR EACH ROW EXECUTE FUNCTION register_menu_rule_code();

-- 4. The applicable nutritional standard and its three named energy conversion coefficients.
-- The coefficients are the same values already seeded and used by the application.
INSERT INTO nutrition_conversion_factors(nutrient_code,kcal_per_gram,description) VALUES
  ('PROTEIN',4,'Protein'),('FAT',9,'Fat'),('CARB',4,'Carbohydrate') ON CONFLICT(nutrient_code) DO NOTHING;
ALTER TABLE nutritional_standards
  ADD COLUMN IF NOT EXISTS protein_factor_code VARCHAR(20) NOT NULL DEFAULT 'PROTEIN',
  ADD COLUMN IF NOT EXISTS fat_factor_code VARCHAR(20) NOT NULL DEFAULT 'FAT',
  ADD COLUMN IF NOT EXISTS carb_factor_code VARCHAR(20) NOT NULL DEFAULT 'CARB';
SELECT pg_temp.ensure_relation('nutritional_standards', 'fk_standard_protein_factor', ARRAY['protein_factor_code'], 'nutrition_conversion_factors', ARRAY['nutrient_code']);
SELECT pg_temp.ensure_relation('nutritional_standards', 'fk_standard_fat_factor', ARRAY['fat_factor_code'], 'nutrition_conversion_factors', ARRAY['nutrient_code']);
SELECT pg_temp.ensure_relation('nutritional_standards', 'fk_standard_carb_factor', ARRAY['carb_factor_code'], 'nutrition_conversion_factors', ARRAY['nutrient_code']);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='nutritional_standards'::regclass AND conname='ck_standard_factor_roles') THEN
    ALTER TABLE nutritional_standards ADD CONSTRAINT ck_standard_factor_roles
      CHECK(protein_factor_code='PROTEIN' AND fat_factor_code='FAT' AND carb_factor_code='CARB');
  END IF;
END $$;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS nutritional_standard_id BIGINT;
SELECT pg_temp.ensure_relation('menus', 'fk_menus_nutritional_standard', ARRAY['nutritional_standard_id'], 'nutritional_standards', ARRAY['id'], 'SET NULL');
-- Backfill only an unambiguous current DAYBOARDING standard for the menu's age group.
WITH applicable AS (SELECT age_group,min(id) AS id FROM nutritional_standards
  WHERE status='ACTIVE' AND meal_scope='DAYBOARDING' GROUP BY age_group HAVING count(*)=1)
UPDATE menus m SET nutritional_standard_id=s.id FROM applicable s
  WHERE m.nutritional_standard_id IS NULL AND m.age_group=s.age_group
    AND (SELECT required FROM relation_backfill_flags WHERE table_name='menus');
COMMENT ON COLUMN menus.nutritional_standard_id IS 'Applicable standard; legacy backfill is the unique active DAYBOARDING standard, not proof of historical calculation provenance.';
CREATE INDEX IF NOT EXISTS idx_menus_nutritional_standard ON menus(nutritional_standard_id);
CREATE OR REPLACE FUNCTION link_menu_nutritional_standard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.age_group IS DISTINCT FROM OLD.age_group
    AND NEW.nutritional_standard_id IS NOT DISTINCT FROM OLD.nutritional_standard_id THEN
    NEW.nutritional_standard_id := NULL;
  END IF;
  IF NEW.nutritional_standard_id IS NULL AND (TG_OP='INSERT' OR NEW.age_group IS DISTINCT FROM OLD.age_group) THEN
    SELECT min(id) INTO NEW.nutritional_standard_id FROM nutritional_standards
      WHERE age_group=NEW.age_group AND meal_scope='DAYBOARDING' AND status='ACTIVE' HAVING count(*)=1;
  ELSIF NEW.nutritional_standard_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nutritional_standards WHERE id=NEW.nutritional_standard_id AND age_group=NEW.age_group) THEN
    RAISE EXCEPTION 'Nutritional standard age group does not match menu' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_link_menu_nutritional_standard ON menus;
CREATE TRIGGER trg_link_menu_nutritional_standard BEFORE INSERT OR UPDATE OF age_group,nutritional_standard_id ON menus
FOR EACH ROW EXECUTE FUNCTION link_menu_nutritional_standard();

-- 5. Preserve the actual WHO lookup used for each newly calculated indicator.
-- Historical scores may have used the built-in fallback, so never fabricate their provenance.
ALTER TABLE growth_zscores ADD COLUMN IF NOT EXISTS waz_standard_id BIGINT,
  ADD COLUMN IF NOT EXISTS haz_standard_id BIGINT, ADD COLUMN IF NOT EXISTS baz_standard_id BIGINT;
SELECT pg_temp.ensure_relation('growth_zscores', 'fk_growth_waz_standard', ARRAY['waz_standard_id'], 'who_growth_standards', ARRAY['id'], 'SET NULL');
SELECT pg_temp.ensure_relation('growth_zscores', 'fk_growth_haz_standard', ARRAY['haz_standard_id'], 'who_growth_standards', ARRAY['id'], 'SET NULL');
SELECT pg_temp.ensure_relation('growth_zscores', 'fk_growth_baz_standard', ARRAY['baz_standard_id'], 'who_growth_standards', ARRAY['id'], 'SET NULL');
COMMENT ON COLUMN growth_zscores.waz_standard_id IS 'NULL for unknown historical provenance or a calculation using built-in fallback data.';
CREATE OR REPLACE FUNCTION validate_growth_standard_references() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.waz_standard_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM who_growth_standards WHERE id=NEW.waz_standard_id AND indicator='WAZ'))
    OR (NEW.haz_standard_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM who_growth_standards WHERE id=NEW.haz_standard_id AND indicator='HAZ'))
    OR (NEW.baz_standard_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM who_growth_standards WHERE id=NEW.baz_standard_id AND indicator='BAZ')) THEN
    RAISE EXCEPTION 'WHO standard indicator does not match score reference' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_growth_standard_references ON growth_zscores;
CREATE TRIGGER trg_validate_growth_standard_references BEFORE INSERT OR UPDATE OF waz_standard_id,haz_standard_id,baz_standard_id ON growth_zscores
FOR EACH ROW EXECUTE FUNCTION validate_growth_standard_references();

-- 6. Global settings remain global (NULL school_id); allow explicit per-school overrides.
ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS school_id BIGINT;
SELECT pg_temp.ensure_relation('system_configs', 'fk_system_configs_school', ARRAY['school_id'], 'schools', ARRAY['id']);
DO $$ DECLARE constraint_row RECORD; BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint
    WHERE conrelid='system_configs'::regclass AND contype='u'
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='system_configs'::regclass AND attname='config_key')]::smallint[]
  LOOP EXECUTE format('ALTER TABLE system_configs DROP CONSTRAINT %I', constraint_row.conname); END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_configs_global_key ON system_configs(config_key) WHERE school_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_configs_school_key ON system_configs(school_id,config_key) WHERE school_id IS NOT NULL;
COMMENT ON COLUMN system_configs.school_id IS 'NULL = global configuration; non-NULL = explicit school override. Existing global values are unchanged.';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS default_language_id BIGINT;
SELECT pg_temp.ensure_relation('schools', 'fk_schools_default_language', ARRAY['default_language_id'], 'languages', ARRAY['id'], 'SET NULL');
WITH default_language AS (SELECT min(id) AS id FROM languages
  WHERE is_default AND is_active HAVING count(*)=1)
UPDATE schools s SET default_language_id=l.id FROM default_language l WHERE s.default_language_id IS NULL
  AND (SELECT required FROM relation_backfill_flags WHERE table_name='schools');

-- 7. Archive records belong to an import run, not to deleted live dishes.
CREATE TABLE IF NOT EXISTS source_catalog_import_runs (
  id BIGSERIAL PRIMARY KEY,
  run_key TEXT NOT NULL UNIQUE,
  initiated_by BIGINT,
  source_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);
SELECT pg_temp.ensure_relation('source_catalog_import_runs', 'fk_catalog_run_actor', ARRAY['initiated_by'], 'users', ARRAY['id'], 'SET NULL');
COMMENT ON COLUMN source_catalog_import_runs.initiated_by IS 'Optional known operator. NULL for CLI imports without an identified user or unknown legacy actor.';
DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['source_catalog_legacy_recipes','source_catalog_legacy_nutrition',
    'source_catalog_removed_dishes','source_catalog_removed_dish_references'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS import_run_id BIGINT',tab);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN import_run_id SET DEFAULT NULLIF(current_setting(''kidmeal.import_run_id'', true), '''')::bigint',tab);
    PERFORM pg_temp.ensure_relation(tab, 'fk_' || tab || '_run', ARRAY['import_run_id'], 'source_catalog_import_runs', ARRAY['id']);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(import_run_id)', 'idx_' || tab || '_run', tab);
  END LOOP;
END $$;
INSERT INTO source_catalog_import_runs(run_key,note)
SELECT 'legacy_before_relational_migration', 'Groups pre-existing archive records. Original import time and actor are unknown; created_at is the migration time.'
WHERE EXISTS(SELECT 1 FROM source_catalog_legacy_recipes WHERE import_run_id IS NULL)
   OR EXISTS(SELECT 1 FROM source_catalog_legacy_nutrition WHERE import_run_id IS NULL)
   OR EXISTS(SELECT 1 FROM source_catalog_removed_dishes WHERE import_run_id IS NULL)
   OR EXISTS(SELECT 1 FROM source_catalog_removed_dish_references WHERE import_run_id IS NULL)
ON CONFLICT(run_key) DO NOTHING;
DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['source_catalog_legacy_recipes','source_catalog_legacy_nutrition',
    'source_catalog_removed_dishes','source_catalog_removed_dish_references'] LOOP
    IF (SELECT required FROM relation_backfill_flags WHERE table_name=tab) THEN
      EXECUTE format('UPDATE %I SET import_run_id=(SELECT id FROM source_catalog_import_runs WHERE run_key=''legacy_before_relational_migration'') WHERE import_run_id IS NULL',tab);
    END IF;
  END LOOP;
END $$;
SELECT pg_temp.ensure_relation('source_catalog_removed_dish_references', 'fk_removed_reference_archive_dish',
  ARRAY['original_dish_id'], 'source_catalog_removed_dishes', ARRAY['original_dish_id']);
DROP TABLE relation_backfill_flags;



WITH run AS (INSERT INTO source_catalog_import_runs(run_key,initiated_by,note)
      VALUES ('catalog_import_' || txid_current()::text || '_' || extract(epoch FROM clock_timestamp())::text,
        NULL,
        'Source catalog CLI import; operator identity was not supplied') RETURNING id)
      SELECT set_config('kidmeal.import_run_id',id::text,true) FROM run;

CREATE OR REPLACE FUNCTION pg_temp.catalog_key(value TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
      SELECT trim(regexp_replace(regexp_replace(lower(translate(normalize(value, NFC), 'ĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ', 'đáàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ')), '[.,;:]+', ' ', 'g'), '\s+', ' ', 'g'));
    $$;

CREATE OR REPLACE FUNCTION pg_temp.repair_name(value TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
      DECLARE c TEXT; code INTEGER; encoded TEXT := ''; cp TEXT := 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
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
    $$;

UPDATE food_categories SET name = pg_temp.repair_name(name);

UPDATE food_ingredients SET name = pg_temp.repair_name(name);

UPDATE dishes SET name = pg_temp.repair_name(name), description = pg_temp.repair_name(description);

INSERT INTO food_categories(name) SELECT 'Ngũ cốc và sản phẩm chế biến' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến');

INSERT INTO food_categories(name) SELECT 'Khoai củ và sản phẩm chế biến' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến');

INSERT INTO food_categories(name) SELECT 'Đậu đỗ, hạt giàu đạm và béo' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo');

INSERT INTO food_categories(name) SELECT 'Rau, củ, quả làm rau' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Rau, củ, quả làm rau');

INSERT INTO food_categories(name) SELECT 'Quả chín / Trái cây' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Quả chín / Trái cây');

INSERT INTO food_categories(name) SELECT 'Dầu, mỡ và bơ' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Dầu, mỡ và bơ');

INSERT INTO food_categories(name) SELECT 'Thịt và sản phẩm chế biến' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến');

INSERT INTO food_categories(name) SELECT 'Thủy sản và sản phẩm chế biến' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến');

INSERT INTO food_categories(name) SELECT 'Trứng và sản phẩm chế biến' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Trứng và sản phẩm chế biến');

INSERT INTO food_categories(name) SELECT 'Sữa và chế phẩm sữa' WHERE NOT EXISTS (SELECT 1 FROM food_categories WHERE name = 'Sữa và chế phẩm sữa');

UPDATE food_ingredients SET name = 'Gạo tẻ máy' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo tẻ máy (gạo trắng)') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo tẻ máy'));

UPDATE food_ingredients SET name = 'Gạo nếp (loại thường)' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo nếp cái hoa vàng') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo nếp (loại thường)'));

UPDATE food_ingredients SET name = 'Bột mì' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bột mì đa dụng') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bột mì'));

UPDATE food_ingredients SET name = 'Bánh phở' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh phở tươi') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh phở'));

UPDATE food_ingredients SET name = 'Bún' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bún tươi') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bún'));

UPDATE food_ingredients SET name = 'Ngô bắp tươi' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ngô ngọt bắp non tươi') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ngô bắp tươi'));

UPDATE food_ingredients SET name = 'Miến dong' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Miến dong / Bún tàu') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Miến dong'));

UPDATE food_ingredients SET name = 'Khoai tây' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai tây Đà Lạt') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai tây'));

UPDATE food_ingredients SET name = 'Lạc hạt' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu phộng (lạc nhân)') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Lạc hạt'));

UPDATE food_ingredients SET name = 'Đậu xanh (đậu tắt)' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu xanh hạt tiêu') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu xanh (đậu tắt)'));

UPDATE food_ingredients SET name = 'Đậu phụ' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu phụ mơ (tàu hũ trắng)') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu phụ'));

UPDATE food_ingredients SET name = 'Rau ngót' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau ngót lá tươi') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau ngót'));

UPDATE food_ingredients SET name = 'Rau mồng tơi' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau mồng tơi tươi') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau mồng tơi'));

UPDATE food_ingredients SET name = 'Cải cúc' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau cải cúc (tần ô)') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải cúc'));

UPDATE food_ingredients SET name = 'Cải ngọt' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau cải ngọt') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải ngọt'));

UPDATE food_ingredients SET name = 'Cải bắp' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau bắp cải trắng') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải bắp'));

UPDATE food_ingredients SET name = 'Súp lơ xanh' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bông cải xanh (súp lơ xanh)') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Súp lơ xanh'));

UPDATE food_ingredients SET name = 'Bí đao (bí xanh)' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bí xanh (bí đao)') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bí đao (bí xanh)'));

UPDATE food_ingredients SET name = 'Bầu' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bầu non tươi') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bầu'));

UPDATE food_ingredients SET name = 'Mướp' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Mướp hương') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Mướp'));

UPDATE food_ingredients SET name = 'Cà rốt (củ đỏ, vàng)' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà rốt Đà Lạt') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà rốt (củ đỏ, vàng)'));

UPDATE food_ingredients SET name = 'Cà chua' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà chua chín') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà chua'));

UPDATE food_ingredients SET name = 'Dưa hấu' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dưa hấu ruột đỏ') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dưa hấu'));

UPDATE food_ingredients SET name = 'Cá quả' WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá lóc đồng') AND NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá quả'));

UPDATE food_ingredients SET status = 'INACTIVE', source_metadata = '{"kind":"LEGACY_UNVERIFIED","missingNutrients":["energyKcal100g","proteinG","fatG","carbG","fiberG","calciumMg","ironMg","zincMg","vitaminAMcg"]}'::jsonb;

INSERT INTO food_ingredients(name, category_id) SELECT 'Gạo nếp (loại thường)', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo nếp (loại thường)'));

UPDATE food_ingredients SET name = 'Gạo nếp (loại thường)', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 350, protein_g = 8.4, fat_g = 1.6, carb_g = 75.4, fiber_g = 0.5, calcium_mg = 16, iron_mg = 1.2, zinc_mg = 2.2, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":1,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":1,"category":"CEREAL","name":"Gạo nếp (loại thường)","ediblePercent":100,"energyKcal100g":350,"proteinG":8.4,"fatG":1.6,"carbG":75.4,"fiberG":0.5,"calciumMg":16,"ironMg":1.2,"zincMg":2.2,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo nếp (loại thường)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Gạo tẻ máy', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo tẻ máy'));

UPDATE food_ingredients SET name = 'Gạo tẻ máy', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 346, protein_g = 7.9, fat_g = 1, carb_g = 76.3, fiber_g = 0.4, calcium_mg = 30, iron_mg = 1.3, zinc_mg = 1.5, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":2,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":2,"category":"CEREAL","name":"Gạo tẻ máy","ediblePercent":100,"energyKcal100g":346,"proteinG":7.9,"fatG":1,"carbG":76.3,"fiberG":0.4,"calciumMg":30,"ironMg":1.3,"zincMg":1.5,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Gạo tẻ máy') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Ngô bắp tươi', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ngô bắp tươi'));

UPDATE food_ingredients SET name = 'Ngô bắp tươi', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 200, protein_g = 4.1, fat_g = 2.3, carb_g = 40.8, fiber_g = 1.2, calcium_mg = 20, iron_mg = 1.5, zinc_mg = 1.4, vitamin_a_mcg = 20, refuse_rate_percent = 45, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":3,"basisGrams":100,"ediblePercent":55,"missingNutrients":[],"values":{"sourceRow":3,"category":"CEREAL","name":"Ngô bắp tươi","ediblePercent":55,"energyKcal100g":200,"proteinG":4.1,"fatG":2.3,"carbG":40.8,"fiberG":1.2,"calciumMg":20,"ironMg":1.5,"zincMg":1.4,"vitaminAMcg":20}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ngô bắp tươi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bánh đa nem', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh đa nem'));

UPDATE food_ingredients SET name = 'Bánh đa nem', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 335, protein_g = 4, fat_g = 0.2, carb_g = 79.4, fiber_g = 0.5, calcium_mg = 20, iron_mg = 0.3, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":4,"basisGrams":100,"ediblePercent":100,"missingNutrients":["zincMg"],"values":{"sourceRow":4,"category":"CEREAL","name":"Bánh đa nem","ediblePercent":100,"energyKcal100g":335,"proteinG":4,"fatG":0.2,"carbG":79.4,"fiberG":0.5,"calciumMg":20,"ironMg":0.3,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh đa nem') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bánh đúc', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh đúc'));

UPDATE food_ingredients SET name = 'Bánh đúc', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 52, protein_g = 0.9, fat_g = 0.3, carb_g = 11.4, fiber_g = 0.1, calcium_mg = 50, iron_mg = 0.4, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":5,"basisGrams":100,"ediblePercent":100,"missingNutrients":["zincMg"],"values":{"sourceRow":5,"category":"CEREAL","name":"Bánh đúc","ediblePercent":100,"energyKcal100g":52,"proteinG":0.9,"fatG":0.3,"carbG":11.4,"fiberG":0.1,"calciumMg":50,"ironMg":0.4,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh đúc') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bánh mỳ', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh mỳ'));

UPDATE food_ingredients SET name = 'Bánh mỳ', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 250, protein_g = 7.9, fat_g = 0.8, carb_g = 52.8, fiber_g = 0.2, calcium_mg = 28, iron_mg = 2, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":6,"basisGrams":100,"ediblePercent":100,"missingNutrients":["zincMg"],"values":{"sourceRow":6,"category":"CEREAL","name":"Bánh mỳ","ediblePercent":100,"energyKcal100g":250,"proteinG":7.9,"fatG":0.8,"carbG":52.8,"fiberG":0.2,"calciumMg":28,"ironMg":2,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh mỳ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bánh phở', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh phở'));

UPDATE food_ingredients SET name = 'Bánh phở', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 141, protein_g = 3.2, fat_g = 0, carb_g = 32.1, fiber_g = 0, calcium_mg = 16, iron_mg = 0.3, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":7,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fatG","fiberG","zincMg"],"values":{"sourceRow":7,"category":"CEREAL","name":"Bánh phở","ediblePercent":100,"energyKcal100g":141,"proteinG":3.2,"fatG":null,"carbG":32.1,"fiberG":null,"calciumMg":16,"ironMg":0.3,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bánh phở') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bột mì', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bột mì'));

UPDATE food_ingredients SET name = 'Bột mì', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 347, protein_g = 11, fat_g = 1.1, carb_g = 73.2, fiber_g = 0.3, calcium_mg = 29, iron_mg = 2, zinc_mg = 2.5, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":8,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":8,"category":"CEREAL","name":"Bột mì","ediblePercent":100,"energyKcal100g":347,"proteinG":11,"fatG":1.1,"carbG":73.2,"fiberG":0.3,"calciumMg":29,"ironMg":2,"zincMg":2.5,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bột mì') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bún', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bún'));

UPDATE food_ingredients SET name = 'Bún', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 112, protein_g = 1.7, fat_g = 0, carb_g = 26.2, fiber_g = 0.5, calcium_mg = 12, iron_mg = 0.2, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":9,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fatG","zincMg"],"values":{"sourceRow":9,"category":"CEREAL","name":"Bún","ediblePercent":100,"energyKcal100g":112,"proteinG":1.7,"fatG":null,"carbG":26.2,"fiberG":0.5,"calciumMg":12,"ironMg":0.2,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bún') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Ngô nếp luộc', (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ngô nếp luộc'));

UPDATE food_ingredients SET name = 'Ngô nếp luộc', category_id = (SELECT id FROM food_categories WHERE name = 'Ngũ cốc và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 172, protein_g = 3.9, fat_g = 2.2, carb_g = 34.1, fiber_g = 1.2, calcium_mg = 18, iron_mg = 0.8, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 50, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":10,"basisGrams":100,"ediblePercent":50,"missingNutrients":["zincMg"],"values":{"sourceRow":10,"category":"CEREAL","name":"Ngô nếp luộc","ediblePercent":50,"energyKcal100g":172,"proteinG":3.9,"fatG":2.2,"carbG":34.1,"fiberG":1.2,"calciumMg":18,"ironMg":0.8,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ngô nếp luộc') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Củ sắn', (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Củ sắn'));

UPDATE food_ingredients SET name = 'Củ sắn', category_id = (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 158, protein_g = 1.1, fat_g = 0.2, carb_g = 37.9, fiber_g = 1.5, calcium_mg = 25, iron_mg = 1.2, zinc_mg = 0, vitamin_a_mcg = 1, refuse_rate_percent = 25, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":11,"basisGrams":100,"ediblePercent":75,"missingNutrients":["zincMg"],"values":{"sourceRow":11,"category":"TUBER","name":"Củ sắn","ediblePercent":75,"energyKcal100g":158,"proteinG":1.1,"fatG":0.2,"carbG":37.9,"fiberG":1.5,"calciumMg":25,"ironMg":1.2,"zincMg":null,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Củ sắn') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Củ sắn dây', (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Củ sắn dây'));

UPDATE food_ingredients SET name = 'Củ sắn dây', category_id = (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 156, protein_g = 1.6, fat_g = 0.1, carb_g = 37.2, fiber_g = 9.2, calcium_mg = 28, iron_mg = 0.2, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 10, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":12,"basisGrams":100,"ediblePercent":90,"missingNutrients":["zincMg"],"values":{"sourceRow":12,"category":"TUBER","name":"Củ sắn dây","ediblePercent":90,"energyKcal100g":156,"proteinG":1.6,"fatG":0.1,"carbG":37.2,"fiberG":9.2,"calciumMg":28,"ironMg":0.2,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Củ sắn dây') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Khoai lang', (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai lang'));

UPDATE food_ingredients SET name = 'Khoai lang', category_id = (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 124, protein_g = 0.8, fat_g = 0.2, carb_g = 29.8, fiber_g = 1.3, calcium_mg = 34, iron_mg = 1, zinc_mg = 0.2, vitamin_a_mcg = 13, refuse_rate_percent = 17, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":13,"basisGrams":100,"ediblePercent":83,"missingNutrients":[],"values":{"sourceRow":13,"category":"TUBER","name":"Khoai lang","ediblePercent":83,"energyKcal100g":124,"proteinG":0.8,"fatG":0.2,"carbG":29.8,"fiberG":1.3,"calciumMg":34,"ironMg":1,"zincMg":0.2,"vitaminAMcg":13}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai lang') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Khoai môn', (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai môn'));

UPDATE food_ingredients SET name = 'Khoai môn', category_id = (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 113, protein_g = 1.5, fat_g = 0.2, carb_g = 26.4, fiber_g = 1.2, calcium_mg = 44, iron_mg = 0.8, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 14, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":14,"basisGrams":100,"ediblePercent":86,"missingNutrients":["zincMg"],"values":{"sourceRow":14,"category":"TUBER","name":"Khoai môn","ediblePercent":86,"energyKcal100g":113,"proteinG":1.5,"fatG":0.2,"carbG":26.4,"fiberG":1.2,"calciumMg":44,"ironMg":0.8,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai môn') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Khoai sọ', (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai sọ'));

UPDATE food_ingredients SET name = 'Khoai sọ', category_id = (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 119, protein_g = 1.8, fat_g = 0.1, carb_g = 27.7, fiber_g = 1.2, calcium_mg = 64, iron_mg = 1.5, zinc_mg = 0, vitamin_a_mcg = 4, refuse_rate_percent = 18, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":15,"basisGrams":100,"ediblePercent":82,"missingNutrients":["zincMg"],"values":{"sourceRow":15,"category":"TUBER","name":"Khoai sọ","ediblePercent":82,"energyKcal100g":119,"proteinG":1.8,"fatG":0.1,"carbG":27.7,"fiberG":1.2,"calciumMg":64,"ironMg":1.5,"zincMg":null,"vitaminAMcg":4}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai sọ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Khoai tây', (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai tây'));

UPDATE food_ingredients SET name = 'Khoai tây', category_id = (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 96, protein_g = 2, fat_g = 0.07, carb_g = 21.93, fiber_g = 1, calcium_mg = 10, iron_mg = 1.2, zinc_mg = 0.3, vitamin_a_mcg = 0, refuse_rate_percent = 13, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":16,"basisGrams":100,"ediblePercent":87,"missingNutrients":[],"values":{"sourceRow":16,"category":"TUBER","name":"Khoai tây","ediblePercent":87,"energyKcal100g":96,"proteinG":2,"fatG":0.07,"carbG":21.93,"fiberG":1,"calciumMg":10,"ironMg":1.2,"zincMg":0.3,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Khoai tây') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Miến dong', (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Miến dong'));

UPDATE food_ingredients SET name = 'Miến dong', category_id = (SELECT id FROM food_categories WHERE name = 'Khoai củ và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 338, protein_g = 0.6, fat_g = 0.1, carb_g = 83.7, fiber_g = 1.5, calcium_mg = 40, iron_mg = 1, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":17,"basisGrams":100,"ediblePercent":100,"missingNutrients":["zincMg"],"values":{"sourceRow":17,"category":"TUBER","name":"Miến dong","ediblePercent":100,"energyKcal100g":338,"proteinG":0.6,"fatG":0.1,"carbG":83.7,"fiberG":1.5,"calciumMg":40,"ironMg":1,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Miến dong') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu đen (hạt)', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu đen (hạt)'));

UPDATE food_ingredients SET name = 'Đậu đen (hạt)', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 341, protein_g = 24.2, fat_g = 1.7, carb_g = 57.3, fiber_g = 4, calcium_mg = 56, iron_mg = 6.1, zinc_mg = 0, vitamin_a_mcg = 3, refuse_rate_percent = 2, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":18,"basisGrams":100,"ediblePercent":98,"missingNutrients":["zincMg"],"values":{"sourceRow":18,"category":"LEGUME","name":"Đậu đen (hạt)","ediblePercent":98,"energyKcal100g":341,"proteinG":24.2,"fatG":1.7,"carbG":57.3,"fiberG":4,"calciumMg":56,"ironMg":6.1,"zincMg":null,"vitaminAMcg":3}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu đen (hạt)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu đũa (hạt)', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu đũa (hạt)'));

UPDATE food_ingredients SET name = 'Đậu đũa (hạt)', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 338, protein_g = 23.7, fat_g = 2, carb_g = 56.2, fiber_g = 4.3, calcium_mg = 110, iron_mg = 6.5, zinc_mg = 0, vitamin_a_mcg = 1, refuse_rate_percent = 10, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":19,"basisGrams":100,"ediblePercent":90,"missingNutrients":["zincMg"],"values":{"sourceRow":19,"category":"LEGUME","name":"Đậu đũa (hạt)","ediblePercent":90,"energyKcal100g":338,"proteinG":23.7,"fatG":2,"carbG":56.2,"fiberG":4.3,"calciumMg":110,"ironMg":6.5,"zincMg":null,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu đũa (hạt)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu Hà lan (hạt)', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu Hà lan (hạt)'));

UPDATE food_ingredients SET name = 'Đậu Hà lan (hạt)', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 342, protein_g = 22.2, fat_g = 1.4, carb_g = 60.1, fiber_g = 6, calcium_mg = 57, iron_mg = 4.4, zinc_mg = 4, vitamin_a_mcg = 6, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":20,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":20,"category":"LEGUME","name":"Đậu Hà lan (hạt)","ediblePercent":100,"energyKcal100g":342,"proteinG":22.2,"fatG":1.4,"carbG":60.1,"fiberG":6,"calciumMg":57,"ironMg":4.4,"zincMg":4,"vitaminAMcg":6}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu Hà lan (hạt)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu tương (đậu nành)', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu tương (đậu nành)'));

UPDATE food_ingredients SET name = 'Đậu tương (đậu nành)', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 418, protein_g = 34, fat_g = 18.4, carb_g = 29.1, fiber_g = 4.5, calcium_mg = 165, iron_mg = 11, zinc_mg = 3.8, vitamin_a_mcg = 3, refuse_rate_percent = 2, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":21,"basisGrams":100,"ediblePercent":98,"missingNutrients":[],"values":{"sourceRow":21,"category":"LEGUME","name":"Đậu tương (đậu nành)","ediblePercent":98,"energyKcal100g":418,"proteinG":34,"fatG":18.4,"carbG":29.1,"fiberG":4.5,"calciumMg":165,"ironMg":11,"zincMg":3.8,"vitaminAMcg":3}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu tương (đậu nành)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu xanh (đậu tắt)', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu xanh (đậu tắt)'));

UPDATE food_ingredients SET name = 'Đậu xanh (đậu tắt)', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 346, protein_g = 23.4, fat_g = 2.4, carb_g = 57.8, fiber_g = 4.7, calcium_mg = 64, iron_mg = 4.8, zinc_mg = 1.1, vitamin_a_mcg = 3, refuse_rate_percent = 2, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":22,"basisGrams":100,"ediblePercent":98,"missingNutrients":[],"values":{"sourceRow":22,"category":"LEGUME","name":"Đậu xanh (đậu tắt)","ediblePercent":98,"energyKcal100g":346,"proteinG":23.4,"fatG":2.4,"carbG":57.8,"fiberG":4.7,"calciumMg":64,"ironMg":4.8,"zincMg":1.1,"vitaminAMcg":3}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu xanh (đậu tắt)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Lạc hạt', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Lạc hạt'));

UPDATE food_ingredients SET name = 'Lạc hạt', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 583, protein_g = 27.5, fat_g = 44.5, carb_g = 18, fiber_g = 2.5, calcium_mg = 68, iron_mg = 2.2, zinc_mg = 1.9, vitamin_a_mcg = 1, refuse_rate_percent = 2, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":23,"basisGrams":100,"ediblePercent":98,"missingNutrients":[],"values":{"sourceRow":23,"category":"LEGUME","name":"Lạc hạt","ediblePercent":98,"energyKcal100g":583,"proteinG":27.5,"fatG":44.5,"carbG":18,"fiberG":2.5,"calciumMg":68,"ironMg":2.2,"zincMg":1.9,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Lạc hạt') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Vừng (đen, trắng)', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Vừng (đen, trắng)'));

UPDATE food_ingredients SET name = 'Vừng (đen, trắng)', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 582, protein_g = 20.1, fat_g = 46.4, carb_g = 21.1, fiber_g = 3.5, calcium_mg = 975, iron_mg = 14.55, zinc_mg = 7.75, vitamin_a_mcg = 1, refuse_rate_percent = 5, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":24,"basisGrams":100,"ediblePercent":95,"missingNutrients":[],"values":{"sourceRow":24,"category":"LEGUME","name":"Vừng (đen, trắng)","ediblePercent":95,"energyKcal100g":582,"proteinG":20.1,"fatG":46.4,"carbG":21.1,"fiberG":3.5,"calciumMg":975,"ironMg":14.55,"zincMg":7.75,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Vừng (đen, trắng)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu phụ', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu phụ'));

UPDATE food_ingredients SET name = 'Đậu phụ', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 97, protein_g = 10.9, fat_g = 5.4, carb_g = 1.1, fiber_g = 0.4, calcium_mg = 24, iron_mg = 2.2, zinc_mg = 0.8, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":25,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":25,"category":"LEGUME","name":"Đậu phụ","ediblePercent":100,"energyKcal100g":97,"proteinG":10.9,"fatG":5.4,"carbG":1.1,"fiberG":0.4,"calciumMg":24,"ironMg":2.2,"zincMg":0.8,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu phụ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Sữa đậu nành (100g đậu/lít)', (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa đậu nành (100g đậu/lít)'));

UPDATE food_ingredients SET name = 'Sữa đậu nành (100g đậu/lít)', category_id = (SELECT id FROM food_categories WHERE name = 'Đậu đỗ, hạt giàu đạm và béo' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 29, protein_g = 3.1, fat_g = 1.6, carb_g = 0.5, fiber_g = 0.1, calcium_mg = 18, iron_mg = 1.2, zinc_mg = 0.44, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":26,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":26,"category":"LEGUME","name":"Sữa đậu nành (100g đậu/lít)","ediblePercent":100,"energyKcal100g":29,"proteinG":3.1,"fatG":1.6,"carbG":0.5,"fiberG":0.1,"calciumMg":18,"ironMg":1.2,"zincMg":0.44,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa đậu nành (100g đậu/lít)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bầu', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bầu'));

UPDATE food_ingredients SET name = 'Bầu', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 18, protein_g = 0.6, fat_g = 0.02, carb_g = 3.88, fiber_g = 1, calcium_mg = 21, iron_mg = 0.2, zinc_mg = 0.7, vitamin_a_mcg = 1, refuse_rate_percent = 16, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":27,"basisGrams":100,"ediblePercent":84,"missingNutrients":[],"values":{"sourceRow":27,"category":"VEGETABLE","name":"Bầu","ediblePercent":84,"energyKcal100g":18,"proteinG":0.6,"fatG":0.02,"carbG":3.88,"fiberG":1,"calciumMg":21,"ironMg":0.2,"zincMg":0.7,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bầu') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bí đao (bí xanh)', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bí đao (bí xanh)'));

UPDATE food_ingredients SET name = 'Bí đao (bí xanh)', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 16, protein_g = 0.6, fat_g = 0, carb_g = 3.4, fiber_g = 1, calcium_mg = 26, iron_mg = 0.3, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 27, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":28,"basisGrams":100,"ediblePercent":73,"missingNutrients":["fatG","zincMg"],"values":{"sourceRow":28,"category":"VEGETABLE","name":"Bí đao (bí xanh)","ediblePercent":73,"energyKcal100g":16,"proteinG":0.6,"fatG":null,"carbG":3.4,"fiberG":1,"calciumMg":26,"ironMg":0.3,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bí đao (bí xanh)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bí ngô', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bí ngô'));

UPDATE food_ingredients SET name = 'Bí ngô', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 29, protein_g = 0.3, fat_g = 0.07, carb_g = 6.83, fiber_g = 0.7, calcium_mg = 24, iron_mg = 0.5, zinc_mg = 0.1, vitamin_a_mcg = 237, refuse_rate_percent = 14, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":29,"basisGrams":100,"ediblePercent":86,"missingNutrients":[],"values":{"sourceRow":29,"category":"VEGETABLE","name":"Bí ngô","ediblePercent":86,"energyKcal100g":29,"proteinG":0.3,"fatG":0.07,"carbG":6.83,"fiberG":0.7,"calciumMg":24,"ironMg":0.5,"zincMg":0.1,"vitaminAMcg":237}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bí ngô') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cà chua', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà chua'));

UPDATE food_ingredients SET name = 'Cà chua', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 24, protein_g = 0.6, fat_g = 0.23, carb_g = 4.77, fiber_g = 0.8, calcium_mg = 12, iron_mg = 1.4, zinc_mg = 0.74, vitamin_a_mcg = 59, refuse_rate_percent = 5, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":30,"basisGrams":100,"ediblePercent":95,"missingNutrients":[],"values":{"sourceRow":30,"category":"VEGETABLE","name":"Cà chua","ediblePercent":95,"energyKcal100g":24,"proteinG":0.6,"fatG":0.23,"carbG":4.77,"fiberG":0.8,"calciumMg":12,"ironMg":1.4,"zincMg":0.74,"vitaminAMcg":59}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà chua') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cà rốt (củ đỏ, vàng)', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà rốt (củ đỏ, vàng)'));

UPDATE food_ingredients SET name = 'Cà rốt (củ đỏ, vàng)', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 44, protein_g = 1.5, fat_g = 0.17, carb_g = 9.03, fiber_g = 1.2, calcium_mg = 43, iron_mg = 0.8, zinc_mg = 1.11, vitamin_a_mcg = 681, refuse_rate_percent = 15, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":31,"basisGrams":100,"ediblePercent":85,"missingNutrients":[],"values":{"sourceRow":31,"category":"VEGETABLE","name":"Cà rốt (củ đỏ, vàng)","ediblePercent":85,"energyKcal100g":44,"proteinG":1.5,"fatG":0.17,"carbG":9.03,"fiberG":1.2,"calciumMg":43,"ironMg":0.8,"zincMg":1.11,"vitaminAMcg":681}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cà rốt (củ đỏ, vàng)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cải bắp', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải bắp'));

UPDATE food_ingredients SET name = 'Cải bắp', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 36, protein_g = 1.8, fat_g = 0.09, carb_g = 6.91, fiber_g = 1.6, calcium_mg = 48, iron_mg = 1.1, zinc_mg = 0.81, vitamin_a_mcg = 5, refuse_rate_percent = 10, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":32,"basisGrams":100,"ediblePercent":90,"missingNutrients":[],"values":{"sourceRow":32,"category":"VEGETABLE","name":"Cải bắp","ediblePercent":90,"energyKcal100g":36,"proteinG":1.8,"fatG":0.09,"carbG":6.91,"fiberG":1.6,"calciumMg":48,"ironMg":1.1,"zincMg":0.81,"vitaminAMcg":5}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải bắp') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cải cúc', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải cúc'));

UPDATE food_ingredients SET name = 'Cải cúc', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 22, protein_g = 1.6, fat_g = 0, carb_g = 3.9, fiber_g = 2, calcium_mg = 63, iron_mg = 0.8, zinc_mg = 0.67, vitamin_a_mcg = 12, refuse_rate_percent = 25, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":33,"basisGrams":100,"ediblePercent":75,"missingNutrients":["fatG"],"values":{"sourceRow":33,"category":"VEGETABLE","name":"Cải cúc","ediblePercent":75,"energyKcal100g":22,"proteinG":1.6,"fatG":null,"carbG":3.9,"fiberG":2,"calciumMg":63,"ironMg":0.8,"zincMg":0.67,"vitaminAMcg":12}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải cúc') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cải soong', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải soong'));

UPDATE food_ingredients SET name = 'Cải soong', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 22, protein_g = 2.1, fat_g = 0.07, carb_g = 3.33, fiber_g = 2, calcium_mg = 69, iron_mg = 1.6, zinc_mg = 0.8, vitamin_a_mcg = 235, refuse_rate_percent = 30, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":34,"basisGrams":100,"ediblePercent":70,"missingNutrients":[],"values":{"sourceRow":34,"category":"VEGETABLE","name":"Cải soong","ediblePercent":70,"energyKcal100g":22,"proteinG":2.1,"fatG":0.07,"carbG":3.33,"fiberG":2,"calciumMg":69,"ironMg":1.6,"zincMg":0.8,"vitaminAMcg":235}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải soong') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cải thìa (cải trắng)', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải thìa (cải trắng)'));

UPDATE food_ingredients SET name = 'Cải thìa (cải trắng)', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 24, protein_g = 1.4, fat_g = 0.14, carb_g = 4.26, fiber_g = 1.8, calcium_mg = 50, iron_mg = 0.7, zinc_mg = 0.75, vitamin_a_mcg = 223, refuse_rate_percent = 25, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":35,"basisGrams":100,"ediblePercent":75,"missingNutrients":[],"values":{"sourceRow":35,"category":"VEGETABLE","name":"Cải thìa (cải trắng)","ediblePercent":75,"energyKcal100g":24,"proteinG":1.4,"fatG":0.14,"carbG":4.26,"fiberG":1.8,"calciumMg":50,"ironMg":0.7,"zincMg":0.75,"vitaminAMcg":223}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải thìa (cải trắng)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cải xanh', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải xanh'));

UPDATE food_ingredients SET name = 'Cải xanh', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 23, protein_g = 1.7, fat_g = 0.14, carb_g = 3.76, fiber_g = 1.8, calcium_mg = 89, iron_mg = 1.9, zinc_mg = 0.9, vitamin_a_mcg = 525, refuse_rate_percent = 24, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":36,"basisGrams":100,"ediblePercent":76,"missingNutrients":[],"values":{"sourceRow":36,"category":"VEGETABLE","name":"Cải xanh","ediblePercent":76,"energyKcal100g":23,"proteinG":1.7,"fatG":0.14,"carbG":3.76,"fiberG":1.8,"calciumMg":89,"ironMg":1.9,"zincMg":0.9,"vitaminAMcg":525}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải xanh') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu cô ve', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu cô ve'));

UPDATE food_ingredients SET name = 'Đậu cô ve', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 77, protein_g = 5, fat_g = 0, carb_g = 14.3, fiber_g = 1, calcium_mg = 26, iron_mg = 0.7, zinc_mg = 0.01, vitamin_a_mcg = 15, refuse_rate_percent = 10, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":37,"basisGrams":100,"ediblePercent":90,"missingNutrients":["fatG"],"values":{"sourceRow":37,"category":"VEGETABLE","name":"Đậu cô ve","ediblePercent":90,"energyKcal100g":77,"proteinG":5,"fatG":null,"carbG":14.3,"fiberG":1,"calciumMg":26,"ironMg":0.7,"zincMg":0.01,"vitaminAMcg":15}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu cô ve') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu đũa', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu đũa'));

UPDATE food_ingredients SET name = 'Đậu đũa', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 67, protein_g = 6, fat_g = 0.31, carb_g = 9.99, fiber_g = 2, calcium_mg = 47, iron_mg = 1.6, zinc_mg = 0.37, vitamin_a_mcg = 21, refuse_rate_percent = 10, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":38,"basisGrams":100,"ediblePercent":90,"missingNutrients":[],"values":{"sourceRow":38,"category":"VEGETABLE","name":"Đậu đũa","ediblePercent":90,"energyKcal100g":67,"proteinG":6,"fatG":0.31,"carbG":9.99,"fiberG":2,"calciumMg":47,"ironMg":1.6,"zincMg":0.37,"vitaminAMcg":21}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu đũa') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đậu Hà Lan', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu Hà Lan'));

UPDATE food_ingredients SET name = 'Đậu Hà Lan', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 75, protein_g = 6.5, fat_g = 0.29, carb_g = 11.71, fiber_g = 1, calcium_mg = 57, iron_mg = 0.8, zinc_mg = 1.24, vitamin_a_mcg = 41, refuse_rate_percent = 10, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":39,"basisGrams":100,"ediblePercent":90,"missingNutrients":[],"values":{"sourceRow":39,"category":"VEGETABLE","name":"Đậu Hà Lan","ediblePercent":90,"energyKcal100g":75,"proteinG":6.5,"fatG":0.29,"carbG":11.71,"fiberG":1,"calciumMg":57,"ironMg":0.8,"zincMg":1.24,"vitaminAMcg":41}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đậu Hà Lan') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Giá đậu xanh', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Giá đậu xanh'));

UPDATE food_ingredients SET name = 'Giá đậu xanh', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 52, protein_g = 5.5, fat_g = 0.13, carb_g = 7.17, fiber_g = 2, calcium_mg = 38, iron_mg = 1.4, zinc_mg = 0.41, vitamin_a_mcg = 1, refuse_rate_percent = 5, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":40,"basisGrams":100,"ediblePercent":95,"missingNutrients":[],"values":{"sourceRow":40,"category":"VEGETABLE","name":"Giá đậu xanh","ediblePercent":95,"energyKcal100g":52,"proteinG":5.5,"fatG":0.13,"carbG":7.17,"fiberG":2,"calciumMg":38,"ironMg":1.4,"zincMg":0.41,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Giá đậu xanh') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Mướp', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Mướp'));

UPDATE food_ingredients SET name = 'Mướp', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 18, protein_g = 0.9, fat_g = 0.14, carb_g = 3.36, fiber_g = 0.5, calcium_mg = 28, iron_mg = 0.8, zinc_mg = 0.07, vitamin_a_mcg = 13, refuse_rate_percent = 12, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":41,"basisGrams":100,"ediblePercent":88,"missingNutrients":[],"values":{"sourceRow":41,"category":"VEGETABLE","name":"Mướp","ediblePercent":88,"energyKcal100g":18,"proteinG":0.9,"fatG":0.14,"carbG":3.36,"fiberG":0.5,"calciumMg":28,"ironMg":0.8,"zincMg":0.07,"vitaminAMcg":13}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Mướp') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Rau mồng tơi', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau mồng tơi'));

UPDATE food_ingredients SET name = 'Rau mồng tơi', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 24, protein_g = 2, fat_g = 0, carb_g = 3.9, fiber_g = 2.5, calcium_mg = 176, iron_mg = 1.6, zinc_mg = 0.54, vitamin_a_mcg = 160, refuse_rate_percent = 17, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":42,"basisGrams":100,"ediblePercent":83,"missingNutrients":["fatG"],"values":{"sourceRow":42,"category":"VEGETABLE","name":"Rau mồng tơi","ediblePercent":83,"energyKcal100g":24,"proteinG":2,"fatG":null,"carbG":3.9,"fiberG":2.5,"calciumMg":176,"ironMg":1.6,"zincMg":0.54,"vitaminAMcg":160}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau mồng tơi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Rau muống', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau muống'));

UPDATE food_ingredients SET name = 'Rau muống', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 28, protein_g = 3.2, fat_g = 0.24, carb_g = 3.26, fiber_g = 1, calcium_mg = 100, iron_mg = 1.4, zinc_mg = 0.35, vitamin_a_mcg = 142, refuse_rate_percent = 15, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":43,"basisGrams":100,"ediblePercent":85,"missingNutrients":[],"values":{"sourceRow":43,"category":"VEGETABLE","name":"Rau muống","ediblePercent":85,"energyKcal100g":28,"proteinG":3.2,"fatG":0.24,"carbG":3.26,"fiberG":1,"calciumMg":100,"ironMg":1.4,"zincMg":0.35,"vitaminAMcg":142}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau muống') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Rau ngót', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau ngót'));

UPDATE food_ingredients SET name = 'Rau ngót', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 45, protein_g = 5.3, fat_g = 0, carb_g = 5.9, fiber_g = 2.5, calcium_mg = 169, iron_mg = 2.7, zinc_mg = 0.94, vitamin_a_mcg = 591, refuse_rate_percent = 23, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":44,"basisGrams":100,"ediblePercent":77,"missingNutrients":["fatG"],"values":{"sourceRow":44,"category":"VEGETABLE","name":"Rau ngót","ediblePercent":77,"energyKcal100g":45,"proteinG":5.3,"fatG":null,"carbG":5.9,"fiberG":2.5,"calciumMg":169,"ironMg":2.7,"zincMg":0.94,"vitaminAMcg":591}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Rau ngót') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Su hào', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Su hào'));

UPDATE food_ingredients SET name = 'Su hào', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 44, protein_g = 2.8, fat_g = 0.07, carb_g = 7.93, fiber_g = 1.7, calcium_mg = 46, iron_mg = 0.6, zinc_mg = 0.45, vitamin_a_mcg = 2, refuse_rate_percent = 22, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":45,"basisGrams":100,"ediblePercent":78,"missingNutrients":[],"values":{"sourceRow":45,"category":"VEGETABLE","name":"Su hào","ediblePercent":78,"energyKcal100g":44,"proteinG":2.8,"fatG":0.07,"carbG":7.93,"fiberG":1.7,"calciumMg":46,"ironMg":0.6,"zincMg":0.45,"vitaminAMcg":2}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Su hào') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Su su', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Su su'));

UPDATE food_ingredients SET name = 'Su su', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 23, protein_g = 0.8, fat_g = 0.1, carb_g = 4.6, fiber_g = 1, calcium_mg = 17, iron_mg = 0.4, zinc_mg = 0.74, vitamin_a_mcg = 0, refuse_rate_percent = 20, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":46,"basisGrams":100,"ediblePercent":80,"missingNutrients":[],"values":{"sourceRow":46,"category":"VEGETABLE","name":"Su su","ediblePercent":80,"energyKcal100g":23,"proteinG":0.8,"fatG":0.1,"carbG":4.6,"fiberG":1,"calciumMg":17,"ironMg":0.4,"zincMg":0.74,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Su su') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Súp lơ trắng', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Súp lơ trắng'));

UPDATE food_ingredients SET name = 'Súp lơ trắng', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 34, protein_g = 2.5, fat_g = 0.15, carb_g = 5.65, fiber_g = 0.9, calcium_mg = 26, iron_mg = 1.4, zinc_mg = 0.2, vitamin_a_mcg = 1, refuse_rate_percent = 40, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":47,"basisGrams":100,"ediblePercent":60,"missingNutrients":[],"values":{"sourceRow":47,"category":"VEGETABLE","name":"Súp lơ trắng","ediblePercent":60,"energyKcal100g":34,"proteinG":2.5,"fatG":0.15,"carbG":5.65,"fiberG":0.9,"calciumMg":26,"ironMg":1.4,"zincMg":0.2,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Súp lơ trắng') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Súp lơ xanh', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Súp lơ xanh'));

UPDATE food_ingredients SET name = 'Súp lơ xanh', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 39, protein_g = 2.95, fat_g = 0.3, carb_g = 6.08, fiber_g = 3.2, calcium_mg = 33, iron_mg = 0.73, zinc_mg = 0.64, vitamin_a_mcg = 8, refuse_rate_percent = 39, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":48,"basisGrams":100,"ediblePercent":61,"missingNutrients":[],"values":{"sourceRow":48,"category":"VEGETABLE","name":"Súp lơ xanh","ediblePercent":61,"energyKcal100g":39,"proteinG":2.95,"fatG":0.3,"carbG":6.08,"fiberG":3.2,"calciumMg":33,"ironMg":0.73,"zincMg":0.64,"vitaminAMcg":8}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Súp lơ xanh') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cải ngọt', (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải ngọt'));

UPDATE food_ingredients SET name = 'Cải ngọt', category_id = (SELECT id FROM food_categories WHERE name = 'Rau, củ, quả làm rau' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 17, protein_g = 1.4, fat_g = 0.1, carb_g = 2.62, fiber_g = 0, calcium_mg = 128, iron_mg = 0.77, zinc_mg = 0.57, vitamin_a_mcg = 101, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":49,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fiberG"],"values":{"sourceRow":49,"category":"VEGETABLE","name":"Cải ngọt","ediblePercent":100,"energyKcal100g":17,"proteinG":1.4,"fatG":0.1,"carbG":2.62,"fiberG":null,"calciumMg":128,"ironMg":0.77,"zincMg":0.57,"vitaminAMcg":101}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cải ngọt') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Bưởi', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bưởi'));

UPDATE food_ingredients SET name = 'Bưởi', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 33, protein_g = 0.2, fat_g = 0, carb_g = 8, fiber_g = 0.7, calcium_mg = 23, iron_mg = 0.5, zinc_mg = 0.16, vitamin_a_mcg = 0, refuse_rate_percent = 35, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":50,"basisGrams":100,"ediblePercent":65,"missingNutrients":["fatG"],"values":{"sourceRow":50,"category":"FRUIT","name":"Bưởi","ediblePercent":65,"energyKcal100g":33,"proteinG":0.2,"fatG":null,"carbG":8,"fiberG":0.7,"calciumMg":23,"ironMg":0.5,"zincMg":0.16,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Bưởi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cam', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cam'));

UPDATE food_ingredients SET name = 'Cam', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 43, protein_g = 0.9, fat_g = 0.06, carb_g = 9.74, fiber_g = 1.4, calcium_mg = 34, iron_mg = 0.4, zinc_mg = 0.22, vitamin_a_mcg = 8, refuse_rate_percent = 25, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":51,"basisGrams":100,"ediblePercent":75,"missingNutrients":[],"values":{"sourceRow":51,"category":"FRUIT","name":"Cam","ediblePercent":75,"energyKcal100g":43,"proteinG":0.9,"fatG":0.06,"carbG":9.74,"fiberG":1.4,"calciumMg":34,"ironMg":0.4,"zincMg":0.22,"vitaminAMcg":8}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cam') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Chuối tây', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Chuối tây'));

UPDATE food_ingredients SET name = 'Chuối tây', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 66, protein_g = 0.9, fat_g = 0.3, carb_g = 15, fiber_g = 0, calcium_mg = 12, iron_mg = 0.5, zinc_mg = 0.32, vitamin_a_mcg = 3, refuse_rate_percent = 24, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":52,"basisGrams":100,"ediblePercent":76,"missingNutrients":[],"values":{"sourceRow":52,"category":"FRUIT","name":"Chuối tây","ediblePercent":76,"energyKcal100g":66,"proteinG":0.9,"fatG":0.3,"carbG":15,"fiberG":0,"calciumMg":12,"ironMg":0.5,"zincMg":0.32,"vitaminAMcg":3}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Chuối tây') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Chuối tiêu', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Chuối tiêu'));

UPDATE food_ingredients SET name = 'Chuối tiêu', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 100, protein_g = 1.5, fat_g = 0.2, carb_g = 23, fiber_g = 0.8, calcium_mg = 8, iron_mg = 0.6, zinc_mg = 0.37, vitamin_a_mcg = 4, refuse_rate_percent = 30, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":53,"basisGrams":100,"ediblePercent":70,"missingNutrients":[],"values":{"sourceRow":53,"category":"FRUIT","name":"Chuối tiêu","ediblePercent":70,"energyKcal100g":100,"proteinG":1.5,"fatG":0.2,"carbG":23,"fiberG":0.8,"calciumMg":8,"ironMg":0.6,"zincMg":0.37,"vitaminAMcg":4}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Chuối tiêu') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Dưa hấu', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dưa hấu'));

UPDATE food_ingredients SET name = 'Dưa hấu', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 18, protein_g = 1.2, fat_g = 0.2, carb_g = 2.8, fiber_g = 0.5, calcium_mg = 8, iron_mg = 1, zinc_mg = 0.11, vitamin_a_mcg = 37, refuse_rate_percent = 48, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":54,"basisGrams":100,"ediblePercent":52,"missingNutrients":[],"values":{"sourceRow":54,"category":"FRUIT","name":"Dưa hấu","ediblePercent":52,"energyKcal100g":18,"proteinG":1.2,"fatG":0.2,"carbG":2.8,"fiberG":0.5,"calciumMg":8,"ironMg":1,"zincMg":0.11,"vitaminAMcg":37}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dưa hấu') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Đu đủ chín', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đu đủ chín'));

UPDATE food_ingredients SET name = 'Đu đủ chín', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 38, protein_g = 1, fat_g = 0.11, carb_g = 8.19, fiber_g = 0.6, calcium_mg = 40, iron_mg = 2.6, zinc_mg = 0.1, vitamin_a_mcg = 56, refuse_rate_percent = 12, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":55,"basisGrams":100,"ediblePercent":88,"missingNutrients":[],"values":{"sourceRow":55,"category":"FRUIT","name":"Đu đủ chín","ediblePercent":88,"energyKcal100g":38,"proteinG":1,"fatG":0.11,"carbG":8.19,"fiberG":0.6,"calciumMg":40,"ironMg":2.6,"zincMg":0.1,"vitaminAMcg":56}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Đu đủ chín') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Nhãn', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Nhãn'));

UPDATE food_ingredients SET name = 'Nhãn', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 52, protein_g = 0.9, fat_g = 0, carb_g = 12, fiber_g = 1, calcium_mg = 21, iron_mg = 0.4, zinc_mg = 0.29, vitamin_a_mcg = 0, refuse_rate_percent = 45, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":56,"basisGrams":100,"ediblePercent":55,"missingNutrients":["fatG"],"values":{"sourceRow":56,"category":"FRUIT","name":"Nhãn","ediblePercent":55,"energyKcal100g":52,"proteinG":0.9,"fatG":null,"carbG":12,"fiberG":1,"calciumMg":21,"ironMg":0.4,"zincMg":0.29,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Nhãn') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Ổi', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ổi'));

UPDATE food_ingredients SET name = 'Ổi', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 61, protein_g = 0.6, fat_g = 0.76, carb_g = 12.94, fiber_g = 6, calcium_mg = 10, iron_mg = 1.3, zinc_mg = 2.4, vitamin_a_mcg = 31, refuse_rate_percent = 5, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":57,"basisGrams":100,"ediblePercent":95,"missingNutrients":[],"values":{"sourceRow":57,"category":"FRUIT","name":"Ổi","ediblePercent":95,"energyKcal100g":61,"proteinG":0.6,"fatG":0.76,"carbG":12.94,"fiberG":6,"calciumMg":10,"ironMg":1.3,"zincMg":2.4,"vitaminAMcg":31}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Ổi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Quít', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Quít'));

UPDATE food_ingredients SET name = 'Quít', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 40, protein_g = 0.8, fat_g = 0, carb_g = 9.2, fiber_g = 0.6, calcium_mg = 35, iron_mg = 0.4, zinc_mg = 0.2, vitamin_a_mcg = 25, refuse_rate_percent = 26, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":58,"basisGrams":100,"ediblePercent":74,"missingNutrients":["fatG"],"values":{"sourceRow":58,"category":"FRUIT","name":"Quít","ediblePercent":74,"energyKcal100g":40,"proteinG":0.8,"fatG":null,"carbG":9.2,"fiberG":0.6,"calciumMg":35,"ironMg":0.4,"zincMg":0.2,"vitaminAMcg":25}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Quít') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Vải', (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Vải'));

UPDATE food_ingredients SET name = 'Vải', category_id = (SELECT id FROM food_categories WHERE name = 'Quả chín / Trái cây' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 49, protein_g = 0.7, fat_g = 0.35, carb_g = 10.75, fiber_g = 1.1, calcium_mg = 6, iron_mg = 0.5, zinc_mg = 0.07, vitamin_a_mcg = 0, refuse_rate_percent = 48, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":59,"basisGrams":100,"ediblePercent":52,"missingNutrients":[],"values":{"sourceRow":59,"category":"FRUIT","name":"Vải","ediblePercent":52,"energyKcal100g":49,"proteinG":0.7,"fatG":0.35,"carbG":10.75,"fiberG":1.1,"calciumMg":6,"ironMg":0.5,"zincMg":0.07,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Vải') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Dầu thảo mộc (Lạc, vừng, ...)', (SELECT id FROM food_categories WHERE name = 'Dầu, mỡ và bơ' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dầu thảo mộc (Lạc, vừng, ...)'));

UPDATE food_ingredients SET name = 'Dầu thảo mộc (Lạc, vừng, ...)', category_id = (SELECT id FROM food_categories WHERE name = 'Dầu, mỡ và bơ' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 897, protein_g = 0, fat_g = 99.7, carb_g = 0, fiber_g = 0, calcium_mg = 0, iron_mg = 0, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":100,"basisGrams":100,"ediblePercent":100,"missingNutrients":["calciumMg","ironMg","zincMg"],"values":{"sourceRow":100,"category":"FAT","name":"Dầu thảo mộc (Lạc, vừng, ...)","ediblePercent":100,"energyKcal100g":897,"proteinG":0,"fatG":99.7,"carbG":0,"fiberG":0,"calciumMg":null,"ironMg":null,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dầu thảo mộc (Lạc, vừng, ...)') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Mỡ lợn nước', (SELECT id FROM food_categories WHERE name = 'Dầu, mỡ và bơ' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Mỡ lợn nước'));

UPDATE food_ingredients SET name = 'Mỡ lợn nước', category_id = (SELECT id FROM food_categories WHERE name = 'Dầu, mỡ và bơ' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 896, protein_g = 0, fat_g = 99.6, carb_g = 0, fiber_g = 0, calcium_mg = 2, iron_mg = 0.3, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":101,"basisGrams":100,"ediblePercent":100,"missingNutrients":["zincMg"],"values":{"sourceRow":101,"category":"FAT","name":"Mỡ lợn nước","ediblePercent":100,"energyKcal100g":896,"proteinG":0,"fatG":99.6,"carbG":0,"fiberG":0,"calciumMg":2,"ironMg":0.3,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Mỡ lợn nước') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Dầu đậu tương', (SELECT id FROM food_categories WHERE name = 'Dầu, mỡ và bơ' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dầu đậu tương'));

UPDATE food_ingredients SET name = 'Dầu đậu tương', category_id = (SELECT id FROM food_categories WHERE name = 'Dầu, mỡ và bơ' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 900, protein_g = 0, fat_g = 100, carb_g = 0, fiber_g = 0, calcium_mg = 0, iron_mg = 0.02, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":102,"basisGrams":100,"ediblePercent":100,"missingNutrients":["calciumMg","zincMg"],"values":{"sourceRow":102,"category":"FAT","name":"Dầu đậu tương","ediblePercent":100,"energyKcal100g":900,"proteinG":0,"fatG":100,"carbG":0,"fiberG":0,"calciumMg":null,"ironMg":0.02,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Dầu đậu tương') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt bò, lưng, nạc', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt bò, lưng, nạc'));

UPDATE food_ingredients SET name = 'Thịt bò, lưng, nạc', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 121, protein_g = 23.07, fat_g = 3.16, carb_g = 0.1, fiber_g = 0, calcium_mg = 23, iron_mg = 1.63, zinc_mg = 4.05, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":103,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":103,"category":"MEAT","name":"Thịt bò, lưng, nạc","ediblePercent":100,"energyKcal100g":121,"proteinG":23.07,"fatG":3.16,"carbG":0.1,"fiberG":0,"calciumMg":23,"ironMg":1.63,"zincMg":4.05,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt bò, lưng, nạc') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt bò, lưng, nạc và mỡ', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt bò, lưng, nạc và mỡ'));

UPDATE food_ingredients SET name = 'Thịt bò, lưng, nạc và mỡ', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 174, protein_g = 21.53, fat_g = 9.49, carb_g = 0.7, fiber_g = 0, calcium_mg = 5, iron_mg = 1.78, zinc_mg = 3.64, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":104,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":104,"category":"MEAT","name":"Thịt bò, lưng, nạc và mỡ","ediblePercent":100,"energyKcal100g":174,"proteinG":21.53,"fatG":9.49,"carbG":0.7,"fiberG":0,"calciumMg":5,"ironMg":1.78,"zincMg":3.64,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt bò, lưng, nạc và mỡ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt gà ta', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà ta'));

UPDATE food_ingredients SET name = 'Thịt gà ta', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 199, protein_g = 20.3, fat_g = 13.1, carb_g = 0, fiber_g = 0, calcium_mg = 12, iron_mg = 1.5, zinc_mg = 1.5, vitamin_a_mcg = 120, refuse_rate_percent = 52, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":105,"basisGrams":100,"ediblePercent":48,"missingNutrients":[],"values":{"sourceRow":105,"category":"MEAT","name":"Thịt gà ta","ediblePercent":48,"energyKcal100g":199,"proteinG":20.3,"fatG":13.1,"carbG":0,"fiberG":0,"calciumMg":12,"ironMg":1.5,"zincMg":1.5,"vitaminAMcg":120}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà ta') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt lợn mỡ', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn mỡ'));

UPDATE food_ingredients SET name = 'Thịt lợn mỡ', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 394, protein_g = 14.5, fat_g = 37.3, carb_g = 0, fiber_g = 0, calcium_mg = 8, iron_mg = 0.4, zinc_mg = 1.59, vitamin_a_mcg = 2, refuse_rate_percent = 2, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":106,"basisGrams":100,"ediblePercent":98,"missingNutrients":[],"values":{"sourceRow":106,"category":"MEAT","name":"Thịt lợn mỡ","ediblePercent":98,"energyKcal100g":394,"proteinG":14.5,"fatG":37.3,"carbG":0,"fiberG":0,"calciumMg":8,"ironMg":0.4,"zincMg":1.59,"vitaminAMcg":2}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn mỡ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt lợn nạc', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn nạc'));

UPDATE food_ingredients SET name = 'Thịt lợn nạc', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 139, protein_g = 19, fat_g = 7, carb_g = 0, fiber_g = 0, calcium_mg = 7, iron_mg = 0.96, zinc_mg = 2.5, vitamin_a_mcg = 2, refuse_rate_percent = 2, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":107,"basisGrams":100,"ediblePercent":98,"missingNutrients":[],"values":{"sourceRow":107,"category":"MEAT","name":"Thịt lợn nạc","ediblePercent":98,"energyKcal100g":139,"proteinG":19,"fatG":7,"carbG":0,"fiberG":0,"calciumMg":7,"ironMg":0.96,"zincMg":2.5,"vitaminAMcg":2}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn nạc') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt lợn nửa nạc, nửa mỡ', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn nửa nạc, nửa mỡ'));

UPDATE food_ingredients SET name = 'Thịt lợn nửa nạc, nửa mỡ', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 260, protein_g = 16.5, fat_g = 21.5, carb_g = 0, fiber_g = 0, calcium_mg = 9, iron_mg = 1.5, zinc_mg = 1.91, vitamin_a_mcg = 10, refuse_rate_percent = 2, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":108,"basisGrams":100,"ediblePercent":98,"missingNutrients":[],"values":{"sourceRow":108,"category":"MEAT","name":"Thịt lợn nửa nạc, nửa mỡ","ediblePercent":98,"energyKcal100g":260,"proteinG":16.5,"fatG":21.5,"carbG":0,"fiberG":0,"calciumMg":9,"ironMg":1.5,"zincMg":1.91,"vitaminAMcg":10}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn nửa nạc, nửa mỡ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Chân giò lợn', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Chân giò lợn'));

UPDATE food_ingredients SET name = 'Chân giò lợn', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 230, protein_g = 15.7, fat_g = 18.6, carb_g = 0, fiber_g = 0, calcium_mg = 24, iron_mg = 2.1, zinc_mg = 1.93, vitamin_a_mcg = 30, refuse_rate_percent = 38, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":109,"basisGrams":100,"ediblePercent":62,"missingNutrients":[],"values":{"sourceRow":109,"category":"MEAT","name":"Chân giò lợn","ediblePercent":62,"energyKcal100g":230,"proteinG":15.7,"fatG":18.6,"carbG":0,"fiberG":0,"calciumMg":24,"ironMg":2.1,"zincMg":1.93,"vitaminAMcg":30}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Chân giò lợn') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Sườn lợn', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sườn lợn'));

UPDATE food_ingredients SET name = 'Sườn lợn', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 187, protein_g = 17.9, fat_g = 12.8, carb_g = 0, fiber_g = 0, calcium_mg = 7, iron_mg = 0.61, zinc_mg = 3.6, vitamin_a_mcg = 0, refuse_rate_percent = 57, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":110,"basisGrams":100,"ediblePercent":43,"missingNutrients":[],"values":{"sourceRow":110,"category":"MEAT","name":"Sườn lợn","ediblePercent":43,"energyKcal100g":187,"proteinG":17.9,"fatG":12.8,"carbG":0,"fiberG":0,"calciumMg":7,"ironMg":0.61,"zincMg":3.6,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sườn lợn') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Giò bò', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Giò bò'));

UPDATE food_ingredients SET name = 'Giò bò', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 335, protein_g = 18.2, fat_g = 29, carb_g = 0.4, fiber_g = 0.1, calcium_mg = 33, iron_mg = 2.81, zinc_mg = 1.06, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":111,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":111,"category":"MEAT","name":"Giò bò","ediblePercent":100,"energyKcal100g":335,"proteinG":18.2,"fatG":29,"carbG":0.4,"fiberG":0.1,"calciumMg":33,"ironMg":2.81,"zincMg":1.06,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Giò bò') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Giò lụa', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Giò lụa'));

UPDATE food_ingredients SET name = 'Giò lụa', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 205, protein_g = 16.9, fat_g = 15, carb_g = 0.5, fiber_g = 0.1, calcium_mg = 24, iron_mg = 0.87, zinc_mg = 2.41, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":112,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":112,"category":"MEAT","name":"Giò lụa","ediblePercent":100,"energyKcal100g":205,"proteinG":16.9,"fatG":15,"carbG":0.5,"fiberG":0.1,"calciumMg":24,"ironMg":0.87,"zincMg":2.41,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Giò lụa') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt lợn, nạc vai', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn, nạc vai'));

UPDATE food_ingredients SET name = 'Thịt lợn, nạc vai', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 149, protein_g = 20.83, fat_g = 7.29, carb_g = 0, fiber_g = 0, calcium_mg = 24, iron_mg = 0.67, zinc_mg = 2.38, vitamin_a_mcg = 1, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":113,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fiberG"],"values":{"sourceRow":113,"category":"MEAT","name":"Thịt lợn, nạc vai","ediblePercent":100,"energyKcal100g":149,"proteinG":20.83,"fatG":7.29,"carbG":0,"fiberG":null,"calciumMg":24,"ironMg":0.67,"zincMg":2.38,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn, nạc vai') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt lợn, nạc mông', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn, nạc mông'));

UPDATE food_ingredients SET name = 'Thịt lợn, nạc mông', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 141, protein_g = 24.68, fat_g = 4.72, carb_g = 0, fiber_g = 0, calcium_mg = 42, iron_mg = 0.66, zinc_mg = 2.33, vitamin_a_mcg = 1, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":114,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fiberG"],"values":{"sourceRow":114,"category":"MEAT","name":"Thịt lợn, nạc mông","ediblePercent":100,"energyKcal100g":141,"proteinG":24.68,"fatG":4.72,"carbG":0,"fiberG":null,"calciumMg":42,"ironMg":0.66,"zincMg":2.33,"vitaminAMcg":1}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn, nạc mông') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt lợn, nạc thăn', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn, nạc thăn'));

UPDATE food_ingredients SET name = 'Thịt lợn, nạc thăn', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 118, protein_g = 23, fat_g = 2.9, carb_g = 0.04, fiber_g = 0, calcium_mg = 38, iron_mg = 0.72, zinc_mg = 1.8, vitamin_a_mcg = 0, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":115,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fiberG"],"values":{"sourceRow":115,"category":"MEAT","name":"Thịt lợn, nạc thăn","ediblePercent":100,"energyKcal100g":118,"proteinG":23,"fatG":2.9,"carbG":0.04,"fiberG":null,"calciumMg":38,"ironMg":0.72,"zincMg":1.8,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt lợn, nạc thăn') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt gà công nghiệp, cánh', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà công nghiệp, cánh'));

UPDATE food_ingredients SET name = 'Thịt gà công nghiệp, cánh', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 188, protein_g = 19.09, fat_g = 12.43, carb_g = 0, fiber_g = 0, calcium_mg = 19, iron_mg = 1.07, zinc_mg = 0.94, vitamin_a_mcg = 7, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":116,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fiberG"],"values":{"sourceRow":116,"category":"MEAT","name":"Thịt gà công nghiệp, cánh","ediblePercent":100,"energyKcal100g":188,"proteinG":19.09,"fatG":12.43,"carbG":0,"fiberG":null,"calciumMg":19,"ironMg":1.07,"zincMg":0.94,"vitaminAMcg":7}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà công nghiệp, cánh') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt gà công nghiệp, đùi', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà công nghiệp, đùi'));

UPDATE food_ingredients SET name = 'Thịt gà công nghiệp, đùi', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 137, protein_g = 18, fat_g = 6.8, carb_g = 0.89, fiber_g = 0, calcium_mg = 18, iron_mg = 0.75, zinc_mg = 1.63, vitamin_a_mcg = 10, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":117,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fiberG"],"values":{"sourceRow":117,"category":"MEAT","name":"Thịt gà công nghiệp, đùi","ediblePercent":100,"energyKcal100g":137,"proteinG":18,"fatG":6.8,"carbG":0.89,"fiberG":null,"calciumMg":18,"ironMg":0.75,"zincMg":1.63,"vitaminAMcg":10}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà công nghiệp, đùi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Thịt gà công nghiệp, lườn', (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà công nghiệp, lườn'));

UPDATE food_ingredients SET name = 'Thịt gà công nghiệp, lườn', category_id = (SELECT id FROM food_categories WHERE name = 'Thịt và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 134, protein_g = 22.86, fat_g = 4.68, carb_g = 0, fiber_g = 0, calcium_mg = 23, iron_mg = 0.69, zinc_mg = 1, vitamin_a_mcg = 9, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":118,"basisGrams":100,"ediblePercent":100,"missingNutrients":["fiberG"],"values":{"sourceRow":118,"category":"MEAT","name":"Thịt gà công nghiệp, lườn","ediblePercent":100,"energyKcal100g":134,"proteinG":22.86,"fatG":4.68,"carbG":0,"fiberG":null,"calciumMg":23,"ironMg":0.69,"zincMg":1,"vitaminAMcg":9}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Thịt gà công nghiệp, lườn') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá chép', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá chép'));

UPDATE food_ingredients SET name = 'Cá chép', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 96, protein_g = 16, fat_g = 3.6, carb_g = 0, fiber_g = 0, calcium_mg = 17, iron_mg = 0.9, zinc_mg = 1.48, vitamin_a_mcg = 181, refuse_rate_percent = 40, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":119,"basisGrams":100,"ediblePercent":60,"missingNutrients":[],"values":{"sourceRow":119,"category":"FISH","name":"Cá chép","ediblePercent":60,"energyKcal100g":96,"proteinG":16,"fatG":3.6,"carbG":0,"fiberG":0,"calciumMg":17,"ironMg":0.9,"zincMg":1.48,"vitaminAMcg":181}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá chép') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá mè', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá mè'));

UPDATE food_ingredients SET name = 'Cá mè', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 144, protein_g = 15.4, fat_g = 9.1, carb_g = 0, fiber_g = 0, calcium_mg = 157, iron_mg = 0, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 35, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":120,"basisGrams":100,"ediblePercent":65,"missingNutrients":["ironMg","zincMg"],"values":{"sourceRow":120,"category":"FISH","name":"Cá mè","ediblePercent":65,"energyKcal100g":144,"proteinG":15.4,"fatG":9.1,"carbG":0,"fiberG":0,"calciumMg":157,"ironMg":null,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá mè') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá ngừ', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá ngừ'));

UPDATE food_ingredients SET name = 'Cá ngừ', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 87, protein_g = 21, fat_g = 0.3, carb_g = 0, fiber_g = 0, calcium_mg = 44, iron_mg = 1, zinc_mg = 0.52, vitamin_a_mcg = 5, refuse_rate_percent = 42, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":121,"basisGrams":100,"ediblePercent":58,"missingNutrients":[],"values":{"sourceRow":121,"category":"FISH","name":"Cá ngừ","ediblePercent":58,"energyKcal100g":87,"proteinG":21,"fatG":0.3,"carbG":0,"fiberG":0,"calciumMg":44,"ironMg":1,"zincMg":0.52,"vitaminAMcg":5}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá ngừ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá nục', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá nục'));

UPDATE food_ingredients SET name = 'Cá nục', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 111, protein_g = 20.2, fat_g = 3.3, carb_g = 0, fiber_g = 0, calcium_mg = 85, iron_mg = 3.25, zinc_mg = 1.72, vitamin_a_mcg = 15, refuse_rate_percent = 27, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":122,"basisGrams":100,"ediblePercent":73,"missingNutrients":[],"values":{"sourceRow":122,"category":"FISH","name":"Cá nục","ediblePercent":73,"energyKcal100g":111,"proteinG":20.2,"fatG":3.3,"carbG":0,"fiberG":0,"calciumMg":85,"ironMg":3.25,"zincMg":1.72,"vitaminAMcg":15}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá nục') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá quả', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá quả'));

UPDATE food_ingredients SET name = 'Cá quả', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 97, protein_g = 18.2, fat_g = 2.7, carb_g = 0, fiber_g = 0, calcium_mg = 90, iron_mg = 0, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 40, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":123,"basisGrams":100,"ediblePercent":60,"missingNutrients":["ironMg","zincMg"],"values":{"sourceRow":123,"category":"FISH","name":"Cá quả","ediblePercent":60,"energyKcal100g":97,"proteinG":18.2,"fatG":2.7,"carbG":0,"fiberG":0,"calciumMg":90,"ironMg":null,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá quả') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá rô phi', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá rô phi'));

UPDATE food_ingredients SET name = 'Cá rô phi', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 100, protein_g = 19.7, fat_g = 2.3, carb_g = 0, fiber_g = 0, calcium_mg = 50, iron_mg = 0.53, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 43, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":124,"basisGrams":100,"ediblePercent":57,"missingNutrients":["zincMg"],"values":{"sourceRow":124,"category":"FISH","name":"Cá rô phi","ediblePercent":57,"energyKcal100g":100,"proteinG":19.7,"fatG":2.3,"carbG":0,"fiberG":0,"calciumMg":50,"ironMg":0.53,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá rô phi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá thu', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá thu'));

UPDATE food_ingredients SET name = 'Cá thu', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 166, protein_g = 18.2, fat_g = 10.3, carb_g = 0, fiber_g = 0, calcium_mg = 50, iron_mg = 1.3, zinc_mg = 0, vitamin_a_mcg = 10, refuse_rate_percent = 35, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":125,"basisGrams":100,"ediblePercent":65,"missingNutrients":["zincMg"],"values":{"sourceRow":125,"category":"FISH","name":"Cá thu","ediblePercent":65,"energyKcal100g":166,"proteinG":18.2,"fatG":10.3,"carbG":0,"fiberG":0,"calciumMg":50,"ironMg":1.3,"zincMg":null,"vitaminAMcg":10}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá thu') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá trắm cỏ', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá trắm cỏ'));

UPDATE food_ingredients SET name = 'Cá trắm cỏ', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 91, protein_g = 17, fat_g = 2.6, carb_g = 0, fiber_g = 0, calcium_mg = 57, iron_mg = 0.1, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 35, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":126,"basisGrams":100,"ediblePercent":65,"missingNutrients":["zincMg"],"values":{"sourceRow":126,"category":"FISH","name":"Cá trắm cỏ","ediblePercent":65,"energyKcal100g":91,"proteinG":17,"fatG":2.6,"carbG":0,"fiberG":0,"calciumMg":57,"ironMg":0.1,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá trắm cỏ') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá trôi', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá trôi'));

UPDATE food_ingredients SET name = 'Cá trôi', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 127, protein_g = 18.8, fat_g = 5.7, carb_g = 0, fiber_g = 0, calcium_mg = 76, iron_mg = 0.05, zinc_mg = 0, vitamin_a_mcg = 0, refuse_rate_percent = 28, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":127,"basisGrams":100,"ediblePercent":72,"missingNutrients":["zincMg"],"values":{"sourceRow":127,"category":"FISH","name":"Cá trôi","ediblePercent":72,"energyKcal100g":127,"proteinG":18.8,"fatG":5.7,"carbG":0,"fiberG":0,"calciumMg":76,"ironMg":0.05,"zincMg":null,"vitaminAMcg":0}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá trôi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cua đồng', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cua đồng'));

UPDATE food_ingredients SET name = 'Cua đồng', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 87, protein_g = 12.3, fat_g = 3.3, carb_g = 2, fiber_g = 0, calcium_mg = 826, iron_mg = 1.4, zinc_mg = 0, vitamin_a_mcg = 210, refuse_rate_percent = 69, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":128,"basisGrams":100,"ediblePercent":31,"missingNutrients":["zincMg"],"values":{"sourceRow":128,"category":"FISH","name":"Cua đồng","ediblePercent":31,"energyKcal100g":87,"proteinG":12.3,"fatG":3.3,"carbG":2,"fiberG":0,"calciumMg":826,"ironMg":1.4,"zincMg":null,"vitaminAMcg":210}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cua đồng') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Tôm biển', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Tôm biển'));

UPDATE food_ingredients SET name = 'Tôm biển', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 82, protein_g = 17.6, fat_g = 0.9, carb_g = 0.9, fiber_g = 0, calcium_mg = 79, iron_mg = 1.6, zinc_mg = 1.11, vitamin_a_mcg = 20, refuse_rate_percent = 54, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":129,"basisGrams":100,"ediblePercent":46,"missingNutrients":[],"values":{"sourceRow":129,"category":"FISH","name":"Tôm biển","ediblePercent":46,"energyKcal100g":82,"proteinG":17.6,"fatG":0.9,"carbG":0.9,"fiberG":0,"calciumMg":79,"ironMg":1.6,"zincMg":1.11,"vitaminAMcg":20}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Tôm biển') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Tôm đồng', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Tôm đồng'));

UPDATE food_ingredients SET name = 'Tôm đồng', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 90, protein_g = 18.4, fat_g = 1.8, carb_g = 0, fiber_g = 0, calcium_mg = 1120, iron_mg = 2.2, zinc_mg = 0, vitamin_a_mcg = 15, refuse_rate_percent = 10, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":130,"basisGrams":100,"ediblePercent":90,"missingNutrients":["zincMg"],"values":{"sourceRow":130,"category":"FISH","name":"Tôm đồng","ediblePercent":90,"energyKcal100g":90,"proteinG":18.4,"fatG":1.8,"carbG":0,"fiberG":0,"calciumMg":1120,"ironMg":2.2,"zincMg":null,"vitaminAMcg":15}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Tôm đồng') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Cá basa, phi lê', (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá basa, phi lê'));

UPDATE food_ingredients SET name = 'Cá basa, phi lê', category_id = (SELECT id FROM food_categories WHERE name = 'Thủy sản và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 67, protein_g = 9.7, fat_g = 0.8, carb_g = 5.32, fiber_g = 0, calcium_mg = 34, iron_mg = 0.2, zinc_mg = 0.26, vitamin_a_mcg = 2, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":131,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":131,"category":"FISH","name":"Cá basa, phi lê","ediblePercent":100,"energyKcal100g":67,"proteinG":9.7,"fatG":0.8,"carbG":5.32,"fiberG":0,"calciumMg":34,"ironMg":0.2,"zincMg":0.26,"vitaminAMcg":2}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Cá basa, phi lê') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Trứng gà ta', (SELECT id FROM food_categories WHERE name = 'Trứng và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Trứng gà ta'));

UPDATE food_ingredients SET name = 'Trứng gà ta', category_id = (SELECT id FROM food_categories WHERE name = 'Trứng và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 150, protein_g = 12.96, fat_g = 10.33, carb_g = 1.25, fiber_g = 0, calcium_mg = 55, iron_mg = 2.7, zinc_mg = 0.9, vitamin_a_mcg = 166, refuse_rate_percent = 14, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":132,"basisGrams":100,"ediblePercent":86,"missingNutrients":[],"values":{"sourceRow":132,"category":"EGG","name":"Trứng gà ta","ediblePercent":86,"energyKcal100g":150,"proteinG":12.96,"fatG":10.33,"carbG":1.25,"fiberG":0,"calciumMg":55,"ironMg":2.7,"zincMg":0.9,"vitaminAMcg":166}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Trứng gà ta') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Trứng vịt', (SELECT id FROM food_categories WHERE name = 'Trứng và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Trứng vịt'));

UPDATE food_ingredients SET name = 'Trứng vịt', category_id = (SELECT id FROM food_categories WHERE name = 'Trứng và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 172, protein_g = 13.02, fat_g = 12.02, carb_g = 2.94, fiber_g = 0, calcium_mg = 71, iron_mg = 3.2, zinc_mg = 0.8, vitamin_a_mcg = 232, refuse_rate_percent = 12, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":133,"basisGrams":100,"ediblePercent":88,"missingNutrients":[],"values":{"sourceRow":133,"category":"EGG","name":"Trứng vịt","ediblePercent":88,"energyKcal100g":172,"proteinG":13.02,"fatG":12.02,"carbG":2.94,"fiberG":0,"calciumMg":71,"ironMg":3.2,"zincMg":0.8,"vitaminAMcg":232}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Trứng vịt') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Trứng chim cút', (SELECT id FROM food_categories WHERE name = 'Trứng và sản phẩm chế biến' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Trứng chim cút'));

UPDATE food_ingredients SET name = 'Trứng chim cút', category_id = (SELECT id FROM food_categories WHERE name = 'Trứng và sản phẩm chế biến' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 157, protein_g = 12.78, fat_g = 10.47, carb_g = 2.89, fiber_g = 0, calcium_mg = 60, iron_mg = 3.65, zinc_mg = 1.47, vitamin_a_mcg = 301, refuse_rate_percent = 11, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":134,"basisGrams":100,"ediblePercent":89,"missingNutrients":[],"values":{"sourceRow":134,"category":"EGG","name":"Trứng chim cút","ediblePercent":89,"energyKcal100g":157,"proteinG":12.78,"fatG":10.47,"carbG":2.89,"fiberG":0,"calciumMg":60,"ironMg":3.65,"zincMg":1.47,"vitaminAMcg":301}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Trứng chim cút') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Sữa bò tươi', (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa bò tươi'));

UPDATE food_ingredients SET name = 'Sữa bò tươi', category_id = (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 74, protein_g = 3.9, fat_g = 4.4, carb_g = 4.8, fiber_g = 0, calcium_mg = 120, iron_mg = 0.1, zinc_mg = 0.4, vitamin_a_mcg = 52, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":135,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":135,"category":"MILK","name":"Sữa bò tươi","ediblePercent":100,"energyKcal100g":74,"proteinG":3.9,"fatG":4.4,"carbG":4.8,"fiberG":0,"calciumMg":120,"ironMg":0.1,"zincMg":0.4,"vitaminAMcg":52}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa bò tươi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Sữa dê tươi', (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa dê tươi'));

UPDATE food_ingredients SET name = 'Sữa dê tươi', category_id = (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 69, protein_g = 3.5, fat_g = 4.1, carb_g = 4.5, fiber_g = 0, calcium_mg = 147, iron_mg = 0.1, zinc_mg = 0.3, vitamin_a_mcg = 52, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":136,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":136,"category":"MILK","name":"Sữa dê tươi","ediblePercent":100,"energyKcal100g":69,"proteinG":3.5,"fatG":4.1,"carbG":4.5,"fiberG":0,"calciumMg":147,"ironMg":0.1,"zincMg":0.3,"vitaminAMcg":52}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa dê tươi') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Sữa chua', (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa chua'));

UPDATE food_ingredients SET name = 'Sữa chua', category_id = (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 61, protein_g = 3.3, fat_g = 3.7, carb_g = 3.6, fiber_g = 0, calcium_mg = 120, iron_mg = 0.1, zinc_mg = 0.59, vitamin_a_mcg = 26, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":137,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":137,"category":"MILK","name":"Sữa chua","ediblePercent":100,"energyKcal100g":61,"proteinG":3.3,"fatG":3.7,"carbG":3.6,"fiberG":0,"calciumMg":120,"ironMg":0.1,"zincMg":0.59,"vitaminAMcg":26}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa chua') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Sữa bột toàn phần', (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa bột toàn phần'));

UPDATE food_ingredients SET name = 'Sữa bột toàn phần', category_id = (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 494, protein_g = 27, fat_g = 26, carb_g = 38, fiber_g = 0, calcium_mg = 939, iron_mg = 1.1, zinc_mg = 3.34, vitamin_a_mcg = 322, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":138,"basisGrams":100,"ediblePercent":100,"missingNutrients":[],"values":{"sourceRow":138,"category":"MILK","name":"Sữa bột toàn phần","ediblePercent":100,"energyKcal100g":494,"proteinG":27,"fatG":26,"carbG":38,"fiberG":0,"calciumMg":939,"ironMg":1.1,"zincMg":3.34,"vitaminAMcg":322}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa bột toàn phần') ORDER BY id LIMIT 1);

INSERT INTO food_ingredients(name, category_id) SELECT 'Sữa đặc có đường Việt Nam', (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1) WHERE NOT EXISTS (SELECT 1 FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa đặc có đường Việt Nam'));

UPDATE food_ingredients SET name = 'Sữa đặc có đường Việt Nam', category_id = (SELECT id FROM food_categories WHERE name = 'Sữa và chế phẩm sữa' ORDER BY id LIMIT 1), unit = 'g', status = 'ACTIVE', energy_kcal_100g = 336, protein_g = 8.1, fat_g = 8.8, carb_g = 56, fiber_g = 0, calcium_mg = 307, iron_mg = 0.6, zinc_mg = 0, vitamin_a_mcg = 62, refuse_rate_percent = 0, source_metadata = '{"kind":"FOOD_COMPOSITION_IMAGE","source":"Quyết định số 3958/QĐ-BYT ngày 25/12/2025 của Bộ Y tế — Phụ lục 7: Thành phần dinh dưỡng của một số thực phẩm thông dụng (trong 100g thực phẩm ăn được), trang 11–14 (docs/ban_du_thao.pdf).","sourceRow":139,"basisGrams":100,"ediblePercent":100,"missingNutrients":["zincMg"],"values":{"sourceRow":139,"category":"MILK","name":"Sữa đặc có đường Việt Nam","ediblePercent":100,"energyKcal100g":336,"proteinG":8.1,"fatG":8.8,"carbG":56,"fiberG":0,"calciumMg":307,"ironMg":0.6,"zincMg":null,"vitaminAMcg":62}}'::jsonb WHERE id = (SELECT id FROM food_ingredients WHERE pg_temp.catalog_key(name) = pg_temp.catalog_key('Sữa đặc có đường Việt Nam') ORDER BY id LIMIT 1);

INSERT INTO dish_categories(code, name) VALUES ('MAIN', 'Món chính') ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO dish_categories(code, name) VALUES ('SOUP', 'Canh / Súp') ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO dish_categories(code, name) VALUES ('RICE', 'Cơm') ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO dish_categories(code, name) VALUES ('DESSERT', 'Tráng miệng') ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO dish_categories(code, name) VALUES ('SNACK_MORNING', 'Phụ sáng') ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO dish_categories(code, name) VALUES ('SNACK_AFTERNOON', 'Xế + Phụ chiều') ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO dish_categories(code, name) VALUES ('DRINK', 'Thức uống / Sữa chua') ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name;

CREATE TEMP TABLE source_dish_ids(id BIGINT PRIMARY KEY) ON COMMIT DROP;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sữa dinh dưỡng', (SELECT id FROM dish_categories WHERE code = 'SNACK_MORNING'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa dinh dưỡng');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa dinh dưỡng' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sữa dinh dưỡng', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_MORNING'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sữa dinh dưỡng","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-08","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-09","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-10","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-11","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-12","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-15","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-16","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-17","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-18","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-19","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-22","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-23","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-24","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-25","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-26","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-29","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-30","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-01","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-02","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-03","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-06","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-07","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-08","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-09","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-10","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-13","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-14","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-15","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-16","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-17","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-20","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-21","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-22","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-23","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-24","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-27","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-28","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-29","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-30","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-31","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-03","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-04","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-05","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-06","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-07","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-10","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-11","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-12","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-13","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-14","mealType":"MORNING_SNACK","rawName":"Sữa dinh dưỡng"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cơm', (SELECT id FROM dish_categories WHERE code = 'RICE'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cơm', category_id = (SELECT id FROM dish_categories WHERE code = 'RICE'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cơm","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-08","mealType":"LUNCH","rawName":"- Cơm-"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-09","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-10","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-11","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-12","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-15","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-16","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-17","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-18","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-19","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-22","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-23","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-24","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-25","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-29","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-30","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-01","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-02","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-03","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-06","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-07","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-08","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-09","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-10","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-13","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-14","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-15","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-16","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-17","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-20","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-21","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-22","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-23","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-27","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-28","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-29","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-30","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-31","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-03","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-04","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-05","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-06","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-10","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-11","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-12","mealType":"LUNCH","rawName":"- Cơm"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-13","mealType":"LUNCH","rawName":"- Cơm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cá lóc muối chiên', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cá lóc muối chiên');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cá lóc muối chiên' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cá lóc muối chiên', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cá lóc muối chiên","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-08","mealType":"LUNCH","rawName":"Cá lóc muối chiên"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-25","mealType":"LUNCH","rawName":"Cá lóc muối chiên"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-14","mealType":"LUNCH","rawName":"Cá lóc muối chiên"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-06","mealType":"LUNCH","rawName":"Cá lóc muối chiên"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh tôm thẻ nấu khoai ngọt, khoai cau', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh tôm thẻ nấu khoai ngọt khoai cau');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh tôm thẻ nấu khoai ngọt khoai cau' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh tôm thẻ nấu khoai ngọt, khoai cau', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh tôm thẻ nấu khoai ngọt khoai cau","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-08","mealType":"LUNCH","rawName":"Canh tôm thẻ nấu khoai ngọt, khoai cau."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nho', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nho');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nho' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nho', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nho","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-08","mealType":"LUNCH","rawName":"Nho"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-24","mealType":"LUNCH","rawName":"Nho"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-13","mealType":"LUNCH","rawName":"Nho"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-30","mealType":"LUNCH","rawName":"Nho"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-12","mealType":"LUNCH","rawName":"Nho"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt gà rô ti', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà rô ti');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà rô ti' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt gà rô ti', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt gà rô ti","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-09","mealType":"LUNCH","rawName":"Thịt gà rôti"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-15","mealType":"LUNCH","rawName":"Thịt gà rô ti"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-10","mealType":"LUNCH","rawName":"Thịt gà rô ti"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cá lóc cải ngọt non', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc cải ngọt non');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc cải ngọt non' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cá lóc cải ngọt non', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cá lóc cải ngọt non","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-09","mealType":"LUNCH","rawName":"Canh cá lóc cải ngọt non."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh su kem', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh su kem');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh su kem' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh su kem', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh su kem","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-09","mealType":"LUNCH","rawName":"Bánh su kem"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-07","mealType":"LUNCH","rawName":"Bánh su kem"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-20","mealType":"LUNCH","rawName":"Bánh su kem"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-13","mealType":"LUNCH","rawName":"Bánh su kem"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cá lóc kho', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cá lóc kho');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cá lóc kho' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cá lóc kho', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cá lóc kho","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-10","mealType":"LUNCH","rawName":"Cá lóc kho"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt sườn hầm bắp bàu', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt sườn hầm bắp bàu');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt sườn hầm bắp bàu' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt sườn hầm bắp bàu', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt sườn hầm bắp bàu","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-10","mealType":"LUNCH","rawName":"Canh thịt sườn hầm bắp bàu"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Lê đường', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'lê đường');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'lê đường' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Lê đường', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"lê đường","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-10","mealType":"LUNCH","rawName":"Lê đường"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-22","mealType":"LUNCH","rawName":"Lê đường"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-08","mealType":"LUNCH","rawName":"Lê đường"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-29","mealType":"LUNCH","rawName":"Lê đường"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt bò kho mặn tràng bắp, cà rốt', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò kho mặn tràng bắp cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò kho mặn tràng bắp cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt bò kho mặn tràng bắp, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt bò kho mặn tràng bắp cà rốt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-11","mealType":"LUNCH","rawName":"Thịt bò kho mặn tràng bắp, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh bầu, cá lóc', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bầu cá lóc');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bầu cá lóc' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh bầu, cá lóc', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh bầu cá lóc","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-11","mealType":"LUNCH","rawName":"Canh bầu, cá lóc"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Rau câu dừa', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'rau câu dừa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'rau câu dừa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Rau câu dừa', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"rau câu dừa","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-11","mealType":"LUNCH","rawName":"Rau câu dừa"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-09","mealType":"LUNCH","rawName":"Rau câu dừa"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-06","mealType":"LUNCH","rawName":"Rau câu dừa"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt gà chiên nước mắm', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà chiên nước mắm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà chiên nước mắm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt gà chiên nước mắm', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt gà chiên nước mắm","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-12","mealType":"LUNCH","rawName":"Gà chiên nước mắm"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-01","mealType":"LUNCH","rawName":"Thịt gà chiên nước mắm"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-30","mealType":"LUNCH","rawName":"Thị gà chiên nước mắm."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cải bó xôi nấu thịt bò', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cải bó xôi nấu thịt bò');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cải bó xôi nấu thịt bò' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cải bó xôi nấu thịt bò', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cải bó xôi nấu thịt bò","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-12","mealType":"LUNCH","rawName":"Canh cải bó xôi nấu thịt bò."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thanh Long', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thanh long');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thanh long' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thanh Long', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thanh long","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-12","mealType":"LUNCH","rawName":"Thanh Long"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-26","mealType":"LUNCH","rawName":"Thanh long"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-17","mealType":"LUNCH","rawName":"Thanh long"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-31","mealType":"LUNCH","rawName":"Thanh long"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-11","mealType":"LUNCH","rawName":"Thanh long trắng"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước đậu rang', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước đậu rang');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước đậu rang' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước đậu rang', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước đậu rang","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-08","mealType":"AFTERNOON_SNACK","rawName":"- Nước đậu rang"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bún suông thịt heo, trứng cút, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bún suông thịt heo trứng cút cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bún suông thịt heo trứng cút cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bún suông thịt heo, trứng cút, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bún suông thịt heo trứng cút cà rốt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-08","mealType":"AFTERNOON_SNACK","rawName":"Bún suông thịt heo, trứng cút, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước cam', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước cam');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước cam' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước cam', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước cam","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-09","mealType":"AFTERNOON_SNACK","rawName":"- Nước cam"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-23","mealType":"AFTERNOON_SNACK","rawName":"- Nước cam"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-06","mealType":"AFTERNOON_SNACK","rawName":"Nước cam"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-20","mealType":"AFTERNOON_SNACK","rawName":"- Nước cam"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo bò bí hồ lô', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo bò bí hồ lô');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo bò bí hồ lô' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo bò bí hồ lô', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo bò bí hồ lô","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-09","mealType":"AFTERNOON_SNACK","rawName":"Cháo bò bí hồ lô"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Yaourt', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'yaourt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'yaourt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Yaourt', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"yaourt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-10","mealType":"AFTERNOON_SNACK","rawName":"-  Yaourt"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-16","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt"},{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-18","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-24","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-30","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-02","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt."},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-07","mealType":"AFTERNOON_SNACK","rawName":"Yaourt"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-09","mealType":"AFTERNOON_SNACK","rawName":"Yaourt"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-16","mealType":"AFTERNOON_SNACK","rawName":"Yaourt."},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-21","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-23","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-29","mealType":"AFTERNOON_SNACK","rawName":"- Yaourt"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-03","mealType":"AFTERNOON_SNACK","rawName":"Yaourt"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-06","mealType":"AFTERNOON_SNACK","rawName":"Yaourt"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-12","mealType":"AFTERNOON_SNACK","rawName":"Yaourt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Hủ tiếu nam vang (mực, tim, gan, tôm)- cần tây', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu nam vang (mực tim gan tôm)- cần tây');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu nam vang (mực tim gan tôm)- cần tây' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Hủ tiếu nam vang (mực, tim, gan, tôm)- cần tây', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"hủ tiếu nam vang (mực tim gan tôm)- cần tây","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-10","mealType":"AFTERNOON_SNACK","rawName":"Hủ tiếu nam vang (mực, tim, gan, tôm)- cần tây"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nha đam, hạt chia, đường phèn', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nha đam hạt chia đường phèn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nha đam hạt chia đường phèn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nha đam, hạt chia, đường phèn', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nha đam hạt chia đường phèn","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-11","mealType":"AFTERNOON_SNACK","rawName":"- Nha đam, hạt chia, đường phèn"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-22","mealType":"AFTERNOON_SNACK","rawName":"- Nước nha đam, hạt chia, đường phèn."},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-22","mealType":"AFTERNOON_SNACK","rawName":"- Nha đam hạt chia, đường phèn"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-11","mealType":"AFTERNOON_SNACK","rawName":"Nha đam, hạt chia, đường phèn."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Súp óc heo, gà xé, trứng cút, cải đỏ', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'súp óc heo gà xé trứng cút cải đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'súp óc heo gà xé trứng cút cải đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Súp óc heo, gà xé, trứng cút, cải đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"súp óc heo gà xé trứng cút cải đỏ","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-11","mealType":"AFTERNOON_SNACK","rawName":"Súp óc heo, gà xé, trứng cút, cải đỏ"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sữa đậu nành', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa đậu nành');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa đậu nành' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sữa đậu nành', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sữa đậu nành","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-12","mealType":"AFTERNOON_SNACK","rawName":"- Sữa đậu nành"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-10","mealType":"AFTERNOON_SNACK","rawName":"Sữa đậu nành"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-27","mealType":"AFTERNOON_SNACK","rawName":"- Sữa đậu nành"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh bao thịt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bao thịt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bao thịt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh bao thịt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh bao thịt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":1,"date":"2025-09-12","mealType":"AFTERNOON_SNACK","rawName":"Bánh bao thịt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt heo ram mặn cà rốt', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt heo ram mặn cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt heo ram mặn cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt heo ram mặn cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt heo ram mặn cà rốt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-15","mealType":"LUNCH","rawName":"Thịt heo ram mặn cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh chua cá hú, khóm, đậu bắp, cà chua, bạc hà', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú khóm đậu bắp cà chua bạc hà');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú khóm đậu bắp cà chua bạc hà' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh chua cá hú, khóm, đậu bắp, cà chua, bạc hà', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh chua cá hú khóm đậu bắp cà chua bạc hà","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-15","mealType":"LUNCH","rawName":"Canh chua cá hú, khóm, đậu bắp, cà chua, bạc hà."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Táo tây', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'táo tây');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'táo tây' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Táo tây', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"táo tây","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-15","mealType":"LUNCH","rawName":"Táo tây"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cá Ngừ chiên sốt cà chua', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cá ngừ chiên sốt cà chua');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cá ngừ chiên sốt cà chua' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cá Ngừ chiên sốt cà chua', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cá ngừ chiên sốt cà chua","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-16","mealType":"LUNCH","rawName":"Cá Ngừ chiên sốt cà chua"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-22","mealType":"LUNCH","rawName":"Cá ngừ chiên sốt cà chua."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh gà hầm bách vị (hạt sen, cà rốt, nấm hương, sup lơ)', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà hầm bách vị (hạt sen cà rốt nấm hương sup lơ)');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà hầm bách vị (hạt sen cà rốt nấm hương sup lơ)' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh gà hầm bách vị (hạt sen, cà rốt, nấm hương, sup lơ)', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh gà hầm bách vị (hạt sen cà rốt nấm hương sup lơ)","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-16","mealType":"LUNCH","rawName":"Canh gà hầm bách vị (hạt sen, cà rốt, nấm hương, sup lơ)"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Đu đủ chín', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'đu đủ chín');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'đu đủ chín' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Đu đủ chín', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"đu đủ chín","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-16","mealType":"LUNCH","rawName":"Đu đủ"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-24","mealType":"LUNCH","rawName":"Đu đủ"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-05","mealType":"LUNCH","rawName":"Đu đủ chín"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt heo, tôm rim nước dừa', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt heo tôm rim nước dừa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt heo tôm rim nước dừa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt heo, tôm rim nước dừa', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt heo tôm rim nước dừa","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-17","mealType":"LUNCH","rawName":"Thịt heo, tôm rim nước dừa"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bò, cải bó xôi', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò cải bó xôi');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò cải bó xôi' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bò, cải bó xôi', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bò cải bó xôi","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-17","mealType":"LUNCH","rawName":"Canh thịt bò, cải bó xôi"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh Flan', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh flan');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh flan' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh Flan', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh flan","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-17","mealType":"LUNCH","rawName":"Bánh Flan"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-14","mealType":"LUNCH","rawName":"Bánh Flan"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-04","mealType":"LUNCH","rawName":"Bánh Flan"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt gà xào mặn, sả, đậu phọng', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà xào mặn sả đậu phọng');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà xào mặn sả đậu phọng' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt gà xào mặn, sả, đậu phọng', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt gà xào mặn sả đậu phọng","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-18","mealType":"LUNCH","rawName":"Thịt gà xào mặn, sả, đậu phọng."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt heo nấm rơm, mướp, tôm khô', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt heo nấm rơm mướp tôm khô');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt heo nấm rơm mướp tôm khô' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt heo nấm rơm, mướp, tôm khô', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt heo nấm rơm mướp tôm khô","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-18","mealType":"LUNCH","rawName":"Canh thịt heo nấm rơm, mướp, tôm khô"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Dưa hấu', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa hấu');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa hấu' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Dưa hấu', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"dưa hấu","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-18","mealType":"LUNCH","rawName":"Dưa hấu"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-10","mealType":"LUNCH","rawName":"Dưa hấu."},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-23","mealType":"LUNCH","rawName":"Dưa hấu."},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-07","mealType":"LUNCH","rawName":"Dưa hấu"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Trứng vịt chiên thịt, cà chua', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'trứng vịt chiên thịt cà chua');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'trứng vịt chiên thịt cà chua' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Trứng vịt chiên thịt, cà chua', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"trứng vịt chiên thịt cà chua","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-19","mealType":"LUNCH","rawName":"Trứng vịt chiên thịt, cà chua"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-10","mealType":"LUNCH","rawName":"Trứng vịt chiên thịt, cà chua"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh rau ngót cá lóc, tôm khô', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh rau ngót cá lóc tôm khô');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh rau ngót cá lóc tôm khô' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh rau ngót cá lóc, tôm khô', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh rau ngót cá lóc tôm khô","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-19","mealType":"LUNCH","rawName":"Canh rau ngót cá lóc, tôm khô"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Quýt', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'quýt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'quýt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Quýt', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"quýt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-19","mealType":"LUNCH","rawName":"Quýt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Chanh dây, hạt chia, đường phèn', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'chanh dây hạt chia đường phèn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'chanh dây hạt chia đường phèn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Chanh dây, hạt chia, đường phèn', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"chanh dây hạt chia đường phèn","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-15","mealType":"AFTERNOON_SNACK","rawName":"- Chanh dây, hạt chia, đường phèn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Miến gà, tôm khô, cần tàu', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'miến gà tôm khô cần tàu');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'miến gà tôm khô cần tàu' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Miến gà, tôm khô, cần tàu', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"miến gà tôm khô cần tàu","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-15","mealType":"AFTERNOON_SNACK","rawName":"Miến gà, tôm khô, cần tàu"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nui thịt bằm, tôm, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nui thịt bằm tôm cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nui thịt bằm tôm cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nui thịt bằm, tôm, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nui thịt bằm tôm cà rốt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-16","mealType":"AFTERNOON_SNACK","rawName":"Nui thịt bằm, tôm, cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sâm bí đao', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sâm bí đao');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sâm bí đao' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sâm bí đao', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sâm bí đao","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-17","mealType":"AFTERNOON_SNACK","rawName":"- Sâm bí đao"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh canh bột xắt tôm khô, cá lóc', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh canh bột xắt tôm khô cá lóc');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh canh bột xắt tôm khô cá lóc' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh canh bột xắt tôm khô, cá lóc', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh canh bột xắt tôm khô cá lóc","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-17","mealType":"AFTERNOON_SNACK","rawName":"Bánh canh bột xắt tôm khô, cá lóc."},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-16","mealType":"AFTERNOON_SNACK","rawName":"Bánh canh bột xắt, cá lóc, tôm khô."},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-30","mealType":"AFTERNOON_SNACK","rawName":"Bánh canh bột xắt cá lóc, tôm khô"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Phở bò, ngò gai, quế', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'phở bò ngò gai quế');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'phở bò ngò gai quế' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Phở bò, ngò gai, quế', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"phở bò ngò gai quế","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-18","mealType":"AFTERNOON_SNACK","rawName":"Phở bò, ngò gai, quế"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-10","mealType":"AFTERNOON_SNACK","rawName":"Phở bò ngò gai, quế"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sữa trái cây', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa trái cây');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa trái cây' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sữa trái cây', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sữa trái cây","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-19","mealType":"AFTERNOON_SNACK","rawName":"- Sữa trái cây"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-03","mealType":"AFTERNOON_SNACK","rawName":"- Sữa trái cây"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-17","mealType":"AFTERNOON_SNACK","rawName":"Sữa trái cây"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-24","mealType":"AFTERNOON_SNACK","rawName":"- Sữa trái cây"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-14","mealType":"AFTERNOON_SNACK","rawName":"Sữa trái cây."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh pateso thịt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh pateso thịt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh pateso thịt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh pateso thịt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh pateso thịt","sources":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sourceSha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63","weekNumber":2,"date":"2025-09-19","mealType":"AFTERNOON_SNACK","rawName":"Bánh pateso thịt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt sườn heo khìa nước dừa', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt sườn heo khìa nước dừa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt sườn heo khìa nước dừa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt sườn heo khìa nước dừa', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt sườn heo khìa nước dừa","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-22","mealType":"LUNCH","rawName":"Thịt sườn heo khìa nước dừa"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh bí đao cá lóc, tôm khô', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bí đao cá lóc tôm khô');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bí đao cá lóc tôm khô' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh bí đao cá lóc, tôm khô', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh bí đao cá lóc tôm khô","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-22","mealType":"LUNCH","rawName":"Canh bí đao cá lóc, tôm khô."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt bò xào đậu que', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào đậu que');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào đậu que' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt bò xào đậu que', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt bò xào đậu que","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-23","mealType":"LUNCH","rawName":"Thịt bò xào đậu que"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh chua cá hú, cà chua, đậu bắp, khóm', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú cà chua đậu bắp khóm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú cà chua đậu bắp khóm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh chua cá hú, cà chua, đậu bắp, khóm', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh chua cá hú cà chua đậu bắp khóm","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-23","mealType":"LUNCH","rawName":"Canh chua cá hú, cà chua, đậu bắp, khóm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Dưa hoàng kim', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa hoàng kim');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa hoàng kim' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Dưa hoàng kim', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"dưa hoàng kim","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-23","mealType":"LUNCH","rawName":"Dưa hoàng kim"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt kho trứng cút', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt kho trứng cút');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt kho trứng cút' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt kho trứng cút', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt kho trứng cút","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-24","mealType":"LUNCH","rawName":"Thịt kho trứng cút"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-06","mealType":"LUNCH","rawName":"Thịt kho trứng cút"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-28","mealType":"LUNCH","rawName":"Thịt kho trứng cút"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-12","mealType":"LUNCH","rawName":"Thịt kho trứng cút"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bò hầm đậu đỏ', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò hầm đậu đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò hầm đậu đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bò hầm đậu đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bò hầm đậu đỏ","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-24","mealType":"LUNCH","rawName":"Canh thịt bò hầm đậu đỏ"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm rau dền, muồng tơi', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm rau dền muồng tơi');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm rau dền muồng tơi' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm rau dền, muồng tơi', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm rau dền muồng tơi","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-25","mealType":"LUNCH","rawName":"Canh thịt bằm rau dền, muồng tơi."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Rau câu giòn sơn thủy', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'rau câu giòn sơn thủy');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'rau câu giòn sơn thủy' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Rau câu giòn sơn thủy', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"rau câu giòn sơn thủy","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-25","mealType":"LUNCH","rawName":"Rau câu giòn sơn thủy"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cơm Dương Châu (đậu đũa, cà rốt, lạp xưởng, thịt nạc, trứng)', (SELECT id FROM dish_categories WHERE code = 'RICE'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm dương châu (đậu đũa cà rốt lạp xưởng thịt nạc trứng)');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm dương châu (đậu đũa cà rốt lạp xưởng thịt nạc trứng)' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cơm Dương Châu (đậu đũa, cà rốt, lạp xưởng, thịt nạc, trứng)', category_id = (SELECT id FROM dish_categories WHERE code = 'RICE'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cơm dương châu (đậu đũa cà rốt lạp xưởng thịt nạc trứng)","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-26","mealType":"LUNCH","rawName":"- Cơm Dương Châu\n(đậu đũa, cà rốt, lạp xưởng, thịt nạc, trứng)"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh gà nấu nấm linh chi, cà rốt, táo đỏ', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà nấu nấm linh chi cà rốt táo đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà nấu nấm linh chi cà rốt táo đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh gà nấu nấm linh chi, cà rốt, táo đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh gà nấu nấm linh chi cà rốt táo đỏ","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-26","mealType":"LUNCH","rawName":"Canh gà nấu nấm linh chi, cà rốt, táo đỏ"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Mì gà tiềm, hạt sen', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'mì gà tiềm hạt sen');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'mì gà tiềm hạt sen' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Mì gà tiềm, hạt sen', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"mì gà tiềm hạt sen","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-22","mealType":"AFTERNOON_SNACK","rawName":"Mì gà tiềm, hạt sen."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo thịt bằm, cải bó xôi, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt bằm cải bó xôi cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt bằm cải bó xôi cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo thịt bằm, cải bó xôi, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo thịt bằm cải bó xôi cà rốt","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-23","mealType":"AFTERNOON_SNACK","rawName":"Cháo thịt bằm, cải bó xôi, cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh canh cá lóc, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh canh cá lóc cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh canh cá lóc cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh canh cá lóc, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh canh cá lóc cà rốt","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-24","mealType":"AFTERNOON_SNACK","rawName":"Bánh canh cá lóc, cà rốt"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-06","mealType":"AFTERNOON_SNACK","rawName":"Bánh canh cá lóc, cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Trà đào, hạt chia, đường phèn', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'trà đào hạt chia đường phèn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'trà đào hạt chia đường phèn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Trà đào, hạt chia, đường phèn', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"trà đào hạt chia đường phèn","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-25","mealType":"AFTERNOON_SNACK","rawName":"- Trà đào, hạt chia, đường phèn."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Hủ tiếu (gà, tôm, mực) cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu (gà tôm mực) cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu (gà tôm mực) cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Hủ tiếu (gà, tôm, mực) cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"hủ tiếu (gà tôm mực) cà rốt","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-25","mealType":"AFTERNOON_SNACK","rawName":"Hủ tiếu (gà, tôm, mực) cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sữa đậu xanh', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa đậu xanh');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sữa đậu xanh' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sữa đậu xanh', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sữa đậu xanh","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-26","mealType":"AFTERNOON_SNACK","rawName":"- Sữa đậu xanh"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-14","mealType":"AFTERNOON_SNACK","rawName":"Sữa đậu xanh"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-05","mealType":"AFTERNOON_SNACK","rawName":"Sữa đậu xanh"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh mêxico mặn', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh mêxico mặn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh mêxico mặn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh mêxico mặn', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh mêxico mặn","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":3,"date":"2025-09-26","mealType":"AFTERNOON_SNACK","rawName":"Bánh mêxico mặn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt ram mặn', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt ram mặn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt ram mặn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt ram mặn', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt ram mặn","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-29","mealType":"LUNCH","rawName":"Thịt ram mặn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cá lóc nấu bầu', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc nấu bầu');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc nấu bầu' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cá lóc nấu bầu', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cá lóc nấu bầu","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-29","mealType":"LUNCH","rawName":"Canh cá lóc nấu bầu"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Hồng trứng', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'hồng trứng');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'hồng trứng' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Hồng trứng', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"hồng trứng","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-29","mealType":"LUNCH","rawName":"Hồng trứng"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Trứng chưng thịt, bún tàu, nấm mèo, cải đỏ', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'trứng chưng thịt bún tàu nấm mèo cải đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'trứng chưng thịt bún tàu nấm mèo cải đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Trứng chưng thịt, bún tàu, nấm mèo, cải đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"trứng chưng thịt bún tàu nấm mèo cải đỏ","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-30","mealType":"LUNCH","rawName":"Trứng chưng thịt, bún tàu, nấm mèo, cải đỏ."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh gà nấu ngũ vị (cà rốt, nấm, bông cải…)', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà nấu ngũ vị (cà rốt nấm bông cải…)');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà nấu ngũ vị (cà rốt nấm bông cải…)' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh gà nấu ngũ vị (cà rốt, nấm, bông cải…)', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh gà nấu ngũ vị (cà rốt nấm bông cải…)","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-30","mealType":"LUNCH","rawName":"Canh gà nấu ngũ vị (cà rốt, nấm, bông cải…)"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Táo', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'táo');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'táo' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Táo', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"táo","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-30","mealType":"LUNCH","rawName":"Táo"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-14","mealType":"LUNCH","rawName":"Táo"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt rau cải cúc', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt rau cải cúc');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt rau cải cúc' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt rau cải cúc', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt rau cải cúc","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-01","mealType":"LUNCH","rawName":"Canh thịt rau cải cúc."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh gang', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh gang');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh gang' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh gang', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh gang","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-01","mealType":"LUNCH","rawName":"Bánh gang"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-28","mealType":"LUNCH","rawName":"Bánh gang"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cá điêu hồng chiên sốt cà chua', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cá điêu hồng chiên sốt cà chua');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cá điêu hồng chiên sốt cà chua' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cá điêu hồng chiên sốt cà chua', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cá điêu hồng chiên sốt cà chua","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-02","mealType":"LUNCH","rawName":"Cá điêu hồng chiên sốt cà chua"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bò hầm khoai môn, ngò gai', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò hầm khoai môn ngò gai');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò hầm khoai môn ngò gai' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bò hầm khoai môn, ngò gai', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bò hầm khoai môn ngò gai","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-02","mealType":"LUNCH","rawName":"Canh thịt bò hầm khoai môn, ngò gai."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Dưa lê', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa lê');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa lê' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Dưa lê', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"dưa lê","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-02","mealType":"LUNCH","rawName":"Dưa lê"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt trứng chiên', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt trứng chiên');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt trứng chiên' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt trứng chiên', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt trứng chiên","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-03","mealType":"LUNCH","rawName":"Thịt trứng chiên"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm, bắp bàu, muồng tơi', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm bắp bàu muồng tơi');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm bắp bàu muồng tơi' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm, bắp bàu, muồng tơi', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm bắp bàu muồng tơi","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-03","mealType":"LUNCH","rawName":"Canh thịt bằm, bắp bàu, muồng tơi."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Quýt đường', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'quýt đường');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'quýt đường' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Quýt đường', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"quýt đường","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-03","mealType":"LUNCH","rawName":"Quýt đường"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước Sâm rong biển, hoa cúc', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước sâm rong biển hoa cúc');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước sâm rong biển hoa cúc' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước Sâm rong biển, hoa cúc', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước sâm rong biển hoa cúc","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-29","mealType":"AFTERNOON_SNACK","rawName":"- Nước Sâm rong biển, hoa cúc."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bún bò huế, ngò gai, quế', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bún bò huế ngò gai quế');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bún bò huế ngò gai quế' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bún bò huế, ngò gai, quế', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bún bò huế ngò gai quế","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-29","mealType":"AFTERNOON_SNACK","rawName":"Bún bò huế, ngò gai, quế"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-27","mealType":"AFTERNOON_SNACK","rawName":"Bún bò huế, ngò gai, quế."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nui nấu gan, tôm, mực cải đỏ', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nui nấu gan tôm mực cải đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nui nấu gan tôm mực cải đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nui nấu gan, tôm, mực cải đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nui nấu gan tôm mực cải đỏ","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-09-30","mealType":"AFTERNOON_SNACK","rawName":"Nui nấu gan, tôm, mực cải đỏ."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước trà sả tắc, hạt chia, mật ong', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước trà sả tắc hạt chia mật ong');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước trà sả tắc hạt chia mật ong' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước trà sả tắc, hạt chia, mật ong', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước trà sả tắc hạt chia mật ong","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-01","mealType":"AFTERNOON_SNACK","rawName":"- Nước trà sả tắc, hạt chia, mật ong"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bún cá lóc, rau muống non', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bún cá lóc rau muống non');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bún cá lóc rau muống non' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bún cá lóc, rau muống non', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bún cá lóc rau muống non","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-01","mealType":"AFTERNOON_SNACK","rawName":"Bún cá lóc, rau muống non"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Súp trứng cút, gà xé, tôm, cải đỏ', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'súp trứng cút gà xé tôm cải đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'súp trứng cút gà xé tôm cải đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Súp trứng cút, gà xé, tôm, cải đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"súp trứng cút gà xé tôm cải đỏ","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-02","mealType":"AFTERNOON_SNACK","rawName":"Súp trứng cút, gà xé, tôm, cải đỏ."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh bông lan thịt chà bông', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bông lan thịt chà bông');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bông lan thịt chà bông' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh bông lan thịt chà bông', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh bông lan thịt chà bông","sources":[{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sourceSha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2","weekNumber":4,"date":"2025-10-03","mealType":"AFTERNOON_SNACK","rawName":"Bánh bông lan thịt chà bong"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh khoai mỡ thịt bằm, tôm khô', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh khoai mỡ thịt bằm tôm khô');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh khoai mỡ thịt bằm tôm khô' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh khoai mỡ thịt bằm, tôm khô', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh khoai mỡ thịt bằm tôm khô","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-06","mealType":"LUNCH","rawName":"Canh khoai mỡ thịt bằm, tôm khô."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Chuối cau', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'chuối cau');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'chuối cau' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Chuối cau', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"chuối cau","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-06","mealType":"LUNCH","rawName":"Chuối cau"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-27","mealType":"LUNCH","rawName":"Chuối cau"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-10","mealType":"LUNCH","rawName":"Chuối cau"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Gà muối sả chiên', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'gà muối sả chiên');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'gà muối sả chiên' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Gà muối sả chiên', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"gà muối sả chiên","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-07","mealType":"LUNCH","rawName":"Gà muối sả chiên"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh chả cá, tần ô', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chả cá tần ô');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chả cá tần ô' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh chả cá, tần ô', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh chả cá tần ô","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-07","mealType":"LUNCH","rawName":"Canh chả cá, tần ô"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt bò xào khóm', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào khóm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào khóm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt bò xào khóm', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt bò xào khóm","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-08","mealType":"LUNCH","rawName":"Thịt bò xào khóm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt gà hầm nấm các loại', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt gà hầm nấm các loại');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt gà hầm nấm các loại' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt gà hầm nấm các loại', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt gà hầm nấm các loại","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-08","mealType":"LUNCH","rawName":"Canh thịt gà hầm nấm các loại"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt heo kho', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt heo kho');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt heo kho' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt heo kho', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt heo kho","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-09","mealType":"LUNCH","rawName":"Thịt heo kho"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh chua cá hú, khóm, cà chua, đậu bắp', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú khóm cà chua đậu bắp');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú khóm cà chua đậu bắp' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh chua cá hú, khóm, cà chua, đậu bắp', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh chua cá hú khóm cà chua đậu bắp","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-09","mealType":"LUNCH","rawName":"Canh chua cá hú, khóm, cà chua, đậu bắp."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cá lóc cải xanh non', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc cải xanh non');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc cải xanh non' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cá lóc cải xanh non', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cá lóc cải xanh non","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-10","mealType":"LUNCH","rawName":"Canh cá lóc cải xanh non"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Hủ tiếu thập cẩm (thịt bằm, tôm, mực) cải cúc', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu thập cẩm (thịt bằm tôm mực) cải cúc');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu thập cẩm (thịt bằm tôm mực) cải cúc' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Hủ tiếu thập cẩm (thịt bằm, tôm, mực) cải cúc', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"hủ tiếu thập cẩm (thịt bằm tôm mực) cải cúc","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-07","mealType":"AFTERNOON_SNACK","rawName":"Hủ tiếu thập cẩm (thịt bằm, tôm, mực) cải cúc"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước chanh dây, hạt chia, mật ong', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước chanh dây hạt chia mật ong');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước chanh dây hạt chia mật ong' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước chanh dây, hạt chia, mật ong', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước chanh dây hạt chia mật ong","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-08","mealType":"AFTERNOON_SNACK","rawName":"Nước chanh dây, hạt chia, mật ong."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo cá, bí đỏ', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo cá bí đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo cá bí đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo cá, bí đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo cá bí đỏ","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-08","mealType":"AFTERNOON_SNACK","rawName":"Cháo cá, bí đỏ"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bún mọc, sườn heo tôm khô, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bún mọc sườn heo tôm khô cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bún mọc sườn heo tôm khô cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bún mọc, sườn heo tôm khô, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bún mọc sườn heo tôm khô cà rốt","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-09","mealType":"AFTERNOON_SNACK","rawName":"Bún mọc, sườn heo tôm khô, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh ngọt kẹp chà bông', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh ngọt kẹp chà bông');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh ngọt kẹp chà bông' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh ngọt kẹp chà bông', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh ngọt kẹp chà bông","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":5,"date":"2025-10-10","mealType":"AFTERNOON_SNACK","rawName":"Bánh ngọt kẹp chà bông"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-07","mealType":"AFTERNOON_SNACK","rawName":"Bánh ngọt kẹp chà bong"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Tôm, sườn heo rim mặn', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'tôm sườn heo rim mặn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'tôm sườn heo rim mặn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Tôm, sườn heo rim mặn', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"tôm sườn heo rim mặn","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-13","mealType":"LUNCH","rawName":"Tôm, sườn heo rim mặn."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm rau ngót', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm rau ngót');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm rau ngót' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm rau ngót', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm rau ngót","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-13","mealType":"LUNCH","rawName":"Canh thịt bằm rau ngót"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-06","mealType":"LUNCH","rawName":"Canh thịt bằm rau ngót"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm, tôm khô, mướp, mấm rơm', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm tôm khô mướp mấm rơm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm tôm khô mướp mấm rơm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm, tôm khô, mướp, mấm rơm', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm tôm khô mướp mấm rơm","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-14","mealType":"LUNCH","rawName":"Canh thịt bằm, tôm khô, mướp, mấm rơm."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm bắp cải, cải đỏ', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm bắp cải cải đỏ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm bắp cải cải đỏ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm bắp cải, cải đỏ', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm bắp cải cải đỏ","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-15","mealType":"LUNCH","rawName":"Canh thịt bằm bắp cải, cải đỏ."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Hồng giòn', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'hồng giòn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'hồng giòn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Hồng giòn', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"hồng giòn","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-15","mealType":"LUNCH","rawName":"Hồng giòn"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-03","mealType":"LUNCH","rawName":"Hồng giòn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cá điêu hồng chiên tươi, nước mắm chua ngọt', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cá điêu hồng chiên tươi nước mắm chua ngọt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cá điêu hồng chiên tươi nước mắm chua ngọt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cá điêu hồng chiên tươi, nước mắm chua ngọt', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cá điêu hồng chiên tươi nước mắm chua ngọt","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-16","mealType":"LUNCH","rawName":"Cá điêu hồng chiên tươi, nước mắm chua ngọt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bò hầm khoai môn', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò hầm khoai môn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bò hầm khoai môn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bò hầm khoai môn', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bò hầm khoai môn","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-16","mealType":"LUNCH","rawName":"Canh thịt bò hầm khoai môn"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-11","mealType":"LUNCH","rawName":"Canh thịt bò hầm khoai môn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Hồng xiêm', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'hồng xiêm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'hồng xiêm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Hồng xiêm', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"hồng xiêm","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-16","mealType":"LUNCH","rawName":"Hồng xiêm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sườn cốt lết khìa', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sườn cốt lết khìa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sườn cốt lết khìa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sườn cốt lết khìa', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sườn cốt lết khìa","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-17","mealType":"LUNCH","rawName":"Sườn cốt lết khìa"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh tôm thẻ, cải dún', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh tôm thẻ cải dún');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh tôm thẻ cải dún' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh tôm thẻ, cải dún', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh tôm thẻ cải dún","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-17","mealType":"LUNCH","rawName":"Canh tôm thẻ, cải dún"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sâm bí đao, hạt chia, đường phèn', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sâm bí đao hạt chia đường phèn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sâm bí đao hạt chia đường phèn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sâm bí đao, hạt chia, đường phèn', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sâm bí đao hạt chia đường phèn","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-13","mealType":"AFTERNOON_SNACK","rawName":"Sâm bí đao, hạt chia, đường phèn"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-28","mealType":"AFTERNOON_SNACK","rawName":"- Sâm bí đao, hạt chia, đường phèn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Miến gà, bó xôi', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'miến gà bó xôi');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'miến gà bó xôi' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Miến gà, bó xôi', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"miến gà bó xôi","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-13","mealType":"AFTERNOON_SNACK","rawName":"Miến gà, bó xôi"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Súp trứng cút, gà xé, tôm, bắp, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'súp trứng cút gà xé tôm bắp cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'súp trứng cút gà xé tôm bắp cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Súp trứng cút, gà xé, tôm, bắp, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"súp trứng cút gà xé tôm bắp cà rốt","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-14","mealType":"AFTERNOON_SNACK","rawName":"Súp trứng cút, gà xé, tôm, bắp, cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước đậu rang, đường phèn', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước đậu rang đường phèn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước đậu rang đường phèn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước đậu rang, đường phèn', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước đậu rang đường phèn","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-15","mealType":"AFTERNOON_SNACK","rawName":"Nước đậu rang, đường phèn."},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-07","mealType":"AFTERNOON_SNACK","rawName":"Nước đậu rang, đường phèn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo cá hồi phô mai', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo cá hồi phô mai');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo cá hồi phô mai' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo cá hồi phô mai', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo cá hồi phô mai","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-15","mealType":"AFTERNOON_SNACK","rawName":"Cháo cá hồi phô mai."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh bao xá xíu', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bao xá xíu');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bao xá xíu' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh bao xá xíu', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh bao xá xíu","sources":[{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sourceSha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4","weekNumber":6,"date":"2025-10-17","mealType":"AFTERNOON_SNACK","rawName":"Bánh bao xá xíu"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt ba rọi kho', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt ba rọi kho');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt ba rọi kho' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt ba rọi kho', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt ba rọi kho","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-20","mealType":"LUNCH","rawName":"Thịt ba rọi kho"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-03","mealType":"LUNCH","rawName":"Thịt ba rọi kho"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh chua cá lóc cà chua, khóm, đậu bắp', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá lóc cà chua khóm đậu bắp');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá lóc cà chua khóm đậu bắp' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh chua cá lóc cà chua, khóm, đậu bắp', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh chua cá lóc cà chua khóm đậu bắp","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-20","mealType":"LUNCH","rawName":"Canh chua cá lóc cà chua, khóm, đậu bắp."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt gà xào đậu phọng', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà xào đậu phọng');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt gà xào đậu phọng' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt gà xào đậu phọng', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt gà xào đậu phọng","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-21","mealType":"LUNCH","rawName":"Thịt gà xào đậu phọng"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-04","mealType":"LUNCH","rawName":"Thịt gà xào đậu phọng"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm, cải dún đà lạt', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm cải dún đà lạt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm cải dún đà lạt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm, cải dún đà lạt', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm cải dún đà lạt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-21","mealType":"LUNCH","rawName":"Canh thịt bằm, cải dún đà lạt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Dưa lưới', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa lưới');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'dưa lưới' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Dưa lưới', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"dưa lưới","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-21","mealType":"LUNCH","rawName":"Dưa lưới"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh gà hầm củ sen, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà hầm củ sen cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh gà hầm củ sen cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh gà hầm củ sen, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh gà hầm củ sen cà rốt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-22","mealType":"LUNCH","rawName":"Canh gà hầm củ sen, cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Rau câu lá dứa sữa', (SELECT id FROM dish_categories WHERE code = 'DESSERT'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'rau câu lá dứa sữa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'rau câu lá dứa sữa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Rau câu lá dứa sữa', category_id = (SELECT id FROM dish_categories WHERE code = 'DESSERT'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"rau câu lá dứa sữa","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-22","mealType":"LUNCH","rawName":"Rau câu lá dứa sữa"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Tôm thịt rim dứa', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'tôm thịt rim dứa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'tôm thịt rim dứa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Tôm thịt rim dứa', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"tôm thịt rim dứa","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-23","mealType":"LUNCH","rawName":"Tôm thịt rim dứa"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cá lóc cải ngọt', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc cải ngọt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cá lóc cải ngọt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cá lóc cải ngọt', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cá lóc cải ngọt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-23","mealType":"LUNCH","rawName":"Canh cá lóc cải ngọt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cơm chiên hải sản (thịt nạc, tôm, mực, cà rốt, đậu que)', (SELECT id FROM dish_categories WHERE code = 'RICE'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm chiên hải sản (thịt nạc tôm mực cà rốt đậu que)');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm chiên hải sản (thịt nạc tôm mực cà rốt đậu que)' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cơm chiên hải sản (thịt nạc, tôm, mực, cà rốt, đậu que)', category_id = (SELECT id FROM dish_categories WHERE code = 'RICE'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cơm chiên hải sản (thịt nạc tôm mực cà rốt đậu que)","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-24","mealType":"LUNCH","rawName":"- Cơm chiên hải sản (thịt nạc, tôm, mực, cà rốt, đậu que)"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh nghêu nấu bầu', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh nghêu nấu bầu');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh nghêu nấu bầu' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh nghêu nấu bầu', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh nghêu nấu bầu","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-24","mealType":"LUNCH","rawName":"Canh nghêu nấu bầu"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo thịt gà, nấm rơm, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt gà nấm rơm cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt gà nấm rơm cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo thịt gà, nấm rơm, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo thịt gà nấm rơm cà rốt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-20","mealType":"AFTERNOON_SNACK","rawName":"Cháo thịt gà, nấm rơm, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh canh cá lóc, tôm khô, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh canh cá lóc tôm khô cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh canh cá lóc tôm khô cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh canh cá lóc, tôm khô, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh canh cá lóc tôm khô cà rốt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-21","mealType":"AFTERNOON_SNACK","rawName":"Bánh canh cá lóc, tôm khô, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Phở bò, quế, ngò gai, ngò om', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'phở bò quế ngò gai ngò om');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'phở bò quế ngò gai ngò om' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Phở bò, quế, ngò gai, ngò om', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"phở bò quế ngò gai ngò om","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-22","mealType":"AFTERNOON_SNACK","rawName":"Phở bò, quế, ngò gai, ngò om."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bún mọc, thịt băm cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bún mọc thịt băm cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bún mọc thịt băm cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bún mọc, thịt băm cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bún mọc thịt băm cà rốt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-23","mealType":"AFTERNOON_SNACK","rawName":"Bún mọc, thịt băm cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh bông lan chà bông', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bông lan chà bông');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bông lan chà bông' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh bông lan chà bông', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh bông lan chà bông","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":7,"date":"2025-10-24","mealType":"AFTERNOON_SNACK","rawName":"Bánh bông lan chà bong"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cá hú muối sả chiên', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cá hú muối sả chiên');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cá hú muối sả chiên' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cá hú muối sả chiên', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cá hú muối sả chiên","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-27","mealType":"LUNCH","rawName":"Cá hú muối sả chiên"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-11","mealType":"LUNCH","rawName":"Cá hú muối sả chiên"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cải bó xôi, thịt bằm', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cải bó xôi thịt bằm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cải bó xôi thịt bằm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cải bó xôi, thịt bằm', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cải bó xôi thịt bằm","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-27","mealType":"LUNCH","rawName":"Canh cải bó xôi, thịt bằm."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh khoai môn hầm sườn heo', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh khoai môn hầm sườn heo');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh khoai môn hầm sườn heo' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh khoai môn hầm sườn heo', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh khoai môn hầm sườn heo","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-28","mealType":"LUNCH","rawName":"Canh khoai môn hầm sườn heo."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt bò xào su su', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào su su');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào su su' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt bò xào su su', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt bò xào su su","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-29","mealType":"LUNCH","rawName":"Thịt bò xào su su"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cua đồng rau ngót', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cua đồng rau ngót');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cua đồng rau ngót' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cua đồng rau ngót', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cua đồng rau ngót","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-29","mealType":"LUNCH","rawName":"Canh cua đồng rau ngót"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh bí hồ lô thịt bằm', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bí hồ lô thịt bằm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bí hồ lô thịt bằm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh bí hồ lô thịt bằm', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh bí hồ lô thịt bằm","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-30","mealType":"LUNCH","rawName":"Canh bí hồ lô thịt bằm."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Trứng thịt chưng bún tàu, nấm mèo, cà rốt', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'trứng thịt chưng bún tàu nấm mèo cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'trứng thịt chưng bún tàu nấm mèo cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Trứng thịt chưng bún tàu, nấm mèo, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"trứng thịt chưng bún tàu nấm mèo cà rốt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-31","mealType":"LUNCH","rawName":"Trứng thịt chưng bún tàu, nấm mèo, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm, cải xoang', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm cải xoang');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm cải xoang' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm, cải xoang', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm cải xoang","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-31","mealType":"LUNCH","rawName":"Canh thịt bằm, cải xoang."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nui thịt bằm, tôm khô, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nui thịt bằm tôm khô cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nui thịt bằm tôm khô cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nui thịt bằm, tôm khô, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nui thịt bằm tôm khô cà rốt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-28","mealType":"AFTERNOON_SNACK","rawName":"Nui thịt bằm, tôm khô, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo thịt bằm, nghêu, rau mùi', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt bằm nghêu rau mùi');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt bằm nghêu rau mùi' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo thịt bằm, nghêu, rau mùi', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo thịt bằm nghêu rau mùi","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-29","mealType":"AFTERNOON_SNACK","rawName":"Cháo thịt bằm, nghêu, rau mùi"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Trà đào, cam, sả, đường phèn', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'trà đào cam sả đường phèn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'trà đào cam sả đường phèn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Trà đào, cam, sả, đường phèn', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"trà đào cam sả đường phèn","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-30","mealType":"AFTERNOON_SNACK","rawName":"- Trà đào, cam, sả, đường phèn."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước mía', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước mía');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước mía' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước mía', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước mía","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-31","mealType":"AFTERNOON_SNACK","rawName":"- Nước mía"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh mexico thịt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh mexico thịt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh mexico thịt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh mexico thịt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh mexico thịt","sources":[{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sourceSha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c","weekNumber":8,"date":"2025-10-31","mealType":"AFTERNOON_SNACK","rawName":"Bánh mexico thịt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh chua cá hú, bông súng', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú bông súng');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh chua cá hú bông súng' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh chua cá hú, bông súng', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh chua cá hú bông súng","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-03","mealType":"LUNCH","rawName":"Canh chua cá hú, bông súng"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh hẹ, đậu phụ, thịt bằm', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh hẹ đậu phụ thịt bằm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh hẹ đậu phụ thịt bằm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh hẹ, đậu phụ, thịt bằm', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh hẹ đậu phụ thịt bằm","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-04","mealType":"LUNCH","rawName":"Canh hẹ, đậu phụ, thịt bằm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt bò nấu khoai tây, cà rốt', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò nấu khoai tây cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò nấu khoai tây cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt bò nấu khoai tây, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt bò nấu khoai tây cà rốt","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-05","mealType":"LUNCH","rawName":"Thịt bò nấu khoai tây, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh cà chua cá diêu hồng, ngò gai', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cà chua cá diêu hồng ngò gai');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh cà chua cá diêu hồng ngò gai' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh cà chua cá diêu hồng, ngò gai', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh cà chua cá diêu hồng ngò gai","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-05","mealType":"LUNCH","rawName":"Canh cà chua cá diêu hồng, ngò gai"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cơm Dương Châu thịt nạc, chả lụa, tôm, cà tốt, đậu đũa', (SELECT id FROM dish_categories WHERE code = 'RICE'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm dương châu thịt nạc chả lụa tôm cà tốt đậu đũa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm dương châu thịt nạc chả lụa tôm cà tốt đậu đũa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cơm Dương Châu thịt nạc, chả lụa, tôm, cà tốt, đậu đũa', category_id = (SELECT id FROM dish_categories WHERE code = 'RICE'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cơm dương châu thịt nạc chả lụa tôm cà tốt đậu đũa","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-07","mealType":"LUNCH","rawName":"- Cơm Dương Châu thịt nạc, chả lụa, tôm, cà tốt, đậu đũa."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh bí đao thịt bằm', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bí đao thịt bằm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bí đao thịt bằm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh bí đao thịt bằm', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh bí đao thịt bằm","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-07","mealType":"LUNCH","rawName":"Canh bí đao thịt bằm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo bí đỏ, thịt bò bằm', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo bí đỏ thịt bò bằm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo bí đỏ thịt bò bằm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo bí đỏ, thịt bò bằm', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo bí đỏ thịt bò bằm","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-03","mealType":"AFTERNOON_SNACK","rawName":"Cháo bí đỏ, thịt bò bằm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước ép cam', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước ép cam');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước ép cam' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước ép cam', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước ép cam","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-04","mealType":"AFTERNOON_SNACK","rawName":"Nước ép cam"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bún nước lèo cá lóc, rau râm', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bún nước lèo cá lóc rau râm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bún nước lèo cá lóc rau râm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bún nước lèo cá lóc, rau râm', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bún nước lèo cá lóc rau râm","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-04","mealType":"AFTERNOON_SNACK","rawName":"Bún nước lèo cá lóc, rau râm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Mì thịt bằm, tôm, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'mì thịt bằm tôm cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'mì thịt bằm tôm cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Mì thịt bằm, tôm, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"mì thịt bằm tôm cà rốt","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-05","mealType":"AFTERNOON_SNACK","rawName":"Mì thịt bằm, tôm, cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Miến gà cần tây, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'miến gà cần tây cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'miến gà cần tây cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Miến gà cần tây, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"miến gà cần tây cà rốt","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":9,"date":"2025-11-06","mealType":"AFTERNOON_SNACK","rawName":"Miến gà cần tây, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm, cải Cúc', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm cải cúc');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm cải cúc' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm, cải Cúc', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm cải cúc","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-10","mealType":"LUNCH","rawName":"Canh thịt bằm, cải Cúc"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh rong biển, thịt heo bằm, đậu hủ, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh rong biển thịt heo bằm đậu hủ cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh rong biển thịt heo bằm đậu hủ cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh rong biển, thịt heo bằm, đậu hủ, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh rong biển thịt heo bằm đậu hủ cà rốt","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-12","mealType":"LUNCH","rawName":"Canh rong biển, thịt heo bằm, đậu hủ, cà rốt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Thịt bò xào, bắp mỹ, đậu que', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào bắp mỹ đậu que');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'thịt bò xào bắp mỹ đậu que' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Thịt bò xào, bắp mỹ, đậu que', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"thịt bò xào bắp mỹ đậu que","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-13","mealType":"LUNCH","rawName":"Thịt bò xào, bắp mỹ, đậu que."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh thịt bằm bắp cải', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm bắp cải');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh thịt bằm bắp cải' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh thịt bằm bắp cải', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh thịt bằm bắp cải","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-13","mealType":"LUNCH","rawName":"Canh thịt bằm bắp cải"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cơm tấm', (SELECT id FROM dish_categories WHERE code = 'RICE'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm tấm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cơm tấm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cơm tấm', category_id = (SELECT id FROM dish_categories WHERE code = 'RICE'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cơm tấm","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-14","mealType":"LUNCH","rawName":"- Cơm tấm"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Sườn khìa, trứng gà xắt', (SELECT id FROM dish_categories WHERE code = 'MAIN'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'sườn khìa trứng gà xắt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'sườn khìa trứng gà xắt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Sườn khìa, trứng gà xắt', category_id = (SELECT id FROM dish_categories WHERE code = 'MAIN'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"sườn khìa trứng gà xắt","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-14","mealType":"LUNCH","rawName":"Sườn khìa, trứng gà xắt."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Canh bắp cải, cà rốt thịt bằm', (SELECT id FROM dish_categories WHERE code = 'SOUP'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bắp cải cà rốt thịt bằm');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'canh bắp cải cà rốt thịt bằm' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Canh bắp cải, cà rốt thịt bằm', category_id = (SELECT id FROM dish_categories WHERE code = 'SOUP'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"canh bắp cải cà rốt thịt bằm","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-14","mealType":"LUNCH","rawName":"Canh bắp cải, cà rốt thịt bằm."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Chanh dây đường phèn', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'chanh dây đường phèn');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'chanh dây đường phèn' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Chanh dây đường phèn', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"chanh dây đường phèn","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-10","mealType":"AFTERNOON_SNACK","rawName":"Chanh dây đường phèn"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Súp thịt gà xé, bắp hạt, trứng cút, cà rốt', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'súp thịt gà xé bắp hạt trứng cút cà rốt');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'súp thịt gà xé bắp hạt trứng cút cà rốt' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Súp thịt gà xé, bắp hạt, trứng cút, cà rốt', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"súp thịt gà xé bắp hạt trứng cút cà rốt","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-11","mealType":"AFTERNOON_SNACK","rawName":"Súp thịt gà xé, bắp hạt, trứng cút, cà rốt"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Hủ tiếu gan, mực, tôm, hẹ', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu gan mực tôm hẹ');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'hủ tiếu gan mực tôm hẹ' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Hủ tiếu gan, mực, tôm, hẹ', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"hủ tiếu gan mực tôm hẹ","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-12","mealType":"AFTERNOON_SNACK","rawName":"Hủ tiếu gan, mực, tôm, hẹ."}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Nước sâm bí đao', (SELECT id FROM dish_categories WHERE code = 'DRINK'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'nước sâm bí đao');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'nước sâm bí đao' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Nước sâm bí đao', category_id = (SELECT id FROM dish_categories WHERE code = 'DRINK'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"nước sâm bí đao","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-13","mealType":"AFTERNOON_SNACK","rawName":"Nước sâm bí đao"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Cháo thịt bằm đậu xanh', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt bằm đậu xanh');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'cháo thịt bằm đậu xanh' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Cháo thịt bằm đậu xanh', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"cháo thịt bằm đậu xanh","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-13","mealType":"AFTERNOON_SNACK","rawName":"Cháo thịt bằm đậu xanh"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

INSERT INTO dishes(name, category_id, description, nutrition_verified)
      SELECT 'Bánh bao kim sa', (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'), 'Chưa có định lượng công thức trong tài liệu gốc.', FALSE
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bao kim sa');

WITH chosen AS (SELECT id FROM dishes WHERE pg_temp.catalog_key(name) = 'bánh bao kim sa' ORDER BY id LIMIT 1),
      updated AS (UPDATE dishes d SET name = 'Bánh bao kim sa', category_id = (SELECT id FROM dish_categories WHERE code = 'SNACK_AFTERNOON'),
        status = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.status ELSE 'ACTIVE' END,
        nutrition_verified = CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC' THEN d.nutrition_verified ELSE FALSE END,
        source_metadata = '{"kind":"SOURCE_MENU_DOC","key":"bánh bao kim sa","sources":[{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sourceSha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8","weekNumber":10,"date":"2025-11-14","mealType":"AFTERNOON_SNACK","rawName":"Bánh bao kim sa"}],"recipeStatus":"MISSING_SOURCE_QUANTITIES","servingSizeStatus":"UNKNOWN"}'::jsonb || CASE WHEN d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN d.source_metadata - 'key' - 'sources' - 'kind' ELSE '{}'::jsonb END
          || CASE WHEN d.nutrition_verified AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
          THEN jsonb_build_object('recipeStatus', 'VERIFIED_MANUAL', 'servingSizeStatus', 'MANUAL') ELSE '{}'::jsonb END
        FROM chosen WHERE d.id = chosen.id RETURNING d.id)
      INSERT INTO source_dish_ids SELECT id FROM updated;

UPDATE dishes SET status = 'INACTIVE', nutrition_verified = FALSE WHERE id NOT IN (SELECT id FROM source_dish_ids);

CREATE TEMP TABLE seed_recipe_cleanup ON COMMIT DROP AS
    SELECT r.*, d.name AS dish_name, f.name AS ingredient_name
    FROM dish_recipes r JOIN dishes d ON d.id = r.dish_id
    JOIN food_ingredients f ON f.id = r.ingredient_id
    JOIN jsonb_to_recordset('[{"id":1,"dishId":1,"ingredientId":1,"grossWeightG":50,"netWeightG":50,"note":"Gạo tẻ vo sạch nấu mềm"},{"id":2,"dishId":2,"ingredientId":1,"grossWeightG":45,"netWeightG":45,"note":"Gạo tẻ"},{"id":3,"dishId":2,"ingredientId":77,"grossWeightG":10,"netWeightG":10,"note":"Lạp xưởng thái hạt lựu"},{"id":4,"dishId":2,"ingredientId":76,"grossWeightG":10,"netWeightG":10,"note":"Chả lụa"},{"id":5,"dishId":2,"ingredientId":90,"grossWeightG":15,"netWeightG":15,"note":"Trứng gà"},{"id":6,"dishId":2,"ingredientId":84,"grossWeightG":15,"netWeightG":10,"note":"Tôm thẻ"},{"id":7,"dishId":2,"ingredientId":39,"grossWeightG":12,"netWeightG":10,"note":"Cà rốt"},{"id":8,"dishId":2,"ingredientId":41,"grossWeightG":12,"netWeightG":10,"note":"Đậu que"},{"id":9,"dishId":2,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":10,"dishId":3,"ingredientId":1,"grossWeightG":45,"netWeightG":45,"note":"Gạo tẻ"},{"id":11,"dishId":3,"ingredientId":84,"grossWeightG":20,"netWeightG":15,"note":"Tôm thẻ"},{"id":12,"dishId":3,"ingredientId":86,"grossWeightG":18,"netWeightG":15,"note":"Mực tươi"},{"id":13,"dishId":3,"ingredientId":90,"grossWeightG":15,"netWeightG":15,"note":"Trứng gà"},{"id":14,"dishId":3,"ingredientId":39,"grossWeightG":12,"netWeightG":10,"note":"Cà rốt"},{"id":15,"dishId":3,"ingredientId":41,"grossWeightG":12,"netWeightG":10,"note":"Đậu que"},{"id":16,"dishId":3,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":17,"dishId":4,"ingredientId":3,"grossWeightG":50,"netWeightG":50,"note":"Gạo tấm"},{"id":18,"dishId":4,"ingredientId":70,"grossWeightG":45,"netWeightG":35,"note":"Sườn cốt lết"},{"id":19,"dishId":4,"ingredientId":90,"grossWeightG":20,"netWeightG":20,"note":"Trứng gà"},{"id":20,"dishId":4,"ingredientId":107,"grossWeightG":15,"netWeightG":15,"note":"Nước dừa"},{"id":21,"dishId":5,"ingredientId":79,"grossWeightG":60,"netWeightG":48,"note":"Cá lóc phi lê sạch xương"},{"id":22,"dishId":5,"ingredientId":101,"grossWeightG":0.5,"netWeightG":0.5,"note":"Muối i-ốt"},{"id":23,"dishId":5,"ingredientId":65,"grossWeightG":5,"netWeightG":5,"note":"Dầu ăn"},{"id":24,"dishId":6,"ingredientId":72,"grossWeightG":55,"netWeightG":45,"note":"Thịt gà ta"},{"id":25,"dishId":6,"ingredientId":107,"grossWeightG":20,"netWeightG":20,"note":"Nước dừa tươi"},{"id":26,"dishId":6,"ingredientId":102,"grossWeightG":2,"netWeightG":2,"note":"Tỏi phi"},{"id":27,"dishId":6,"ingredientId":100,"grossWeightG":2,"netWeightG":2,"note":"Nước mắm"},{"id":28,"dishId":6,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":29,"dishId":7,"ingredientId":79,"grossWeightG":60,"netWeightG":48,"note":"Cá lóc"},{"id":30,"dishId":7,"ingredientId":100,"grossWeightG":3,"netWeightG":3,"note":"Nước mắm"},{"id":31,"dishId":7,"ingredientId":96,"grossWeightG":2,"netWeightG":2,"note":"Đường phèn"},{"id":32,"dishId":7,"ingredientId":103,"grossWeightG":2,"netWeightG":2,"note":"Hành tím"},{"id":33,"dishId":7,"ingredientId":65,"grossWeightG":2,"netWeightG":2,"note":"Dầu ăn"},{"id":34,"dishId":8,"ingredientId":71,"grossWeightG":40,"netWeightG":38,"note":"Thịt bò bắp"},{"id":35,"dishId":8,"ingredientId":14,"grossWeightG":25,"netWeightG":15,"note":"Ngô ngọt"},{"id":36,"dishId":8,"ingredientId":39,"grossWeightG":18,"netWeightG":15,"note":"Cà rốt"},{"id":37,"dishId":8,"ingredientId":100,"grossWeightG":2,"netWeightG":2,"note":"Nước mắm"},{"id":38,"dishId":9,"ingredientId":72,"grossWeightG":55,"netWeightG":45,"note":"Thịt gà"},{"id":39,"dishId":9,"ingredientId":100,"grossWeightG":3,"netWeightG":3,"note":"Nước mắm"},{"id":40,"dishId":9,"ingredientId":96,"grossWeightG":2,"netWeightG":2,"note":"Đường phèn"},{"id":41,"dishId":9,"ingredientId":65,"grossWeightG":4,"netWeightG":4,"note":"Dầu ăn"},{"id":42,"dishId":10,"ingredientId":67,"grossWeightG":48,"netWeightG":45,"note":"Thịt lợn nạc"},{"id":43,"dishId":10,"ingredientId":39,"grossWeightG":20,"netWeightG":18,"note":"Cà rốt"},{"id":44,"dishId":10,"ingredientId":100,"grossWeightG":2,"netWeightG":2,"note":"Nước mắm"},{"id":45,"dishId":10,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":46,"dishId":11,"ingredientId":82,"grossWeightG":55,"netWeightG":45,"note":"Cá ngừ"},{"id":47,"dishId":11,"ingredientId":40,"grossWeightG":26,"netWeightG":25,"note":"Cà chua"},{"id":48,"dishId":11,"ingredientId":103,"grossWeightG":2,"netWeightG":2,"note":"Hành tím"},{"id":49,"dishId":11,"ingredientId":65,"grossWeightG":4,"netWeightG":4,"note":"Dầu ăn"},{"id":50,"dishId":12,"ingredientId":67,"grossWeightG":32,"netWeightG":30,"note":"Thịt nạc"},{"id":51,"dishId":12,"ingredientId":84,"grossWeightG":28,"netWeightG":20,"note":"Tôm thẻ"},{"id":52,"dishId":12,"ingredientId":107,"grossWeightG":20,"netWeightG":20,"note":"Nước dừa"},{"id":53,"dishId":12,"ingredientId":100,"grossWeightG":2,"netWeightG":2,"note":"Nước mắm"},{"id":54,"dishId":13,"ingredientId":72,"grossWeightG":50,"netWeightG":42,"note":"Thịt gà"},{"id":55,"dishId":13,"ingredientId":104,"grossWeightG":6,"netWeightG":5,"note":"Sả non"},{"id":56,"dishId":13,"ingredientId":23,"grossWeightG":6,"netWeightG":5,"note":"Đậu phộng"},{"id":57,"dishId":13,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":58,"dishId":14,"ingredientId":91,"grossWeightG":40,"netWeightG":35,"note":"Trứng vịt"},{"id":59,"dishId":14,"ingredientId":67,"grossWeightG":18,"netWeightG":17,"note":"Thịt nạc băm"},{"id":60,"dishId":14,"ingredientId":40,"grossWeightG":15,"netWeightG":14,"note":"Cà chua"},{"id":61,"dishId":14,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":62,"dishId":15,"ingredientId":69,"grossWeightG":65,"netWeightG":45,"note":"Sườn non"},{"id":63,"dishId":15,"ingredientId":107,"grossWeightG":20,"netWeightG":20,"note":"Nước dừa"},{"id":64,"dishId":15,"ingredientId":102,"grossWeightG":2,"netWeightG":2,"note":"Tỏi"},{"id":65,"dishId":15,"ingredientId":100,"grossWeightG":2,"netWeightG":2,"note":"Nước mắm"},{"id":66,"dishId":16,"ingredientId":71,"grossWeightG":40,"netWeightG":38,"note":"Thịt bò"},{"id":67,"dishId":16,"ingredientId":41,"grossWeightG":35,"netWeightG":30,"note":"Đậu que"},{"id":68,"dishId":16,"ingredientId":102,"grossWeightG":2,"netWeightG":2,"note":"Tỏi"},{"id":69,"dishId":16,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":70,"dishId":17,"ingredientId":68,"grossWeightG":40,"netWeightG":38,"note":"Thịt ba chỉ"},{"id":71,"dishId":17,"ingredientId":92,"grossWeightG":25,"netWeightG":22,"note":"Trứng cút"},{"id":72,"dishId":17,"ingredientId":107,"grossWeightG":15,"netWeightG":15,"note":"Nước dừa"},{"id":73,"dishId":17,"ingredientId":100,"grossWeightG":2.5,"netWeightG":2.5,"note":"Nước mắm"},{"id":74,"dishId":18,"ingredientId":90,"grossWeightG":35,"netWeightG":30,"note":"Trứng gà"},{"id":75,"dishId":18,"ingredientId":67,"grossWeightG":22,"netWeightG":20,"note":"Thịt nạc băm"},{"id":76,"dishId":18,"ingredientId":11,"grossWeightG":5,"netWeightG":5,"note":"Bún tàu"},{"id":77,"dishId":18,"ingredientId":47,"grossWeightG":3,"netWeightG":3,"note":"Nấm mèo"},{"id":78,"dishId":18,"ingredientId":39,"grossWeightG":8,"netWeightG":7,"note":"Cà rốt"},{"id":79,"dishId":19,"ingredientId":72,"grossWeightG":55,"netWeightG":45,"note":"Thịt gà"},{"id":80,"dishId":19,"ingredientId":104,"grossWeightG":6,"netWeightG":5,"note":"Sả non"},{"id":81,"dishId":19,"ingredientId":65,"grossWeightG":4,"netWeightG":4,"note":"Dầu ăn"},{"id":82,"dishId":20,"ingredientId":71,"grossWeightG":40,"netWeightG":38,"note":"Thịt bò"},{"id":83,"dishId":20,"ingredientId":44,"grossWeightG":45,"netWeightG":28,"note":"Khóm"},{"id":84,"dishId":20,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":85,"dishId":21,"ingredientId":67,"grossWeightG":48,"netWeightG":45,"note":"Thịt lợn"},{"id":86,"dishId":21,"ingredientId":100,"grossWeightG":3,"netWeightG":3,"note":"Nước mắm"},{"id":87,"dishId":21,"ingredientId":96,"grossWeightG":2,"netWeightG":2,"note":"Đường"},{"id":88,"dishId":21,"ingredientId":65,"grossWeightG":2,"netWeightG":2,"note":"Dầu ăn"},{"id":89,"dishId":22,"ingredientId":70,"grossWeightG":60,"netWeightG":48,"note":"Sườn cốt lết"},{"id":90,"dishId":22,"ingredientId":107,"grossWeightG":15,"netWeightG":15,"note":"Nước dừa"},{"id":91,"dishId":22,"ingredientId":100,"grossWeightG":2,"netWeightG":2,"note":"Nước mắm"},{"id":92,"dishId":23,"ingredientId":68,"grossWeightG":48,"netWeightG":45,"note":"Thịt ba chỉ"},{"id":93,"dishId":23,"ingredientId":100,"grossWeightG":3,"netWeightG":3,"note":"Nước mắm"},{"id":94,"dishId":23,"ingredientId":96,"grossWeightG":2,"netWeightG":2,"note":"Đường"},{"id":95,"dishId":24,"ingredientId":84,"grossWeightG":25,"netWeightG":18,"note":"Tôm thẻ"},{"id":96,"dishId":24,"ingredientId":67,"grossWeightG":30,"netWeightG":28,"note":"Thịt nạc"},{"id":97,"dishId":24,"ingredientId":44,"grossWeightG":30,"netWeightG":18,"note":"Khóm"},{"id":98,"dishId":25,"ingredientId":83,"grossWeightG":65,"netWeightG":50,"note":"Cá hú"},{"id":99,"dishId":25,"ingredientId":104,"grossWeightG":6,"netWeightG":5,"note":"Sả băm"},{"id":100,"dishId":25,"ingredientId":65,"grossWeightG":4,"netWeightG":4,"note":"Dầu ăn"},{"id":101,"dishId":26,"ingredientId":71,"grossWeightG":40,"netWeightG":38,"note":"Thịt bò"},{"id":102,"dishId":26,"ingredientId":45,"grossWeightG":40,"netWeightG":32,"note":"Su su"},{"id":103,"dishId":26,"ingredientId":65,"grossWeightG":3,"netWeightG":3,"note":"Dầu ăn"},{"id":104,"dishId":27,"ingredientId":71,"grossWeightG":40,"netWeightG":38,"note":"Thịt bò"},{"id":105,"dishId":27,"ingredientId":16,"grossWeightG":25,"netWeightG":22,"note":"Khoai tây"},{"id":106,"dishId":27,"ingredientId":39,"grossWeightG":20,"netWeightG":18,"note":"Cà rốt"},{"id":107,"dishId":28,"ingredientId":71,"grossWeightG":40,"netWeightG":38,"note":"Thịt bò"},{"id":108,"dishId":28,"ingredientId":14,"grossWeightG":20,"netWeightG":12,"note":"Ngô ngọt"},{"id":109,"dishId":28,"ingredientId":41,"grossWeightG":20,"netWeightG":18,"note":"Đậu que"},{"id":110,"dishId":29,"ingredientId":81,"grossWeightG":65,"netWeightG":45,"note":"Cá điêu hồng"},{"id":111,"dishId":29,"ingredientId":40,"grossWeightG":28,"netWeightG":25,"note":"Cà chua"},{"id":112,"dishId":29,"ingredientId":65,"grossWeightG":4,"netWeightG":4,"note":"Dầu ăn"},{"id":113,"dishId":30,"ingredientId":81,"grossWeightG":65,"netWeightG":45,"note":"Cá điêu hồng"},{"id":114,"dishId":30,"ingredientId":100,"grossWeightG":3,"netWeightG":3,"note":"Nước mắm"},{"id":115,"dishId":30,"ingredientId":65,"grossWeightG":5,"netWeightG":5,"note":"Dầu ăn"},{"id":116,"dishId":31,"ingredientId":84,"grossWeightG":20,"netWeightG":15,"note":"Tôm thẻ"},{"id":117,"dishId":31,"ingredientId":17,"grossWeightG":55,"netWeightG":45,"note":"Khoai sọ"},{"id":118,"dishId":31,"ingredientId":106,"grossWeightG":2,"netWeightG":2,"note":"Hành ngò"},{"id":119,"dishId":32,"ingredientId":79,"grossWeightG":25,"netWeightG":20,"note":"Cá lóc"},{"id":120,"dishId":32,"ingredientId":30,"grossWeightG":55,"netWeightG":45,"note":"Cải ngọt"},{"id":121,"dishId":32,"ingredientId":105,"grossWeightG":1,"netWeightG":1,"note":"Gừng khử tanh"},{"id":122,"dishId":33,"ingredientId":69,"grossWeightG":35,"netWeightG":25,"note":"Sườn heo"},{"id":123,"dishId":33,"ingredientId":14,"grossWeightG":25,"netWeightG":15,"note":"Ngô ngọt"},{"id":124,"dishId":33,"ingredientId":37,"grossWeightG":35,"netWeightG":30,"note":"Bầu non"},{"id":125,"dishId":34,"ingredientId":79,"grossWeightG":25,"netWeightG":20,"note":"Cá lóc"},{"id":126,"dishId":34,"ingredientId":37,"grossWeightG":60,"netWeightG":50,"note":"Bầu non"},{"id":127,"dishId":35,"ingredientId":71,"grossWeightG":20,"netWeightG":18,"note":"Thịt bò băm"},{"id":128,"dishId":35,"ingredientId":31,"grossWeightG":55,"netWeightG":45,"note":"Cải bó xôi"},{"id":129,"dishId":36,"ingredientId":83,"grossWeightG":32,"netWeightG":25,"note":"Cá hú"},{"id":130,"dishId":36,"ingredientId":44,"grossWeightG":25,"netWeightG":15,"note":"Khóm"},{"id":131,"dishId":36,"ingredientId":42,"grossWeightG":18,"netWeightG":15,"note":"Đậu bắp"},{"id":132,"dishId":36,"ingredientId":40,"grossWeightG":16,"netWeightG":15,"note":"Cà chua"},{"id":133,"dishId":36,"ingredientId":43,"grossWeightG":20,"netWeightG":15,"note":"Dọc mùng"},{"id":134,"dishId":37,"ingredientId":72,"grossWeightG":30,"netWeightG":25,"note":"Thịt gà"},{"id":135,"dishId":37,"ingredientId":24,"grossWeightG":10,"netWeightG":10,"note":"Hạt sen"},{"id":136,"dishId":37,"ingredientId":39,"grossWeightG":18,"netWeightG":15,"note":"Cà rốt"},{"id":137,"dishId":37,"ingredientId":48,"grossWeightG":4,"netWeightG":4,"note":"Nấm hương"},{"id":138,"dishId":37,"ingredientId":34,"grossWeightG":20,"netWeightG":15,"note":"Súp lơ xanh"},{"id":139,"dishId":38,"ingredientId":67,"grossWeightG":18,"netWeightG":16,"note":"Thịt nạc băm"},{"id":140,"dishId":38,"ingredientId":85,"grossWeightG":4,"netWeightG":4,"note":"Tôm khô"},{"id":141,"dishId":38,"ingredientId":38,"grossWeightG":36,"netWeightG":30,"note":"Mướp hương"},{"id":142,"dishId":38,"ingredientId":46,"grossWeightG":18,"netWeightG":15,"note":"Nấm rơm"},{"id":143,"dishId":39,"ingredientId":79,"grossWeightG":20,"netWeightG":15,"note":"Cá lóc"},{"id":144,"dishId":39,"ingredientId":85,"grossWeightG":3,"netWeightG":3,"note":"Tôm khô"},{"id":145,"dishId":39,"ingredientId":26,"grossWeightG":55,"netWeightG":45,"note":"Rau ngót"},{"id":146,"dishId":40,"ingredientId":79,"grossWeightG":20,"netWeightG":15,"note":"Cá lóc"},{"id":147,"dishId":40,"ingredientId":85,"grossWeightG":3,"netWeightG":3,"note":"Tôm khô"},{"id":148,"dishId":40,"ingredientId":36,"grossWeightG":60,"netWeightG":50,"note":"Bí đao"},{"id":149,"dishId":41,"ingredientId":71,"grossWeightG":20,"netWeightG":18,"note":"Thịt bò"},{"id":150,"dishId":41,"ingredientId":22,"grossWeightG":15,"netWeightG":15,"note":"Đậu đỏ ninh nhừ"},{"id":151,"dishId":41,"ingredientId":39,"grossWeightG":22,"netWeightG":20,"note":"Cà rốt"},{"id":152,"dishId":42,"ingredientId":67,"grossWeightG":18,"netWeightG":16,"note":"Thịt nạc băm"},{"id":153,"dishId":42,"ingredientId":28,"grossWeightG":32,"netWeightG":25,"note":"Rau dền đỏ"},{"id":154,"dishId":42,"ingredientId":27,"grossWeightG":34,"netWeightG":25,"note":"Rau mồng tơi"},{"id":155,"dishId":43,"ingredientId":67,"grossWeightG":20,"netWeightG":18,"note":"Thịt nạc băm"},{"id":156,"dishId":43,"ingredientId":29,"grossWeightG":60,"netWeightG":50,"note":"Rau cải cúc"},{"id":157,"dishId":44,"ingredientId":71,"grossWeightG":20,"netWeightG":18,"note":"Thịt bò"},{"id":158,"dishId":44,"ingredientId":17,"grossWeightG":55,"netWeightG":45,"note":"Khoai môn"},{"id":159,"dishId":44,"ingredientId":106,"grossWeightG":2,"netWeightG":2,"note":"Ngò gai"},{"id":160,"dishId":45,"ingredientId":67,"grossWeightG":18,"netWeightG":16,"note":"Thịt nạc"},{"id":161,"dishId":45,"ingredientId":85,"grossWeightG":3,"netWeightG":3,"note":"Tôm khô"},{"id":162,"dishId":45,"ingredientId":18,"grossWeightG":60,"netWeightG":50,"note":"Khoai mỡ"},{"id":163,"dishId":46,"ingredientId":89,"grossWeightG":22,"netWeightG":20,"note":"Chả cá"},{"id":164,"dishId":46,"ingredientId":29,"grossWeightG":60,"netWeightG":50,"note":"Cải cúc"},{"id":165,"dishId":47,"ingredientId":67,"grossWeightG":20,"netWeightG":18,"note":"Thịt nạc băm"},{"id":166,"dishId":47,"ingredientId":26,"grossWeightG":60,"netWeightG":50,"note":"Rau ngót"},{"id":167,"dishId":48,"ingredientId":67,"grossWeightG":20,"netWeightG":18,"note":"Thịt nạc"},{"id":168,"dishId":48,"ingredientId":33,"grossWeightG":40,"netWeightG":35,"note":"Bắp cải"},{"id":169,"dishId":48,"ingredientId":39,"grossWeightG":18,"netWeightG":15,"note":"Cà rốt"},{"id":170,"dishId":49,"ingredientId":84,"grossWeightG":22,"netWeightG":16,"note":"Tôm thẻ"},{"id":171,"dishId":49,"ingredientId":32,"grossWeightG":60,"netWeightG":50,"note":"Cải dún"},{"id":172,"dishId":50,"ingredientId":72,"grossWeightG":30,"netWeightG":25,"note":"Thịt gà"},{"id":173,"dishId":50,"ingredientId":19,"grossWeightG":30,"netWeightG":25,"note":"Củ sen"},{"id":174,"dishId":50,"ingredientId":39,"grossWeightG":18,"netWeightG":15,"note":"Cà rốt"},{"id":175,"dishId":51,"ingredientId":88,"grossWeightG":80,"netWeightG":20,"note":"Nghêu thịt"},{"id":176,"dishId":51,"ingredientId":37,"grossWeightG":60,"netWeightG":50,"note":"Bầu non"},{"id":177,"dishId":52,"ingredientId":87,"grossWeightG":60,"netWeightG":30,"note":"Cua đồng giã"},{"id":178,"dishId":52,"ingredientId":26,"grossWeightG":60,"netWeightG":50,"note":"Rau ngót"},{"id":179,"dishId":53,"ingredientId":67,"grossWeightG":20,"netWeightG":18,"note":"Thịt nạc"},{"id":180,"dishId":53,"ingredientId":35,"grossWeightG":60,"netWeightG":50,"note":"Bí đỏ"},{"id":181,"dishId":54,"ingredientId":83,"grossWeightG":32,"netWeightG":25,"note":"Cá hú"},{"id":182,"dishId":54,"ingredientId":51,"grossWeightG":45,"netWeightG":40,"note":"Bông súng"},{"id":183,"dishId":54,"ingredientId":40,"grossWeightG":18,"netWeightG":16,"note":"Cà chua"},{"id":184,"dishId":55,"ingredientId":67,"grossWeightG":18,"netWeightG":16,"note":"Thịt nạc"},{"id":185,"dishId":55,"ingredientId":20,"grossWeightG":25,"netWeightG":25,"note":"Đậu phụ"},{"id":186,"dishId":55,"ingredientId":49,"grossWeightG":35,"netWeightG":30,"note":"Hẹ lá"},{"id":187,"dishId":56,"ingredientId":81,"grossWeightG":35,"netWeightG":25,"note":"Cá diêu hồng"},{"id":188,"dishId":56,"ingredientId":40,"grossWeightG":35,"netWeightG":30,"note":"Cà chua"},{"id":189,"dishId":56,"ingredientId":106,"grossWeightG":2,"netWeightG":2,"note":"Ngò gai"},{"id":190,"dishId":57,"ingredientId":67,"grossWeightG":20,"netWeightG":18,"note":"Thịt nạc"},{"id":191,"dishId":57,"ingredientId":36,"grossWeightG":60,"netWeightG":50,"note":"Bí đao"},{"id":192,"dishId":58,"ingredientId":67,"grossWeightG":18,"netWeightG":16,"note":"Thịt nạc"},{"id":193,"dishId":58,"ingredientId":20,"grossWeightG":25,"netWeightG":25,"note":"Đậu phụ"},{"id":194,"dishId":58,"ingredientId":52,"grossWeightG":3,"netWeightG":3,"note":"Rong biển"},{"id":195,"dishId":58,"ingredientId":39,"grossWeightG":16,"netWeightG":14,"note":"Cà rốt"},{"id":196,"dishId":59,"ingredientId":53,"grossWeightG":55,"netWeightG":50,"note":"Nho tươi"},{"id":197,"dishId":60,"ingredientId":98,"grossWeightG":35,"netWeightG":35,"note":"Bánh su kem"},{"id":198,"dishId":61,"ingredientId":54,"grossWeightG":60,"netWeightG":50,"note":"Lê đường"},{"id":199,"dishId":62,"ingredientId":97,"grossWeightG":50,"netWeightG":50,"note":"Rau câu dừa"},{"id":200,"dishId":63,"ingredientId":56,"grossWeightG":80,"netWeightG":60,"note":"Thanh long"},{"id":201,"dishId":64,"ingredientId":55,"grossWeightG":58,"netWeightG":50,"note":"Táo tây"},{"id":202,"dishId":65,"ingredientId":57,"grossWeightG":80,"netWeightG":60,"note":"Đu đủ"},{"id":203,"dishId":66,"ingredientId":99,"grossWeightG":50,"netWeightG":50,"note":"Bánh flan"},{"id":204,"dishId":67,"ingredientId":58,"grossWeightG":125,"netWeightG":70,"note":"Dưa hấu"},{"id":205,"dishId":68,"ingredientId":59,"grossWeightG":80,"netWeightG":60,"note":"Quýt đường"},{"id":206,"dishId":69,"ingredientId":60,"grossWeightG":85,"netWeightG":60,"note":"Dưa lưới"},{"id":207,"dishId":70,"ingredientId":61,"grossWeightG":80,"netWeightG":60,"note":"Dưa lê"},{"id":208,"dishId":71,"ingredientId":62,"grossWeightG":65,"netWeightG":50,"note":"Chuối cau"},{"id":209,"dishId":72,"ingredientId":63,"grossWeightG":60,"netWeightG":50,"note":"Hồng giòn"},{"id":210,"dishId":73,"ingredientId":64,"grossWeightG":62,"netWeightG":50,"note":"Hồng xiêm"},{"id":211,"dishId":74,"ingredientId":8,"grossWeightG":60,"netWeightG":60,"note":"Bún tươi"},{"id":212,"dishId":74,"ingredientId":67,"grossWeightG":22,"netWeightG":20,"note":"Thịt nạc băm"},{"id":213,"dishId":74,"ingredientId":92,"grossWeightG":18,"netWeightG":15,"note":"Trứng cút"},{"id":214,"dishId":74,"ingredientId":39,"grossWeightG":18,"netWeightG":15,"note":"Cà rốt"},{"id":215,"dishId":75,"ingredientId":1,"grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ"},{"id":216,"dishId":75,"ingredientId":71,"grossWeightG":22,"netWeightG":20,"note":"Thịt bò băm"},{"id":217,"dishId":75,"ingredientId":35,"grossWeightG":30,"netWeightG":25,"note":"Bí đỏ"},{"id":218,"dishId":76,"ingredientId":9,"grossWeightG":50,"netWeightG":50,"note":"Hủ tiếu"},{"id":219,"dishId":76,"ingredientId":86,"grossWeightG":12,"netWeightG":10,"note":"Mực"},{"id":220,"dishId":76,"ingredientId":74,"grossWeightG":11,"netWeightG":10,"note":"Tim heo"},{"id":221,"dishId":76,"ingredientId":73,"grossWeightG":11,"netWeightG":10,"note":"Gan heo"},{"id":222,"dishId":76,"ingredientId":84,"grossWeightG":15,"netWeightG":10,"note":"Tôm thẻ"},{"id":223,"dishId":76,"ingredientId":50,"grossWeightG":12,"netWeightG":10,"note":"Cần tây"},{"id":224,"dishId":77,"ingredientId":75,"grossWeightG":16,"netWeightG":15,"note":"Óc heo"},{"id":225,"dishId":77,"ingredientId":72,"grossWeightG":18,"netWeightG":15,"note":"Thịt gà xé"},{"id":226,"dishId":77,"ingredientId":92,"grossWeightG":12,"netWeightG":10,"note":"Trứng cút"},{"id":227,"dishId":77,"ingredientId":14,"grossWeightG":20,"netWeightG":12,"note":"Ngô ngọt"},{"id":228,"dishId":77,"ingredientId":6,"grossWeightG":5,"netWeightG":5,"note":"Bột năng"},{"id":229,"dishId":78,"ingredientId":4,"grossWeightG":35,"netWeightG":35,"note":"Bột mì"},{"id":230,"dishId":78,"ingredientId":67,"grossWeightG":22,"netWeightG":20,"note":"Thịt nạc"},{"id":231,"dishId":78,"ingredientId":92,"grossWeightG":12,"netWeightG":10,"note":"Trứng cút"},{"id":232,"dishId":79,"ingredientId":11,"grossWeightG":25,"netWeightG":25,"note":"Miến dong"},{"id":233,"dishId":79,"ingredientId":72,"grossWeightG":25,"netWeightG":20,"note":"Thịt gà"},{"id":234,"dishId":79,"ingredientId":85,"grossWeightG":5,"netWeightG":5,"note":"Tôm khô"},{"id":235,"dishId":79,"ingredientId":50,"grossWeightG":12,"netWeightG":10,"note":"Cần tây"},{"id":236,"dishId":80,"ingredientId":12,"grossWeightG":25,"netWeightG":25,"note":"Nui"},{"id":237,"dishId":80,"ingredientId":67,"grossWeightG":22,"netWeightG":20,"note":"Thịt nạc"},{"id":238,"dishId":80,"ingredientId":84,"grossWeightG":15,"netWeightG":10,"note":"Tôm thẻ"},{"id":239,"dishId":80,"ingredientId":39,"grossWeightG":18,"netWeightG":15,"note":"Cà rốt"},{"id":240,"dishId":81,"ingredientId":10,"grossWeightG":60,"netWeightG":60,"note":"Bánh canh"},{"id":241,"dishId":81,"ingredientId":79,"grossWeightG":25,"netWeightG":20,"note":"Cá lóc"},{"id":242,"dishId":81,"ingredientId":85,"grossWeightG":5,"netWeightG":5,"note":"Tôm khô"},{"id":243,"dishId":82,"ingredientId":7,"grossWeightG":60,"netWeightG":60,"note":"Bánh phở"},{"id":244,"dishId":82,"ingredientId":71,"grossWeightG":28,"netWeightG":25,"note":"Thịt bò bắp"},{"id":245,"dishId":82,"ingredientId":106,"grossWeightG":5,"netWeightG":5,"note":"Hành ngò"},{"id":246,"dishId":83,"ingredientId":13,"grossWeightG":40,"netWeightG":40,"note":"Mì trứng"},{"id":247,"dishId":83,"ingredientId":72,"grossWeightG":30,"netWeightG":25,"note":"Thịt gà"},{"id":248,"dishId":83,"ingredientId":24,"grossWeightG":10,"netWeightG":10,"note":"Hạt sen"},{"id":249,"dishId":84,"ingredientId":1,"grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ"},{"id":250,"dishId":84,"ingredientId":67,"grossWeightG":22,"netWeightG":20,"note":"Thịt nạc"},{"id":251,"dishId":84,"ingredientId":31,"grossWeightG":24,"netWeightG":20,"note":"Cải bó xôi"},{"id":252,"dishId":84,"ingredientId":39,"grossWeightG":12,"netWeightG":10,"note":"Cà rốt"},{"id":253,"dishId":85,"ingredientId":8,"grossWeightG":60,"netWeightG":60,"note":"Bún tươi"},{"id":254,"dishId":85,"ingredientId":71,"grossWeightG":28,"netWeightG":25,"note":"Thịt bò"},{"id":255,"dishId":85,"ingredientId":104,"grossWeightG":5,"netWeightG":5,"note":"Sả thơm"},{"id":256,"dishId":86,"ingredientId":8,"grossWeightG":60,"netWeightG":60,"note":"Bún tươi"},{"id":257,"dishId":86,"ingredientId":79,"grossWeightG":30,"netWeightG":25,"note":"Cá lóc"},{"id":258,"dishId":86,"ingredientId":28,"grossWeightG":30,"netWeightG":25,"note":"Rau muống non"},{"id":259,"dishId":87,"ingredientId":8,"grossWeightG":60,"netWeightG":60,"note":"Bún tươi"},{"id":260,"dishId":87,"ingredientId":67,"grossWeightG":22,"netWeightG":20,"note":"Thịt nạc mọc"},{"id":261,"dishId":87,"ingredientId":69,"grossWeightG":28,"netWeightG":20,"note":"Sườn heo"},{"id":262,"dishId":87,"ingredientId":85,"grossWeightG":3,"netWeightG":3,"note":"Tôm khô"},{"id":263,"dishId":88,"ingredientId":1,"grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ"},{"id":264,"dishId":88,"ingredientId":80,"grossWeightG":22,"netWeightG":20,"note":"Cá hồi"},{"id":265,"dishId":88,"ingredientId":95,"grossWeightG":15,"netWeightG":15,"note":"Phô mai"},{"id":266,"dishId":88,"ingredientId":39,"grossWeightG":12,"netWeightG":10,"note":"Cà rốt"},{"id":267,"dishId":89,"ingredientId":1,"grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ"},{"id":268,"dishId":89,"ingredientId":72,"grossWeightG":25,"netWeightG":20,"note":"Thịt gà"},{"id":269,"dishId":89,"ingredientId":46,"grossWeightG":18,"netWeightG":15,"note":"Nấm rơm"},{"id":270,"dishId":89,"ingredientId":39,"grossWeightG":12,"netWeightG":10,"note":"Cà rốt"},{"id":271,"dishId":90,"ingredientId":1,"grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ"},{"id":272,"dishId":90,"ingredientId":67,"grossWeightG":18,"netWeightG":16,"note":"Thịt nạc"},{"id":273,"dishId":90,"ingredientId":88,"grossWeightG":60,"netWeightG":15,"note":"Nghêu thịt"},{"id":274,"dishId":91,"ingredientId":1,"grossWeightG":20,"netWeightG":20,"note":"Gạo tẻ"},{"id":275,"dishId":91,"ingredientId":21,"grossWeightG":10,"netWeightG":10,"note":"Đậu xanh"},{"id":276,"dishId":91,"ingredientId":67,"grossWeightG":22,"netWeightG":20,"note":"Thịt nạc"},{"id":277,"dishId":92,"ingredientId":4,"grossWeightG":25,"netWeightG":25,"note":"Bột mì"},{"id":278,"dishId":92,"ingredientId":90,"grossWeightG":20,"netWeightG":20,"note":"Trứng gà"},{"id":279,"dishId":92,"ingredientId":78,"grossWeightG":10,"netWeightG":10,"note":"Chà bông"},{"id":280,"dishId":93,"ingredientId":93,"grossWeightG":150,"netWeightG":150,"note":"Sữa tươi"},{"id":281,"dishId":94,"ingredientId":94,"grossWeightG":100,"netWeightG":100,"note":"Sữa chua"},{"id":282,"dishId":95,"ingredientId":108,"grossWeightG":120,"netWeightG":120,"note":"Nước cam"},{"id":283,"dishId":95,"ingredientId":96,"grossWeightG":5,"netWeightG":5,"note":"Đường phèn"},{"id":284,"dishId":96,"ingredientId":109,"grossWeightG":150,"netWeightG":150,"note":"Sữa đậu nành"},{"id":285,"dishId":96,"ingredientId":96,"grossWeightG":5,"netWeightG":5,"note":"Đường phèn"},{"id":286,"dishId":97,"ingredientId":25,"grossWeightG":3,"netWeightG":3,"note":"Hạt chia"},{"id":287,"dishId":97,"ingredientId":96,"grossWeightG":8,"netWeightG":8,"note":"Đường phèn"},{"id":288,"dishId":98,"ingredientId":36,"grossWeightG":50,"netWeightG":40,"note":"Bí đao"},{"id":289,"dishId":98,"ingredientId":25,"grossWeightG":3,"netWeightG":3,"note":"Hạt chia"},{"id":290,"dishId":98,"ingredientId":96,"grossWeightG":8,"netWeightG":8,"note":"Đường phèn"},{"id":291,"dishId":99,"ingredientId":22,"grossWeightG":15,"netWeightG":15,"note":"Đậu đen"},{"id":292,"dishId":99,"ingredientId":96,"grossWeightG":8,"netWeightG":8,"note":"Đường phèn"},{"id":293,"dishId":100,"ingredientId":110,"grossWeightG":120,"netWeightG":120,"note":"Nước mía"}]'::jsonb) AS baseline(
      id BIGINT, "dishId" BIGINT, "ingredientId" BIGINT,
      "grossWeightG" NUMERIC, "netWeightG" NUMERIC, note TEXT)
    ON r.id = baseline.id AND r.dish_id = baseline."dishId"
      AND r.ingredient_id = baseline."ingredientId"
      AND r.gross_weight_g = baseline."grossWeightG" AND r.net_weight_g = baseline."netWeightG"
      AND pg_temp.repair_name(r.note) IS NOT DISTINCT FROM baseline.note
    WHERE d.nutrition_verified = FALSE;

INSERT INTO source_catalog_legacy_recipes(original_recipe_id, dish_name, ingredient_name, recipe)
    SELECT id, dish_name, ingredient_name,
      jsonb_build_object('id', id, 'dish_id', dish_id, 'ingredient_id', ingredient_id,
        'gross_weight_g', gross_weight_g, 'net_weight_g', net_weight_g, 'note', note)
    FROM seed_recipe_cleanup ON CONFLICT(original_recipe_id) DO NOTHING;

INSERT INTO source_catalog_legacy_nutrition(original_dish_id, dish_name, nutrition)
    SELECT dn.dish_id, d.name, to_jsonb(dn) FROM dish_nutrition dn JOIN dishes d ON d.id=dn.dish_id
    WHERE dn.dish_id IN (SELECT dish_id FROM seed_recipe_cleanup)
    ON CONFLICT(original_dish_id) DO NOTHING;

DELETE FROM dish_recipes r USING seed_recipe_cleanup old WHERE r.id = old.id;

DELETE FROM dish_nutrition dn WHERE dn.dish_id IN (SELECT dish_id FROM seed_recipe_cleanup)
    AND NOT EXISTS (SELECT 1 FROM dish_recipes r WHERE r.dish_id = dn.dish_id);

DROP TABLE seed_recipe_cleanup;

UPDATE source_catalog_import_runs SET source_documents='[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}]'::jsonb
    WHERE id=NULLIF(current_setting('kidmeal.import_run_id',true),'')::bigint;

DO $$ BEGIN
    IF (SELECT COUNT(*) FROM source_dish_ids) <> 172 OR 172 = 0 THEN
      RAISE EXCEPTION 'Source dish selection is incomplete; refusing deletion';
    END IF;
  END $$;

CREATE TEMP TABLE source_dish_cleanup ON COMMIT DROP AS
    SELECT d.id, to_jsonb(d) AS dish FROM dishes d
    WHERE NOT EXISTS (SELECT 1 FROM source_dish_ids source WHERE source.id = d.id);

INSERT INTO source_catalog_removed_dishes(original_dish_id, dish, source_documents)
    SELECT id, dish, '[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}]'::jsonb FROM source_dish_cleanup
    ON CONFLICT(original_dish_id) DO NOTHING;

DO $$
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
  $$;

DELETE FROM dish_recipes recipe USING source_dish_cleanup removed WHERE recipe.dish_id = removed.id;

DELETE FROM dishes dish USING source_dish_cleanup removed WHERE dish.id = removed.id;

DROP TABLE source_dish_cleanup;

DELETE FROM dish_recipes r
     USING dishes d
     WHERE r.dish_id = d.id
       AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
       AND (
         COALESCE(d.source_metadata->>'recipeStatus', '') IN ('MISSING_SOURCE_QUANTITIES', 'REFERENCE_RESTORED', 'APPROVED_REFERENCE', 'USER_APPROVED_REFERENCE', 'INCOMPLETE_RECIPE', 'VERIFIED_FROM_SOURCE_CATALOG')
         OR EXISTS (
           SELECT 1 FROM dish_recipes r2
           JOIN food_ingredients f2 ON f2.id = r2.ingredient_id
           WHERE r2.dish_id = d.id AND (f2.status <> 'ACTIVE' OR COALESCE(f2.source_metadata->>'kind', '') <> 'FOOD_COMPOSITION_IMAGE')
         )
       );

UPDATE dishes d
     SET nutrition_verified = FALSE
     WHERE d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
       AND NOT EXISTS (SELECT 1 FROM dish_recipes r WHERE r.dish_id = d.id)
       AND (d.status = 'ACTIVE' OR COALESCE(d.source_metadata->>'recipeStatus', '') <> 'VERIFIED_MANUAL');

CREATE TEMP TABLE reference_recipe_targets ON COMMIT DROP AS
     SELECT d.id, r."sourceKey" AS source_key, r."standardServingSizeG" AS serving_size, r.items
     FROM dishes d JOIN jsonb_to_recordset('[{"sourceKey":"sữa dinh dưỡng","name":"Sữa dinh dưỡng","standardServingSizeG":150,"items":[{"ingredientName":"Sữa bò tươi","grossWeightG":150,"netWeightG":150,"note":"Sữa tươi dinh dưỡng học đường","legacyRecipeId":1}]},{"sourceKey":"cơm","name":"Cơm","standardServingSizeG":100,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":50,"netWeightG":50,"note":"Gạo tẻ vo sạch nấu cơm mềm","legacyRecipeId":2}]},{"sourceKey":"cá lóc muối chiên","name":"Cá lóc muối chiên","standardServingSizeG":65,"items":[{"ingredientName":"Cá quả","grossWeightG":80,"netWeightG":48,"note":"Cá lóc (cá quả) phi lê sạch xương","legacyRecipeId":3},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":4}]},{"sourceKey":"canh tôm thẻ nấu khoai ngọt khoai cau","name":"Canh tôm thẻ nấu khoai ngọt, khoai cau","standardServingSizeG":120,"items":[{"ingredientName":"Tôm biển","grossWeightG":39,"netWeightG":18,"note":"Tôm tươi bóc vỏ băm nhỏ","legacyRecipeId":5},{"ingredientName":"Khoai sọ","grossWeightG":55,"netWeightG":45,"note":"Khoai gọt vỏ nấu canh dẻo","legacyRecipeId":6},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":7}]},{"sourceKey":"nho","name":"Nho","standardServingSizeG":50,"items":[{"ingredientName":"Nhãn","grossWeightG":91,"netWeightG":50,"note":"Quả chín ngọt bỏ hạt (Nho tươi)","legacyRecipeId":8}]},{"sourceKey":"thịt gà rô ti","name":"Thịt gà rô ti","standardServingSizeG":65,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":94,"netWeightG":45,"note":"Thịt gà ta lọc xương","legacyRecipeId":9},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":10}]},{"sourceKey":"canh cá lóc cải ngọt non","name":"Canh cá lóc cải ngọt non","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":11},{"ingredientName":"Cải ngọt","grossWeightG":45,"netWeightG":45,"note":"Rau cải ngọt non thái nhỏ","legacyRecipeId":12},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":13}]},{"sourceKey":"bánh su kem","name":"Bánh su kem","standardServingSizeG":40,"items":[{"ingredientName":"Bột mì","grossWeightG":12,"netWeightG":12,"note":"Vỏ bánh su kem","legacyRecipeId":14},{"ingredientName":"Trứng gà ta","grossWeightG":12,"netWeightG":10,"note":"Trứng gà làm nhân kem","legacyRecipeId":15},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi làm nhân kem","legacyRecipeId":16},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Chất béo làm bánh","legacyRecipeId":17}]},{"sourceKey":"cá lóc kho","name":"Cá lóc kho","standardServingSizeG":65,"items":[{"ingredientName":"Cá quả","grossWeightG":80,"netWeightG":48,"note":"Cá lóc (cá quả) phi lê sạch xương","legacyRecipeId":18},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":19}]},{"sourceKey":"canh thịt sườn hầm bắp bàu","name":"Canh thịt sườn hầm bắp bàu","standardServingSizeG":120,"items":[{"ingredientName":"Sườn lợn","grossWeightG":58,"netWeightG":25,"note":"Sườn lợn ninh nước dùng","legacyRecipeId":20},{"ingredientName":"Bầu","grossWeightG":54,"netWeightG":45,"note":"Bầu non gọt vỏ băm sợi","legacyRecipeId":21},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":22},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":23}]},{"sourceKey":"lê đường","name":"Lê đường","standardServingSizeG":50,"items":[{"ingredientName":"Ổi","grossWeightG":60,"netWeightG":50,"note":"Lê đường gọt vỏ cắt lát","legacyRecipeId":24}]},{"sourceKey":"thịt bò kho mặn tràng bắp cà rốt","name":"Thịt bò kho mặn tràng bắp, cà rốt","standardServingSizeG":65,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":38,"netWeightG":38,"note":"Thịt bò nạc thái mềm","legacyRecipeId":25},{"ingredientName":"Ngô bắp tươi","grossWeightG":27,"netWeightG":15,"note":"Ngô bắp ngọt tách hạt","legacyRecipeId":26},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt thái miếng","legacyRecipeId":27},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":28}]},{"sourceKey":"canh bầu cá lóc","name":"Canh bầu, cá lóc","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":29},{"ingredientName":"Bầu","grossWeightG":54,"netWeightG":45,"note":"Bầu non gọt vỏ băm sợi","legacyRecipeId":30},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":31}]},{"sourceKey":"rau câu dừa","name":"Rau câu dừa","standardServingSizeG":50,"items":[{"ingredientName":"Sữa bò tươi","grossWeightG":35,"netWeightG":35,"note":"Sữa tươi nấu thạch rau câu","legacyRecipeId":32},{"ingredientName":"Sữa đặc có đường Việt Nam","grossWeightG":8,"netWeightG":8,"note":"Sữa đặc làm thạch rau câu","legacyRecipeId":33}]},{"sourceKey":"thịt gà chiên nước mắm","name":"Thịt gà chiên nước mắm","standardServingSizeG":65,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":94,"netWeightG":45,"note":"Thịt gà ta lọc xương","legacyRecipeId":34},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":35}]},{"sourceKey":"canh cải bó xôi nấu thịt bò","name":"Canh cải bó xôi nấu thịt bò","standardServingSizeG":120,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt bò nạc băm/thái mềm","legacyRecipeId":36},{"ingredientName":"Rau ngót","grossWeightG":58,"netWeightG":45,"note":"Rau lá xanh đậm giàu sắt","legacyRecipeId":37},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":38}]},{"sourceKey":"thanh long","name":"Thanh Long","standardServingSizeG":60,"items":[{"ingredientName":"Bưởi","grossWeightG":92,"netWeightG":60,"note":"Thanh long cắt miếng vừa ăn","legacyRecipeId":39}]},{"sourceKey":"nước đậu rang","name":"Nước đậu rang","standardServingSizeG":140,"items":[{"ingredientName":"Đậu đen (hạt)","grossWeightG":18,"netWeightG":18,"note":"Đậu đen rang nấu nước mát","legacyRecipeId":40}]},{"sourceKey":"bún suông thịt heo trứng cút cà rốt","name":"Bún suông thịt heo, trứng cút, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Bún","grossWeightG":60,"netWeightG":60,"note":"Bún tươi sợi mềm","legacyRecipeId":41},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":42},{"ingredientName":"Trứng chim cút","grossWeightG":17,"netWeightG":15,"note":"Trứng chim cút bóc vỏ","legacyRecipeId":43},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":44},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":45}]},{"sourceKey":"nước cam","name":"Nước cam","standardServingSizeG":120,"items":[{"ingredientName":"Cam","grossWeightG":107,"netWeightG":80,"note":"Cam tươi vắt lấy nước","legacyRecipeId":46}]},{"sourceKey":"cháo bò bí hồ lô","name":"Cháo bò bí hồ lô","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":47},{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":22,"netWeightG":22,"note":"Thịt bò nạc băm/thái mỏng","legacyRecipeId":48},{"ingredientName":"Bí ngô","grossWeightG":29,"netWeightG":25,"note":"Bí đỏ ninh nhừ","legacyRecipeId":49},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":50}]},{"sourceKey":"yaourt","name":"Yaourt","standardServingSizeG":100,"items":[{"ingredientName":"Sữa chua","grossWeightG":100,"netWeightG":100,"note":"Sữa chua (Yaourt)","legacyRecipeId":51}]},{"sourceKey":"hủ tiếu nam vang (mực tim gan tôm)- cần tây","name":"Hủ tiếu nam vang (mực, tim, gan, tôm)- cần tây","standardServingSizeG":155,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":52},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":53},{"ingredientName":"Cá basa, phi lê","grossWeightG":15,"netWeightG":15,"note":"Thủy hải sản tươi mềm","legacyRecipeId":54},{"ingredientName":"Thịt lợn, nạc vai","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn giàu sắt và kẽm","legacyRecipeId":55},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":56},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":57}]},{"sourceKey":"nha đam hạt chia đường phèn","name":"Nha đam, hạt chia, đường phèn","standardServingSizeG":130,"items":[{"ingredientName":"Bưởi","grossWeightG":77,"netWeightG":50,"note":"Nguyên liệu thanh nhiệt (Nha đam, hạt chia, đường phèn)","legacyRecipeId":58},{"ingredientName":"Vừng (đen, trắng)","grossWeightG":3,"netWeightG":3,"note":"Hạt chia / hạt dinh dưỡng","legacyRecipeId":59}]},{"sourceKey":"súp óc heo gà xé trứng cút cải đỏ","name":"Súp óc heo, gà xé, trứng cút, cải đỏ","standardServingSizeG":155,"items":[{"ingredientName":"Ngô bắp tươi","grossWeightG":33,"netWeightG":18,"note":"Bắp ngọt nấu súp","legacyRecipeId":60},{"ingredientName":"Củ sắn dây","grossWeightG":9,"netWeightG":8,"note":"Bột sánh nấu súp","legacyRecipeId":61},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":62},{"ingredientName":"Thịt lợn, nạc vai","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn giàu sắt và kẽm","legacyRecipeId":63},{"ingredientName":"Trứng chim cút","grossWeightG":17,"netWeightG":15,"note":"Trứng chim cút bóc vỏ","legacyRecipeId":64},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":65},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":66}]},{"sourceKey":"sữa đậu nành","name":"Sữa đậu nành","standardServingSizeG":150,"items":[{"ingredientName":"Sữa đậu nành (100g đậu/lít)","grossWeightG":150,"netWeightG":150,"note":"Sữa đậu nành nấu chín","legacyRecipeId":67}]},{"sourceKey":"bánh bao thịt","name":"Bánh bao thịt","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":68},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":69},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":70},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":71}]},{"sourceKey":"thịt heo ram mặn cà rốt","name":"Thịt heo ram mặn cà rốt","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":46,"netWeightG":45,"note":"Thịt lợn nạc","legacyRecipeId":72},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt thái miếng","legacyRecipeId":73},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":74}]},{"sourceKey":"canh chua cá hú khóm đậu bắp cà chua bạc hà","name":"Canh chua cá hú, khóm, đậu bắp, cà chua, bạc hà","standardServingSizeG":120,"items":[{"ingredientName":"Cá basa, phi lê","grossWeightG":25,"netWeightG":25,"note":"Cá da trơn (cá hú/basa) nấu canh","legacyRecipeId":75},{"ingredientName":"Cà chua","grossWeightG":26,"netWeightG":25,"note":"Cà chua chín tạo vị thanh","legacyRecipeId":76},{"ingredientName":"Giá đậu xanh","grossWeightG":26,"netWeightG":25,"note":"Rau nấu canh chua miền Nam","legacyRecipeId":77},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":78},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":79}]},{"sourceKey":"táo tây","name":"Táo tây","standardServingSizeG":50,"items":[{"ingredientName":"Ổi","grossWeightG":60,"netWeightG":50,"note":"Táo ngọt gọt vỏ cắt lát","legacyRecipeId":80}]},{"sourceKey":"cá ngừ chiên sốt cà chua","name":"Cá Ngừ chiên sốt cà chua","standardServingSizeG":65,"items":[{"ingredientName":"Cá ngừ","grossWeightG":78,"netWeightG":45,"note":"Cá ngừ phi lê sạch xương","legacyRecipeId":81},{"ingredientName":"Cà chua","grossWeightG":21,"netWeightG":20,"note":"Cà chua chín sốt mềm","legacyRecipeId":82},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":83}]},{"sourceKey":"canh gà hầm bách vị (hạt sen cà rốt nấm hương sup lơ)","name":"Canh gà hầm bách vị (hạt sen, cà rốt, nấm hương, sup lơ)","standardServingSizeG":120,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":52,"netWeightG":25,"note":"Thịt gà ta ninh mềm","legacyRecipeId":84},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":24,"netWeightG":20,"note":"Cà rốt tỉa hoa/thái hạt lựu","legacyRecipeId":85},{"ingredientName":"Súp lơ xanh","grossWeightG":41,"netWeightG":25,"note":"Rau củ hầm canh ngọt nước","legacyRecipeId":86},{"ingredientName":"Đậu Hà lan (hạt)","grossWeightG":15,"netWeightG":15,"note":"Hạt hầm bùi mềm giàu đạm","legacyRecipeId":87},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":88}]},{"sourceKey":"đu đủ chín","name":"Đu đủ chín","standardServingSizeG":60,"items":[{"ingredientName":"Đu đủ chín","grossWeightG":80,"netWeightG":60,"note":"Đu đủ chín gọt vỏ cắt miếng","legacyRecipeId":89}]},{"sourceKey":"thịt heo tôm rim nước dừa","name":"Thịt heo, tôm rim nước dừa","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":26,"netWeightG":25,"note":"Thịt lợn nạc","legacyRecipeId":90},{"ingredientName":"Tôm biển","grossWeightG":43,"netWeightG":20,"note":"Tôm tươi bóc vỏ","legacyRecipeId":91},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":92}]},{"sourceKey":"canh thịt bò cải bó xôi","name":"Canh thịt bò, cải bó xôi","standardServingSizeG":120,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt bò nạc băm/thái mềm","legacyRecipeId":93},{"ingredientName":"Rau ngót","grossWeightG":58,"netWeightG":45,"note":"Rau lá xanh đậm giàu sắt","legacyRecipeId":94},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":95}]},{"sourceKey":"bánh flan","name":"Bánh Flan","standardServingSizeG":50,"items":[{"ingredientName":"Trứng gà ta","grossWeightG":23,"netWeightG":20,"note":"Trứng gà tươi","legacyRecipeId":96},{"ingredientName":"Sữa bò tươi","grossWeightG":25,"netWeightG":25,"note":"Sữa tươi tiệt trùng","legacyRecipeId":97},{"ingredientName":"Sữa đặc có đường Việt Nam","grossWeightG":8,"netWeightG":8,"note":"Sữa đặc có đường","legacyRecipeId":98}]},{"sourceKey":"thịt gà xào mặn sả đậu phọng","name":"Thịt gà xào mặn, sả, đậu phọng","standardServingSizeG":65,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":94,"netWeightG":45,"note":"Thịt gà ta lọc xương","legacyRecipeId":99},{"ingredientName":"Lạc hạt","grossWeightG":6,"netWeightG":6,"note":"Lạc hạt (đậu phộng) rang","legacyRecipeId":100},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":101}]},{"sourceKey":"canh thịt heo nấm rơm mướp tôm khô","name":"Canh thịt heo nấm rơm, mướp, tôm khô","standardServingSizeG":120,"items":[{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước canh","legacyRecipeId":102},{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":103},{"ingredientName":"Mướp","grossWeightG":40,"netWeightG":35,"note":"Mướp hương gọt vỏ thái lát","legacyRecipeId":104},{"ingredientName":"Súp lơ xanh","grossWeightG":41,"netWeightG":25,"note":"Rau củ hầm canh ngọt nước","legacyRecipeId":105},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":106}]},{"sourceKey":"dưa hấu","name":"Dưa hấu","standardServingSizeG":70,"items":[{"ingredientName":"Dưa hấu","grossWeightG":135,"netWeightG":70,"note":"Dưa hấu chín bỏ vỏ cắt miếng","legacyRecipeId":107}]},{"sourceKey":"trứng vịt chiên thịt cà chua","name":"Trứng vịt chiên thịt, cà chua","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":26,"netWeightG":25,"note":"Thịt lợn nạc","legacyRecipeId":108},{"ingredientName":"Trứng vịt","grossWeightG":40,"netWeightG":35,"note":"Trứng vịt tươi","legacyRecipeId":109},{"ingredientName":"Cà chua","grossWeightG":21,"netWeightG":20,"note":"Cà chua chín sốt mềm","legacyRecipeId":110},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":111}]},{"sourceKey":"canh rau ngót cá lóc tôm khô","name":"Canh rau ngót cá lóc, tôm khô","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":112},{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước canh","legacyRecipeId":113},{"ingredientName":"Rau ngót","grossWeightG":58,"netWeightG":45,"note":"Rau ngót tuốt lá rửa sạch","legacyRecipeId":114},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":115}]},{"sourceKey":"quýt","name":"Quýt","standardServingSizeG":60,"items":[{"ingredientName":"Quít","grossWeightG":81,"netWeightG":60,"note":"Quýt chín bóc vỏ bỏ hạt","legacyRecipeId":116}]},{"sourceKey":"chanh dây hạt chia đường phèn","name":"Chanh dây, hạt chia, đường phèn","standardServingSizeG":130,"items":[{"ingredientName":"Cam","grossWeightG":67,"netWeightG":50,"note":"Trái cây tươi pha Chanh dây, hạt chia, đường phèn","legacyRecipeId":117},{"ingredientName":"Vừng (đen, trắng)","grossWeightG":3,"netWeightG":3,"note":"Hạt chia / hạt dinh dưỡng","legacyRecipeId":118}]},{"sourceKey":"miến gà tôm khô cần tàu","name":"Miến gà, tôm khô, cần tàu","standardServingSizeG":155,"items":[{"ingredientName":"Miến dong","grossWeightG":25,"netWeightG":25,"note":"Miến dong mềm","legacyRecipeId":119},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":120},{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước","legacyRecipeId":121},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":122},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":123}]},{"sourceKey":"nui thịt bằm tôm cà rốt","name":"Nui thịt bằm, tôm, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Bột mì","grossWeightG":28,"netWeightG":28,"note":"Sợi mì / nui chế biến từ bột mì","legacyRecipeId":124},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":125},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":126},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":127},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":128}]},{"sourceKey":"sâm bí đao","name":"Sâm bí đao","standardServingSizeG":140,"items":[{"ingredientName":"Bí đao (bí xanh)","grossWeightG":62,"netWeightG":45,"note":"Bí đao nấu nước sâm","legacyRecipeId":129}]},{"sourceKey":"bánh canh bột xắt tôm khô cá lóc","name":"Bánh canh bột xắt tôm khô, cá lóc","standardServingSizeG":75,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":130},{"ingredientName":"Cá quả","grossWeightG":37,"netWeightG":22,"note":"Cá lóc (cá quả) lọc sạch xương","legacyRecipeId":131},{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước","legacyRecipeId":132},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":133}]},{"sourceKey":"phở bò ngò gai quế","name":"Phở bò, ngò gai, quế","standardServingSizeG":155,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":134},{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":22,"netWeightG":22,"note":"Thịt bò nạc băm/thái mỏng","legacyRecipeId":135},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":136},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":137}]},{"sourceKey":"sữa trái cây","name":"Sữa trái cây","standardServingSizeG":140,"items":[{"ingredientName":"Sữa bò tươi","grossWeightG":110,"netWeightG":110,"note":"Sữa tươi","legacyRecipeId":138},{"ingredientName":"Cam","grossWeightG":33,"netWeightG":25,"note":"Trái cây tươi phối hợp","legacyRecipeId":139}]},{"sourceKey":"bánh pateso thịt","name":"Bánh pateso thịt","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":140},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":141},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":142},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà ta","legacyRecipeId":143},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":144}]},{"sourceKey":"thịt sườn heo khìa nước dừa","name":"Thịt sườn heo khìa nước dừa","standardServingSizeG":65,"items":[{"ingredientName":"Sườn lợn","grossWeightG":105,"netWeightG":45,"note":"Sườn lợn non chặt miếng","legacyRecipeId":145},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":146}]},{"sourceKey":"canh bí đao cá lóc tôm khô","name":"Canh bí đao cá lóc, tôm khô","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":147},{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước canh","legacyRecipeId":148},{"ingredientName":"Bí đao (bí xanh)","grossWeightG":62,"netWeightG":45,"note":"Bí đao gọt vỏ thái mỏng","legacyRecipeId":149},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":150}]},{"sourceKey":"thịt bò xào đậu que","name":"Thịt bò xào đậu que","standardServingSizeG":65,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":38,"netWeightG":38,"note":"Thịt bò nạc thái mềm","legacyRecipeId":151},{"ingredientName":"Đậu cô ve","grossWeightG":28,"netWeightG":25,"note":"Đậu cô ve (đậu que) non","legacyRecipeId":152},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":153}]},{"sourceKey":"canh chua cá hú cà chua đậu bắp khóm","name":"Canh chua cá hú, cà chua, đậu bắp, khóm","standardServingSizeG":120,"items":[{"ingredientName":"Cá basa, phi lê","grossWeightG":25,"netWeightG":25,"note":"Cá da trơn (cá hú/basa) nấu canh","legacyRecipeId":154},{"ingredientName":"Cà chua","grossWeightG":26,"netWeightG":25,"note":"Cà chua chín tạo vị thanh","legacyRecipeId":155},{"ingredientName":"Giá đậu xanh","grossWeightG":26,"netWeightG":25,"note":"Rau nấu canh chua miền Nam","legacyRecipeId":156},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":157},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":158}]},{"sourceKey":"dưa hoàng kim","name":"Dưa hoàng kim","standardServingSizeG":60,"items":[{"ingredientName":"Đu đủ chín","grossWeightG":80,"netWeightG":60,"note":"Dưa hoàng kim gọt vỏ cắt miếng","legacyRecipeId":159}]},{"sourceKey":"thịt kho trứng cút","name":"Thịt kho trứng cút","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nửa nạc, nửa mỡ","grossWeightG":41,"netWeightG":40,"note":"Thịt ba chỉ (nửa nạc nửa mỡ)","legacyRecipeId":160},{"ingredientName":"Trứng chim cút","grossWeightG":25,"netWeightG":22,"note":"Trứng chim cút bóc vỏ","legacyRecipeId":161},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":162}]},{"sourceKey":"canh thịt bò hầm đậu đỏ","name":"Canh thịt bò hầm đậu đỏ","standardServingSizeG":120,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt bò nạc băm/thái mềm","legacyRecipeId":163},{"ingredientName":"Đậu Hà lan (hạt)","grossWeightG":15,"netWeightG":15,"note":"Hạt hầm bùi mềm giàu đạm","legacyRecipeId":164},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":165}]},{"sourceKey":"canh thịt bằm rau dền muồng tơi","name":"Canh thịt bằm rau dền, muồng tơi","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":166},{"ingredientName":"Rau mồng tơi","grossWeightG":54,"netWeightG":45,"note":"Rau mồng tơi non mềm","legacyRecipeId":167},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":168}]},{"sourceKey":"rau câu giòn sơn thủy","name":"Rau câu giòn sơn thủy","standardServingSizeG":50,"items":[{"ingredientName":"Sữa bò tươi","grossWeightG":35,"netWeightG":35,"note":"Sữa tươi nấu thạch rau câu","legacyRecipeId":169},{"ingredientName":"Sữa đặc có đường Việt Nam","grossWeightG":8,"netWeightG":8,"note":"Sữa đặc làm thạch rau câu","legacyRecipeId":170}]},{"sourceKey":"cơm dương châu (đậu đũa cà rốt lạp xưởng thịt nạc trứng)","name":"Cơm Dương Châu (đậu đũa, cà rốt, lạp xưởng, thịt nạc, trứng)","standardServingSizeG":120,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":45,"netWeightG":45,"note":"Gạo tẻ nấu cơm chiên","legacyRecipeId":171},{"ingredientName":"Đậu đũa","grossWeightG":11,"netWeightG":10,"note":"Đậu đũa thái hạt lựu","legacyRecipeId":172},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":12,"netWeightG":10,"note":"Cà rốt thái hạt lựu","legacyRecipeId":173},{"ingredientName":"Thịt lợn nửa nạc, nửa mỡ","grossWeightG":10,"netWeightG":10,"note":"Lạp xưởng thịt thái hạt lựu","legacyRecipeId":174},{"ingredientName":"Thịt lợn nạc","grossWeightG":10,"netWeightG":10,"note":"Thịt lợn nạc thái nhỏ","legacyRecipeId":175},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà chiên","legacyRecipeId":176},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật","legacyRecipeId":177}]},{"sourceKey":"canh gà nấu nấm linh chi cà rốt táo đỏ","name":"Canh gà nấu nấm linh chi, cà rốt, táo đỏ","standardServingSizeG":120,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":52,"netWeightG":25,"note":"Thịt gà ta ninh mềm","legacyRecipeId":178},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":24,"netWeightG":20,"note":"Cà rốt tỉa hoa/thái hạt lựu","legacyRecipeId":179},{"ingredientName":"Súp lơ xanh","grossWeightG":41,"netWeightG":25,"note":"Rau củ hầm canh ngọt nước","legacyRecipeId":180},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":181}]},{"sourceKey":"mì gà tiềm hạt sen","name":"Mì gà tiềm, hạt sen","standardServingSizeG":155,"items":[{"ingredientName":"Bột mì","grossWeightG":28,"netWeightG":28,"note":"Sợi mì / nui chế biến từ bột mì","legacyRecipeId":182},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":183},{"ingredientName":"Đậu Hà lan (hạt)","grossWeightG":12,"netWeightG":12,"note":"Hạt sen / hạt đậu ninh mềm","legacyRecipeId":184},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":185}]},{"sourceKey":"cháo thịt bằm cải bó xôi cà rốt","name":"Cháo thịt bằm, cải bó xôi, cà rốt","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":186},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":187},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":188},{"ingredientName":"Rau ngót","grossWeightG":26,"netWeightG":20,"note":"Rau xanh băm nhuyễn","legacyRecipeId":189},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":190}]},{"sourceKey":"bánh canh cá lóc cà rốt","name":"Bánh canh cá lóc, cà rốt","standardServingSizeG":75,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":191},{"ingredientName":"Cá quả","grossWeightG":37,"netWeightG":22,"note":"Cá lóc (cá quả) lọc sạch xương","legacyRecipeId":192},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":193},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":194}]},{"sourceKey":"trà đào hạt chia đường phèn","name":"Trà đào, hạt chia, đường phèn","standardServingSizeG":130,"items":[{"ingredientName":"Cam","grossWeightG":67,"netWeightG":50,"note":"Trái cây tươi pha Trà đào, hạt chia, đường phèn","legacyRecipeId":195},{"ingredientName":"Vừng (đen, trắng)","grossWeightG":3,"netWeightG":3,"note":"Hạt chia / hạt dinh dưỡng","legacyRecipeId":196}]},{"sourceKey":"hủ tiếu (gà tôm mực) cà rốt","name":"Hủ tiếu (gà, tôm, mực) cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":197},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":198},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":199},{"ingredientName":"Cá basa, phi lê","grossWeightG":15,"netWeightG":15,"note":"Thủy hải sản tươi mềm","legacyRecipeId":200},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":201},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":202}]},{"sourceKey":"sữa đậu xanh","name":"Sữa đậu xanh","standardServingSizeG":150,"items":[{"ingredientName":"Đậu xanh (đậu tắt)","grossWeightG":18,"netWeightG":18,"note":"Đậu xanh đãi vỏ nấu sữa","legacyRecipeId":203},{"ingredientName":"Sữa bò tươi","grossWeightG":80,"netWeightG":80,"note":"Sữa tươi phối hợp","legacyRecipeId":204}]},{"sourceKey":"bánh mêxico mặn","name":"Bánh mêxico mặn","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":205},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":206},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":207},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà ta","legacyRecipeId":208},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":209}]},{"sourceKey":"thịt ram mặn","name":"Thịt ram mặn","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":46,"netWeightG":45,"note":"Thịt lợn nạc","legacyRecipeId":210},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":211}]},{"sourceKey":"canh cá lóc nấu bầu","name":"Canh cá lóc nấu bầu","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":212},{"ingredientName":"Bầu","grossWeightG":54,"netWeightG":45,"note":"Bầu non gọt vỏ băm sợi","legacyRecipeId":213},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":214}]},{"sourceKey":"hồng trứng","name":"Hồng trứng","standardServingSizeG":50,"items":[{"ingredientName":"Vải","grossWeightG":96,"netWeightG":50,"note":"Hồng trứng chín ngọt gọt vỏ","legacyRecipeId":215}]},{"sourceKey":"trứng chưng thịt bún tàu nấm mèo cải đỏ","name":"Trứng chưng thịt, bún tàu, nấm mèo, cải đỏ","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":26,"netWeightG":25,"note":"Thịt lợn nạc","legacyRecipeId":216},{"ingredientName":"Trứng gà ta","grossWeightG":35,"netWeightG":30,"note":"Trứng gà ta","legacyRecipeId":217},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt thái miếng","legacyRecipeId":218},{"ingredientName":"Miến dong","grossWeightG":6,"netWeightG":6,"note":"Miến dong (bún tàu) cắt ngắn","legacyRecipeId":219},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":220}]},{"sourceKey":"canh gà nấu ngũ vị (cà rốt nấm bông cải…)","name":"Canh gà nấu ngũ vị (cà rốt, nấm, bông cải…)","standardServingSizeG":120,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":52,"netWeightG":25,"note":"Thịt gà ta ninh mềm","legacyRecipeId":221},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":24,"netWeightG":20,"note":"Cà rốt tỉa hoa/thái hạt lựu","legacyRecipeId":222},{"ingredientName":"Súp lơ xanh","grossWeightG":41,"netWeightG":25,"note":"Rau củ hầm canh ngọt nước","legacyRecipeId":223},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":224}]},{"sourceKey":"táo","name":"Táo","standardServingSizeG":50,"items":[{"ingredientName":"Ổi","grossWeightG":60,"netWeightG":50,"note":"Táo ngọt gọt vỏ cắt lát","legacyRecipeId":225}]},{"sourceKey":"canh thịt rau cải cúc","name":"Canh thịt rau cải cúc","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":226},{"ingredientName":"Cải cúc","grossWeightG":60,"netWeightG":45,"note":"Rau cải cúc (tần ô) non","legacyRecipeId":227},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":228}]},{"sourceKey":"bánh gang","name":"Bánh gang","standardServingSizeG":50,"items":[{"ingredientName":"Trứng gà ta","grossWeightG":23,"netWeightG":20,"note":"Trứng gà tươi","legacyRecipeId":229},{"ingredientName":"Sữa bò tươi","grossWeightG":25,"netWeightG":25,"note":"Sữa tươi tiệt trùng","legacyRecipeId":230},{"ingredientName":"Sữa đặc có đường Việt Nam","grossWeightG":8,"netWeightG":8,"note":"Sữa đặc có đường","legacyRecipeId":231}]},{"sourceKey":"cá điêu hồng chiên sốt cà chua","name":"Cá điêu hồng chiên sốt cà chua","standardServingSizeG":65,"items":[{"ingredientName":"Cá rô phi","grossWeightG":79,"netWeightG":45,"note":"Cá điêu hồng phi lê","legacyRecipeId":232},{"ingredientName":"Cà chua","grossWeightG":21,"netWeightG":20,"note":"Cà chua chín sốt mềm","legacyRecipeId":233},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":234}]},{"sourceKey":"canh thịt bò hầm khoai môn ngò gai","name":"Canh thịt bò hầm khoai môn, ngò gai","standardServingSizeG":120,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt bò nạc băm/thái mềm","legacyRecipeId":235},{"ingredientName":"Khoai môn","grossWeightG":52,"netWeightG":45,"note":"Khoai môn ninh mềm","legacyRecipeId":236},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":237}]},{"sourceKey":"dưa lê","name":"Dưa lê","standardServingSizeG":60,"items":[{"ingredientName":"Đu đủ chín","grossWeightG":80,"netWeightG":60,"note":"Dưa lê gọt vỏ cắt miếng","legacyRecipeId":238}]},{"sourceKey":"thịt trứng chiên","name":"Thịt trứng chiên","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":26,"netWeightG":25,"note":"Thịt lợn nạc","legacyRecipeId":239},{"ingredientName":"Trứng gà ta","grossWeightG":35,"netWeightG":30,"note":"Trứng gà ta","legacyRecipeId":240},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":241}]},{"sourceKey":"canh thịt bằm bắp bàu muồng tơi","name":"Canh thịt bằm, bắp bàu, muồng tơi","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":242},{"ingredientName":"Rau mồng tơi","grossWeightG":54,"netWeightG":45,"note":"Rau mồng tơi non mềm","legacyRecipeId":243},{"ingredientName":"Bầu","grossWeightG":54,"netWeightG":45,"note":"Bầu non gọt vỏ băm sợi","legacyRecipeId":244},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":245},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":246}]},{"sourceKey":"quýt đường","name":"Quýt đường","standardServingSizeG":60,"items":[{"ingredientName":"Quít","grossWeightG":81,"netWeightG":60,"note":"Quýt chín bóc vỏ bỏ hạt","legacyRecipeId":247}]},{"sourceKey":"nước sâm rong biển hoa cúc","name":"Nước Sâm rong biển, hoa cúc","standardServingSizeG":130,"items":[{"ingredientName":"Bưởi","grossWeightG":77,"netWeightG":50,"note":"Nguyên liệu thanh nhiệt (Nước Sâm rong biển, hoa cúc)","legacyRecipeId":248}]},{"sourceKey":"bún bò huế ngò gai quế","name":"Bún bò huế, ngò gai, quế","standardServingSizeG":155,"items":[{"ingredientName":"Bún","grossWeightG":60,"netWeightG":60,"note":"Bún tươi sợi mềm","legacyRecipeId":249},{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":22,"netWeightG":22,"note":"Thịt bò nạc băm/thái mỏng","legacyRecipeId":250},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":251},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":252}]},{"sourceKey":"nui nấu gan tôm mực cải đỏ","name":"Nui nấu gan, tôm, mực cải đỏ","standardServingSizeG":155,"items":[{"ingredientName":"Bột mì","grossWeightG":28,"netWeightG":28,"note":"Sợi mì / nui chế biến từ bột mì","legacyRecipeId":253},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":254},{"ingredientName":"Cá basa, phi lê","grossWeightG":15,"netWeightG":15,"note":"Thủy hải sản tươi mềm","legacyRecipeId":255},{"ingredientName":"Thịt lợn, nạc vai","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn giàu sắt và kẽm","legacyRecipeId":256},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":257},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":258}]},{"sourceKey":"nước trà sả tắc hạt chia mật ong","name":"Nước trà sả tắc, hạt chia, mật ong","standardServingSizeG":130,"items":[{"ingredientName":"Cam","grossWeightG":67,"netWeightG":50,"note":"Trái cây tươi pha Nước trà sả tắc, hạt chia, mật ong","legacyRecipeId":259},{"ingredientName":"Vừng (đen, trắng)","grossWeightG":3,"netWeightG":3,"note":"Hạt chia / hạt dinh dưỡng","legacyRecipeId":260}]},{"sourceKey":"bún cá lóc rau muống non","name":"Bún cá lóc, rau muống non","standardServingSizeG":155,"items":[{"ingredientName":"Bún","grossWeightG":60,"netWeightG":60,"note":"Bún tươi sợi mềm","legacyRecipeId":261},{"ingredientName":"Cá quả","grossWeightG":37,"netWeightG":22,"note":"Cá lóc (cá quả) lọc sạch xương","legacyRecipeId":262},{"ingredientName":"Rau muống","grossWeightG":29,"netWeightG":25,"note":"Rau muống non thái nhỏ","legacyRecipeId":263},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":264}]},{"sourceKey":"súp trứng cút gà xé tôm cải đỏ","name":"Súp trứng cút, gà xé, tôm, cải đỏ","standardServingSizeG":155,"items":[{"ingredientName":"Ngô bắp tươi","grossWeightG":33,"netWeightG":18,"note":"Bắp ngọt nấu súp","legacyRecipeId":265},{"ingredientName":"Củ sắn dây","grossWeightG":9,"netWeightG":8,"note":"Bột sánh nấu súp","legacyRecipeId":266},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":267},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":268},{"ingredientName":"Trứng chim cút","grossWeightG":17,"netWeightG":15,"note":"Trứng chim cút bóc vỏ","legacyRecipeId":269},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":270},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":271}]},{"sourceKey":"bánh bông lan thịt chà bông","name":"Bánh bông lan thịt chà bông","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":272},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":273},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":274},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà ta","legacyRecipeId":275},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":276}]},{"sourceKey":"canh khoai mỡ thịt bằm tôm khô","name":"Canh khoai mỡ thịt bằm, tôm khô","standardServingSizeG":120,"items":[{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước canh","legacyRecipeId":277},{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":278},{"ingredientName":"Khoai sọ","grossWeightG":55,"netWeightG":45,"note":"Khoai gọt vỏ nấu canh dẻo","legacyRecipeId":279},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":280}]},{"sourceKey":"chuối cau","name":"Chuối cau","standardServingSizeG":50,"items":[{"ingredientName":"Chuối tiêu","grossWeightG":71,"netWeightG":50,"note":"Chuối chín bóc vỏ","legacyRecipeId":281}]},{"sourceKey":"gà muối sả chiên","name":"Gà muối sả chiên","standardServingSizeG":65,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":94,"netWeightG":45,"note":"Thịt gà ta lọc xương","legacyRecipeId":282},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":283}]},{"sourceKey":"canh chả cá tần ô","name":"Canh chả cá, tần ô","standardServingSizeG":120,"items":[{"ingredientName":"Cá thu","grossWeightG":31,"netWeightG":20,"note":"Chả cá quết dai mềm","legacyRecipeId":284},{"ingredientName":"Cải cúc","grossWeightG":60,"netWeightG":45,"note":"Rau cải cúc (tần ô) non","legacyRecipeId":285},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":286}]},{"sourceKey":"thịt bò xào khóm","name":"Thịt bò xào khóm","standardServingSizeG":65,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":38,"netWeightG":38,"note":"Thịt bò nạc thái mềm","legacyRecipeId":287},{"ingredientName":"Cà chua","grossWeightG":21,"netWeightG":20,"note":"Quả chua ngọt rim/xào mềm","legacyRecipeId":288},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":289}]},{"sourceKey":"canh thịt gà hầm nấm các loại","name":"Canh thịt gà hầm nấm các loại","standardServingSizeG":120,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":52,"netWeightG":25,"note":"Thịt gà ta ninh mềm","legacyRecipeId":290},{"ingredientName":"Súp lơ xanh","grossWeightG":41,"netWeightG":25,"note":"Rau củ hầm canh ngọt nước","legacyRecipeId":291},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":292}]},{"sourceKey":"thịt heo kho","name":"Thịt heo kho","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":46,"netWeightG":45,"note":"Thịt lợn nạc","legacyRecipeId":293},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":294}]},{"sourceKey":"canh chua cá hú khóm cà chua đậu bắp","name":"Canh chua cá hú, khóm, cà chua, đậu bắp","standardServingSizeG":120,"items":[{"ingredientName":"Cá basa, phi lê","grossWeightG":25,"netWeightG":25,"note":"Cá da trơn (cá hú/basa) nấu canh","legacyRecipeId":295},{"ingredientName":"Cà chua","grossWeightG":26,"netWeightG":25,"note":"Cà chua chín tạo vị thanh","legacyRecipeId":296},{"ingredientName":"Giá đậu xanh","grossWeightG":26,"netWeightG":25,"note":"Rau nấu canh chua miền Nam","legacyRecipeId":297},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":298},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":299}]},{"sourceKey":"canh cá lóc cải xanh non","name":"Canh cá lóc cải xanh non","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":300},{"ingredientName":"Cải xanh","grossWeightG":59,"netWeightG":45,"note":"Cải xanh non thái nhỏ","legacyRecipeId":301},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":302}]},{"sourceKey":"hủ tiếu thập cẩm (thịt bằm tôm mực) cải cúc","name":"Hủ tiếu thập cẩm (thịt bằm, tôm, mực) cải cúc","standardServingSizeG":155,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":303},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":304},{"ingredientName":"Cá basa, phi lê","grossWeightG":15,"netWeightG":15,"note":"Thủy hải sản tươi mềm","legacyRecipeId":305},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":306},{"ingredientName":"Cải cúc","grossWeightG":33,"netWeightG":25,"note":"Rau cải cúc non","legacyRecipeId":307},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":308}]},{"sourceKey":"nước chanh dây hạt chia mật ong","name":"Nước chanh dây, hạt chia, mật ong","standardServingSizeG":130,"items":[{"ingredientName":"Cam","grossWeightG":67,"netWeightG":50,"note":"Trái cây tươi pha Nước chanh dây, hạt chia, mật ong","legacyRecipeId":309},{"ingredientName":"Vừng (đen, trắng)","grossWeightG":3,"netWeightG":3,"note":"Hạt chia / hạt dinh dưỡng","legacyRecipeId":310}]},{"sourceKey":"cháo cá bí đỏ","name":"Cháo cá, bí đỏ","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":311},{"ingredientName":"Bí ngô","grossWeightG":29,"netWeightG":25,"note":"Bí đỏ ninh nhừ","legacyRecipeId":312},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":313}]},{"sourceKey":"bún mọc sườn heo tôm khô cà rốt","name":"Bún mọc, sườn heo tôm khô, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Bún","grossWeightG":60,"netWeightG":60,"note":"Bún tươi sợi mềm","legacyRecipeId":314},{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước","legacyRecipeId":315},{"ingredientName":"Sườn lợn","grossWeightG":47,"netWeightG":20,"note":"Sườn lợn ninh mềm","legacyRecipeId":316},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":317},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":318},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":319}]},{"sourceKey":"bánh ngọt kẹp chà bông","name":"Bánh ngọt kẹp chà bông","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":320},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":321},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":322},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà ta","legacyRecipeId":323},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":324}]},{"sourceKey":"tôm sườn heo rim mặn","name":"Tôm, sườn heo rim mặn","standardServingSizeG":65,"items":[{"ingredientName":"Sườn lợn","grossWeightG":105,"netWeightG":45,"note":"Sườn lợn non chặt miếng","legacyRecipeId":325},{"ingredientName":"Tôm biển","grossWeightG":43,"netWeightG":20,"note":"Tôm tươi bóc vỏ","legacyRecipeId":326},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":327}]},{"sourceKey":"canh thịt bằm rau ngót","name":"Canh thịt bằm rau ngót","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":328},{"ingredientName":"Rau ngót","grossWeightG":58,"netWeightG":45,"note":"Rau ngót tuốt lá rửa sạch","legacyRecipeId":329},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":330}]},{"sourceKey":"canh thịt bằm tôm khô mướp mấm rơm","name":"Canh thịt bằm, tôm khô, mướp, mấm rơm","standardServingSizeG":120,"items":[{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước canh","legacyRecipeId":331},{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":332},{"ingredientName":"Mướp","grossWeightG":40,"netWeightG":35,"note":"Mướp hương gọt vỏ thái lát","legacyRecipeId":333},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":334}]},{"sourceKey":"canh thịt bằm bắp cải cải đỏ","name":"Canh thịt bằm bắp cải, cải đỏ","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":335},{"ingredientName":"Cải bắp","grossWeightG":44,"netWeightG":40,"note":"Cải bắp thái sợi mềm","legacyRecipeId":336},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":24,"netWeightG":20,"note":"Cà rốt tỉa hoa/thái hạt lựu","legacyRecipeId":337},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":338},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":339}]},{"sourceKey":"hồng giòn","name":"Hồng giòn","standardServingSizeG":50,"items":[{"ingredientName":"Vải","grossWeightG":96,"netWeightG":50,"note":"Hồng giòn chín ngọt gọt vỏ","legacyRecipeId":340}]},{"sourceKey":"cá điêu hồng chiên tươi nước mắm chua ngọt","name":"Cá điêu hồng chiên tươi, nước mắm chua ngọt","standardServingSizeG":65,"items":[{"ingredientName":"Cá rô phi","grossWeightG":79,"netWeightG":45,"note":"Cá điêu hồng phi lê","legacyRecipeId":341},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":342}]},{"sourceKey":"canh thịt bò hầm khoai môn","name":"Canh thịt bò hầm khoai môn","standardServingSizeG":120,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt bò nạc băm/thái mềm","legacyRecipeId":343},{"ingredientName":"Khoai môn","grossWeightG":52,"netWeightG":45,"note":"Khoai môn ninh mềm","legacyRecipeId":344},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":345}]},{"sourceKey":"hồng xiêm","name":"Hồng xiêm","standardServingSizeG":50,"items":[{"ingredientName":"Vải","grossWeightG":96,"netWeightG":50,"note":"Hồng xiêm chín ngọt gọt vỏ","legacyRecipeId":346}]},{"sourceKey":"sườn cốt lết khìa","name":"Sườn cốt lết khìa","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn, nạc thăn","grossWeightG":48,"netWeightG":48,"note":"Sườn cốt lết heo mềm","legacyRecipeId":347},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":348}]},{"sourceKey":"canh tôm thẻ cải dún","name":"Canh tôm thẻ, cải dún","standardServingSizeG":120,"items":[{"ingredientName":"Tôm biển","grossWeightG":39,"netWeightG":18,"note":"Tôm tươi bóc vỏ băm nhỏ","legacyRecipeId":349},{"ingredientName":"Cải thìa (cải trắng)","grossWeightG":60,"netWeightG":45,"note":"Rau cải non nấu canh","legacyRecipeId":350},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":351}]},{"sourceKey":"sâm bí đao hạt chia đường phèn","name":"Sâm bí đao, hạt chia, đường phèn","standardServingSizeG":140,"items":[{"ingredientName":"Bí đao (bí xanh)","grossWeightG":62,"netWeightG":45,"note":"Bí đao nấu nước sâm","legacyRecipeId":352},{"ingredientName":"Vừng (đen, trắng)","grossWeightG":3,"netWeightG":3,"note":"Hạt giàu dưỡng chất","legacyRecipeId":353}]},{"sourceKey":"miến gà bó xôi","name":"Miến gà, bó xôi","standardServingSizeG":155,"items":[{"ingredientName":"Miến dong","grossWeightG":25,"netWeightG":25,"note":"Miến dong mềm","legacyRecipeId":354},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":355},{"ingredientName":"Rau ngót","grossWeightG":26,"netWeightG":20,"note":"Rau xanh băm nhuyễn","legacyRecipeId":356},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":357}]},{"sourceKey":"súp trứng cút gà xé tôm bắp cà rốt","name":"Súp trứng cút, gà xé, tôm, bắp, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Ngô bắp tươi","grossWeightG":33,"netWeightG":18,"note":"Bắp ngọt nấu súp","legacyRecipeId":358},{"ingredientName":"Củ sắn dây","grossWeightG":9,"netWeightG":8,"note":"Bột sánh nấu súp","legacyRecipeId":359},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":360},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":361},{"ingredientName":"Trứng chim cút","grossWeightG":17,"netWeightG":15,"note":"Trứng chim cút bóc vỏ","legacyRecipeId":362},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":363},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":364}]},{"sourceKey":"nước đậu rang đường phèn","name":"Nước đậu rang, đường phèn","standardServingSizeG":140,"items":[{"ingredientName":"Đậu đen (hạt)","grossWeightG":18,"netWeightG":18,"note":"Đậu đen rang nấu nước mát","legacyRecipeId":365}]},{"sourceKey":"cháo cá hồi phô mai","name":"Cháo cá hồi phô mai","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":366},{"ingredientName":"Cá thu","grossWeightG":31,"netWeightG":20,"note":"Cá giàu DHA phi lê","legacyRecipeId":367},{"ingredientName":"Sữa bột toàn phần","grossWeightG":10,"netWeightG":10,"note":"Chế phẩm sữa / Phô mai giàu canxi","legacyRecipeId":368},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":369}]},{"sourceKey":"bánh bao xá xíu","name":"Bánh bao xá xíu","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":370},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":371},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":372},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":373}]},{"sourceKey":"thịt ba rọi kho","name":"Thịt ba rọi kho","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nửa nạc, nửa mỡ","grossWeightG":41,"netWeightG":40,"note":"Thịt ba chỉ (nửa nạc nửa mỡ)","legacyRecipeId":374},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":375}]},{"sourceKey":"canh chua cá lóc cà chua khóm đậu bắp","name":"Canh chua cá lóc cà chua, khóm, đậu bắp","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":376},{"ingredientName":"Cà chua","grossWeightG":26,"netWeightG":25,"note":"Cà chua chín tạo vị thanh","legacyRecipeId":377},{"ingredientName":"Giá đậu xanh","grossWeightG":26,"netWeightG":25,"note":"Rau nấu canh chua miền Nam","legacyRecipeId":378},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":379},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":380}]},{"sourceKey":"thịt gà xào đậu phọng","name":"Thịt gà xào đậu phọng","standardServingSizeG":65,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":94,"netWeightG":45,"note":"Thịt gà ta lọc xương","legacyRecipeId":381},{"ingredientName":"Lạc hạt","grossWeightG":6,"netWeightG":6,"note":"Lạc hạt (đậu phộng) rang","legacyRecipeId":382},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":383}]},{"sourceKey":"canh thịt bằm cải dún đà lạt","name":"Canh thịt bằm, cải dún đà lạt","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":384},{"ingredientName":"Cải thìa (cải trắng)","grossWeightG":60,"netWeightG":45,"note":"Rau cải non nấu canh","legacyRecipeId":385},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":386}]},{"sourceKey":"dưa lưới","name":"Dưa lưới","standardServingSizeG":60,"items":[{"ingredientName":"Đu đủ chín","grossWeightG":80,"netWeightG":60,"note":"Dưa lưới gọt vỏ cắt miếng","legacyRecipeId":387}]},{"sourceKey":"canh gà hầm củ sen cà rốt","name":"Canh gà hầm củ sen, cà rốt","standardServingSizeG":120,"items":[{"ingredientName":"Thịt gà ta","grossWeightG":52,"netWeightG":25,"note":"Thịt gà ta ninh mềm","legacyRecipeId":388},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":24,"netWeightG":20,"note":"Cà rốt tỉa hoa/thái hạt lựu","legacyRecipeId":389},{"ingredientName":"Đậu Hà lan (hạt)","grossWeightG":15,"netWeightG":15,"note":"Hạt hầm bùi mềm giàu đạm","legacyRecipeId":390},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":391}]},{"sourceKey":"rau câu lá dứa sữa","name":"Rau câu lá dứa sữa","standardServingSizeG":50,"items":[{"ingredientName":"Sữa bò tươi","grossWeightG":35,"netWeightG":35,"note":"Sữa tươi nấu thạch rau câu","legacyRecipeId":392},{"ingredientName":"Sữa đặc có đường Việt Nam","grossWeightG":8,"netWeightG":8,"note":"Sữa đặc làm thạch rau câu","legacyRecipeId":393}]},{"sourceKey":"tôm thịt rim dứa","name":"Tôm thịt rim dứa","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":26,"netWeightG":25,"note":"Thịt lợn nạc","legacyRecipeId":394},{"ingredientName":"Tôm biển","grossWeightG":43,"netWeightG":20,"note":"Tôm tươi bóc vỏ","legacyRecipeId":395},{"ingredientName":"Cà chua","grossWeightG":21,"netWeightG":20,"note":"Quả chua ngọt rim/xào mềm","legacyRecipeId":396},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":397}]},{"sourceKey":"canh cá lóc cải ngọt","name":"Canh cá lóc cải ngọt","standardServingSizeG":120,"items":[{"ingredientName":"Cá quả","grossWeightG":33,"netWeightG":20,"note":"Cá lóc (cá quả) lọc xương","legacyRecipeId":398},{"ingredientName":"Cải ngọt","grossWeightG":45,"netWeightG":45,"note":"Rau cải ngọt non thái nhỏ","legacyRecipeId":399},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":400}]},{"sourceKey":"cơm chiên hải sản (thịt nạc tôm mực cà rốt đậu que)","name":"Cơm chiên hải sản (thịt nạc, tôm, mực, cà rốt, đậu que)","standardServingSizeG":120,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":45,"netWeightG":45,"note":"Gạo tẻ nấu cơm chiên","legacyRecipeId":401},{"ingredientName":"Thịt lợn nạc","grossWeightG":10,"netWeightG":10,"note":"Thịt lợn nạc","legacyRecipeId":402},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":403},{"ingredientName":"Cá basa, phi lê","grossWeightG":15,"netWeightG":15,"note":"Thủy hải sản phi lê","legacyRecipeId":404},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà","legacyRecipeId":405},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":12,"netWeightG":10,"note":"Cà rốt thái hạt lựu","legacyRecipeId":406},{"ingredientName":"Đậu cô ve","grossWeightG":11,"netWeightG":10,"note":"Đậu cô ve (đậu que) thái hạt lựu","legacyRecipeId":407},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật","legacyRecipeId":408}]},{"sourceKey":"canh nghêu nấu bầu","name":"Canh nghêu nấu bầu","standardServingSizeG":120,"items":[{"ingredientName":"Tôm biển","grossWeightG":43,"netWeightG":20,"note":"Thủy sản tươi ngọt nước","legacyRecipeId":409},{"ingredientName":"Bầu","grossWeightG":54,"netWeightG":45,"note":"Bầu non gọt vỏ băm sợi","legacyRecipeId":410},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":411}]},{"sourceKey":"cháo thịt gà nấm rơm cà rốt","name":"Cháo thịt gà, nấm rơm, cà rốt","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":412},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":413},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":414},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":415},{"ingredientName":"Su hào","grossWeightG":19,"netWeightG":15,"note":"Rau củ thái hạt lựu nấu cháo","legacyRecipeId":416},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":417}]},{"sourceKey":"bánh canh cá lóc tôm khô cà rốt","name":"Bánh canh cá lóc, tôm khô, cà rốt","standardServingSizeG":75,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":418},{"ingredientName":"Cá quả","grossWeightG":37,"netWeightG":22,"note":"Cá lóc (cá quả) lọc sạch xương","legacyRecipeId":419},{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước","legacyRecipeId":420},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":421},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":422}]},{"sourceKey":"phở bò quế ngò gai ngò om","name":"Phở bò, quế, ngò gai, ngò om","standardServingSizeG":155,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":423},{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":22,"netWeightG":22,"note":"Thịt bò nạc băm/thái mỏng","legacyRecipeId":424},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":425},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":426}]},{"sourceKey":"bún mọc thịt băm cà rốt","name":"Bún mọc, thịt băm cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Bún","grossWeightG":60,"netWeightG":60,"note":"Bún tươi sợi mềm","legacyRecipeId":427},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":428},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":429},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":430}]},{"sourceKey":"bánh bông lan chà bông","name":"Bánh bông lan chà bông","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":431},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":432},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":433},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà ta","legacyRecipeId":434},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":435}]},{"sourceKey":"cá hú muối sả chiên","name":"Cá hú muối sả chiên","standardServingSizeG":65,"items":[{"ingredientName":"Cá basa, phi lê","grossWeightG":50,"netWeightG":50,"note":"Cá da trơn (cá hú/basa) sạch xương","legacyRecipeId":436},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":437}]},{"sourceKey":"canh cải bó xôi thịt bằm","name":"Canh cải bó xôi, thịt bằm","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":438},{"ingredientName":"Rau ngót","grossWeightG":58,"netWeightG":45,"note":"Rau lá xanh đậm giàu sắt","legacyRecipeId":439},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":440}]},{"sourceKey":"canh khoai môn hầm sườn heo","name":"Canh khoai môn hầm sườn heo","standardServingSizeG":120,"items":[{"ingredientName":"Sườn lợn","grossWeightG":58,"netWeightG":25,"note":"Sườn lợn ninh nước dùng","legacyRecipeId":441},{"ingredientName":"Khoai môn","grossWeightG":52,"netWeightG":45,"note":"Khoai môn ninh mềm","legacyRecipeId":442},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":443}]},{"sourceKey":"thịt bò xào su su","name":"Thịt bò xào su su","standardServingSizeG":65,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":38,"netWeightG":38,"note":"Thịt bò nạc thái mềm","legacyRecipeId":444},{"ingredientName":"Su su","grossWeightG":38,"netWeightG":30,"note":"Su su gọt vỏ thái mỏng","legacyRecipeId":445},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":446}]},{"sourceKey":"canh cua đồng rau ngót","name":"Canh cua đồng rau ngót","standardServingSizeG":120,"items":[{"ingredientName":"Cua đồng","grossWeightG":81,"netWeightG":25,"note":"Cua đồng giã lọc thịt","legacyRecipeId":447},{"ingredientName":"Rau ngót","grossWeightG":58,"netWeightG":45,"note":"Rau ngót tuốt lá rửa sạch","legacyRecipeId":448},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":449}]},{"sourceKey":"canh bí hồ lô thịt bằm","name":"Canh bí hồ lô thịt bằm","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":450},{"ingredientName":"Bí ngô","grossWeightG":52,"netWeightG":45,"note":"Bí ngô (bí đỏ) ninh mềm","legacyRecipeId":451},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":452}]},{"sourceKey":"trứng thịt chưng bún tàu nấm mèo cà rốt","name":"Trứng thịt chưng bún tàu, nấm mèo, cà rốt","standardServingSizeG":65,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":26,"netWeightG":25,"note":"Thịt lợn nạc","legacyRecipeId":453},{"ingredientName":"Trứng gà ta","grossWeightG":35,"netWeightG":30,"note":"Trứng gà ta","legacyRecipeId":454},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt thái miếng","legacyRecipeId":455},{"ingredientName":"Miến dong","grossWeightG":6,"netWeightG":6,"note":"Miến dong (bún tàu) cắt ngắn","legacyRecipeId":456},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":457}]},{"sourceKey":"canh thịt bằm cải xoang","name":"Canh thịt bằm, cải xoang","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":458},{"ingredientName":"Cải soong","grossWeightG":64,"netWeightG":45,"note":"Rau cải soong tươi","legacyRecipeId":459},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":460}]},{"sourceKey":"nui thịt bằm tôm khô cà rốt","name":"Nui thịt bằm, tôm khô, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Bột mì","grossWeightG":28,"netWeightG":28,"note":"Sợi mì / nui chế biến từ bột mì","legacyRecipeId":461},{"ingredientName":"Tôm đồng","grossWeightG":7,"netWeightG":6,"note":"Tôm nấu ngọt nước","legacyRecipeId":462},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":463},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":464},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":465}]},{"sourceKey":"cháo thịt bằm nghêu rau mùi","name":"Cháo thịt bằm, nghêu, rau mùi","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":466},{"ingredientName":"Cá basa, phi lê","grossWeightG":15,"netWeightG":15,"note":"Thủy hải sản tươi mềm","legacyRecipeId":467},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":468},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":469},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":470}]},{"sourceKey":"trà đào cam sả đường phèn","name":"Trà đào, cam, sả, đường phèn","standardServingSizeG":130,"items":[{"ingredientName":"Cam","grossWeightG":67,"netWeightG":50,"note":"Trái cây tươi pha Trà đào, cam, sả, đường phèn","legacyRecipeId":471}]},{"sourceKey":"nước mía","name":"Nước mía","standardServingSizeG":130,"items":[{"ingredientName":"Bưởi","grossWeightG":77,"netWeightG":50,"note":"Nguyên liệu thanh nhiệt (Nước mía)","legacyRecipeId":472}]},{"sourceKey":"bánh mexico thịt","name":"Bánh mexico thịt","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":473},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":474},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":475},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà ta","legacyRecipeId":476},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":477}]},{"sourceKey":"canh chua cá hú bông súng","name":"Canh chua cá hú, bông súng","standardServingSizeG":120,"items":[{"ingredientName":"Cá basa, phi lê","grossWeightG":25,"netWeightG":25,"note":"Cá da trơn (cá hú/basa) nấu canh","legacyRecipeId":478},{"ingredientName":"Cà chua","grossWeightG":26,"netWeightG":25,"note":"Cà chua chín tạo vị thanh","legacyRecipeId":479},{"ingredientName":"Giá đậu xanh","grossWeightG":26,"netWeightG":25,"note":"Rau nấu canh chua miền Nam","legacyRecipeId":480},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":481}]},{"sourceKey":"canh hẹ đậu phụ thịt bằm","name":"Canh hẹ, đậu phụ, thịt bằm","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":482},{"ingredientName":"Đậu phụ","grossWeightG":25,"netWeightG":25,"note":"Đậu phụ non cắt miếng","legacyRecipeId":483},{"ingredientName":"Cải thìa (cải trắng)","grossWeightG":47,"netWeightG":35,"note":"Rau xanh nấu canh thanh mát","legacyRecipeId":484},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":485}]},{"sourceKey":"thịt bò nấu khoai tây cà rốt","name":"Thịt bò nấu khoai tây, cà rốt","standardServingSizeG":65,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":38,"netWeightG":38,"note":"Thịt bò nạc thái mềm","legacyRecipeId":486},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt thái miếng","legacyRecipeId":487},{"ingredientName":"Khoai tây","grossWeightG":25,"netWeightG":22,"note":"Khoai tây cắt khối mềm","legacyRecipeId":488},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":489}]},{"sourceKey":"canh cà chua cá diêu hồng ngò gai","name":"Canh cà chua cá diêu hồng, ngò gai","standardServingSizeG":120,"items":[{"ingredientName":"Cá rô phi","grossWeightG":44,"netWeightG":25,"note":"Cá diêu hồng nấu canh","legacyRecipeId":490},{"ingredientName":"Cà chua","grossWeightG":26,"netWeightG":25,"note":"Cà chua chín tạo vị thanh","legacyRecipeId":491},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":492}]},{"sourceKey":"cơm dương châu thịt nạc chả lụa tôm cà tốt đậu đũa","name":"Cơm Dương Châu thịt nạc, chả lụa, tôm, cà tốt, đậu đũa","standardServingSizeG":120,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":45,"netWeightG":45,"note":"Gạo tẻ nấu cơm chiên","legacyRecipeId":493},{"ingredientName":"Thịt lợn nạc","grossWeightG":10,"netWeightG":10,"note":"Thịt lợn nạc","legacyRecipeId":494},{"ingredientName":"Giò lụa","grossWeightG":10,"netWeightG":10,"note":"Chả lụa thái hạt lựu","legacyRecipeId":495},{"ingredientName":"Tôm biển","grossWeightG":22,"netWeightG":10,"note":"Tôm tươi bóc vỏ","legacyRecipeId":496},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà","legacyRecipeId":497},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":12,"netWeightG":10,"note":"Cà rốt thái hạt lựu","legacyRecipeId":498},{"ingredientName":"Đậu đũa","grossWeightG":11,"netWeightG":10,"note":"Đậu đũa thái hạt lựu","legacyRecipeId":499},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật","legacyRecipeId":500}]},{"sourceKey":"canh bí đao thịt bằm","name":"Canh bí đao thịt bằm","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":501},{"ingredientName":"Bí đao (bí xanh)","grossWeightG":62,"netWeightG":45,"note":"Bí đao gọt vỏ thái mỏng","legacyRecipeId":502},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":503}]},{"sourceKey":"cháo bí đỏ thịt bò bằm","name":"Cháo bí đỏ, thịt bò bằm","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":504},{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":22,"netWeightG":22,"note":"Thịt bò nạc băm/thái mỏng","legacyRecipeId":505},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":506},{"ingredientName":"Bí ngô","grossWeightG":29,"netWeightG":25,"note":"Bí đỏ ninh nhừ","legacyRecipeId":507},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":508}]},{"sourceKey":"nước ép cam","name":"Nước ép cam","standardServingSizeG":120,"items":[{"ingredientName":"Cam","grossWeightG":107,"netWeightG":80,"note":"Cam tươi vắt lấy nước","legacyRecipeId":509}]},{"sourceKey":"bún nước lèo cá lóc rau râm","name":"Bún nước lèo cá lóc, rau râm","standardServingSizeG":155,"items":[{"ingredientName":"Bún","grossWeightG":60,"netWeightG":60,"note":"Bún tươi sợi mềm","legacyRecipeId":510},{"ingredientName":"Cá quả","grossWeightG":37,"netWeightG":22,"note":"Cá lóc (cá quả) lọc sạch xương","legacyRecipeId":511},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":512},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":513}]},{"sourceKey":"mì thịt bằm tôm cà rốt","name":"Mì thịt bằm, tôm, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Bột mì","grossWeightG":28,"netWeightG":28,"note":"Sợi mì / nui chế biến từ bột mì","legacyRecipeId":514},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":515},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":516},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":517},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":518}]},{"sourceKey":"miến gà cần tây cà rốt","name":"Miến gà cần tây, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Miến dong","grossWeightG":25,"netWeightG":25,"note":"Miến dong mềm","legacyRecipeId":519},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":520},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":521},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":522},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":523}]},{"sourceKey":"canh thịt bằm cải cúc","name":"Canh thịt bằm, cải Cúc","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":524},{"ingredientName":"Cải cúc","grossWeightG":60,"netWeightG":45,"note":"Rau cải cúc (tần ô) non","legacyRecipeId":525},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":526}]},{"sourceKey":"canh rong biển thịt heo bằm đậu hủ cà rốt","name":"Canh rong biển, thịt heo bằm, đậu hủ, cà rốt","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":527},{"ingredientName":"Đậu phụ","grossWeightG":25,"netWeightG":25,"note":"Đậu phụ non cắt miếng","legacyRecipeId":528},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":24,"netWeightG":20,"note":"Cà rốt tỉa hoa/thái hạt lựu","legacyRecipeId":529},{"ingredientName":"Cải thìa (cải trắng)","grossWeightG":47,"netWeightG":35,"note":"Rau xanh nấu canh thanh mát","legacyRecipeId":530},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":531}]},{"sourceKey":"thịt bò xào bắp mỹ đậu que","name":"Thịt bò xào, bắp mỹ, đậu que","standardServingSizeG":65,"items":[{"ingredientName":"Thịt bò, lưng, nạc","grossWeightG":38,"netWeightG":38,"note":"Thịt bò nạc thái mềm","legacyRecipeId":532},{"ingredientName":"Ngô bắp tươi","grossWeightG":27,"netWeightG":15,"note":"Ngô bắp ngọt tách hạt","legacyRecipeId":533},{"ingredientName":"Đậu cô ve","grossWeightG":28,"netWeightG":25,"note":"Đậu cô ve (đậu que) non","legacyRecipeId":534},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":535}]},{"sourceKey":"canh thịt bằm bắp cải","name":"Canh thịt bằm bắp cải","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":536},{"ingredientName":"Cải bắp","grossWeightG":44,"netWeightG":40,"note":"Cải bắp thái sợi mềm","legacyRecipeId":537},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":538},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":539}]},{"sourceKey":"cơm tấm","name":"Cơm tấm","standardServingSizeG":100,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":50,"netWeightG":50,"note":"Gạo tấm nấu cơm mềm","legacyRecipeId":540}]},{"sourceKey":"sườn khìa trứng gà xắt","name":"Sườn khìa, trứng gà xắt","standardServingSizeG":65,"items":[{"ingredientName":"Sườn lợn","grossWeightG":105,"netWeightG":45,"note":"Sườn lợn non chặt miếng","legacyRecipeId":541},{"ingredientName":"Trứng gà ta","grossWeightG":35,"netWeightG":30,"note":"Trứng gà ta","legacyRecipeId":542},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":3,"netWeightG":3,"note":"Dầu thực vật chế biến","legacyRecipeId":543}]},{"sourceKey":"canh bắp cải cà rốt thịt bằm","name":"Canh bắp cải, cà rốt thịt bằm","standardServingSizeG":120,"items":[{"ingredientName":"Thịt lợn nạc","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn nạc băm","legacyRecipeId":544},{"ingredientName":"Cải bắp","grossWeightG":44,"netWeightG":40,"note":"Cải bắp thái sợi mềm","legacyRecipeId":545},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":24,"netWeightG":20,"note":"Cà rốt tỉa hoa/thái hạt lựu","legacyRecipeId":546},{"ingredientName":"Ngô bắp tươi","grossWeightG":36,"netWeightG":20,"note":"Bắp ngọt hầm nước canh","legacyRecipeId":547},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":548}]},{"sourceKey":"chanh dây đường phèn","name":"Chanh dây đường phèn","standardServingSizeG":130,"items":[{"ingredientName":"Cam","grossWeightG":67,"netWeightG":50,"note":"Trái cây tươi pha Chanh dây đường phèn","legacyRecipeId":549}]},{"sourceKey":"súp thịt gà xé bắp hạt trứng cút cà rốt","name":"Súp thịt gà xé, bắp hạt, trứng cút, cà rốt","standardServingSizeG":155,"items":[{"ingredientName":"Ngô bắp tươi","grossWeightG":33,"netWeightG":18,"note":"Bắp ngọt nấu súp","legacyRecipeId":550},{"ingredientName":"Củ sắn dây","grossWeightG":9,"netWeightG":8,"note":"Bột sánh nấu súp","legacyRecipeId":551},{"ingredientName":"Thịt gà ta","grossWeightG":46,"netWeightG":22,"note":"Thịt gà ta xé mềm","legacyRecipeId":552},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":553},{"ingredientName":"Trứng chim cút","grossWeightG":17,"netWeightG":15,"note":"Trứng chim cút bóc vỏ","legacyRecipeId":554},{"ingredientName":"Cà rốt (củ đỏ, vàng)","grossWeightG":18,"netWeightG":15,"note":"Cà rốt băm nhỏ","legacyRecipeId":555},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":556}]},{"sourceKey":"hủ tiếu gan mực tôm hẹ","name":"Hủ tiếu gan, mực, tôm, hẹ","standardServingSizeG":155,"items":[{"ingredientName":"Bánh phở","grossWeightG":60,"netWeightG":60,"note":"Bánh sợi gạo tươi mềm","legacyRecipeId":557},{"ingredientName":"Tôm biển","grossWeightG":33,"netWeightG":15,"note":"Tôm tươi bóc vỏ","legacyRecipeId":558},{"ingredientName":"Cá basa, phi lê","grossWeightG":15,"netWeightG":15,"note":"Thủy hải sản tươi mềm","legacyRecipeId":559},{"ingredientName":"Thịt lợn, nạc vai","grossWeightG":18,"netWeightG":18,"note":"Thịt lợn giàu sắt và kẽm","legacyRecipeId":560},{"ingredientName":"Cải ngọt","grossWeightG":10,"netWeightG":10,"note":"Rau thơm / rau xanh thái nhỏ","legacyRecipeId":561},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":562}]},{"sourceKey":"nước sâm bí đao","name":"Nước sâm bí đao","standardServingSizeG":140,"items":[{"ingredientName":"Bí đao (bí xanh)","grossWeightG":62,"netWeightG":45,"note":"Bí đao nấu nước sâm","legacyRecipeId":563}]},{"sourceKey":"cháo thịt bằm đậu xanh","name":"Cháo thịt bằm đậu xanh","standardServingSizeG":180,"items":[{"ingredientName":"Gạo tẻ máy","grossWeightG":25,"netWeightG":25,"note":"Gạo tẻ ninh cháo nhừ","legacyRecipeId":564},{"ingredientName":"Thịt lợn nạc","grossWeightG":20,"netWeightG":20,"note":"Thịt lợn nạc chế biến","legacyRecipeId":565},{"ingredientName":"Đậu xanh (đậu tắt)","grossWeightG":12,"netWeightG":12,"note":"Đậu xanh ninh nhừ","legacyRecipeId":566},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":567}]},{"sourceKey":"bánh bao kim sa","name":"Bánh bao kim sa","standardServingSizeG":75,"items":[{"ingredientName":"Bột mì","grossWeightG":32,"netWeightG":32,"note":"Bột mì làm vỏ bánh","legacyRecipeId":568},{"ingredientName":"Sữa bò tươi","grossWeightG":15,"netWeightG":15,"note":"Sữa tươi nhào bột bánh","legacyRecipeId":569},{"ingredientName":"Trứng gà ta","grossWeightG":17,"netWeightG":15,"note":"Trứng gà ta","legacyRecipeId":570},{"ingredientName":"Dầu thảo mộc (Lạc, vừng, ...)","grossWeightG":2,"netWeightG":2,"note":"Dầu thực vật","legacyRecipeId":571}]}]'::jsonb)
       AS r("sourceKey" TEXT, "standardServingSizeG" NUMERIC, items JSONB)
       ON d.source_metadata->>'key' = r."sourceKey"
     WHERE NOT EXISTS (SELECT 1 FROM dish_recipes current_recipe WHERE current_recipe.dish_id=d.id)
       AND d.nutrition_verified=FALSE;

DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM reference_recipe_targets target CROSS JOIN LATERAL jsonb_array_elements(target.items) item
        WHERE NOT EXISTS (SELECT 1 FROM food_ingredients f WHERE f.name=item->>'ingredientName')
          OR (item->>'netWeightG')::numeric <= 0
          OR (item->>'grossWeightG')::numeric < (item->>'netWeightG')::numeric
      ) THEN RAISE EXCEPTION 'Invalid ingredient or weight in archived reference recipe'; END IF;
    END $$;

INSERT INTO dish_recipes(dish_id,ingredient_id,gross_weight_g,net_weight_g,note,source_metadata)
     SELECT target.id, ingredient.id, (item->>'grossWeightG')::numeric, (item->>'netWeightG')::numeric,
       COALESCE(pg_temp.repair_name(item->>'note'), ''),
       jsonb_build_object('status','REFERENCE_UNVERIFIED','origin','ARCHIVED_SEED_RECIPE',
         'legacyRecipeId',(item->>'legacyRecipeId')::bigint,'basis','ONE_STANDARD_SERVING')
     FROM reference_recipe_targets target CROSS JOIN LATERAL jsonb_array_elements(target.items) item
     JOIN LATERAL (SELECT f.id FROM food_ingredients f WHERE f.name=item->>'ingredientName' ORDER BY f.id LIMIT 1) ingredient ON TRUE
     ON CONFLICT(dish_id,ingredient_id) DO NOTHING;

UPDATE dishes d SET standard_serving_size_g=target.serving_size,
       description = CASE
         WHEN d.description IS NULL OR d.description LIKE 'Chưa có định lượng%'
         THEN 'Công thức chuẩn hóa từ thực đơn thư mục dử liệu chính và bảng thành phần dinh dưỡng Phụ lục 7 (Quyết định 3958/QĐ-BYT).'
         ELSE d.description
       END,
       source_metadata=d.source_metadata || jsonb_build_object('recipeStatus','REFERENCE_RESTORED',
         'servingSizeStatus','REFERENCE','referenceSource','ARCHIVED_SEED_RECIPE'), nutrition_verified=FALSE
     FROM reference_recipe_targets target WHERE d.id=target.id;

UPDATE dish_nutrition nutrition SET source_metadata=jsonb_build_object(
       'status','REFERENCE_UNVERIFIED','basis','ONE_STANDARD_SERVING',
       'calculation','SUM(food_ingredients nutrient per 100g * dish_recipes.net_weight_g / 100)',
       'unverifiedIngredients',COALESCE((SELECT jsonb_agg(DISTINCT f.name) FROM dish_recipes r
         JOIN food_ingredients f ON f.id=r.ingredient_id WHERE r.dish_id=nutrition.dish_id
         AND f.source_metadata->>'kind'='LEGACY_UNVERIFIED'),'[]'::jsonb),
       'missingNutrients',COALESCE((SELECT jsonb_agg(DISTINCT missing.value) FROM dish_recipes r
         JOIN food_ingredients f ON f.id=r.ingredient_id
         CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.source_metadata->'missingNutrients','[]'::jsonb)) missing(value)
         WHERE r.dish_id=nutrition.dish_id),'[]'::jsonb))
     WHERE nutrition.dish_id IN (SELECT id FROM reference_recipe_targets);

DO $$ BEGIN
      IF to_regclass('ingredient_allergens') IS NOT NULL THEN
        DELETE FROM ingredient_allergens ia
        USING food_ingredients f
        WHERE ia.ingredient_id = f.id AND COALESCE(f.source_metadata->>'kind', '') <> 'FOOD_COMPOSITION_IMAGE';

        INSERT INTO ingredient_allergens(ingredient_id, allergen_id)
        SELECT f.id, a.id
        FROM food_ingredients f
        JOIN allergens a ON (
          (a.code = 'WHEAT' AND f.name IN ('Bột mì', 'Bánh mỳ')) OR
          (a.code = 'PEANUT' AND f.name IN ('Lạc hạt')) OR
          (a.code = 'SESAME' AND f.name IN ('Vừng (đen, trắng)')) OR
          (a.code = 'SOY' AND f.name IN ('Đậu tương (đậu nành)', 'Đậu phụ', 'Sữa đậu nành (100g đậu/lít)', 'Dầu đậu tương')) OR
          (a.code = 'EGG' AND f.name IN ('Trứng gà ta', 'Trứng vịt', 'Trứng chim cút')) OR
          (a.code = 'MILK' AND f.name IN ('Sữa bò tươi', 'Sữa chua', 'Sữa bột toàn phần', 'Sữa đặc có đường Việt Nam')) OR
          (a.code = 'SEAFOOD' AND f.name IN ('Cá chép', 'Cá mè', 'Cá ngừ', 'Cá nục', 'Cá quả', 'Cá rô phi', 'Cá thu', 'Cá trắm cỏ', 'Cá trôi', 'Cua đồng', 'Tôm biển', 'Tôm đồng', 'Cá basa, phi lê'))
        )
        WHERE f.status = 'ACTIVE'
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;

DROP TABLE reference_recipe_targets;

CREATE TEMP TABLE config_import_changes(table_name TEXT, inserted_count INT) ON COMMIT DROP;

WITH added AS (
    INSERT INTO dish_frequency_rules (school_id,rule_name,meal_slot,target_type,target_id,target_code,target_name,age_group,period_type,min_occurrences,max_occurrences,is_required_in_meal,severity,is_active,note,source_metadata) SELECT 1,'Cơ cấu Phụ sáng theo DOC','MORNING_SNACK','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='SNACK_MORNING'),'SNACK_MORNING','Phụ sáng','ALL','PER_WEEK',5,5,false,'INFO',true,'Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.','{"seedKey":"DOC_FREQUENCY_SNACK_MORNING_V1","kind":"SOURCE_MENU_OBSERVATION","status":"OBSERVED_REFERENCE","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"weeklyCounts":[{"weekNumber":1,"count":5},{"weekNumber":2,"count":5},{"weekNumber":3,"count":5},{"weekNumber":4,"count":5},{"weekNumber":5,"count":5},{"weekNumber":6,"count":5},{"weekNumber":7,"count":5},{"weekNumber":8,"count":5},{"weekNumber":9,"count":5},{"weekNumber":10,"count":5}],"totalOccurrences":50}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_frequency_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_frequency_rules (school_id,rule_name,meal_slot,target_type,target_id,target_code,target_name,age_group,period_type,min_occurrences,max_occurrences,is_required_in_meal,severity,is_active,note,source_metadata) SELECT 1,'Cơ cấu Cơm theo DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='RICE'),'RICE','Cơm','ALL','PER_WEEK',5,5,false,'INFO',true,'Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.','{"seedKey":"DOC_FREQUENCY_RICE_V1","kind":"SOURCE_MENU_OBSERVATION","status":"OBSERVED_REFERENCE","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"weeklyCounts":[{"weekNumber":1,"count":5},{"weekNumber":2,"count":5},{"weekNumber":3,"count":5},{"weekNumber":4,"count":5},{"weekNumber":5,"count":5},{"weekNumber":6,"count":5},{"weekNumber":7,"count":5},{"weekNumber":8,"count":5},{"weekNumber":9,"count":5},{"weekNumber":10,"count":5}],"totalOccurrences":50}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_frequency_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_frequency_rules (school_id,rule_name,meal_slot,target_type,target_id,target_code,target_name,age_group,period_type,min_occurrences,max_occurrences,is_required_in_meal,severity,is_active,note,source_metadata) SELECT 1,'Cơ cấu Món chính theo DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='MAIN'),'MAIN','Món chính','ALL','PER_WEEK',4,5,false,'INFO',true,'Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.','{"seedKey":"DOC_FREQUENCY_MAIN_V1","kind":"SOURCE_MENU_OBSERVATION","status":"OBSERVED_REFERENCE","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"weeklyCounts":[{"weekNumber":1,"count":5},{"weekNumber":2,"count":5},{"weekNumber":3,"count":4},{"weekNumber":4,"count":5},{"weekNumber":5,"count":5},{"weekNumber":6,"count":5},{"weekNumber":7,"count":4},{"weekNumber":8,"count":5},{"weekNumber":9,"count":4},{"weekNumber":10,"count":5}],"totalOccurrences":47}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_frequency_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_frequency_rules (school_id,rule_name,meal_slot,target_type,target_id,target_code,target_name,age_group,period_type,min_occurrences,max_occurrences,is_required_in_meal,severity,is_active,note,source_metadata) SELECT 1,'Cơ cấu Canh theo DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='SOUP'),'SOUP','Canh','ALL','PER_WEEK',5,5,false,'INFO',true,'Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.','{"seedKey":"DOC_FREQUENCY_SOUP_V1","kind":"SOURCE_MENU_OBSERVATION","status":"OBSERVED_REFERENCE","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"weeklyCounts":[{"weekNumber":1,"count":5},{"weekNumber":2,"count":5},{"weekNumber":3,"count":5},{"weekNumber":4,"count":5},{"weekNumber":5,"count":5},{"weekNumber":6,"count":5},{"weekNumber":7,"count":5},{"weekNumber":8,"count":5},{"weekNumber":9,"count":5},{"weekNumber":10,"count":5}],"totalOccurrences":50}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_frequency_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_frequency_rules (school_id,rule_name,meal_slot,target_type,target_id,target_code,target_name,age_group,period_type,min_occurrences,max_occurrences,is_required_in_meal,severity,is_active,note,source_metadata) SELECT 1,'Cơ cấu Tráng miệng theo DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='DESSERT'),'DESSERT','Tráng miệng','ALL','PER_WEEK',5,5,false,'INFO',true,'Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.','{"seedKey":"DOC_FREQUENCY_DESSERT_V1","kind":"SOURCE_MENU_OBSERVATION","status":"OBSERVED_REFERENCE","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"weeklyCounts":[{"weekNumber":1,"count":5},{"weekNumber":2,"count":5},{"weekNumber":3,"count":5},{"weekNumber":4,"count":5},{"weekNumber":5,"count":5},{"weekNumber":6,"count":5},{"weekNumber":7,"count":5},{"weekNumber":8,"count":5},{"weekNumber":9,"count":5},{"weekNumber":10,"count":5}],"totalOccurrences":50}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_frequency_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_frequency_rules (school_id,rule_name,meal_slot,target_type,target_id,target_code,target_name,age_group,period_type,min_occurrences,max_occurrences,is_required_in_meal,severity,is_active,note,source_metadata) SELECT 1,'Cơ cấu Thức uống / Sữa chua theo DOC','AFTERNOON_SNACK','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='DRINK'),'DRINK','Thức uống / Sữa chua','ALL','PER_WEEK',5,5,false,'INFO',true,'Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.','{"seedKey":"DOC_FREQUENCY_DRINK_V1","kind":"SOURCE_MENU_OBSERVATION","status":"OBSERVED_REFERENCE","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"weeklyCounts":[{"weekNumber":1,"count":5},{"weekNumber":2,"count":5},{"weekNumber":3,"count":5},{"weekNumber":4,"count":5},{"weekNumber":5,"count":5},{"weekNumber":6,"count":5},{"weekNumber":7,"count":5},{"weekNumber":8,"count":5},{"weekNumber":9,"count":5},{"weekNumber":10,"count":5}],"totalOccurrences":50}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_frequency_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_frequency_rules (school_id,rule_name,meal_slot,target_type,target_id,target_code,target_name,age_group,period_type,min_occurrences,max_occurrences,is_required_in_meal,severity,is_active,note,source_metadata) SELECT 1,'Cơ cấu Xế + Phụ chiều theo DOC','AFTERNOON_SNACK','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='SNACK_AFTERNOON'),'SNACK_AFTERNOON','Xế + Phụ chiều','ALL','PER_WEEK',5,5,false,'INFO',true,'Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.','{"seedKey":"DOC_FREQUENCY_SNACK_AFTERNOON_V1","kind":"SOURCE_MENU_OBSERVATION","status":"OBSERVED_REFERENCE","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"weeklyCounts":[{"weekNumber":1,"count":5},{"weekNumber":2,"count":5},{"weekNumber":3,"count":5},{"weekNumber":4,"count":5},{"weekNumber":5,"count":5},{"weekNumber":6,"count":5},{"weekNumber":7,"count":5},{"weekNumber":8,"count":5},{"weekNumber":9,"count":5},{"weekNumber":10,"count":5}],"totalOccurrences":50}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_frequency_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_spacing_rules (school_id,rule_name,meal_slot,target_type,target_id,target_name,age_group,min_spacing_days,no_repeat_in_same_week,no_repeat_in_same_day,priority_order,severity,is_active,note,source_metadata) SELECT 1,'Khoảng lặp Phụ sáng quan sát từ DOC','MORNING_SNACK','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='SNACK_MORNING'),'Phụ sáng','ALL',1,false,true,1,'INFO',false,'Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.','{"seedKey":"DOC_SPACING_SNACK_MORNING_V1","kind":"SOURCE_MENU_OBSERVATION","status":"DRAFT_OBSERVED_REFERENCE","dayUnit":"CALENDAR_DAYS","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"observations":[{"dishKey":"sữa dinh dưỡng","dates":["2025-09-08","2025-09-09","2025-09-10","2025-09-11","2025-09-12","2025-09-15","2025-09-16","2025-09-17","2025-09-18","2025-09-19","2025-09-22","2025-09-23","2025-09-24","2025-09-25","2025-09-26","2025-09-29","2025-09-30","2025-10-01","2025-10-02","2025-10-03","2025-10-06","2025-10-07","2025-10-08","2025-10-09","2025-10-10","2025-10-13","2025-10-14","2025-10-15","2025-10-16","2025-10-17","2025-10-20","2025-10-21","2025-10-22","2025-10-23","2025-10-24","2025-10-27","2025-10-28","2025-10-29","2025-10-30","2025-10-31","2025-11-03","2025-11-04","2025-11-05","2025-11-06","2025-11-07","2025-11-10","2025-11-11","2025-11-12","2025-11-13","2025-11-14"]}]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_spacing_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_spacing_rules (school_id,rule_name,meal_slot,target_type,target_id,target_name,age_group,min_spacing_days,no_repeat_in_same_week,no_repeat_in_same_day,priority_order,severity,is_active,note,source_metadata) SELECT 1,'Khoảng lặp Cơm quan sát từ DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='RICE'),'Cơm','ALL',1,false,true,1,'INFO',false,'Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.','{"seedKey":"DOC_SPACING_RICE_V1","kind":"SOURCE_MENU_OBSERVATION","status":"DRAFT_OBSERVED_REFERENCE","dayUnit":"CALENDAR_DAYS","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"observations":[{"dishKey":"cơm","dates":["2025-09-08","2025-09-09","2025-09-10","2025-09-11","2025-09-12","2025-09-15","2025-09-16","2025-09-17","2025-09-18","2025-09-19","2025-09-22","2025-09-23","2025-09-24","2025-09-25","2025-09-29","2025-09-30","2025-10-01","2025-10-02","2025-10-03","2025-10-06","2025-10-07","2025-10-08","2025-10-09","2025-10-10","2025-10-13","2025-10-14","2025-10-15","2025-10-16","2025-10-17","2025-10-20","2025-10-21","2025-10-22","2025-10-23","2025-10-27","2025-10-28","2025-10-29","2025-10-30","2025-10-31","2025-11-03","2025-11-04","2025-11-05","2025-11-06","2025-11-10","2025-11-11","2025-11-12","2025-11-13"]}]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_spacing_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_spacing_rules (school_id,rule_name,meal_slot,target_type,target_id,target_name,age_group,min_spacing_days,no_repeat_in_same_week,no_repeat_in_same_day,priority_order,severity,is_active,note,source_metadata) SELECT 1,'Khoảng lặp Món chính quan sát từ DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='MAIN'),'Món chính','ALL',12,true,true,1,'INFO',false,'Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.','{"seedKey":"DOC_SPACING_MAIN_V1","kind":"SOURCE_MENU_OBSERVATION","status":"DRAFT_OBSERVED_REFERENCE","dayUnit":"CALENDAR_DAYS","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"observations":[{"dishKey":"cá lóc muối chiên","dates":["2025-09-08","2025-09-25","2025-10-14","2025-11-06"]},{"dishKey":"thịt gà rô ti","dates":["2025-09-09","2025-10-15","2025-11-10"]},{"dishKey":"thịt gà chiên nước mắm","dates":["2025-09-12","2025-10-01","2025-10-30"]},{"dishKey":"cá ngừ chiên sốt cà chua","dates":["2025-09-16","2025-10-22"]},{"dishKey":"trứng vịt chiên thịt cà chua","dates":["2025-09-19","2025-10-10"]},{"dishKey":"thịt kho trứng cút","dates":["2025-09-24","2025-10-06","2025-10-28","2025-11-12"]},{"dishKey":"thịt ba rọi kho","dates":["2025-10-20","2025-11-03"]},{"dishKey":"thịt gà xào đậu phọng","dates":["2025-10-21","2025-11-04"]},{"dishKey":"cá hú muối sả chiên","dates":["2025-10-27","2025-11-11"]}]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_spacing_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_spacing_rules (school_id,rule_name,meal_slot,target_type,target_id,target_name,age_group,min_spacing_days,no_repeat_in_same_week,no_repeat_in_same_day,priority_order,severity,is_active,note,source_metadata) SELECT 1,'Khoảng lặp Canh quan sát từ DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='SOUP'),'Canh','ALL',24,true,true,1,'INFO',false,'Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.','{"seedKey":"DOC_SPACING_SOUP_V1","kind":"SOURCE_MENU_OBSERVATION","status":"DRAFT_OBSERVED_REFERENCE","dayUnit":"CALENDAR_DAYS","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"observations":[{"dishKey":"canh thịt bằm rau ngót","dates":["2025-10-13","2025-11-06"]},{"dishKey":"canh thịt bò hầm khoai môn","dates":["2025-10-16","2025-11-11"]}]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_spacing_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_spacing_rules (school_id,rule_name,meal_slot,target_type,target_id,target_name,age_group,min_spacing_days,no_repeat_in_same_week,no_repeat_in_same_day,priority_order,severity,is_active,note,source_metadata) SELECT 1,'Khoảng lặp Tráng miệng quan sát từ DOC','LUNCH','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='DESSERT'),'Tráng miệng','ALL',11,true,true,1,'INFO',false,'Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.','{"seedKey":"DOC_SPACING_DESSERT_V1","kind":"SOURCE_MENU_OBSERVATION","status":"DRAFT_OBSERVED_REFERENCE","dayUnit":"CALENDAR_DAYS","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"observations":[{"dishKey":"nho","dates":["2025-09-08","2025-09-24","2025-10-13","2025-10-30","2025-11-12"]},{"dishKey":"bánh su kem","dates":["2025-09-09","2025-10-07","2025-10-20","2025-11-13"]},{"dishKey":"lê đường","dates":["2025-09-10","2025-09-22","2025-10-08","2025-10-29"]},{"dishKey":"rau câu dừa","dates":["2025-09-11","2025-10-09","2025-11-06"]},{"dishKey":"thanh long","dates":["2025-09-12","2025-09-26","2025-10-17","2025-10-31","2025-11-11"]},{"dishKey":"đu đủ chín","dates":["2025-09-16","2025-10-24","2025-11-05"]},{"dishKey":"bánh flan","dates":["2025-09-17","2025-10-14","2025-11-04"]},{"dishKey":"dưa hấu","dates":["2025-09-18","2025-10-10","2025-10-23","2025-11-07"]},{"dishKey":"táo","dates":["2025-09-30","2025-11-14"]},{"dishKey":"bánh gang","dates":["2025-10-01","2025-10-28"]},{"dishKey":"chuối cau","dates":["2025-10-06","2025-10-27","2025-11-10"]},{"dishKey":"hồng giòn","dates":["2025-10-15","2025-11-03"]}]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_spacing_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_spacing_rules (school_id,rule_name,meal_slot,target_type,target_id,target_name,age_group,min_spacing_days,no_repeat_in_same_week,no_repeat_in_same_day,priority_order,severity,is_active,note,source_metadata) SELECT 1,'Khoảng lặp Thức uống / Sữa chua quan sát từ DOC','AFTERNOON_SNACK','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='DRINK'),'Thức uống / Sữa chua','ALL',2,false,true,1,'INFO',false,'Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.','{"seedKey":"DOC_SPACING_DRINK_V1","kind":"SOURCE_MENU_OBSERVATION","status":"DRAFT_OBSERVED_REFERENCE","dayUnit":"CALENDAR_DAYS","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"observations":[{"dishKey":"nước cam","dates":["2025-09-09","2025-09-23","2025-10-06","2025-10-20"]},{"dishKey":"yaourt","dates":["2025-09-10","2025-09-16","2025-09-18","2025-09-24","2025-09-30","2025-10-02","2025-10-07","2025-10-09","2025-10-16","2025-10-21","2025-10-23","2025-10-29","2025-11-03","2025-11-06","2025-11-12"]},{"dishKey":"nha đam hạt chia đường phèn","dates":["2025-09-11","2025-09-22","2025-10-22","2025-11-11"]},{"dishKey":"sữa đậu nành","dates":["2025-09-12","2025-10-10","2025-10-27"]},{"dishKey":"sữa trái cây","dates":["2025-09-19","2025-10-03","2025-10-17","2025-10-24","2025-11-14"]},{"dishKey":"sữa đậu xanh","dates":["2025-09-26","2025-10-14","2025-11-05"]},{"dishKey":"sâm bí đao hạt chia đường phèn","dates":["2025-10-13","2025-10-28"]},{"dishKey":"nước đậu rang đường phèn","dates":["2025-10-15","2025-11-07"]}]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_spacing_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO dish_spacing_rules (school_id,rule_name,meal_slot,target_type,target_id,target_name,age_group,min_spacing_days,no_repeat_in_same_week,no_repeat_in_same_day,priority_order,severity,is_active,note,source_metadata) SELECT 1,'Khoảng lặp Xế + Phụ chiều quan sát từ DOC','AFTERNOON_SNACK','DISH_CATEGORY',(SELECT id FROM dish_categories WHERE code='SNACK_AFTERNOON'),'Xế + Phụ chiều','ALL',12,true,true,1,'INFO',false,'Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.','{"seedKey":"DOC_SPACING_SNACK_AFTERNOON_V1","kind":"SOURCE_MENU_OBSERVATION","status":"DRAFT_OBSERVED_REFERENCE","dayUnit":"CALENDAR_DAYS","documents":[{"file":"Tuần 1,2 tháng 9 (từ 8 đến 19-9-2025) (DIEU CHINH).doc","sha256":"377467bb802df28ae8fe480fb6e2a3c18d0a72e14c49cda5deb46df542d88e63"},{"file":"Tuần 3,4 tháng 9 (từ 22 đến 03 - 10-2025) Điều Chỉnh.doc","sha256":"25fa493ed6cb04357a55c795f594c8105eb885c7f0193da668dfa5d01cf12cd2"},{"file":"Tuần 5,6 tháng 10 (từ 6 đến 17 - 10-2025) (ĐIỀU CHỈNH).doc","sha256":"0c90adc1ace86c3fdcf9d06c04da3fcff9977f64c91db718955f370ed17442f4"},{"file":"Tuần 7,8 tháng 10 (từ 20 đến 31-10-2025) (Điều Chỉnh).doc","sha256":"fa27ac04ae7adfd4c5ab648f82705b8078c3c333547ffe9650ea41b67af4e96c"},{"file":"Tuần 9,10 tháng 11 (từ 03 đến 14 - 11 - 2025).doc","sha256":"ed496d506a47e7e621c7f5913128966b92b35e69ebde9c8c7fe4eec76de8bdb8"}],"observations":[{"dishKey":"bánh canh bột xắt tôm khô cá lóc","dates":["2025-09-17","2025-10-16","2025-10-30"]},{"dishKey":"phở bò ngò gai quế","dates":["2025-09-18","2025-11-10"]},{"dishKey":"bánh canh cá lóc cà rốt","dates":["2025-09-24","2025-10-06"]},{"dishKey":"bún bò huế ngò gai quế","dates":["2025-09-29","2025-10-27"]},{"dishKey":"bánh ngọt kẹp chà bông","dates":["2025-10-10","2025-11-07"]}]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'dish_spacing_rules', count(*)::int FROM added;

WITH added AS (
    INSERT INTO nutrition_intake_standards (school_id,standard_name,age_group,gender,meal_scope,energy_kcal_min,energy_kcal_max,protein_ratio_min,protein_ratio_max,lipid_ratio_min,lipid_ratio_max,carbohydrate_ratio_min,carbohydrate_ratio_max,calcium_mg_min,iron_mg_min,zinc_mg_min,vitamin_a_rae_mcg_min,iron_absorption_rate,zinc_absorption_level,is_active,note,source_metadata) SELECT 1,'Nhà trẻ 12–36 tháng — cả ngày (01/VBHN-BGDĐT)','NHA_TRE','ALL','ALL_DAY',930,1000,13,20,30,40,47,50,NULL,NULL,NULL,NULL,NULL,NULL,true,'Năng lượng và tỷ lệ P:L:G theo Chương trình Giáo dục mầm non. Vi chất và chất xơ chưa có nguồn đối chiếu trong phần trích, để NULL; không suy ra từ năng lượng.','{"seedKey":"PRESCHOOL_2021_NHA_TRE_ALL_DAY_V1","kind":"OFFICIAL_PRESCHOOL_PROGRAM","source":{"title":"Chương trình Giáo dục mầm non — Văn bản hợp nhất 01/VBHN-BGDĐT ngày 13/4/2021","url":"https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2021/4/33649/35633-1-565-566.pdf","gazette":"Công báo số 565 + 566 ngày 28/4/2021","pages":{"NHA_TRE":24,"MAU_GIAO":50},"scope":"Năng lượng và tỷ lệ các chất sinh năng lượng; không có định mức vi chất trong phần được trích."},"ageMonthsMin":12,"ageMonthsMax":36,"missingNutrients":["fiberGMin","fiberGMax","calciumMgMin","ironMgMin","zincMgMin","vitaminARaeMcgMin"]}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'nutrition_intake_standards'::regclass AND conname = 'nutrition_intake_standards_age_group_check' AND pg_get_constraintdef(oid) NOT LIKE '%NHA_TRE%') ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'nutrition_intake_standards', count(*)::int FROM added;

WITH added AS (
    INSERT INTO nutrition_intake_standards (school_id,standard_name,age_group,gender,meal_scope,energy_kcal_min,energy_kcal_max,protein_ratio_min,protein_ratio_max,lipid_ratio_min,lipid_ratio_max,carbohydrate_ratio_min,carbohydrate_ratio_max,calcium_mg_min,iron_mg_min,zinc_mg_min,vitamin_a_rae_mcg_min,iron_absorption_rate,zinc_absorption_level,is_active,note,source_metadata) SELECT 1,'Nhà trẻ 12–36 tháng — tại trường (01/VBHN-BGDĐT)','NHA_TRE','ALL','DAYBOARDING',600,651,13,20,30,40,47,50,NULL,NULL,NULL,NULL,NULL,NULL,true,'Năng lượng và tỷ lệ P:L:G theo Chương trình Giáo dục mầm non. Vi chất và chất xơ chưa có nguồn đối chiếu trong phần trích, để NULL; không suy ra từ năng lượng.','{"seedKey":"PRESCHOOL_2021_NHA_TRE_DAYBOARDING_V1","kind":"OFFICIAL_PRESCHOOL_PROGRAM","source":{"title":"Chương trình Giáo dục mầm non — Văn bản hợp nhất 01/VBHN-BGDĐT ngày 13/4/2021","url":"https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2021/4/33649/35633-1-565-566.pdf","gazette":"Công báo số 565 + 566 ngày 28/4/2021","pages":{"NHA_TRE":24,"MAU_GIAO":50},"scope":"Năng lượng và tỷ lệ các chất sinh năng lượng; không có định mức vi chất trong phần được trích."},"ageMonthsMin":12,"ageMonthsMax":36,"missingNutrients":["fiberGMin","fiberGMax","calciumMgMin","ironMgMin","zincMgMin","vitaminARaeMcgMin"]}'::jsonb WHERE NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'nutrition_intake_standards'::regclass AND conname = 'nutrition_intake_standards_age_group_check' AND pg_get_constraintdef(oid) NOT LIKE '%NHA_TRE%') ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'nutrition_intake_standards', count(*)::int FROM added;

WITH added AS (
    INSERT INTO nutrition_intake_standards (school_id,standard_name,age_group,gender,meal_scope,energy_kcal_min,energy_kcal_max,protein_ratio_min,protein_ratio_max,lipid_ratio_min,lipid_ratio_max,carbohydrate_ratio_min,carbohydrate_ratio_max,calcium_mg_min,iron_mg_min,zinc_mg_min,vitamin_a_rae_mcg_min,iron_absorption_rate,zinc_absorption_level,is_active,note,source_metadata) SELECT 1,'Mẫu giáo 3–6 tuổi — cả ngày (01/VBHN-BGDĐT)','MAU_GIAO','ALL','ALL_DAY',1230,1320,13,20,25,35,52,60,NULL,NULL,NULL,NULL,NULL,NULL,true,'Năng lượng và tỷ lệ P:L:G theo Chương trình Giáo dục mầm non. Vi chất và chất xơ chưa có nguồn đối chiếu trong phần trích, để NULL; không suy ra từ năng lượng.','{"seedKey":"PRESCHOOL_2021_MAU_GIAO_ALL_DAY_V1","kind":"OFFICIAL_PRESCHOOL_PROGRAM","source":{"title":"Chương trình Giáo dục mầm non — Văn bản hợp nhất 01/VBHN-BGDĐT ngày 13/4/2021","url":"https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2021/4/33649/35633-1-565-566.pdf","gazette":"Công báo số 565 + 566 ngày 28/4/2021","pages":{"NHA_TRE":24,"MAU_GIAO":50},"scope":"Năng lượng và tỷ lệ các chất sinh năng lượng; không có định mức vi chất trong phần được trích."},"ageMonthsMin":36,"ageMonthsMax":72,"missingNutrients":["fiberGMin","fiberGMax","calciumMgMin","ironMgMin","zincMgMin","vitaminARaeMcgMin"]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'nutrition_intake_standards', count(*)::int FROM added;

WITH added AS (
    INSERT INTO nutrition_intake_standards (school_id,standard_name,age_group,gender,meal_scope,energy_kcal_min,energy_kcal_max,protein_ratio_min,protein_ratio_max,lipid_ratio_min,lipid_ratio_max,carbohydrate_ratio_min,carbohydrate_ratio_max,calcium_mg_min,iron_mg_min,zinc_mg_min,vitamin_a_rae_mcg_min,iron_absorption_rate,zinc_absorption_level,is_active,note,source_metadata) SELECT 1,'Mẫu giáo 3–6 tuổi — tại trường (01/VBHN-BGDĐT)','MAU_GIAO','ALL','DAYBOARDING',615,726,13,20,25,35,52,60,NULL,NULL,NULL,NULL,NULL,NULL,true,'Năng lượng và tỷ lệ P:L:G theo Chương trình Giáo dục mầm non. Vi chất và chất xơ chưa có nguồn đối chiếu trong phần trích, để NULL; không suy ra từ năng lượng.','{"seedKey":"PRESCHOOL_2021_MAU_GIAO_DAYBOARDING_V1","kind":"OFFICIAL_PRESCHOOL_PROGRAM","source":{"title":"Chương trình Giáo dục mầm non — Văn bản hợp nhất 01/VBHN-BGDĐT ngày 13/4/2021","url":"https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2021/4/33649/35633-1-565-566.pdf","gazette":"Công báo số 565 + 566 ngày 28/4/2021","pages":{"NHA_TRE":24,"MAU_GIAO":50},"scope":"Năng lượng và tỷ lệ các chất sinh năng lượng; không có định mức vi chất trong phần được trích."},"ageMonthsMin":36,"ageMonthsMax":72,"missingNutrients":["fiberGMin","fiberGMax","calciumMgMin","ironMgMin","zincMgMin","vitaminARaeMcgMin"]}'::jsonb WHERE TRUE ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT 'nutrition_intake_standards', count(*)::int FROM added;

INSERT INTO audit_logs(school_id,user_id,user_name,user_role,action,target_entity,details)
    SELECT 1,NULL,'Source data import','SYSTEM','INITIALIZE_NUTRITION_CONFIGURATION','NUTRITION_CONFIGURATION',
      jsonb_build_object('origin','SOURCE_CATALOG_IMPORT','migration','20261103-nutrition-configuration',
        'insertedRows',(SELECT jsonb_object_agg(table_name, total) FROM
          (SELECT table_name,sum(inserted_count) AS total FROM config_import_changes GROUP BY table_name) counts),
        'description','Actual configuration initialization; no historical user activity was synthesized.')
    WHERE (SELECT COALESCE(sum(inserted_count),0) FROM config_import_changes)>0;

DROP TABLE config_import_changes;

COMMIT;
