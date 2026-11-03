DROP TABLE dish_frequency_rules, dish_spacing_rules, nutrition_intake_standards;
CREATE TABLE dish_frequency_rules (
  id BIGSERIAL PRIMARY KEY, food_group VARCHAR(50) NOT NULL,
  dish_category_id BIGINT REFERENCES dish_categories(id) ON DELETE SET NULL,
  min_occurrences_per_week INT NOT NULL DEFAULT 0, max_occurrences_per_week INT NOT NULL DEFAULT 5,
  target_age_group VARCHAR(30) NOT NULL DEFAULT 'ALL', severity VARCHAR(15) NOT NULL DEFAULT 'WARNING',
  is_active BOOLEAN NOT NULL DEFAULT TRUE, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE dish_spacing_rules (
  id BIGSERIAL PRIMARY KEY, rule_name VARCHAR(200) NOT NULL, scope VARCHAR(30) NOT NULL DEFAULT 'DISH_CATEGORY',
  dish_id BIGINT REFERENCES dishes(id) ON DELETE CASCADE,
  dish_category_id BIGINT REFERENCES dish_categories(id) ON DELETE SET NULL,
  min_spacing_days INT NOT NULL DEFAULT 2, is_active BOOLEAN NOT NULL DEFAULT TRUE, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE nutrition_intake_standards (
  id BIGSERIAL PRIMARY KEY, standard_name VARCHAR(200) NOT NULL, age_group VARCHAR(30) NOT NULL,
  energy_kcal_min NUMERIC NOT NULL DEFAULT 0, energy_kcal_max NUMERIC NOT NULL DEFAULT 0,
  protein_g_min NUMERIC NOT NULL DEFAULT 0, protein_g_max NUMERIC NOT NULL DEFAULT 0,
  protein_pct_min NUMERIC NOT NULL DEFAULT 13, protein_pct_max NUMERIC NOT NULL DEFAULT 20,
  fat_pct_min NUMERIC NOT NULL DEFAULT 25, fat_pct_max NUMERIC NOT NULL DEFAULT 35,
  carb_pct_min NUMERIC NOT NULL DEFAULT 52, carb_pct_max NUMERIC NOT NULL DEFAULT 60,
  calcium_mg_min NUMERIC NOT NULL DEFAULT 0, iron_mg_min NUMERIC NOT NULL DEFAULT 0,
  zinc_mg_min NUMERIC NOT NULL DEFAULT 0, fiber_g_min NUMERIC NOT NULL DEFAULT 0,
  vitamin_a_mcg_min NUMERIC NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO dish_frequency_rules(food_group,min_occurrences_per_week,max_occurrences_per_week,description)
  VALUES ('MANUAL_TEST',1,3,'Preserve this manual legacy configuration');
INSERT INTO dish_spacing_rules(rule_name,scope,dish_category_id,min_spacing_days)
  SELECT 'Manual legacy spacing','DISH_CATEGORY',id,3 FROM dish_categories WHERE code='MAIN';
INSERT INTO nutrition_intake_standards(standard_name,age_group,energy_kcal_min,energy_kcal_max,calcium_mg_min)
  VALUES ('Manual legacy standard','MAU_GIAO',600,720,321);
