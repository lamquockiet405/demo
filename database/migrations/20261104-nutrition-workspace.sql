BEGIN;

ALTER TABLE nutritional_standards ADD COLUMN IF NOT EXISTS rule_name VARCHAR(200);
ALTER TABLE food_samples ALTER COLUMN sample_weight_g DROP NOT NULL;
ALTER TABLE food_samples ALTER COLUMN storage_temp DROP NOT NULL;
ALTER TABLE food_samples ADD COLUMN IF NOT EXISTS dish_id BIGINT REFERENCES dishes(id) ON DELETE SET NULL;
ALTER TABLE food_samples ADD COLUMN IF NOT EXISTS inspection_id BIGINT REFERENCES food_inspections(id) ON DELETE SET NULL;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS nutrition_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE food_ingredients ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dish_recipes ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dish_nutrition ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE growth_zscores ADD COLUMN IF NOT EXISTS waz_standard_id BIGINT REFERENCES who_growth_standards(id);
ALTER TABLE growth_zscores ADD COLUMN IF NOT EXISTS haz_standard_id BIGINT REFERENCES who_growth_standards(id);
ALTER TABLE growth_zscores ADD COLUMN IF NOT EXISTS baz_standard_id BIGINT REFERENCES who_growth_standards(id);

CREATE TABLE IF NOT EXISTS picky_eating_advices (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  advice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  severity_level VARCHAR(20) NOT NULL,
  picky_symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  advice_title VARCHAR(255) NOT NULL,
  home_supplement_advice TEXT NOT NULL,
  recommended_dishes JSONB NOT NULL DEFAULT '[]'::jsonb,
  micronutrients_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'SENT',
  parent_feedback TEXT,
  parent_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_picky_eating_advices_student ON picky_eating_advices(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meal_evaluation_locks (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type VARCHAR(50) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  softness_score INTEGER,
  temperature_score INTEGER,
  excitement_score INTEGER,
  food_safety_checked BOOLEAN,
  chef_feedback TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (class_id, date, meal_type)
);

COMMIT;
