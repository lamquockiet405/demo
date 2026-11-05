-- ============================================================================
-- REALISTIC VIETNAMESE PRESCHOOL SEED DATA (3–6 TUỔI)
-- TRƯỜNG MẪU GIÁO HƯỚNG DƯƠNG
-- Standard: Thông tư 28/2016/TT-BGDĐT, Quyết định 1246/QĐ-BYT, WHO LMS (36-72 tháng)
-- ============================================================================

BEGIN;

-- 1. Đảm bảo các bảng và ràng buộc sẵn sàng
ALTER TABLE menu_meals DROP CONSTRAINT IF EXISTS menu_meals_meal_type_check;
ALTER TABLE menu_meals ADD CONSTRAINT menu_meals_meal_type_check
  CHECK (meal_type IN ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'LATE_SNACK'));

CREATE TABLE IF NOT EXISTS meal_coordination_notes (
  id bigserial PRIMARY KEY,
  class_id bigint NOT NULL REFERENCES classes(id),
  child_id bigint REFERENCES students(id) ON DELETE SET NULL,
  meal_date date NOT NULL,
  meal_session varchar(30) NOT NULL DEFAULT 'LUNCH',
  meal_session_label varchar(100) NOT NULL,
  note_type varchar(50) NOT NULL DEFAULT 'OTHER',
  note_type_label varchar(150) NOT NULL,
  priority varchar(20) NOT NULL DEFAULT 'NORMAL',
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  title text NOT NULL,
  content text NOT NULL,
  teacher_name varchar(255) NOT NULL,
  target_role varchar(30) NOT NULL DEFAULT 'KITCHEN',
  target_role_label varchar(150) NOT NULL,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  kitchen_acknowledged boolean NOT NULL DEFAULT false,
  kitchen_acknowledged_by varchar(255),
  kitchen_acknowledged_at timestamptz,
  kitchen_response text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cập nhật chuẩn hóa 6 lớp Mẫu giáo 3-6 tuổi
UPDATE classes SET name = 'Lớp Mầm 1 (3-4 tuổi)', age_group = 'MAU_GIAO', school_year = '2025-2026', homeroom_teacher_id = 7, status = 'ACTIVE' WHERE id = 1;
UPDATE classes SET name = 'Lớp Mầm 2 (3-4 tuổi)', age_group = 'MAU_GIAO', school_year = '2025-2026', homeroom_teacher_id = 8, status = 'ACTIVE' WHERE id = 2;
UPDATE classes SET name = 'Lớp Chồi 1 (4-5 tuổi)', age_group = 'MAU_GIAO', school_year = '2025-2026', homeroom_teacher_id = 9, status = 'ACTIVE' WHERE id = 3;
UPDATE classes SET name = 'Lớp Chồi 2 (4-5 tuổi)', age_group = 'MAU_GIAO', school_year = '2025-2026', homeroom_teacher_id = 10, status = 'ACTIVE' WHERE id = 4;
UPDATE classes SET name = 'Lớp Lá 1 (5-6 tuổi)', age_group = 'MAU_GIAO', school_year = '2025-2026', homeroom_teacher_id = 11, status = 'ACTIVE' WHERE id = 5;
UPDATE classes SET name = 'Lớp Lá 2 (5-6 tuổi)', age_group = 'MAU_GIAO', school_year = '2025-2026', homeroom_teacher_id = 12, status = 'ACTIVE' WHERE id = 6;

-- Đảm bảo ngày sinh 14 học sinh cũ nằm chuẩn trong độ tuổi 36-72 tháng (3-6 tuổi):
-- Năm học 2025-2026:
-- Khối Mầm (3-4t): sinh 2022-2023 (36-47 tháng)
-- Khối Chồi (4-5t): sinh 2021-2022 (48-59 tháng)
-- Khối Lá (5-6t): sinh 2020-2021 (60-71 tháng)
UPDATE students SET date_of_birth = '2022-10-15' WHERE id = 1; -- Nguyễn Gia Huy (Mầm 1, 3 tuổi)
UPDATE students SET date_of_birth = '2022-11-20' WHERE id = 2; -- Trần Phương Linh (Mầm 1, 3 tuổi)
UPDATE students SET date_of_birth = '2023-01-10' WHERE id = 3; -- Lê Bảo An (Mầm 1, 3 tuổi)
UPDATE students SET date_of_birth = '2022-09-12' WHERE id = 4; -- Hoàng Minh Khang (Mầm 2, 3 tuổi)
UPDATE students SET date_of_birth = '2022-12-05' WHERE id = 5; -- Nguyễn Tường Vy (Mầm 2, 3 tuổi)
UPDATE students SET date_of_birth = '2021-10-18' WHERE id = 6; -- Phạm Đăng Khoa (Chồi 1, 4 tuổi)
UPDATE students SET date_of_birth = '2021-11-25' WHERE id = 7; -- Vũ Ngọc Diệp (Chồi 1, 4 tuổi)
UPDATE students SET date_of_birth = '2021-08-05' WHERE id = 8; -- Đỗ Tuấn Kiệt (Chồi 2, 4 tuổi)
UPDATE students SET date_of_birth = '2021-09-30' WHERE id = 9; -- Bùi Khánh Vy (Chồi 2, 4 tuổi)
UPDATE students SET date_of_birth = '2020-08-14' WHERE id = 10; -- Ngô Hải Đăng (Lá 1, 5 tuổi)
UPDATE students SET date_of_birth = '2020-10-22' WHERE id = 11; -- Trịnh Mai Anh (Lá 1, 5 tuổi)
UPDATE students SET date_of_birth = '2020-07-19' WHERE id = 12; -- Dương Quốc Bảo (Lá 2, 5 tuổi)
UPDATE students SET date_of_birth = '2020-09-08' WHERE id = 13; -- Đinh Thảo My (Lá 2, 5 tuổi)
UPDATE students SET date_of_birth = '2020-11-02' WHERE id = 14; -- Phan Gia Khiêm (Lá 2, 5 tuổi)

-- Bổ sung thêm học sinh cho thực tế (mỗi lớp 7-8 học sinh, Lớp Mầm 1 có 8 học sinh: 2 bé dị ứng, 6 bé ăn tiêu chuẩn)
INSERT INTO students (id, class_id, student_code, full_name, date_of_birth, gender, status) VALUES
-- Thêm vào Lớp Mầm 1 (class_id = 1) -> Sĩ số lớp đạt 8 bé
(15, 1, 'HD-2022-04', 'Phạm Minh Đăng', '2022-10-28', 'MALE', 'ACTIVE'),
(16, 1, 'HD-2022-05', 'Hoàng Bảo Ngọc', '2023-01-15', 'FEMALE', 'ACTIVE'),
(17, 1, 'HD-2022-06', 'Vũ Khánh An',   '2022-12-18', 'FEMALE', 'ACTIVE'),
(18, 1, 'HD-2022-07', 'Đặng Gia Phúc', '2023-02-22', 'MALE', 'ACTIVE'),
(19, 1, 'HD-2022-08', 'Bùi Thảo Linh', '2022-11-05', 'FEMALE', 'ACTIVE'),

-- Thêm vào Lớp Mầm 2 (class_id = 2) -> Sĩ số đạt 6 bé
(20, 2, 'HD-2022-09', 'Lê Hữu Nghĩa',  '2022-10-12', 'MALE', 'ACTIVE'),
(21, 2, 'HD-2022-10', 'Trần Thảo Nhi', '2023-01-08', 'FEMALE', 'ACTIVE'),
(22, 2, 'HD-2022-11', 'Nguyễn Đức Trí','2022-11-30', 'MALE', 'ACTIVE'),
(23, 2, 'HD-2022-12', 'Võ Mai Phương', '2023-02-14', 'FEMALE', 'ACTIVE'),

-- Thêm vào Lớp Chồi 1 (class_id = 3) -> Sĩ số đạt 6 bé
(24, 3, 'HD-2021-06', 'Trương Quốc Anh','2021-09-15', 'MALE', 'ACTIVE'),
(25, 3, 'HD-2021-07', 'Lâm Tú Uyên',    '2021-12-04', 'FEMALE', 'ACTIVE'),
(26, 3, 'HD-2021-08', 'Đoàn Nhật Nam',  '2021-10-20', 'MALE', 'ACTIVE'),
(27, 3, 'HD-2021-09', 'Hồ Diệu Linh',   '2022-01-18', 'FEMALE', 'ACTIVE'),

-- Thêm vào Lớp Chồi 2 (class_id = 4) -> Sĩ số đạt 6 bé
(28, 4, 'HD-2021-10', 'Cao Tuấn Kiệt',  '2021-08-25', 'MALE', 'ACTIVE'),
(29, 4, 'HD-2021-11', 'Phan Ngọc Hân',  '2021-11-14', 'FEMALE', 'ACTIVE'),
(30, 4, 'HD-2021-12', 'Dương Minh Khôi','2021-07-30', 'MALE', 'ACTIVE'),
(31, 4, 'HD-2021-13', 'Tạ Quỳnh Anh',   '2022-02-10', 'FEMALE', 'ACTIVE'),

-- Thêm vào Lớp Lá 1 (class_id = 5) -> Sĩ số đạt 6 bé
(32, 5, 'HD-2020-05', 'Nguyễn Hoàng Long','2020-09-12','MALE', 'ACTIVE'),
(33, 5, 'HD-2020-06', 'Phạm Trúc Mai',   '2020-11-28','FEMALE', 'ACTIVE'),
(34, 5, 'HD-2020-07', 'Vũ Anh Dũng',     '2020-08-05','MALE', 'ACTIVE'),
(35, 5, 'HD-2020-08', 'Lê Quỳnh Chi',    '2021-01-22','FEMALE', 'ACTIVE'),

-- Thêm vào Lớp Lá 2 (class_id = 6) -> Sĩ số đạt 6 bé
(36, 6, 'HD-2020-09', 'Đỗ Thành Vinh',   '2020-07-14','MALE', 'ACTIVE'),
(37, 6, 'HD-2020-10', 'Bùi Kim Ngân',    '2020-12-03','FEMALE', 'ACTIVE'),
(38, 6, 'HD-2020-11', 'Ngô Quốc Khánh',  '2020-10-17','MALE', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  class_id = EXCLUDED.class_id;

SELECT setval('students_id_seq', (SELECT MAX(id) FROM students));

-- 3. Cập nhật tỷ lệ dị ứng thực tế (khoảng 15-20% học sinh, còn lại 80-85% ăn tiêu chuẩn)
-- Điều chỉnh Lê Bảo An (Mầm 1, id = 3) chuyển sang chế độ chuẩn hoặc dị ứng nhẹ:
DELETE FROM student_allergies WHERE student_id = 3; -- Bé Bảo An ăn tiêu chuẩn

-- Bổ sung thêm dị ứng cho 2 bé khác trong toàn trường để danh mục dị ứng phong phú
INSERT INTO student_allergies (student_id, allergen_id, severity, note, declared_by) VALUES
(21, 1, 'LOW', 'Dị ứng nhẹ với sữa đặc nhiều đường, sữa tươi uống bình thường', 8),
(30, 3, 'MEDIUM', 'Dị ứng đậu phộng, không dùng các món rắc đậu phộng', 10)
ON CONFLICT DO NOTHING;

-- 4. Đo chiều cao cân nặng & Z-score cho tất cả học sinh mới
INSERT INTO physical_measurements (id, student_id, measured_date, height_cm, weight_kg, measured_by) VALUES
(15, 15, '2025-09-10', 96.0, 14.8, 3),
(16, 16, '2025-09-10', 94.5, 13.9, 3),
(17, 17, '2025-09-10', 95.0, 14.2, 3),
(18, 18, '2025-09-10', 97.0, 15.1, 3),
(19, 19, '2025-09-10', 93.8, 13.7, 3),
(20, 20, '2025-09-10', 96.5, 15.0, 3),
(21, 21, '2025-09-10', 94.0, 13.6, 3),
(22, 22, '2025-09-10', 95.5, 14.7, 3),
(23, 23, '2025-09-10', 93.5, 13.4, 3),
(24, 24, '2025-09-10', 103.5, 16.2, 3),
(25, 25, '2025-09-10', 102.0, 15.5, 3),
(26, 26, '2025-09-10', 104.0, 16.8, 3),
(27, 27, '2025-09-10', 101.5, 15.2, 3),
(28, 28, '2025-09-10', 103.0, 16.0, 3),
(29, 29, '2025-09-10', 102.5, 15.8, 3),
(30, 30, '2025-09-10', 105.0, 17.2, 3),
(31, 31, '2025-09-10', 101.0, 15.0, 3),
(32, 32, '2025-09-10', 111.5, 18.8, 3),
(33, 33, '2025-09-10', 110.0, 18.0, 3),
(34, 34, '2025-09-10', 112.5, 19.4, 3),
(35, 35, '2025-09-10', 109.0, 17.2, 3),
(36, 36, '2025-09-10', 111.0, 18.5, 3),
(37, 37, '2025-09-10', 110.5, 18.2, 3),
(38, 38, '2025-09-10', 113.0, 19.8, 3)
ON CONFLICT (id) DO UPDATE SET
  height_cm = EXCLUDED.height_cm,
  weight_kg = EXCLUDED.weight_kg;

SELECT setval('physical_measurements_id_seq', (SELECT MAX(id) FROM physical_measurements));

INSERT INTO growth_zscores (id, measurement_id, waz, haz, baz, classification) VALUES
(15, 15, 0.15, 0.20, 0.10, 'NORMAL'),
(16, 16, 0.05, 0.10, 0.02, 'NORMAL'),
(17, 17, 0.10, 0.15, 0.05, 'NORMAL'),
(18, 18, 0.30, 0.35, 0.20, 'NORMAL'),
(19, 19, -0.20, -0.10, -0.15, 'NORMAL'),
(20, 20, 0.25, 0.30, 0.15, 'NORMAL'),
(21, 21, -0.15, -0.05, -0.10, 'NORMAL'),
(22, 22, 0.10, 0.20, 0.05, 'NORMAL'),
(23, 23, -0.25, -0.15, -0.20, 'NORMAL'),
(24, 24, 0.10, 0.15, 0.05, 'NORMAL'),
(25, 25, 0.05, 0.10, 0.00, 'NORMAL'),
(26, 26, 0.20, 0.25, 0.12, 'NORMAL'),
(27, 27, -0.05, 0.05, -0.10, 'NORMAL'),
(28, 28, 0.00, 0.10, -0.05, 'NORMAL'),
(29, 29, 0.10, 0.15, 0.08, 'NORMAL'),
(30, 30, 0.35, 0.40, 0.25, 'NORMAL'),
(31, 31, -0.10, 0.00, -0.15, 'NORMAL'),
(32, 32, 0.20, 0.25, 0.10, 'NORMAL'),
(33, 33, 0.10, 0.15, 0.05, 'NORMAL'),
(34, 34, 0.30, 0.35, 0.20, 'NORMAL'),
(35, 35, -0.15, -0.05, -0.10, 'NORMAL'),
(36, 36, 0.15, 0.20, 0.10, 'NORMAL'),
(37, 37, 0.10, 0.15, 0.05, 'NORMAL'),
(38, 38, 0.35, 0.40, 0.25, 'NORMAL')
ON CONFLICT (id) DO UPDATE SET
  waz = EXCLUDED.waz,
  haz = EXCLUDED.haz,
  baz = EXCLUDED.baz,
  classification = EXCLUDED.classification;

SELECT setval('growth_zscores_id_seq', (SELECT MAX(id) FROM growth_zscores));

-- 5. Suất ăn & điểm danh cho ngày hiện tại (2026-11-05)
-- Suất ăn cho Lớp Mầm 1 (sĩ số 8 học sinh)
INSERT INTO daily_meal_portions (date, class_id, meal_type, planned_quantity, actual_quantity, note) VALUES
('2026-11-05', 1, 'MORNING_SNACK',   8, 8, '8/8 trẻ dùng sữa hạt & ngũ cốc'),
('2026-11-05', 1, 'LUNCH',           8, 8, 'Chuẩn bị riêng 1 suất kiêng giáp xác cho bé Gia Huy, 1 suất thay sữa bò cho bé Linh'),
('2026-11-05', 1, 'AFTERNOON_SNACK', 8, 8, 'Bữa xế 14h30 đầy đủ 8 suất'),
('2026-11-05', 2, 'LUNCH',           6, 6, 'Lớp Mầm 2 đủ 6 suất cơm trưa'),
('2026-11-05', 3, 'LUNCH',           6, 6, 'Lớp Chồi 1 đủ 6 suất cơm trưa'),
('2026-11-05', 4, 'LUNCH',           6, 6, 'Lớp Chồi 2 đủ 6 suất cơm trưa'),
('2026-11-05', 5, 'LUNCH',           6, 6, 'Lớp Lá 1 đủ 6 suất cơm trưa'),
('2026-11-05', 6, 'LUNCH',           6, 6, 'Lớp Lá 2 đủ 6 suất cơm trưa')
ON CONFLICT DO NOTHING;

-- Điểm danh & đánh giá sau bữa ăn học sinh lớp Mầm 1 ngày 2026-11-05
INSERT INTO meal_attendances (student_id, date, meal_type, is_attended, consumption_level, note, recorded_by) VALUES
(1,  '2026-11-05', 'LUNCH', TRUE, 'FULL',    '[5★] Bé ăn hết suất riêng thịt rim bí xanh, không có dấu hiệu dị ứng.', 7),
(2,  '2026-11-05', 'LUNCH', TRUE, 'MOST',    '[4★] Bé ăn hết 90% phần cơm, uống hết canh, tiêu hóa tốt.', 7),
(3,  '2026-11-05', 'LUNCH', TRUE, 'FULL',    '[5★] Bé tự xúc ăn nhanh, tự giác dọn khay sạch sẽ.', 7),
(15, '2026-11-05', 'LUNCH', TRUE, 'FULL',    '[5★] Bé ăn rất ngon miệng, xin thêm 1 thìa canh ngọt.', 7),
(16, '2026-11-05', 'LUNCH', TRUE, 'FULL',    '[5★] Bé ăn hết suất, uống đủ nước sau bữa ăn.', 7),
(17, '2026-11-05', 'LUNCH', TRUE, 'HALF',    '[3★] Hôm nay bé ăn chậm hơn ngày thường, cô động viên ăn được 70% khay.', 7),
(18, '2026-11-05', 'LUNCH', TRUE, 'FULL',    '[5★] Bé ăn giỏi, vui vẻ cùng các bạn.', 7),
(19, '2026-11-05', 'LUNCH', TRUE, 'FULL',    '[5★] Bé tự ăn ngoan, dọn muỗng sạch sẽ.', 7)
ON CONFLICT (student_id, date, meal_type) DO UPDATE SET
  is_attended = EXCLUDED.is_attended,
  consumption_level = EXCLUDED.consumption_level,
  note = EXCLUDED.note;

-- 6. Ghi chú phối hợp Bếp - Giáo viên cho ngày 2026-11-05
INSERT INTO meal_coordination_notes (
  class_id, child_id, meal_date, meal_session, meal_session_label,
  note_type, note_type_label, priority, status, title, content,
  teacher_name, target_role, target_role_label,
  kitchen_acknowledged, kitchen_acknowledged_by, kitchen_acknowledged_at,
  kitchen_response, created_at, updated_at
) VALUES
(
  1, 1, '2026-11-05', 'LUNCH', 'Bữa trưa chính (10:45)',
  'ALLERGY', 'Cảnh báo dị ứng thức ăn', 'HIGH', 'RESOLVED',
  'Tách riêng suất kiêng tôm cua cho bé Nguyễn Gia Huy',
  'Bé Gia Huy dị ứng giáp xác tôm cua mức độ nặng. Nhờ bếp kiểm tra kỹ nồi chảo và tách riêng suất thịt nạc rim bí đỏ cho con.',
  'Lê Thị Hương Giang', 'KITCHEN', 'Bộ phận Bếp bán trú',
  true, 'Nguyễn Văn Cường (Bếp trưởng)', '2026-11-05 09:30:00+07',
  'Bếp đã chuẩn bị khay inox có dán nhãn tên bé Nguyễn Gia Huy, món thịt nạc dăm rim hạt sen và canh bí xanh thịt nạc, cam kết 100% không dính hải sản.',
  '2026-11-05 08:30:00+07', '2026-11-05 09:30:00+07'
),
(
  1, 2, '2026-11-05', 'MORNING_SNACK', 'Phụ sáng (08:30)',
  'SPECIAL_DIET', 'Khẩu phần ăn đặc biệt', 'NORMAL', 'RESOLVED',
  'Thay sữa bò bằng sữa hạt cho bé Trần Phương Linh',
  'Bé Linh có tiền sử không dung nạp đạm sữa bò (đầy bụng), nhờ bếp đổi phụ sáng của bé sang sữa hạt sen hoặc nước hoa quả ép.',
  'Lê Thị Hương Giang', 'KITCHEN', 'Bộ phận Bếp bán trú',
  true, 'Đặng Thị Lan (Nhân viên Tiếp phẩm)', '2026-11-05 08:00:00+07',
  'Bếp đã giao 1 chai sữa hạt sen tươi nấu ấm cho cô Giang nhận tại lớp lúc 08h15.',
  '2026-11-05 07:45:00+07', '2026-11-05 08:00:00+07'
),
(
  1, NULL, '2026-11-05', 'LUNCH', 'Bữa trưa chính (10:45)',
  'FEEDBACK', 'Phản hồi chất lượng bữa ăn', 'NORMAL', 'PENDING',
  'Học sinh lớp Mầm 1 rất thích món canh hôm nay',
  'Các bé lớp Mầm 1 ăn rất ngon miệng, hầu hết các con đều xin thêm canh. Khen bếp nấu vừa miệng, rau mềm dễ xúc.',
  'Lê Thị Hương Giang', 'KITCHEN', 'Bộ phận Bếp bán trú',
  true, 'Nguyễn Văn Cường (Bếp trưởng)', '2026-11-05 12:15:00+07',
  'Cảm ơn cô Giang và các con lớp Mầm 1! Bếp sẽ tiếp tục phát huy các món canh hầm thanh mát giàu canxi.',
  '2026-11-05 11:45:00+07', '2026-11-05 12:15:00+07'
);

-- 7. Dịch vụ ăn xế tháng 11/2026 và đăng ký cho trẻ
INSERT INTO snack_service_periods (id, name, start_date, end_date, registration_deadline, fee_amount, status) VALUES
(4, 'Dịch vụ Ăn xế Tháng 11/2026 - Mẫu Giáo Hướng Dương', '2026-11-01', '2026-11-30', '2026-10-30', 380000.0, 'OPEN')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  status = EXCLUDED.status;

SELECT setval('snack_service_periods_id_seq', (SELECT MAX(id) FROM snack_service_periods));

INSERT INTO snack_registrations (id, period_id, student_id, parent_id, status) VALUES
(20, 4, 1, 13, 'PAID'),
(21, 4, 2, 14, 'PAID'),
(22, 4, 3, 15, 'PAID'),
(23, 4, 15, 13, 'PAID'),
(24, 4, 16, 14, 'PAID'),
(25, 4, 6, 17, 'PAID'),
(26, 4, 8, 19, 'PAID'),
(27, 4, 10, 21, 'PAID')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

SELECT setval('snack_registrations_id_seq', (SELECT MAX(id) FROM snack_registrations));

INSERT INTO snack_daily_rosters (date, student_id, registration_id, status) VALUES
('2026-11-05', 1,  20, 'SERVED'),
('2026-11-05', 2,  21, 'SERVED'),
('2026-11-05', 3,  22, 'SERVED'),
('2026-11-05', 15, 23, 'SERVED'),
('2026-11-05', 16, 24, 'SERVED'),
('2026-11-05', 6,  25, 'SERVED'),
('2026-11-05', 8,  26, 'SERVED'),
('2026-11-05', 10, 27, 'SERVED')
ON CONFLICT DO NOTHING;

-- 8. Kiểm thực 3 bước và lưu mẫu thức ăn 24h ngày 2026-11-05
INSERT INTO food_inspections (date, inspection_step, inspector_id, result, meal_session, session_code, note) VALUES
('2026-11-05', 'STEP_1_RAW_CHECK', 5, 'PASS', 'LUNCH', 'KT-20261105-01',
 'Thịt heo nạc đùi tươi hồng dẻo dính từ Vissan (hóa đơn số 002931). Cá bống tươi sống, rau ngót non tươi xanh không sâu úa. Đạt 100% tiêu chuẩn nhập phẩm.'),
('2026-11-05', 'STEP_2_PROCESSING_CHECK', 5, 'PASS', 'LUNCH', 'KT-20261105-02',
 'Bếp thực hiện quy tắc 1 chiều. Phân biệt thớt xanh cho rau, thớt đỏ cho thịt cá. Nhiệt độ tâm món kho đạt 88°C, canh sôi bùng > 100°C.'),
('2026-11-05', 'STEP_3_PRE_SERVING_CHECK', 3, 'PASS', 'LUNCH', 'KT-20261105-03',
 'Cảm quan món ăn đạt chuẩn vị trẻ em, ít gia vị mặn ngọt gắt. Thức ăn chia vào khay inox 304 giữ ấm > 65°C trước khi chuyển lên các lớp Mầm, Chồi, Lá.')
ON CONFLICT DO NOTHING;

INSERT INTO food_samples (date, dish_name, sample_code, stored_at, dispose_at, status, fridge_unit, sample_weight_g, storage_temp, collector_name, note) VALUES
('2026-11-05', 'Cơm trắng dẻo', 'LM-20261105-01', '2026-11-05 10:30:00+07', '2026-11-06 10:30:00+07', 'STORED', 'Tủ lưu mẫu số 1 (Ngăn mát 0-5°C)', 150.0, 3.8, 'Nguyễn Văn Cường (Bếp trưởng)', 'Lưu mẫu cơm trưa 150g'),
('2026-11-05', 'Thịt heo rim nước dừa cà rốt', 'LM-20261105-02', '2026-11-05 10:30:00+07', '2026-11-06 10:30:00+07', 'STORED', 'Tủ lưu mẫu số 1 (Ngăn mát 0-5°C)', 100.0, 3.8, 'Nguyễn Văn Cường (Bếp trưởng)', 'Lưu mẫu món mặn 100g'),
('2026-11-05', 'Canh rau ngót nấu thịt bằm', 'LM-20261105-03', '2026-11-05 10:30:00+07', '2026-11-06 10:30:00+07', 'STORED', 'Tủ lưu mẫu số 1 (Ngăn mát 0-5°C)', 150.0, 3.8, 'Nguyễn Văn Cường (Bếp trưởng)', 'Lưu mẫu canh 150ml cái + nước'),
('2026-11-05', 'Dưa hấu tráng miệng', 'LM-20261105-04', '2026-11-05 10:30:00+07', '2026-11-06 10:30:00+07', 'STORED', 'Tủ lưu mẫu số 1 (Ngăn mát 0-5°C)', 100.0, 3.8, 'Nguyễn Văn Cường (Bếp trưởng)', 'Lưu mẫu tráng miệng 100g'),
('2026-11-05', 'Bún mọc thịt sườn cà rốt', 'LM-20261105-05', '2026-11-05 14:15:00+07', '2026-11-06 14:15:00+07', 'STORED', 'Tủ lưu mẫu số 1 (Ngăn mát 0-5°C)', 150.0, 3.8, 'Nguyễn Văn Cường (Bếp trưởng)', 'Lưu mẫu bữa xế chiều 14h30')
ON CONFLICT DO NOTHING;

COMMIT;

