const fs = require('node:fs');
const path = require('node:path');
const archive = require('../database/reference/unverified-seed-recipes.json');
const catalog = require('../database/generated/source-catalog.json');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;

// Reuse recorded weights only. Omitted ingredients are recorded as adaptations;
// these templates are not independently verified kitchen measurements.
const targets = [
  ['yaourt', 94, 100, 'YOGURT', []],
  ['nước cam', 95, 120, 'ORANGE', []],
  ['nước ép cam', 95, 120, 'ORANGE', [96]],
  ['sữa đậu nành', 96, 150, 'SOY_MILK', []],
  ['sâm bí đao', 98, 140, 'WINTER_MELON', [25]],
  ['nước sâm bí đao', 98, 140, 'WINTER_MELON', [25]],
  ['sâm bí đao hạt chia đường phèn', 98, 140, 'WINTER_MELON', []],
  ['nước đậu rang', 99, 140, 'ROASTED_BEAN', [96]],
  ['nước đậu rang đường phèn', 99, 140, 'ROASTED_BEAN', []],
  ['nước mía', 100, 120, 'SUGARCANE', []],
];
// Resolve by ingredient name, never assume legacy IDs refer to today's foods.
const foods = { 94: 'Yaourt (sữa chua có đường)', 108: 'Nước cam tươi nguyên chất',
  109: 'Sữa đậu nành nguyên chất', 96: 'Đường phèn / Đường kính trắng',
  36: 'Bí đao (bí xanh)', 25: 'Hạt chia hữu cơ', 22: 'Đậu đen (hạt)', 110: 'Nước mía tươi' };

function buildSql() {
  for (const [key] of targets) {
    if (!catalog.dishes.some(d => d.key === key && d.categoryCode === 'DRINK')) throw new Error(`Missing source drink: ${key}`);
  }
  const recipes = targets.map(([key, legacyId, serving, family, omitted]) => ({
    key, legacyId, serving, family, omitted,
    items: archive.rows.filter(r => r.dishId === legacyId && !omitted.includes(r.ingredientId))
      .map(r => ({ ingredientName: foods[r.ingredientId], gross: r.grossWeightG, net: r.netWeightG,
        legacyRecipeId: r.id, note: r.note })),
  }));
  if (recipes.some(r => !r.items.length || r.items.some(i => !i.ingredientName || !(i.net > 0) || i.gross < i.net))) throw new Error('Invalid archived recipe');
  return `-- Reference drink templates requested for draft menu planning.
-- Weights inherited from archived seed; no new nutrient values are supplied.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtext('kidmeal-drink-recipes'));
CREATE TEMP TABLE drink_templates ON COMMIT DROP AS
 SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(recipes))}::jsonb)
 AS t(key text, "legacyId" int, serving numeric, family text, omitted jsonb, items jsonb);
CREATE TEMP TABLE drink_recipe_targets ON COMMIT DROP AS
 SELECT d.id,t.* FROM dishes d JOIN drink_templates t ON d.source_metadata->>'key'=t.key
 JOIN dish_categories c ON c.id=d.category_id AND c.code='DRINK'
 WHERE NOT EXISTS(SELECT 1 FROM dish_recipes r WHERE r.dish_id=d.id);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM drink_recipe_targets t CROSS JOIN LATERAL jsonb_array_elements(t.items) item
  WHERE NOT EXISTS(SELECT 1 FROM food_ingredients f WHERE f.name=item->>'ingredientName')) THEN
  RAISE EXCEPTION 'Required archived drink ingredient is missing';
 END IF;
END $$;
INSERT INTO dish_recipes(dish_id,ingredient_id,gross_weight_g,net_weight_g,note,source_metadata)
 SELECT t.id,f.id,(item->>'gross')::numeric,(item->>'net')::numeric,
 '[THAM KHẢO - định lượng mẫu cũ] ' || (item->>'note'),
 jsonb_build_object('status','APPROVED_REFERENCE','origin','ARCHIVED_SEED_TEMPLATE',
 'legacyRecipeId',(item->>'legacyRecipeId')::int,'legacyDishId',t."legacyId",
 'omittedLegacyIngredientIds',t.omitted,'basis','ONE_STANDARD_SERVING','quantitiesIndependentlyVerified',false)
 FROM drink_recipe_targets t CROSS JOIN LATERAL jsonb_array_elements(t.items) item
 JOIN LATERAL(SELECT id FROM food_ingredients WHERE name=item->>'ingredientName' ORDER BY id LIMIT 1) f ON true;
UPDATE dishes d SET standard_serving_size_g=t.serving,nutrition_verified=false,
 source_metadata=COALESCE(d.source_metadata,'{}'::jsonb) || jsonb_build_object(
 'recipeStatus','APPROVED_REFERENCE','servingSizeStatus','REFERENCE','menuPlanningEnabled',true,
 'referenceSource','ARCHIVED_SEED_TEMPLATE','drinkFamily',t.family,'omittedLegacyIngredientIds',t.omitted)
 FROM drink_recipe_targets t WHERE d.id=t.id;
UPDATE dish_nutrition n SET source_metadata=jsonb_build_object(
 'status','APPROVED_REFERENCE','origin','ARCHIVED_SEED_TEMPLATE','basis','ONE_STANDARD_SERVING',
 'quantitiesIndependentlyVerified',false,
 'calculation','SUM(ingredient nutrient per 100g * netWeightG / 100)',
 'processingNote','Reference ingredient totals; extraction and straining losses have not been measured.',
 'unverifiedIngredients',COALESCE((SELECT jsonb_agg(DISTINCT f.name) FROM dish_recipes r
 JOIN food_ingredients f ON f.id=r.ingredient_id WHERE r.dish_id=n.dish_id
 AND f.source_metadata->>'kind'='LEGACY_UNVERIFIED'),'[]'::jsonb),
 'missingNutrients',COALESCE((SELECT jsonb_agg(DISTINCT missing.value) FROM dish_recipes r
 JOIN food_ingredients f ON f.id=r.ingredient_id
 CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(f.source_metadata->'missingNutrients','[]'::jsonb)) missing(value)
 WHERE r.dish_id=n.dish_id),'[]'::jsonb))
 FROM drink_recipe_targets t WHERE n.dish_id=t.id;
INSERT INTO dish_allergens(dish_id,allergen_id,risk_level,note)
 SELECT t.id,a.id,'HIGH','Present in the restored reference drink recipe'
 FROM drink_recipe_targets t JOIN allergens a ON
 (t.family='YOGURT' AND a.code='MILK') OR (t.family='SOY_MILK' AND a.code='SOY')
 ON CONFLICT(dish_id,allergen_id) DO NOTHING;
INSERT INTO audit_logs(school_id,user_id,action,target_entity,details)
 SELECT (SELECT min(id) FROM schools),NULL,'DRINK_RECIPES_RESTORED','DISH',
 jsonb_build_object('actorKind','USER_REQUEST_VIA_ASSISTANT','restoredDishes',count(*),
 'source','ARCHIVED_SEED_TEMPLATE','quantitiesIndependentlyVerified',false,'draftPlanningOnly',true)
 FROM drink_recipe_targets HAVING count(*)>0;
COMMIT;
`;
}
if (require.main === module) {
  fs.writeFileSync(path.resolve(__dirname, '../database/migrations/20261105-drink-recipes.sql'), buildSql(), 'utf8');
  console.log(`Generated ${targets.length} reference drink templates from archived weights.`);
}
module.exports = { buildSql, targets };
