-- Additive schema updates required by the entities in branch test.
-- Applied only to the isolated Docker test database.
BEGIN;
ALTER TABLE student_allergies
  ALTER COLUMN allergen_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS custom_allergen_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS allergy_type VARCHAR(50) DEFAULT 'ALLERGY',
  ADD COLUMN IF NOT EXISTS symptoms TEXT,
  ADD COLUMN IF NOT EXISTS reaction_treatment TEXT,
  ADD COLUMN IF NOT EXISTS diagnosed_date DATE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
COMMIT;
