-- Applied before deploying the API changes; also included by the source importer.
ALTER TABLE food_ingredients ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS nutrition_verified BOOLEAN NOT NULL DEFAULT TRUE;

-- Refresh caches when ingredient composition changes, not only recipe weights.
CREATE OR REPLACE FUNCTION refresh_ingredient_dish_nutrition()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dish_recipes SET net_weight_g = net_weight_g WHERE ingredient_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_refresh_ingredient_nutrition ON food_ingredients;
CREATE TRIGGER trg_refresh_ingredient_nutrition
AFTER UPDATE OF energy_kcal_100g, protein_g, fat_g, carb_g, fiber_g, calcium_mg, iron_mg, zinc_mg
ON food_ingredients FOR EACH ROW EXECUTE FUNCTION refresh_ingredient_dish_nutrition();
