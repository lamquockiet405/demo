-- Allow standard kindergarten and daycare meal types: BREAKFAST, MORNING_SNACK, LUNCH, AFTERNOON_SNACK, LATE_SNACK
BEGIN;
ALTER TABLE menu_meals DROP CONSTRAINT IF EXISTS menu_meals_meal_type_check;
ALTER TABLE menu_meals ADD CONSTRAINT menu_meals_meal_type_check
  CHECK (meal_type IN ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'LATE_SNACK'));
COMMIT;

