# Liên kết database và ERD

Migration: `database/migrations/20261103-relational-integrity.sql`.

Trước migration, database cấu hình trong `.env` có 55 bảng, 57 khóa ngoại, chia thành 13 nhóm không nối với nhau; 11 bảng không có FK đi ra hoặc đi vào. Sau migration có **56 bảng, 77 khóa ngoại, một nhóm liên thông**, không có bảng đứng riêng trong ERD tổng quan.

## Các quan hệ bổ sung

| Bảng chứa FK | Bảng được tham chiếu | Ý nghĩa |
|---|---|---|
| `audit_logs.school_id`, `audit_logs.user_id` | `schools`, `users` | Trường và người thực hiện hành động |
| `food_samples.dish_id`, `food_samples.inspection_id` | `dishes`, `food_inspections` | Món hiện tại và lần kiểm thực tạo ra mẫu |
| `menu_rule_violations.rule_code` | `nutrition_rule_codes.code` | Danh mục mã vi phạm |
| `menus.nutritional_standard_id` | `nutritional_standards` | Chuẩn áp dụng cho nhóm tuổi của thực đơn |
| Ba cột `*_factor_code` trong `nutritional_standards` | `nutrition_conversion_factors.nutrient_code` | Hệ số tương ứng Protein/Fat/Carb |
| Ba cột `*_standard_id` trong `growth_zscores` | `who_growth_standards` | Bản ghi WHO thực sự được dùng khi tính từng chỉ số mới |
| `system_configs.school_id` | `schools` | Phạm vi cấu hình; NULL vẫn là cấu hình toàn cục |
| `schools.default_language_id` | `languages` | Ngôn ngữ mặc định của trường |
| `source_catalog_import_runs.initiated_by` | `users` | Người nhập nguồn nếu biết danh tính |
| `import_run_id` trong bốn bảng lưu trữ nguồn | `source_catalog_import_runs` | Đợt nhập nguồn sinh ra bản lưu trữ |
| `source_catalog_removed_dish_references.original_dish_id` | `source_catalog_removed_dishes.original_dish_id` | Tham chiếu lịch sử tới món đã lưu trữ |

`source_catalog_import_runs` là bảng mới ghi nhận đợt nhập nguồn. Các bản lưu trữ cũ được gom vào đợt `legacy_before_relational_migration`, có ghi rõ thời điểm và người nhập gốc không xác định. Không gán giả người thực hiện. Các ID món đã xóa không bị ép tham chiếu món đang hoạt động.

## Bảo toàn dữ liệu

- Script chạy trong một transaction và so checksum tất cả cột đã tồn tại của các bảng gốc trước/sau. Dữ liệu gốc phải giữ nguyên thì mới COMMIT. Hai bảng danh mục mã/hệ số được phép thêm mã còn thiếu nhưng không đổi các dòng đã có.
- Các FK được VALIDATE; dữ liệu mồ côi làm transaction thất bại, không bị xóa hoặc sửa ID để ép khớp.
- Chỉ tự điền món cho mẫu cũ khi tên khớp duy nhất. Tám mẫu cũ hiện không khớp danh mục mới nên `dish_id` vẫn NULL và tên lịch sử giữ nguyên. Mẫu mới có thể gửi `dishId`; mẫu phát sinh từ bước kiểm thực 3 lưu `inspection_id`.
- Không gán nguồn WHO cho điểm tăng trưởng cũ vì không biết chúng dùng bảng WHO hay bộ giá trị dự phòng. Backend mới lưu đúng ID đã dùng; khi dùng dự phòng, ID vẫn NULL. Công thức và kết quả tính không thay đổi.
- Cấu hình cũ vẫn toàn cục (`school_id IS NULL`). Khóa cấu hình duy nhất theo phạm vi, cho phép cùng tên ở các trường khác nhau.
- Thực đơn cũ chỉ nhận chuẩn DAYBOARDING hiện tại nếu có đúng một chuẩn ACTIVE cùng nhóm tuổi. Đây là chuẩn áp dụng hiện tại, không phải bằng chứng chuẩn đã được dùng trong quá khứ. Backend tạo thực đơn mới lưu chuẩn thực sự được chọn.
- Các bước điền tham chiếu cũ chỉ chạy khi thêm cột lần đầu; chạy lại không gán lại tham chiếu đã được xóa thủ công.
- Xóa người dùng sẽ đặt các tham chiếu nhật ký/đợt nhập thành NULL. Trường còn nhật ký không bị xóa qua FK mới. Xóa món/lần kiểm thực không xóa mẫu thức ăn lịch sử.

Liên thông trong ERD nghĩa là **các quan hệ được khai báo ở cấp cấu trúc**. Các tham chiếu tùy chọn vẫn có thể NULL khi không biết quan hệ của một bản ghi lịch sử.

## Chạy và xác minh

```powershell
# Kiểm tra migration với database trong .env, rồi ROLLBACK
npm run db:relations:check

# Áp dụng sau khi kiểm tra dữ liệu gốc và tất cả FK
npm run db:relations:apply

# Sinh lại sơ đồ từ FK thật
npm run db:erd
```

Mở `docs/diagrams/erd/kidmeal.drawio` trong draw.io, chọn trang **All tables**. Các trang nhóm chức năng chỉ hiển thị một phần hệ thống.

Database mới qua Docker chạy migration sau schema, seed và danh mục nguồn. `scripts/import-source-catalog.cjs` cũng nhúng migration và ghi nhận đợt nhập. Khi biết người nhập, có thể dùng:

```powershell
node scripts/import-source-catalog.cjs --actor-id 3
# Thêm --apply nếu muốn thực hiện nhập; nếu không chỉ sinh SQL.
```

Không nhập lại danh mục chỉ để cập nhật ERD; dùng `db:relations:apply` cho database đang có dữ liệu. Backend dùng code mới cần được build và khởi động lại để ghi thêm các tham chiếu từ luồng tạo mẫu/tăng trưởng. Các cột mới là bổ sung; những dữ liệu lịch sử không xác định được liên kết vẫn giữ NULL.

## Kiểm thử

```powershell
# Dùng PostgreSQL trong container kidmeal_postgres cục bộ, không dùng endpoint trong .env.
# Hai kịch bản fresh/legacy tạo schema thử nghiệm trong transaction và ROLLBACK.
npm run db:relations:test

node --test scripts/test/generate-erd.test.cjs scripts/test/source-catalog.test.cjs
```

Đã kiểm tra tạo mới, chạy lại migration/nhập nguồn, đồ thị liên thông, chặn FK mồ côi, khớp tên không duy nhất, bảo toàn mẫu sau khi xóa món, chuẩn sai nhóm tuổi, mã cảnh báo động và cấu hình theo phạm vi. Build backend và 25 unit test liên quan (tăng trưởng, kiểm thực, thực đơn, nhật ký) đều đạt; 10 kiểm tra script ERD/nguồn cũng đạt.

Bộ unit test toàn dự án còn 5 suite không biên dịch do các API cũ không còn tồn tại (`tenant`, `nutrition-rules`, hai suite `staff-management`, `password-reset`). Các lỗi đó không thuộc phần migration này.
