-- Migration: 20261106-meal-energy-distribution.sql
-- Bảng phân bổ năng lượng & dinh dưỡng theo từng bữa trong ngày.
-- Mỗi dòng cho biết một bữa (sáng / trưa / chiều ...) chiếm bao nhiêu % nhu cầu
-- năng lượng CẢ NGÀY của trẻ. Lượng Protein / Lipid / Glucid mục tiêu của bữa
-- được suy ra từ % này nhân với định mức cả ngày (nutrition_intake_standards, ALL_DAY).
--
-- Nguồn tham chiếu: Chương trình GDMN — Văn bản hợp nhất 01/VBHN-BGDĐT ngày 13/4/2021
--   Nhà trẻ : tại trường 60–70% nhu cầu cả ngày; bữa trưa 30–35%, bữa chiều 25–30%, bữa phụ 5–10%.
--   Mẫu giáo: tại trường 50–55% nhu cầu cả ngày; bữa trưa 30–35%, các bữa phụ 15–25%.
-- Idempotent: chạy lại nhiều lần không làm thay đổi dữ liệu đã chỉnh sửa.

CREATE TABLE IF NOT EXISTS meal_energy_distributions (
  id              BIGSERIAL PRIMARY KEY,
  school_id       BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  age_group       VARCHAR(30) NOT NULL,                 -- 'NHA_TRE', 'MAU_GIAO'
  meal_type       VARCHAR(30) NOT NULL,                 -- 'BREAKFAST', 'LUNCH', 'AFTERNOON_SNACK', 'LATE_SNACK'
  meal_label      VARCHAR(100) NOT NULL,
  meal_time       VARCHAR(5),                           -- 'HH:MM'
  display_order   INT NOT NULL DEFAULT 1,
  energy_pct_min  NUMERIC(5,2) NOT NULL,                -- % nhu cầu năng lượng cả ngày
  energy_pct_max  NUMERIC(5,2) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  note            TEXT,
  source_metadata JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT meal_energy_distributions_pct_check
    CHECK (energy_pct_min >= 0 AND energy_pct_max <= 100 AND energy_pct_min <= energy_pct_max),
  CONSTRAINT meal_energy_distributions_meal_type_check
    CHECK (meal_type IN ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'LATE_SNACK')),
  CONSTRAINT meal_energy_distributions_unique UNIQUE (school_id, age_group, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_energy_dist_school
  ON meal_energy_distributions(school_id, age_group, is_active);

-- Giá trị mặc định cho mọi trường hiện có.
INSERT INTO meal_energy_distributions
  (school_id, age_group, meal_type, meal_label, meal_time, display_order, energy_pct_min, energy_pct_max, note, source_metadata)
SELECT s.id, v.age_group, v.meal_type, v.meal_label, v.meal_time, v.display_order, v.pct_min, v.pct_max, v.note,
       jsonb_build_object('source', '01/VBHN-BGDĐT 13/4/2021', 'seedKey', v.age_group || ':' || v.meal_type)
FROM schools s
CROSS JOIN (VALUES
  ('NHA_TRE',  'BREAKFAST',       'Buổi sáng',      '09:00', 1,  5.00, 10.00, 'Bữa phụ buổi sáng tại trường (5–10%).'),
  ('NHA_TRE',  'LUNCH',           'Bữa trưa chính', '11:00', 2, 30.00, 35.00, 'Bữa trưa cung cấp 30–35% năng lượng cả ngày.'),
  ('NHA_TRE',  'AFTERNOON_SNACK', 'Bữa chiều',      '14:30', 3, 25.00, 30.00, 'Bữa chiều cung cấp 25–30% năng lượng cả ngày.'),
  ('MAU_GIAO', 'BREAKFAST',       'Buổi sáng',      '09:00', 1,  5.00, 10.00, 'Bữa phụ buổi sáng; cộng với bữa phụ chiều đạt 15–25%.'),
  ('MAU_GIAO', 'LUNCH',           'Bữa trưa chính', '11:00', 2, 30.00, 35.00, 'Bữa chính buổi trưa cung cấp 30–35% năng lượng cả ngày.'),
  ('MAU_GIAO', 'AFTERNOON_SNACK', 'Bữa phụ chiều',  '14:30', 3, 10.00, 15.00, 'Bữa phụ chiều; cộng với bữa phụ sáng đạt 15–25%.')
) AS v(age_group, meal_type, meal_label, meal_time, display_order, pct_min, pct_max, note)
ON CONFLICT (school_id, age_group, meal_type) DO NOTHING;

