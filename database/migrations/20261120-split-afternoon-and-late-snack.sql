-- Tách 2 buổi: Buổi xế (14:30) và Buổi chiều phụ (17:00)
-- 1. Cập nhật tên nhóm món trong dish_categories
UPDATE dish_categories 
SET name = 'Món ăn xế (14:30)' 
WHERE code = 'SNACK_AFTERNOON';

UPDATE dish_categories 
SET name = 'Nước / Phụ chiều (17:00)' 
WHERE code = 'DRINK';

-- 2. Đảm bảo meal_energy_distributions có cấu hình chuẩn cho cả AFTERNOON_SNACK và LATE_SNACK
UPDATE meal_energy_distributions
SET meal_label = 'Buổi xế',
    meal_time = '14:30'
WHERE meal_type = 'AFTERNOON_SNACK';

-- Thêm cấu hình LATE_SNACK (17:00) nếu chưa có
INSERT INTO meal_energy_distributions (
    school_id, age_group, meal_type, meal_label, meal_time, 
    display_order, energy_pct_min, energy_pct_max, is_active, 
    note, created_at, updated_at, water_pct_min, water_pct_max, water_ml_min, water_ml_max
)
SELECT 
    1, 'MAU_GIAO', 'LATE_SNACK', 'Buổi chiều phụ', '17:00',
    4, 5.00, 10.00, true,
    'Buổi chiều phụ lúc 17h (nước uống/sữa/phụ chiều muộn)',
    NOW(), NOW(), 10.00, 15.00, 150.00, 250.00
WHERE NOT EXISTS (
    SELECT 1 FROM meal_energy_distributions 
    WHERE school_id = 1 AND age_group = 'MAU_GIAO' AND meal_type = 'LATE_SNACK'
);

INSERT INTO meal_energy_distributions (
    school_id, age_group, meal_type, meal_label, meal_time, 
    display_order, energy_pct_min, energy_pct_max, is_active, 
    note, created_at, updated_at, water_pct_min, water_pct_max, water_ml_min, water_ml_max
)
SELECT 
    1, 'NHA_TRE', 'LATE_SNACK', 'Buổi chiều phụ', '17:00',
    4, 5.00, 10.00, true,
    'Buổi chiều phụ lúc 17h (nước uống/sữa/phụ chiều muộn)',
    NOW(), NOW(), 10.00, 15.00, 100.00, 150.00
WHERE NOT EXISTS (
    SELECT 1 FROM meal_energy_distributions 
    WHERE school_id = 1 AND age_group = 'NHA_TRE' AND meal_type = 'LATE_SNACK'
);

-- 3. Tạo bữa LATE_SNACK trong menu_meals cho tất cả các ngày trong thực đơn
DO $$
DECLARE
    r RECORD;
    new_meal_id INT;
BEGIN
    FOR r IN (
        SELECT md.id AS menu_day_id
        FROM menu_days md
        WHERE NOT EXISTS (
            SELECT 1 FROM menu_meals mm 
            WHERE mm.menu_day_id = md.id AND mm.meal_type = 'LATE_SNACK'
        )
    ) LOOP
        INSERT INTO menu_meals (menu_day_id, meal_type)
        VALUES (r.menu_day_id, 'LATE_SNACK')
        RETURNING id INTO new_meal_id;

        -- Chuyển các món nước uống (DRINK - category 8) từ AFTERNOON_SNACK sang LATE_SNACK
        UPDATE menu_dishes mdish
        SET menu_meal_id = new_meal_id
        FROM menu_meals mmeal, dishes d, dish_categories c
        WHERE mdish.menu_meal_id = mmeal.id
          AND mmeal.menu_day_id = r.menu_day_id
          AND mmeal.meal_type = 'AFTERNOON_SNACK'
          AND mdish.dish_id = d.id
          AND d.category_id = c.id
          AND c.code = 'DRINK';
    END LOOP;
END $$;
