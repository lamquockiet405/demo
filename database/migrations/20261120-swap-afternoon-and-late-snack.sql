-- Hoán đổi 2 buổi theo yêu cầu:
-- Buổi xế (14:30): Nước uống / Trái cây (DRINK)
-- Buổi chiều phụ (17:00): Đồ ăn (Cháo, Bún, Bánh mặn... - SNACK_AFTERNOON)

-- 1. Cập nhật tên nhóm món trong dish_categories
UPDATE dish_categories 
SET name = 'Nước uống / Trái cây xế (14:30)' 
WHERE code = 'DRINK';

UPDATE dish_categories 
SET name = 'Món ăn chiều phụ (17:00)' 
WHERE code = 'SNACK_AFTERNOON';

-- 2. Cập nhật ghi chú meal_energy_distributions
UPDATE meal_energy_distributions
SET meal_label = 'Buổi xế',
    meal_time = '14:30',
    note = 'Buổi xế lúc 14h30 (nước uống / nước trái cây / sữa)'
WHERE meal_type = 'AFTERNOON_SNACK';

UPDATE meal_energy_distributions
SET meal_label = 'Buổi chiều phụ',
    meal_time = '17:00',
    note = 'Buổi chiều phụ lúc 17h (món ăn: cháo, bún, bánh mặn...)'
WHERE meal_type = 'LATE_SNACK';

-- 3. Hoán đổi vị trí món giữa AFTERNOON_SNACK và LATE_SNACK
DO $$
DECLARE
    r RECORD;
    snack_meal_id INT;
    late_meal_id INT;
BEGIN
    FOR r IN (SELECT id FROM menu_days) LOOP
        SELECT id INTO snack_meal_id FROM menu_meals WHERE menu_day_id = r.id AND meal_type = 'AFTERNOON_SNACK';
        SELECT id INTO late_meal_id FROM menu_meals WHERE menu_day_id = r.id AND meal_type = 'LATE_SNACK';
        
        IF snack_meal_id IS NOT NULL AND late_meal_id IS NOT NULL THEN
            -- Chuyển DRINK sang AFTERNOON_SNACK
            UPDATE menu_dishes mdish
            SET menu_meal_id = snack_meal_id
            FROM dishes d, dish_categories c
            WHERE mdish.menu_meal_id = late_meal_id
              AND mdish.dish_id = d.id
              AND d.category_id = c.id
              AND c.code = 'DRINK';

            -- Chuyển SNACK_AFTERNOON sang LATE_SNACK
            UPDATE menu_dishes mdish
            SET menu_meal_id = late_meal_id
            FROM dishes d, dish_categories c
            WHERE mdish.menu_meal_id = snack_meal_id
              AND mdish.dish_id = d.id
              AND d.category_id = c.id
              AND c.code = 'SNACK_AFTERNOON';
        END IF;
    END LOOP;
END $$;
