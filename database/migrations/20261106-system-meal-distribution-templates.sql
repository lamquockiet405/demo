-- Migration: 20261106-system-meal-distribution-templates.sql
-- Chuyển toàn bộ giá trị mặc định & mốc tham chiếu từ code vào Database (PostgreSQL).
-- Khi school_id IS NULL, bản ghi đóng vai trò là "Mẫu chuẩn Quốc gia (01/VBHN-BGDĐT)" dùng chung toàn hệ thống.

-- 1. Cho phép school_id mang giá trị NULL trong meal_energy_distributions
ALTER TABLE meal_energy_distributions ALTER COLUMN school_id DROP NOT NULL;

-- 2. Cập nhật ràng buộc UNIQUE của meal_energy_distributions
ALTER TABLE meal_energy_distributions DROP CONSTRAINT IF EXISTS meal_energy_distributions_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_dist_school
  ON meal_energy_distributions(school_id, age_group, meal_type)
  WHERE school_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_dist_system
  ON meal_energy_distributions(age_group, meal_type)
  WHERE school_id IS NULL;

-- 3. Cho phép school_id mang giá trị NULL trong nutrition_intake_standards
ALTER TABLE nutrition_intake_standards ALTER COLUMN school_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_intake_std_system
  ON nutrition_intake_standards(age_group, meal_scope)
  WHERE school_id IS NULL;

-- 4. Thêm các bản ghi mẫu chuẩn cả ngày & tại trường vào nutrition_intake_standards (school_id = NULL)
INSERT INTO nutrition_intake_standards (
  school_id, standard_name, age_group, gender, meal_scope,
  energy_kcal_min, energy_kcal_max,
  protein_ratio_min, protein_ratio_max,
  lipid_ratio_min, lipid_ratio_max,
  carbohydrate_ratio_min, carbohydrate_ratio_max,
  water_ml_min, water_ml_max,
  is_active, note, source_metadata
)
VALUES
  (NULL, 'Mẫu giáo 3–6 tuổi — Chuẩn cả ngày (01/VBHN-BGDĐT)', 'MAU_GIAO', 'ALL', 'ALL_DAY',
   1230.00, 1320.00, 13.00, 20.00, 25.00, 35.00, 52.00, 60.00, 1600.00, 2000.00,
   true, 'Mẫu chuẩn Quốc gia theo Chương trình GDMN', '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_MAU_GIAO_ALL_DAY"}'::jsonb),
  (NULL, 'Mẫu giáo 3–6 tuổi — Chuẩn tại trường (01/VBHN-BGDĐT)', 'MAU_GIAO', 'ALL', 'DAYBOARDING',
   615.00, 726.00, 13.00, 20.00, 25.00, 35.00, 52.00, 60.00, 800.00, 1100.00,
   true, 'Mẫu chuẩn Quốc gia 50–55% tại trường', '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_MAU_GIAO_DAYBOARDING"}'::jsonb),
  (NULL, 'Nhà trẻ 12–36 tháng — Chuẩn cả ngày (01/VBHN-BGDĐT)', 'NHA_TRE', 'ALL', 'ALL_DAY',
   930.00, 1000.00, 13.00, 20.00, 30.00, 40.00, 47.00, 50.00, 800.00, 1000.00,
   true, 'Mẫu chuẩn Quốc gia theo Chương trình GDMN', '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_NHA_TRE_ALL_DAY"}'::jsonb),
  (NULL, 'Nhà trẻ 12–36 tháng — Chuẩn tại trường (01/VBHN-BGDĐT)', 'NHA_TRE', 'ALL', 'DAYBOARDING',
   600.00, 651.00, 13.00, 20.00, 30.00, 40.00, 47.00, 50.00, 500.00, 700.00,
   true, 'Mẫu chuẩn Quốc gia 60–70% tại trường', '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_NHA_TRE_DAYBOARDING"}'::jsonb)
