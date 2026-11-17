-- Migration: 20261104-breakfast-meal-support.sql
-- Hỗ trợ đầy đủ Bữa sáng (BREAKFAST) và Phụ sáng (MORNING_SNACK) trong hệ thống

ALTER TABLE menu_meals DROP CONSTRAINT IF EXISTS menu_meals_meal_type_check;

ALTER TABLE menu_meals 
ADD CONSTRAINT menu_meals_meal_type_check 
CHECK (meal_type IN ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'LATE_SNACK'));

SELECT setval('menu_meals_id_seq', COALESCE((SELECT MAX(id) FROM menu_meals), 1));
SELECT setval('menu_dishes_id_seq', COALESCE((SELECT MAX(id) FROM menu_dishes), 1));

