-- Make application relationships explicit without deleting or rewriting historical data.
-- Run inside a transaction; safe to run again.
BEGIN;
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

COMMIT;
