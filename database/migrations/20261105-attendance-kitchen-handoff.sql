-- One attendance record and one portion plan per child/class, day, and meal.
-- Unique indexes fail safely if historical duplicates require review.
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_attendance_student_day_meal
  ON meal_attendances(student_id, date, meal_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_meal_portion_class_day_meal
  ON daily_meal_portions(class_id, date, meal_type);

ALTER TABLE meal_attendances DROP CONSTRAINT IF EXISTS meal_attendances_meal_type_check;
ALTER TABLE meal_attendances ADD CONSTRAINT meal_attendances_meal_type_check
  CHECK (meal_type IN ('BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK'));
ALTER TABLE daily_meal_portions DROP CONSTRAINT IF EXISTS daily_meal_portions_meal_type_check;
ALTER TABLE daily_meal_portions ADD CONSTRAINT daily_meal_portions_meal_type_check
  CHECK (meal_type IN ('BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK'));
ALTER TABLE meal_attendances DROP CONSTRAINT IF EXISTS meal_attendances_consumption_level_check;
ALTER TABLE meal_attendances ADD CONSTRAINT meal_attendances_consumption_level_check
  CHECK (consumption_level IN ('FULL','MOST','HALF','LITTLE','NONE','PARTIAL','ALL','FEW'));

ALTER TABLE daily_meal_portions
  ADD COLUMN IF NOT EXISTS attendance_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_submitted_by bigint REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_snapshot jsonb;
