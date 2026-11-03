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
