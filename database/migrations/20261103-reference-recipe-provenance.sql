ALTER TABLE dish_recipes ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE dish_nutrition ADD COLUMN IF NOT EXISTS source_metadata JSONB;
