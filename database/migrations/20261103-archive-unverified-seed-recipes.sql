-- Retain original sample data for inspection without presenting it as a recipe.
CREATE TABLE IF NOT EXISTS source_catalog_legacy_recipes (
    original_recipe_id BIGINT PRIMARY KEY,
    dish_name TEXT,
    ingredient_name TEXT,
    recipe JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT 'UNVERIFIED_SEED_RECIPE',
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_catalog_legacy_nutrition (
    original_dish_id BIGINT PRIMARY KEY,
    dish_name TEXT,
    nutrition JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT 'DERIVED_FROM_UNVERIFIED_SEED_RECIPE',
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