ON CONFLICT (age_group, meal_scope) WHERE school_id IS NULL DO UPDATE SET
  standard_name = EXCLUDED.standard_name,
  energy_kcal_min = EXCLUDED.energy_kcal_min,
  energy_kcal_max = EXCLUDED.energy_kcal_max,
  protein_ratio_min = EXCLUDED.protein_ratio_min,
  protein_ratio_max = EXCLUDED.protein_ratio_max,
  lipid_ratio_min = EXCLUDED.lipid_ratio_min,
  lipid_ratio_max = EXCLUDED.lipid_ratio_max,
  carbohydrate_ratio_min = EXCLUDED.carbohydrate_ratio_min,
  carbohydrate_ratio_max = EXCLUDED.carbohydrate_ratio_max,
  water_ml_min = EXCLUDED.water_ml_min,
  water_ml_max = EXCLUDED.water_ml_max;

-- 5. Thêm các bản ghi mẫu phân bổ bữa ăn vào meal_energy_distributions (school_id = NULL)
INSERT INTO meal_energy_distributions (
  school_id, age_group, meal_type, meal_label, meal_time, display_order,
  energy_pct_min, energy_pct_max,
  water_pct_min, water_pct_max,
  water_ml_min, water_ml_max,
  is_active, note, source_metadata
)
VALUES
  (NULL, 'NHA_TRE', 'BREAKFAST', 'Buổi sáng', '09:00', 1,
   5.00, 10.00, 10.00, 15.00, 100.00, 150.00,
   true, 'Bữa phụ sáng tại trường (5–10% calo, 100–150 ml nước uống/sữa).',
   '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_NHA_TRE:BREAKFAST"}'::jsonb),
  (NULL, 'NHA_TRE', 'LUNCH', 'Bữa trưa chính', '11:00', 2,
   30.00, 35.00, 30.00, 35.00, 250.00, 350.00,
   true, 'Bữa trưa cung cấp 30–35% năng lượng, 250–350 ml nước (canh + nước uống).',
   '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_NHA_TRE:LUNCH"}'::jsonb),
  (NULL, 'NHA_TRE', 'AFTERNOON_SNACK', 'Bữa chiều', '14:30', 3,
   25.00, 30.00, 20.00, 25.00, 150.00, 250.00,
   true, 'Bữa chiều cung cấp 25–30% năng lượng, 150–250 ml sữa hoặc nước quả.',
   '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_NHA_TRE:AFTERNOON_SNACK"}'::jsonb),
  (NULL, 'MAU_GIAO', 'BREAKFAST', 'Buổi sáng', '09:00', 1,
   5.00, 10.00, 10.00, 15.00, 150.00, 250.00,
   true, 'Bữa phụ buổi sáng (5–10% calo, 150–250 ml nước uống/sữa).',
   '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_MAU_GIAO:BREAKFAST"}'::jsonb),
  (NULL, 'MAU_GIAO', 'LUNCH', 'Bữa trưa chính', '11:00', 2,
   30.00, 35.00, 30.00, 35.00, 450.00, 600.00,
   true, 'Bữa chính trưa 30–35% calo, 450–600 ml gồm bát canh đầy + nước tráng miệng.',
   '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_MAU_GIAO:LUNCH"}'::jsonb),
  (NULL, 'MAU_GIAO', 'AFTERNOON_SNACK', 'Bữa phụ chiều', '14:30', 3,
   10.00, 15.00, 15.00, 20.00, 250.00, 350.00,
   true, 'Bữa phụ chiều 10–15% calo, 250–350 ml sữa hoặc sinh tố hoa quả.',
   '{"source":"01/VBHN-BGDĐT 13/4/2021","seedKey":"SYSTEM_MAU_GIAO:AFTERNOON_SNACK"}'::jsonb)
ON CONFLICT (age_group, meal_type) WHERE school_id IS NULL DO UPDATE SET
  meal_label = EXCLUDED.meal_label,
  meal_time = EXCLUDED.meal_time,
  display_order = EXCLUDED.display_order,
  energy_pct_min = EXCLUDED.energy_pct_min,
  energy_pct_max = EXCLUDED.energy_pct_max,
  water_pct_min = EXCLUDED.water_pct_min,
  water_pct_max = EXCLUDED.water_pct_max,
  water_ml_min = EXCLUDED.water_ml_min,
  water_ml_max = EXCLUDED.water_ml_max,
  note = EXCLUDED.note;
