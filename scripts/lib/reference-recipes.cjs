const reference = require('../../database/reference/archived-menu-recipes.json');
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

function referenceRecipeSql(catalog) {
  const keys = new Set(catalog.dishes.map((dish) => dish.key));
  const recipes = reference.dishes.filter((dish) => keys.has(dish.sourceKey));
  const statements = [
    `DELETE FROM dish_recipes r
     USING dishes d
     WHERE r.dish_id = d.id
       AND d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
       AND (
         COALESCE(d.source_metadata->>'recipeStatus', '') IN ('MISSING_SOURCE_QUANTITIES', 'REFERENCE_RESTORED', 'APPROVED_REFERENCE', 'USER_APPROVED_REFERENCE', 'INCOMPLETE_RECIPE', 'VERIFIED_FROM_SOURCE_CATALOG')
         OR EXISTS (
           SELECT 1 FROM dish_recipes r2
           JOIN food_ingredients f2 ON f2.id = r2.ingredient_id
           WHERE r2.dish_id = d.id AND (f2.status <> 'ACTIVE' OR COALESCE(f2.source_metadata->>'kind', '') <> 'FOOD_COMPOSITION_IMAGE')
         )
       );`,
    `UPDATE dishes d
     SET nutrition_verified = FALSE
     WHERE d.source_metadata->>'kind' = 'SOURCE_MENU_DOC'
       AND NOT EXISTS (SELECT 1 FROM dish_recipes r WHERE r.dish_id = d.id)
       AND (d.status = 'ACTIVE' OR COALESCE(d.source_metadata->>'recipeStatus', '') <> 'VERIFIED_MANUAL');`,
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
       COALESCE(pg_temp.repair_name(item->>'note'), ''),
       jsonb_build_object('status','REFERENCE_UNVERIFIED','origin','ARCHIVED_SEED_RECIPE',
         'legacyRecipeId',(item->>'legacyRecipeId')::bigint,'basis','ONE_STANDARD_SERVING')
     FROM reference_recipe_targets target CROSS JOIN LATERAL jsonb_array_elements(target.items) item
     JOIN LATERAL (SELECT f.id FROM food_ingredients f WHERE f.name=item->>'ingredientName' ORDER BY f.id LIMIT 1) ingredient ON TRUE
     ON CONFLICT(dish_id,ingredient_id) DO NOTHING;`,
    `UPDATE dishes d SET standard_serving_size_g=target.serving_size,
       description = CASE
         WHEN d.description IS NULL OR d.description LIKE 'Chưa có định lượng%'
         THEN 'Công thức chuẩn hóa từ thực đơn thư mục dử liệu chính và bảng thành phần dinh dưỡng Phụ lục 7 (Quyết định 3958/QĐ-BYT).'
         ELSE d.description
       END,
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
    `DO $$ BEGIN
      IF to_regclass('ingredient_allergens') IS NOT NULL THEN
        DELETE FROM ingredient_allergens ia
        USING food_ingredients f
        WHERE ia.ingredient_id = f.id AND COALESCE(f.source_metadata->>'kind', '') <> 'FOOD_COMPOSITION_IMAGE';

        INSERT INTO ingredient_allergens(ingredient_id, allergen_id)
        SELECT f.id, a.id
        FROM food_ingredients f
        JOIN allergens a ON (
          (a.code = 'WHEAT' AND f.name IN ('Bột mì', 'Bánh mỳ')) OR
          (a.code = 'PEANUT' AND f.name IN ('Lạc hạt')) OR
          (a.code = 'SESAME' AND f.name IN ('Vừng (đen, trắng)')) OR
          (a.code = 'SOY' AND f.name IN ('Đậu tương (đậu nành)', 'Đậu phụ', 'Sữa đậu nành (100g đậu/lít)', 'Dầu đậu tương')) OR
          (a.code = 'EGG' AND f.name IN ('Trứng gà ta', 'Trứng vịt', 'Trứng chim cút')) OR
          (a.code = 'MILK' AND f.name IN ('Sữa bò tươi', 'Sữa chua', 'Sữa bột toàn phần', 'Sữa đặc có đường Việt Nam')) OR
          (a.code = 'SEAFOOD' AND f.name IN ('Cá chép', 'Cá mè', 'Cá ngừ', 'Cá nục', 'Cá quả', 'Cá rô phi', 'Cá thu', 'Cá trắm cỏ', 'Cá trôi', 'Cua đồng', 'Tôm biển', 'Tôm đồng', 'Cá basa, phi lê'))
        )
        WHERE f.status = 'ACTIVE'
        ON CONFLICT DO NOTHING;
      END IF;
    END $$;`,
    'DROP TABLE reference_recipe_targets;',
  ];
  return statements.join('\n\n');
}

module.exports = { referenceRecipeSql };
