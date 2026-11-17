const reference = require('../../database/reference/archived-menu-recipes.json');
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

function referenceRecipeSql(catalog) {
  const keys = new Set(catalog.dishes.map((dish) => dish.key));
  const recipes = reference.dishes.filter((dish) => keys.has(dish.sourceKey));
  const statements = [
    `CREATE TEMP TABLE reference_recipe_targets ON COMMIT DROP AS
     SELECT d.id, r."sourceKey" AS source_key, r."standardServingSizeG" AS serving_size, r.items
     FROM dishes d JOIN jsonb_to_recordset(${quote(JSON.stringify(recipes))}::jsonb)
       AS r("sourceKey" TEXT, "standardServingSizeG" NUMERIC, items JSONB)
       ON d.source_metadata->>'key' = r."sourceKey"
     WHERE NOT EXISTS (SELECT 1 FROM dish_recipes current_recipe WHERE current_recipe.dish_id=d.id)
       AND d.nutrition_verified=FALSE;`,
    `DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM reference_recipe_targets target CROSS JOIN LATERAL jsonb_array_elements(target.items) item
        WHERE NOT EXISTS (SELECT 1 FROM food_ingredients f WHERE f.name=item->>'ingredientName')
          OR (item->>'netWeightG')::numeric <= 0
          OR (item->>'grossWeightG')::numeric < (item->>'netWeightG')::numeric
      ) THEN RAISE EXCEPTION 'Invalid ingredient or weight in archived reference recipe'; END IF;
    END $$;`,
    `INSERT INTO dish_recipes(dish_id,ingredient_id,gross_weight_g,net_weight_g,note,source_metadata)
     SELECT target.id, ingredient.id, (item->>'grossWeightG')::numeric, (item->>'netWeightG')::numeric,
       '[THAM KHẢO - chưa xác minh định lượng thực tế] ' || COALESCE(pg_temp.repair_name(item->>'note'), ''),
       jsonb_build_object('status','REFERENCE_UNVERIFIED','origin','ARCHIVED_SEED_RECIPE',
         'legacyRecipeId',(item->>'legacyRecipeId')::bigint,'basis','ONE_STANDARD_SERVING')
     FROM reference_recipe_targets target CROSS JOIN LATERAL jsonb_array_elements(target.items) item
     JOIN LATERAL (SELECT f.id FROM food_ingredients f WHERE f.name=item->>'ingredientName' ORDER BY f.id LIMIT 1) ingredient ON TRUE
     ON CONFLICT(dish_id,ingredient_id) DO NOTHING;`,
    `UPDATE dishes d SET standard_serving_size_g=target.serving_size,
       source_metadata=d.source_metadata || jsonb_build_object('recipeStatus','REFERENCE_RESTORED',
         'servingSizeStatus','REFERENCE','referenceSource','ARCHIVED_SEED_RECIPE'), nutrition_verified=FALSE
     FROM reference_recipe_targets target WHERE d.id=target.id;`,
    // Existing recipe triggers calculate every value using net_weight_g / 100.
    `UPDATE dish_nutrition nutrition SET source_metadata=jsonb_build_object(
       'status','REFERENCE_UNVERIFIED','basis','ONE_STANDARD_SERVING',
       'calculation','SUM(food_ingredients nutrient per 100g * dish_recipes.net_weight_g / 100)',
       'unverifiedIngredients',COALESCE((SELECT jsonb_agg(DISTINCT f.name) FROM dish_recipes r
         JOIN food_ingredients f ON f.id=r.ingredient_id WHERE r.dish_id=nutrition.dish_id
         AND f.source_metadata->>'kind'='LEGACY_UNVERIFIED'),'[]'::jsonb),
       'missingNutrients',COALESCE((SELECT jsonb_agg(DISTINCT missing.value) FROM dish_recipes r
         JOIN food_ingredients f ON f.id=r.ingredient_id
         CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.source_metadata->'missingNutrients','[]'::jsonb)) missing(value)
         WHERE r.dish_id=nutrition.dish_id),'[]'::jsonb))
     WHERE nutrition.dish_id IN (SELECT id FROM reference_recipe_targets);`,
    'DROP TABLE reference_recipe_targets;',
  ];
  return statements.join('\n\n');
}

module.exports = { referenceRecipeSql };
