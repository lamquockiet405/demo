BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_meals_day_pair ON menu_meals(id,menu_day_id);
CREATE TABLE IF NOT EXISTS daily_meal_nutrition (
    menu_meal_id BIGINT PRIMARY KEY,
    menu_day_id BIGINT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
    energy_kcal NUMERIC(14,4), protein_g NUMERIC(14,4), fat_g NUMERIC(14,4), carb_g NUMERIC(14,4),
    fiber_g NUMERIC(14,4), calcium_mg NUMERIC(14,4), iron_mg NUMERIC(14,4), zinc_mg NUMERIC(14,4),
    energy_percent NUMERIC(5,2) CHECK (energy_percent BETWEEN 0 AND 100),
    protein_percent NUMERIC(5,2) CHECK (protein_percent BETWEEN 0 AND 100),
    fat_percent NUMERIC(5,2) CHECK (fat_percent BETWEEN 0 AND 100),
    carb_percent NUMERIC(5,2) CHECK (carb_percent BETWEEN 0 AND 100),
    fiber_percent NUMERIC(5,2) CHECK (fiber_percent BETWEEN 0 AND 100),
    calcium_percent NUMERIC(5,2) CHECK (calcium_percent BETWEEN 0 AND 100),
    iron_percent NUMERIC(5,2) CHECK (iron_percent BETWEEN 0 AND 100),
    zinc_percent NUMERIC(5,2) CHECK (zinc_percent BETWEEN 0 AND 100),
    dish_count INT NOT NULL DEFAULT 0 CHECK (dish_count>=0),
    missing_dishes JSONB NOT NULL DEFAULT '[]'::jsonb,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_meal_id,menu_day_id) REFERENCES menu_meals(id,menu_day_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_daily_meal_nutrition_day ON daily_meal_nutrition(menu_day_id);
COMMENT ON TABLE daily_meal_nutrition IS 'Derived nutrition per child portion and meal. Each percentage uses the same nutrient total in the selected menu day; NULL means unknown or a zero denominator.';

CREATE OR REPLACE FUNCTION invalidate_daily_meal_nutrition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE meal_ids BIGINT[] := '{}'; day_ids BIGINT[] := '{}'; dish_ids BIGINT[] := '{}';
BEGIN
    IF TG_TABLE_NAME='menu_dishes' THEN
        IF TG_OP<>'INSERT' THEN meal_ids := array_append(meal_ids,OLD.menu_meal_id); END IF;
        IF TG_OP<>'DELETE' THEN meal_ids := array_append(meal_ids,NEW.menu_meal_id); END IF;
        DELETE FROM daily_meal_nutrition WHERE menu_day_id IN (SELECT menu_day_id FROM menu_meals WHERE id=ANY(meal_ids));
    ELSIF TG_TABLE_NAME='menu_meals' THEN
        IF TG_OP<>'INSERT' THEN day_ids := array_append(day_ids,OLD.menu_day_id); END IF;
        IF TG_OP<>'DELETE' THEN day_ids := array_append(day_ids,NEW.menu_day_id); END IF;
        DELETE FROM daily_meal_nutrition WHERE menu_day_id=ANY(day_ids);
    ELSE
        IF TG_TABLE_NAME='dishes' THEN
            IF TG_OP<>'INSERT' THEN dish_ids := array_append(dish_ids,OLD.id); END IF;
            IF TG_OP<>'DELETE' THEN dish_ids := array_append(dish_ids,NEW.id); END IF;
        ELSE
            IF TG_OP<>'INSERT' THEN dish_ids := array_append(dish_ids,OLD.dish_id); END IF;
            IF TG_OP<>'DELETE' THEN dish_ids := array_append(dish_ids,NEW.dish_id); END IF;
        END IF;
        DELETE FROM daily_meal_nutrition WHERE menu_day_id IN (
            SELECT mm.menu_day_id FROM menu_dishes md JOIN menu_meals mm ON mm.id=md.menu_meal_id WHERE md.dish_id=ANY(dish_ids));
    END IF;
    RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_daily_nutrition_menu_dishes ON menu_dishes;
CREATE TRIGGER trg_daily_nutrition_menu_dishes AFTER INSERT OR UPDATE OR DELETE ON menu_dishes FOR EACH ROW EXECUTE FUNCTION invalidate_daily_meal_nutrition();
DROP TRIGGER IF EXISTS trg_daily_nutrition_meals ON menu_meals;
CREATE TRIGGER trg_daily_nutrition_meals AFTER INSERT OR UPDATE OR DELETE ON menu_meals FOR EACH ROW EXECUTE FUNCTION invalidate_daily_meal_nutrition();
DROP TRIGGER IF EXISTS trg_daily_nutrition_dishes ON dishes;
CREATE TRIGGER trg_daily_nutrition_dishes AFTER UPDATE OR DELETE ON dishes FOR EACH ROW EXECUTE FUNCTION invalidate_daily_meal_nutrition();
DROP TRIGGER IF EXISTS trg_daily_nutrition_values ON dish_nutrition;
CREATE TRIGGER trg_daily_nutrition_values AFTER INSERT OR UPDATE OR DELETE ON dish_nutrition FOR EACH ROW EXECUTE FUNCTION invalidate_daily_meal_nutrition();
COMMIT;
