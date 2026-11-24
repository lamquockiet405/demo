-- Keep every existing evaluation and reply. New writes serialize by child/day/meal.
ALTER TABLE parent_evaluations
  ADD COLUMN IF NOT EXISTS feedback_date date,
  ADD COLUMN IF NOT EXISTS meal_type varchar(30) NOT NULL DEFAULT 'LUNCH',
  ADD COLUMN IF NOT EXISTS evaluation_type varchar(30) NOT NULL DEFAULT 'QUICK_EVALUATION',
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_drafting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE parent_evaluations
SET feedback_date = (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
WHERE feedback_date IS NULL;
UPDATE parent_evaluations SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE parent_evaluations
  ALTER COLUMN feedback_date SET NOT NULL,
  ALTER COLUMN feedback_date SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_parent_evaluation_meal
ON parent_evaluations(student_id, feedback_date, meal_type, evaluation_type);
