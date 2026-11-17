-- Migration: 20261106-water-intake-requirement.sql
-- Bổ sung định mức & phân bổ nhu cầu nước (ml/ngày) cho trẻ em mầm non.
-- Nguồn tham chiếu:
--   Chương trình Giáo dục Mầm non (01/VBHN-BGDĐT ngày 13/4/2021)
--     - Nhà trẻ (12–36 tháng): 800 – 1.000 ml/ngày (kể cả nước trong thức ăn & sữa); tại trường: 500 – 700 ml.
--     - Mẫu giáo (3–6 tuổi): 1.600 – 2.000 ml/ngày (kể cả nước trong thức ăn); tại trường: 800 – 1.100 ml.
-- Idempotent: chạy lại an toàn, không ghi đè dữ liệu tùy biến.

-- 1. Bổ sung cột nước vào bảng meal_energy_distributions
ALTER TABLE meal_energy_distributions
  ADD COLUMN IF NOT EXISTS water_pct_min NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS water_pct_max NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS water_ml_min  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS water_ml_max  NUMERIC(8,2);

-- 2. Bổ sung cột nước vào bảng nutrition_intake_standards
ALTER TABLE nutrition_intake_standards
  ADD COLUMN IF NOT EXISTS water_ml_min NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS water_ml_max NUMERIC(8,2);

-- 3. Cập nhật định mức nước chuẩn cho các bản ghi mẫu giáo & nhà trẻ trong nutrition_intake_standards
UPDATE nutrition_intake_standards
SET water_ml_min = 1600.0, water_ml_max = 2000.0
WHERE age_group = 'MAU_GIAO' AND meal_scope = 'ALL_DAY' AND water_ml_min IS NULL;

UPDATE nutrition_intake_standards
SET water_ml_min = 800.0, water_ml_max = 1100.0
WHERE age_group = 'MAU_GIAO' AND meal_scope = 'DAYBOARDING' AND water_ml_min IS NULL;

UPDATE nutrition_intake_standards
SET water_ml_min = 800.0, water_ml_max = 1000.0
WHERE age_group = 'NHA_TRE' AND meal_scope = 'ALL_DAY' AND water_ml_min IS NULL;

UPDATE nutrition_intake_standards
SET water_ml_min = 500.0, water_ml_max = 700.0
WHERE age_group = 'NHA_TRE' AND meal_scope = 'DAYBOARDING' AND water_ml_min IS NULL;

-- 4. Cập nhật phân bổ nước cho các bữa trong meal_energy_distributions
-- Nhà trẻ: Sáng (~15%), Trưa (~35%), Chiều (~25%)
UPDATE meal_energy_distributions
SET water_pct_min = 10.0, water_pct_max = 15.0, water_ml_min = 100.0, water_ml_max = 150.0
WHERE age_group = 'NHA_TRE' AND meal_type = 'BREAKFAST' AND (water_pct_min IS NULL OR water_pct_min = 0);

UPDATE meal_energy_distributions
SET water_pct_min = 30.0, water_pct_max = 35.0, water_ml_min = 250.0, water_ml_max = 350.0
WHERE age_group = 'NHA_TRE' AND meal_type = 'LUNCH' AND (water_pct_min IS NULL OR water_pct_min = 0);

UPDATE meal_energy_distributions
SET water_pct_min = 20.0, water_pct_max = 25.0, water_ml_min = 150.0, water_ml_max = 250.0
WHERE age_group = 'NHA_TRE' AND meal_type = 'AFTERNOON_SNACK' AND (water_pct_min IS NULL OR water_pct_min = 0);

-- Mẫu giáo: Sáng (~10-15%), Trưa (~30-35%), Chiều (~15-20%)
UPDATE meal_energy_distributions
SET water_pct_min = 10.0, water_pct_max = 15.0, water_ml_min = 150.0, water_ml_max = 250.0
WHERE age_group = 'MAU_GIAO' AND meal_type = 'BREAKFAST' AND (water_pct_min IS NULL OR water_pct_min = 0);

UPDATE meal_energy_distributions
SET water_pct_min = 30.0, water_pct_max = 35.0, water_ml_min = 450.0, water_ml_max = 600.0
WHERE age_group = 'MAU_GIAO' AND meal_type = 'LUNCH' AND (water_pct_min IS NULL OR water_pct_min = 0);

UPDATE meal_energy_distributions
SET water_pct_min = 15.0, water_pct_max = 20.0, water_ml_min = 250.0, water_ml_max = 350.0
WHERE age_group = 'MAU_GIAO' AND meal_type = 'AFTERNOON_SNACK' AND (water_pct_min IS NULL OR water_pct_min = 0);

-- 5. Bổ sung cột nước vào bảng nutritional_standards (bảng chuẩn Thông tư 28 cũ hiển thị tại Tab 1)
ALTER TABLE nutritional_standards
  ADD COLUMN IF NOT EXISTS water_ml_min NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS water_ml_max NUMERIC(8,2);

UPDATE nutritional_standards
SET water_ml_min = 1600.0, water_ml_max = 2000.0
WHERE age_group = 'MAU_GIAO' AND meal_scope = 'ALL_DAY' AND (water_ml_min IS NULL OR water_ml_min = 0);

UPDATE nutritional_standards
SET water_ml_min = 800.0, water_ml_max = 1100.0
WHERE age_group = 'MAU_GIAO' AND meal_scope = 'DAYBOARDING' AND (water_ml_min IS NULL OR water_ml_min = 0);

UPDATE nutritional_standards
SET water_ml_min = 800.0, water_ml_max = 1000.0
WHERE age_group = 'NHA_TRE' AND meal_scope = 'ALL_DAY' AND (water_ml_min IS NULL OR water_ml_min = 0);

UPDATE nutritional_standards
SET water_ml_min = 500.0, water_ml_max = 700.0
WHERE age_group = 'NHA_TRE' AND meal_scope = 'DAYBOARDING' AND (water_ml_min IS NULL OR water_ml_min = 0);


