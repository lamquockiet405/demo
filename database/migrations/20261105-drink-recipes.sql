-- Reference drink templates requested for draft menu planning.
-- Weights inherited from archived seed; no new nutrient values are supplied.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtext('kidmeal-drink-recipes'));
CREATE TEMP TABLE drink_templates ON COMMIT DROP AS
 SELECT * FROM jsonb_to_recordset('[{"key":"yaourt","legacyId":94,"serving":100,"family":"YOGURT","omitted":[],"items":[{"ingredientName":"Yaourt (sữa chua có đường)","gross":100,"net":100,"legacyRecipeId":281,"note":"Sữa chua"}]},{"key":"nước cam","legacyId":95,"serving":120,"family":"ORANGE","omitted":[],"items":[{"ingredientName":"Nước cam tươi nguyên chất","gross":120,"net":120,"legacyRecipeId":282,"note":"Nước cam"},{"ingredientName":"Đường phèn / Đường kính trắng","gross":5,"net":5,"legacyRecipeId":283,"note":"Đường phèn"}]},{"key":"nước ép cam","legacyId":95,"serving":120,"family":"ORANGE","omitted":[96],"items":[{"ingredientName":"Nước cam tươi nguyên chất","gross":120,"net":120,"legacyRecipeId":282,"note":"Nước cam"}]},{"key":"sữa đậu nành","legacyId":96,"serving":150,"family":"SOY_MILK","omitted":[],"items":[{"ingredientName":"Sữa đậu nành nguyên chất","gross":150,"net":150,"legacyRecipeId":284,"note":"Sữa đậu nành"},{"ingredientName":"Đường phèn / Đường kính trắng","gross":5,"net":5,"legacyRecipeId":285,"note":"Đường phèn"}]},{"key":"sâm bí đao","legacyId":98,"serving":140,"family":"WINTER_MELON","omitted":[25],"items":[{"ingredientName":"Bí đao (bí xanh)","gross":50,"net":40,"legacyRecipeId":288,"note":"Bí đao"},{"ingredientName":"Đường phèn / Đường kính trắng","gross":8,"net":8,"legacyRecipeId":290,"note":"Đường phèn"}]},{"key":"nước sâm bí đao","legacyId":98,"serving":140,"family":"WINTER_MELON","omitted":[25],"items":[{"ingredientName":"Bí đao (bí xanh)","gross":50,"net":40,"legacyRecipeId":288,"note":"Bí đao"},{"ingredientName":"Đường phèn / Đường kính trắng","gross":8,"net":8,"legacyRecipeId":290,"note":"Đường phèn"}]},{"key":"sâm bí đao hạt chia đường phèn","legacyId":98,"serving":140,"family":"WINTER_MELON","omitted":[],"items":[{"ingredientName":"Bí đao (bí xanh)","gross":50,"net":40,"legacyRecipeId":288,"note":"Bí đao"},{"ingredientName":"Hạt chia hữu cơ","gross":3,"net":3,"legacyRecipeId":289,"note":"Hạt chia"},{"ingredientName":"Đường phèn / Đường kính trắng","gross":8,"net":8,"legacyRecipeId":290,"note":"Đường phèn"}]},{"key":"nước đậu rang","legacyId":99,"serving":140,"family":"ROASTED_BEAN","omitted":[96],"items":[{"ingredientName":"Đậu đen (hạt)","gross":15,"net":15,"legacyRecipeId":291,"note":"Đậu đen"}]},{"key":"nước đậu rang đường phèn","legacyId":99,"serving":140,"family":"ROASTED_BEAN","omitted":[],"items":[{"ingredientName":"Đậu đen (hạt)","gross":15,"net":15,"legacyRecipeId":291,"note":"Đậu đen"},{"ingredientName":"Đường phèn / Đường kính trắng","gross":8,"net":8,"legacyRecipeId":292,"note":"Đường phèn"}]},{"key":"nước mía","legacyId":100,"serving":120,"family":"SUGARCANE","omitted":[],"items":[{"ingredientName":"Nước mía tươi","gross":120,"net":120,"legacyRecipeId":293,"note":"Nước mía"}]}]'::jsonb)
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
