-- Quantities inherited unchanged from archived seed recipes, not new kitchen measurements.
-- Restored as user-approved REFERENCE templates for the requested weekday lunch rule.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtext('kidmeal-lunch-rice-recipes'));
CREATE TEMP TABLE lunch_rice_targets ON COMMIT DROP AS
 SELECT d.id,t.legacy_id,t.serving FROM (VALUES ('cơm',1,100),
('cơm dương châu thịt nạc chả lụa tôm cà tốt đậu đũa',2,120),
('cơm chiên hải sản (thịt nạc tôm mực cà rốt đậu que)',3,120)) AS t(source_key,legacy_id,serving)
 JOIN dishes d ON d.source_metadata->>'key'=t.source_key
 WHERE NOT EXISTS(SELECT 1 FROM dish_recipes r WHERE r.dish_id=d.id);
CREATE TEMP TABLE lunch_rice_recipe_rows ON COMMIT DROP AS
 SELECT * FROM (VALUES (1,1,'Gạo tẻ máy',50,50,'Gạo tẻ vo sạch nấu mềm'),
(2,2,'Gạo tẻ máy',45,45,'Gạo tẻ'),
(2,3,'Lạp xưởng tôm/thịt',10,10,'Lạp xưởng thái hạt lựu'),
(2,4,'Chả lụa heo (giò lụa)',10,10,'Chả lụa'),
(2,5,'Trứng gà ta',15,15,'Trứng gà'),
(2,6,'Tôm thẻ tươi sống',15,10,'Tôm thẻ'),
(2,7,'Cà rốt (củ đỏ, vàng)',12,10,'Cà rốt'),
(2,8,'Đậu que (đậu cô ve)',12,10,'Đậu que'),
(2,9,'Dầu thực vật tinh luyện',3,3,'Dầu ăn'),
(3,10,'Gạo tẻ máy',45,45,'Gạo tẻ'),
(3,11,'Tôm thẻ tươi sống',20,15,'Tôm thẻ'),
(3,12,'Mực ống tươi',18,15,'Mực tươi'),
(3,13,'Trứng gà ta',15,15,'Trứng gà'),
(3,14,'Cà rốt (củ đỏ, vàng)',12,10,'Cà rốt'),
(3,15,'Đậu que (đậu cô ve)',12,10,'Đậu que'),
(3,16,'Dầu thực vật tinh luyện',3,3,'Dầu ăn')) AS r(legacy_id,recipe_id,ingredient_name,gross_g,net_g,note);
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
