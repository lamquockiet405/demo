-- KidMeal: read-only examples accompanying docs/giai-thich-db-va-lap-thuc-don.md.
-- IDs 65 (dish), 20 (meal), 2 (menu) were inspected in the 2026-11-03 snapshot.
-- Replace these IDs for another database. No INSERT/UPDATE/DELETE is performed.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- Q1. Recipe ingredients and the contribution of each ingredient to one standard serving.
SELECT d.id AS dish_id, d.name AS dish_name,
       f.id AS ingredient_id, f.name AS ingredient_name,
       r.gross_weight_g, r.net_weight_g, f.energy_kcal_100g,
       ROUND(f.energy_kcal_100g * r.net_weight_g / 100, 2) AS ingredient_kcal,
       r.source_metadata->>'status' AS recipe_status,
       f.source_metadata->>'kind' AS ingredient_source_kind
FROM dishes d
JOIN dish_recipes r ON r.dish_id = d.id
JOIN food_ingredients f ON f.id = r.ingredient_id
WHERE d.id = 65
ORDER BY r.id;

-- Q2. Recompute a dish from recipes, then compare with its cached value.
-- This is reference arithmetic, not a statement that the recipe is verified.
SELECT d.id AS dish_id, d.name, d.nutrition_verified,
       ROUND(SUM(f.energy_kcal_100g * r.net_weight_g / 100), 2) AS computed_reference_kcal,
       n.energy_kcal AS cached_reference_kcal,
       ROUND(SUM(f.calcium_mg * r.net_weight_g / 100), 2) AS computed_reference_calcium_mg,
       n.calcium_mg AS cached_reference_calcium_mg
FROM dishes d
JOIN dish_recipes r ON r.dish_id = d.id
JOIN food_ingredients f ON f.id = r.ingredient_id
LEFT JOIN dish_nutrition n ON n.dish_id = d.id
WHERE d.id = 65
GROUP BY d.id, d.name, d.nutrition_verified, n.energy_kcal, n.calcium_mg;

-- Q3. The dishes selected in a meal, with portion scaling.
-- LEFT JOIN preserves a selected dish even when it has no nutrition row.
SELECT m.id AS meal_id, m.meal_type, d.id AS dish_id, d.name,
       md.portion_size_g, d.standard_serving_size_g,
       n.energy_kcal AS standard_serving_reference_kcal,
       ROUND(n.energy_kcal * md.portion_size_g
             / NULLIF(d.standard_serving_size_g, 0), 2) AS portion_reference_kcal,
       d.nutrition_verified,
       n.source_metadata->>'status' AS nutrition_status
FROM menu_meals m
JOIN menu_dishes md ON md.menu_meal_id = m.id
JOIN dishes d ON d.id = md.dish_id
LEFT JOIN dish_nutrition n ON n.dish_id = d.id
WHERE m.id = 20
ORDER BY md.display_order, md.id;

-- Q4. A whole menu, using only its latest version and preserving empty meals.
WITH latest AS (
  SELECT id FROM menu_versions
  WHERE menu_id = 2
  ORDER BY version_number DESC, id DESC
  LIMIT 1
)
SELECT day.date, meal.meal_type, md.id AS menu_dish_id,
       d.id AS dish_id, d.name, md.portion_size_g, d.nutrition_verified
FROM latest v
JOIN menu_days day ON day.menu_version_id = v.id
LEFT JOIN menu_meals meal ON meal.menu_day_id = day.id
LEFT JOIN menu_dishes md ON md.menu_meal_id = meal.id
LEFT JOIN dishes d ON d.id = md.dish_id
ORDER BY day.date, meal.id, md.display_order, md.id;

-- Q5. Daily totals with explicit completeness, instead of reporting unknowns as zero.
-- No recipe join here: joining recipe lines would multiply the cached dish values.
WITH latest AS (
  SELECT id FROM menu_versions WHERE menu_id = 2
  ORDER BY version_number DESC, id DESC LIMIT 1
), per_item AS (
  SELECT day.id AS day_id, day.date, md.id AS menu_dish_id,
         CASE WHEN d.nutrition_verified = TRUE AND n.dish_id IS NOT NULL
           THEN n.energy_kcal * CASE WHEN md.portion_size_g IS NULL THEN 1
             ELSE md.portion_size_g / COALESCE(NULLIF(d.standard_serving_size_g, 0), 100) END
         END AS verified_kcal
  FROM latest v
  JOIN menu_days day ON day.menu_version_id = v.id
  LEFT JOIN menu_meals meal ON meal.menu_day_id = day.id
  LEFT JOIN menu_dishes md ON md.menu_meal_id = meal.id
  LEFT JOIN dishes d ON d.id = md.dish_id
  LEFT JOIN dish_nutrition n ON n.dish_id = d.id
), daily AS (
  SELECT day_id, date, COUNT(menu_dish_id) AS selected_dishes,
         COUNT(verified_kcal) AS verified_dishes,
         ROUND(SUM(verified_kcal), 2) AS verified_subtotal_kcal
  FROM per_item GROUP BY day_id, date
)
SELECT date, selected_dishes, verified_dishes, verified_subtotal_kcal,
       CASE WHEN selected_dishes > 0 AND selected_dishes = verified_dishes
         THEN verified_subtotal_kcal END AS complete_day_kcal
FROM daily ORDER BY date;
-- Completeness here covers selected dishes only, not adequacy of meal structure or dietary targets.

-- Q6. Appearance history: latest version of each menu, then filter actual menu-day dates.
-- Illustrates how to avoid counting the same menu's older versions again.
WITH latest_versions AS (
  SELECT DISTINCT ON (menu_id) id, menu_id
  FROM menu_versions ORDER BY menu_id, version_number DESC, id DESC
)
SELECT d.id AS dish_id, d.name, COUNT(*) AS occurrences
FROM latest_versions v
JOIN menus m ON m.id = v.menu_id
JOIN menu_days day ON day.menu_version_id = v.id
JOIN menu_meals meal ON meal.menu_day_id = day.id
JOIN menu_dishes md ON md.menu_meal_id = meal.id
JOIN dishes d ON d.id = md.dish_id
WHERE m.age_group = 'MAU_GIAO'
  AND day.date >= DATE '2025-10-20' - INTERVAL '28 days'
  AND day.date < DATE '2025-10-20'
GROUP BY d.id, d.name ORDER BY occurrences DESC, d.id;

-- Q7. Exact nutrition eligibility conditions used to form the auto-generator's dish pool.
SELECT COUNT(*) AS eligible_dishes
FROM dishes d
JOIN dish_nutrition n ON n.dish_id = d.id
WHERE d.status = 'ACTIVE'
  AND d.nutrition_verified = TRUE
  AND n.energy_kcal > 0;

-- Q8. Compare the two standards tables; adding the new table does not redirect consumers.
SELECT 'OLD_TABLE_USED_BY_ENGINE' AS origin, age_group, meal_scope,
       min_energy_kcal AS kcal_min, max_energy_kcal AS kcal_max,
       min_carb_pct AS carb_min, max_carb_pct AS carb_max
FROM nutritional_standards WHERE age_group = 'NHA_TRE' AND meal_scope = 'DAYBOARDING'
UNION ALL
SELECT 'NEW_SOURCED_CONFIGURATION', age_group, meal_scope,
       energy_kcal_min, energy_kcal_max, carbohydrate_ratio_min, carbohydrate_ratio_max
FROM nutrition_intake_standards WHERE age_group = 'NHA_TRE' AND meal_scope = 'DAYBOARDING';

COMMIT;
