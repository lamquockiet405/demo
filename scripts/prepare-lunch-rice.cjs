const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalog = require('../database/generated/source-catalog.json');
const archive = require('../database/reference/unverified-seed-recipes.json');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const foods = {
  1: 'Gạo tẻ máy', 77: 'Lạp xưởng tôm/thịt', 76: 'Chả lụa heo (giò lụa)',
  90: 'Trứng gà ta', 84: 'Tôm thẻ tươi sống', 39: 'Cà rốt (củ đỏ, vàng)',
  41: 'Đậu que (đậu cô ve)', 65: 'Dầu thực vật tinh luyện', 86: 'Mực ống tươi',
};
const rice = catalog.dishes.filter(dish => dish.categoryCode === 'RICE');
const targets = [
  { dish: rice.find(dish => dish.name === 'Cơm'), legacyId: 1, serving: 100 },
  { dish: rice.find(dish => dish.name.includes('Dương Châu') && dish.name.includes('chả lụa')), legacyId: 2, serving: 120 },
  { dish: rice.find(dish => dish.name.includes('hải sản')), legacyId: 3, serving: 120 },
];
if (targets.some(target => !target.dish)) throw new Error('Expected rice dishes are missing from the source catalog');
const targetValues = targets.map(t => `(${quote(t.dish.key)},${t.legacyId},${t.serving})`).join(',\n');
const recipeValues = archive.rows.filter(row => [1, 2, 3].includes(row.dishId)).map(row => {
  if (!foods[row.ingredientId]) throw new Error('Missing archived ingredient mapping');
  return `(${row.dishId},${row.id},${quote(foods[row.ingredientId])},${row.grossWeightG},${row.netWeightG},${quote(row.note)})`;
}).join(',\n');
const sql = `-- Quantities inherited unchanged from archived seed recipes, not new kitchen measurements.
-- Restored as user-approved REFERENCE templates for the requested weekday lunch rule.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtext('kidmeal-lunch-rice-recipes'));
CREATE TEMP TABLE lunch_rice_targets ON COMMIT DROP AS
 SELECT d.id,t.legacy_id,t.serving FROM (VALUES ${targetValues}) AS t(source_key,legacy_id,serving)
 JOIN dishes d ON d.source_metadata->>'key'=t.source_key
 WHERE NOT EXISTS(SELECT 1 FROM dish_recipes r WHERE r.dish_id=d.id);
CREATE TEMP TABLE lunch_rice_recipe_rows ON COMMIT DROP AS
 SELECT * FROM (VALUES ${recipeValues}) AS r(legacy_id,recipe_id,ingredient_name,gross_g,net_g,note);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM lunch_rice_targets t JOIN lunch_rice_recipe_rows r USING(legacy_id)
  WHERE NOT EXISTS(SELECT 1 FROM food_ingredients f WHERE f.name=r.ingredient_name)) THEN
  RAISE EXCEPTION 'A required rice recipe ingredient is missing';
 END IF;
END $$;
INSERT INTO dish_recipes(dish_id,ingredient_id,gross_weight_g,net_weight_g,note,source_metadata)
 SELECT t.id,f.id,r.gross_g,r.net_g,'[THAM KHẢO - công thức mẫu cũ] ' || r.note,
 jsonb_build_object('status','USER_APPROVED_REFERENCE','origin','ARCHIVED_SEED_TEMPLATE',
  'legacyRecipeId',r.recipe_id,'legacyDishId',r.legacy_id,'basis','ONE_STANDARD_SERVING',
  'quantitiesIndependentlyVerified',false)
 FROM lunch_rice_targets t JOIN lunch_rice_recipe_rows r USING(legacy_id)
 JOIN LATERAL(SELECT id FROM food_ingredients WHERE name=r.ingredient_name ORDER BY id LIMIT 1) f ON true;
UPDATE dishes d SET standard_serving_size_g=t.serving,nutrition_verified=TRUE,
 source_metadata=COALESCE(d.source_metadata,'{}'::jsonb) || jsonb_build_object(
  'recipeStatus','USER_APPROVED_REFERENCE','servingSizeStatus','REFERENCE',
  'referenceSource','ARCHIVED_SEED_TEMPLATE','legacyDishId',t.legacy_id)
 FROM lunch_rice_targets t WHERE t.id=d.id;
UPDATE dish_nutrition n SET source_metadata=jsonb_build_object(
 'status','USER_APPROVED_REFERENCE','origin','ARCHIVED_SEED_TEMPLATE',
 'basis','ONE_STANDARD_SERVING','quantitiesIndependentlyVerified',false,
 'calculation','SUM(ingredient nutrient per 100g * netWeightG / 100)')
 FROM lunch_rice_targets t WHERE n.dish_id=t.id;
INSERT INTO dish_allergens(dish_id,allergen_id,risk_level,note)
 SELECT t.id,a.id,'HIGH','Present in the restored reference recipe'
 FROM lunch_rice_targets t JOIN allergens a ON a.code IN ('EGG','SEAFOOD')
 WHERE t.legacy_id IN(2,3) ON CONFLICT(dish_id,allergen_id) DO NOTHING;
INSERT INTO audit_logs(school_id,user_id,action,target_entity,details)
 SELECT (SELECT min(id) FROM schools),NULL,'LUNCH_RICE_RECIPES_RESTORED','DISH',
 jsonb_build_object('actorKind','USER_REQUEST_VIA_ASSISTANT','restoredDishes',count(*),
  'source','ARCHIVED_SEED_TEMPLATE','quantitiesIndependentlyVerified',false)
 FROM lunch_rice_targets HAVING count(*)>0;
COMMIT;
`;
const output = path.join(root, 'database/migrations/20261103-lunch-rice-recipes.sql');
fs.writeFileSync(output, sql, 'utf8');
console.log('Generated rice recipe migration from archived quantities.');
