# Dữ liệu món ăn và dinh dưỡng có nguồn

Cập nhật quan hệ database ngày 03/11/2026: migration `20261103-relational-integrity.sql` bổ sung các tham chiếu thực, đưa schema hiện tại lên **56 bảng, 77 FK trong một nhóm liên thông**. Xem [chi tiết migration và dữ liệu lịch sử](database-relations.md). Những số lượng 55 bảng bên dưới mô tả bản chụp trước migration này.

Đã bổ sung trực tiếp bốn bảng còn trống ngày 03/11/2026 và xuất lại trang xem toàn bộ database lúc **13:21 (UTC+7)**: **55 bảng, 2.350 dòng, không còn bảng trống** trong database hiện tại. Kết quả được đọc lại bằng PostgreSQL và các entity TypeORM của backend:

| Bảng | Số dòng | Nội dung và nguồn |
| --- | ---: | --- |
| `dish_frequency_rules` | 7 | Cơ cấu bảy nhóm món/bữa, đếm từ 10 tuần DOC. Sáu nhóm có 5 lượt/tuần, nhóm món chính có 4–5 lượt/tuần. Mức `INFO`, không thay thế định mức dinh dưỡng. |
| `dish_spacing_rules` | 7 | Khoảng cách lặp nhỏ nhất của cùng món trong từng nhóm theo ngày lịch DOC: phụ sáng 1, cơm 1, món chính 12, canh 24, tráng miệng 11, thức uống 2, xế 12 ngày. Lưu dưới dạng **bản nháp tham khảo, `is_active=false`**; đây là quan sát lịch cũ, chưa phải quy định của trường. |
| `nutrition_intake_standards` | 4 | Nhà trẻ 12–36 tháng và mẫu giáo 3–6 tuổi, mỗi nhóm có phạm vi cả ngày/tại trường. Năng lượng và tỷ lệ P:L:G lấy từ Chương trình Giáo dục mầm non. |
| `audit_logs` | 1 | Sự kiện hệ thống ghi nhận chính lần khởi tạo cấu hình này, kèm số dòng thêm; `user_id=NULL`, không gán cho người dùng thật hay tạo lịch sử giả. |

Chuẩn năng lượng theo [Văn bản hợp nhất 01/VBHN-BGDĐT, Công báo ngày 28/4/2021, trang in 24 và 50](https://congbaocdn.chinhphu.vn/CongBaoCP/CongBao/2021/4/33649/35633-1-565-566.pdf): nhà trẻ cả ngày 930–1.000 kcal, tại trường 600–651 kcal; tỷ lệ đạm 13–20%, béo 30–40%, bột đường 47–50%. Mẫu giáo cả ngày 1.230–1.320 kcal, tại trường 615–726 kcal; tỷ lệ tương ứng 13–20%, 25–35%, 52–60%. Tài liệu được trích không cung cấp định mức vi chất và chất xơ trong phần này nên các cột đó để **NULL**, API giữ NULL và giao diện hiện “—”; không suy ra các chỉ tiêu này từ kcal. Dữ liệu và nguồn nằm trong `database/reference/preschool-intake-standards.json`.

Migration `20261103-nutrition-configuration.sql` sửa cấu trúc cũ của ba bảng cấu hình để khớp backend, giữ nguyên bản ghi sẵn có và bổ sung `source_metadata`. `scripts/lib/nutrition-configuration.cjs` sinh các dòng có nguồn, dùng khóa nguồn riêng để nhập lại không nhân đôi và không ghi đè cấu hình đã chỉnh tay. Nhật ký chỉ được thêm khi có dòng cấu hình thực sự được khởi tạo. Bản nhập danh mục và Docker đều đã bao gồm bước này; bản sao lưu trước cập nhật gồm cả ba bảng cấu hình và audit.

Đã kiểm tra trên PostgreSQL riêng: khởi tạo mới, nâng cấp cấu trúc cũ có dữ liệu thủ công, nhập lặp và bảo toàn chỉnh sửa. Chạy kịch bản cũ bằng `node scripts/test-source-import.cjs --legacy-config`; kịch bản mới bằng `--fresh`. Backend/frontend build thành công. Docker Engine trên máy chưa chạy nên chưa khởi động container thực tế.

Trang xem dữ liệu là `docs/database-snapshot/latest/index.html`; tải lại trang đã mở để thấy bản mới. Đây là bản xuất tại thời điểm nêu trên, không tự cập nhật theo database.

Đã đối chiếu trực tiếp database sau bản sửa ngày 03/11/2026: bảng `dishes` chỉ còn **172 bản ghi**, đều có nguồn trong DOC; **41 món mẫu ngoài danh mục nguồn đã được xóa thật**. Có **91 nguyên liệu đang dùng**, **177 dòng công thức định lượng tham khảo cho 59 món** và **59 dòng dinh dưỡng tự tính từ các công thức đó**. 293 dòng công thức mẫu gốc và 100 cache dinh dưỡng mẫu gốc vẫn nằm trong bảng lưu trữ để đối chiếu. **113 món chưa có định lượng đầu vào**. Bộ SQL dùng cho Docker đã được sửa theo cùng quy tắc này.

Danh mục đang dùng được trích từ 5 file Word `.doc` trong `docs/dử liệu chính`: 10 tuần, 50 ngày, 347 lượt món. Sau chuẩn hóa Unicode, chữ hoa/thường, khoảng trắng, dấu câu cuối tên và các biến thể chính tả được khai báo rõ trong mã, còn **172 món duy nhất**; **175 lượt lặp** không tạo thêm món.

Phân loại theo vị trí trong bảng gốc: 1 món phụ sáng, 5 món cơm, 32 món chính, 48 món canh, 22 món tráng miệng, 20 thức uống/sữa chua và 44 món xế. Các món có thành phần khác nhau vẫn là món riêng. Những dòng trong ngoặc thuộc món phía trước được giữ cùng tên món.

`database/generated/source-catalog.json` lưu lịch xuất hiện theo ngày và bữa, tên nguyên văn, tên file và SHA-256 của file gốc. `database/generated/source-catalog.sql` là bản nhập có thể kiểm tra và dùng lại. Thay đổi file nguồn cần chạy lại bước generate.

91 dòng nguyên liệu đọc được từ ảnh bảng thành phần dinh dưỡng người dùng cung cấp ngày 03/11/2026 nằm trong `database/reference/food-composition.json`. Chỉ nhập những dòng đọc được; phần ảnh bị cắt không được suy đoán. Năng lượng, đạm, béo, bột đường, xơ, canxi, sắt, kẽm và vitamin A được lưu theo **100 g phần ăn được**, đúng đơn vị của bảng. Tỷ lệ thải bỏ bằng `100 - tỷ lệ ăn được`.

Ô trống trong ảnh là `null` trong dữ liệu nguồn. Vì schema cũ yêu cầu các cột số `NOT NULL`, trường `source_metadata.missingNutrients` phân biệt giá trị chưa có với số 0 đã biết; API trả `null` cho trường chưa có, giao diện danh mục hiển thị dấu “—”. Các nguyên liệu mẫu chưa có nguồn được giữ lại, chuyển sang `INACTIVE` và đánh dấu `LEGACY_UNVERIFIED`.

Các tài liệu thực đơn không ghi khối lượng nguyên liệu, khối lượng suất ăn hoặc công thức chế biến. Vì vậy, việc nhập danh mục **không xác nhận** công thức mẫu cũ. Các món được đánh dấu `nutrition_verified = FALSE`; API không công bố cache cũ như số liệu đã xác nhận. Món ngoài danh mục nguồn bị xóa khỏi `dishes`, kể cả món đang `INACTIVE`. Tên món còn lại được đồng bộ theo danh mục trích xuất, với tên nguyên văn nằm trong metadata nguồn.

Trước khi xóa, toàn bộ bản ghi món được lưu vào `source_catalog_removed_dishes`, kèm danh sách và SHA-256 của các file DOC dùng để đối chiếu. Các dòng có khóa ngoại trỏ tới món bị xóa được sao lưu vào `source_catalog_removed_dish_references`, rồi được loại khỏi các bảng sử dụng theo quan hệ khóa ngoại. Lần làm sạch này xóa 41 món, cùng 228 liên kết trong `menu_dishes` và 20 liên kết trong `dish_allergens`. Các bảng thực đơn, phiên bản, ngày và bữa không bị xóa. Danh sách món đã xóa nằm trong `docs/mon-da-xoa-ngoai-doc.md`.

293 dòng công thức mẫu nguyên bản được nhận diện bằng ID, món, nguyên liệu, hai khối lượng và ghi chú gốc trong `database/reference/unverified-seed-recipes.json`. Các dòng khớp hoàn toàn, thuộc món chưa xác minh, được chuyển khỏi `dish_recipes` vào `source_catalog_legacy_recipes`; cache liên quan được lưu vào `source_catalog_legacy_nutrition`. Công thức có định lượng đã sửa, dòng mới và món đã xác minh được giữ. Toàn bộ việc lưu trữ và làm sạch nằm trong cùng transaction. Database mới không nạp các công thức mẫu này từ seed.

Sau bước làm sạch, `database/reference/archived-menu-recipes.json` cung cấp lại **177 định lượng đã có cho đúng 59 món còn trong DOC**, tra theo khóa tên món và tên nguyên liệu. Không tạo mới số gram. Dữ liệu được khôi phục vào `dish_recipes` khi món chưa có công thức, có ghi chú THAM KHẢO và `source_metadata.status = REFERENCE_UNVERIFIED`. Các công thức đã nhập thủ công không bị ghi đè khi nhập lại. Suất chuẩn đi kèm là số liệu tham khảo kế thừa từ dữ liệu cũ.

Trigger tính lại `dish_nutrition` bằng `SUM(giá trị dinh dưỡng nguyên liệu trên 100 g × net_weight_g / 100)`, làm tròn hai chữ số. Không khôi phục các số kcal/đạm/béo ghi sẵn trong cache mẫu. Ví dụ, công thức đu đủ gồm 60 g phần ăn được và nguyên liệu có 38 kcal/100 g sẽ cho 22,80 kcal, 0,60 g đạm và 24 mg canxi. Đã kiểm tra độc lập đủ 472 kết quả số của 59 món bằng số nguyên, tránh sai số dấu phẩy động.

Các kết quả này **chưa được xác minh là khẩu phần thực tế của bếp**. Một số công thức còn dùng nguyên liệu mẫu chưa có nguồn đối chiếu; danh sách nguyên liệu và chỉ số thiếu được ghi trong `dish_nutrition.source_metadata`. API tách `referenceNutrition` khỏi dinh dưỡng đã xác minh; màn hình món ăn/công thức hiển thị rõ nhãn tham khảo. Quy trình kiểm tra chuẩn dinh dưỡng và tự lập thực đơn vẫn yêu cầu dữ liệu đã xác minh. Cả hai bảng có `source_metadata` để truy nguồn trực tiếp.

Xem dữ liệu hiện có: `docs/database-data/dish_recipes.md` và `docs/database-data/dish_nutrition.md`; các file JSON cùng thư mục giữ nguyên toàn bộ cột database.

Sau khi nhập công thức có định lượng qua chức năng sửa món ăn, backend chỉ xác nhận dinh dưỡng nếu các nguyên liệu có đủ dữ liệu cần tính. Năng lượng một suất là tổng `giá trị trên 100 g × khối lượng nguyên liệu ăn được / 100`. Khi dùng suất ăn khác suất chuẩn, dinh dưỡng được nhân với `khối lượng suất thực tế / khối lượng suất chuẩn`. Năng lượng trong bảng được giữ nguyên; tỷ lệ đạm, béo, bột đường được tính từ năng lượng 4–9–4 của ba chất.

Đánh giá thực đơn lấy phiên bản mới nhất và các món thực tế; đánh giá tuần dùng trung bình theo số ngày. Không chọn ngẫu nhiên món thay thế, không điền kcal/vi chất giả khi thiếu dữ liệu, không gợi ý những món mẫu có ID và dinh dưỡng ghi cứng. Tự lập thực đơn chỉ dùng món có công thức được xác nhận.

Các lệnh chạy tại thư mục gốc:

```powershell
node scripts/import-source-catalog.cjs             # Trích tài liệu và sinh SQL, chưa sửa database
node --test scripts/test/source-catalog.test.cjs  # Kiểm tra trích xuất, trùng tên và dữ liệu nguồn
node scripts/import-source-catalog.cjs --apply     # Áp dụng vào database cấu hình bằng .env
```

Bước `--apply` sao lưu 6 bảng danh mục/công thức, các bảng lưu trữ nếu đã có và toàn bộ bảng có khóa ngoại trỏ tới món ăn vào `database/backups/catalog-<UTC>.json` trước khi ghi. Thư mục sao lưu được bỏ qua bởi Git và Docker build context. Toàn bộ SQL nhập chạy trong một transaction, có khóa chống hai bản nhập chạy cùng lúc; chạy lại không tạo thêm món trùng. Chỉ giữ món trong nguồn DOC trong bảng `dishes`; bản ghi món ngoài nguồn cùng các liên kết bị ảnh hưởng được sao lưu trước khi xóa.

Migration `database/migrations/20261103-source-catalog.sql` bổ sung cột nguồn và cờ xác nhận, đồng thời làm mới cache công thức khi thành phần dinh dưỡng nguyên liệu thay đổi. Migration `20261103-archive-unverified-seed-recipes.sql` tạo hai bảng lưu trữ công thức/cache mẫu. Migration `20261103-remove-non-source-dishes.sql` tạo bảng sao lưu món và các liên kết bị xóa. Migration `20261103-reference-recipe-provenance.sql` thêm nguồn vào công thức và kết quả dinh dưỡng. Bản SQL sinh ra đã bao gồm cả bốn migration và bước khôi phục/tính lại dữ liệu tham khảo.

`database/Dockerfile` đóng gói schema, seed và SQL nguồn vào image `kidmeal-postgres:16-source`. Khi triển khai, các bản sửa nằm trong image; không phụ thuộc vào các file SQL bind mount trên máy chạy container.

Database Docker mới, với volume mới, tự chạy schema, seed, danh mục nguồn và file `04-relational-integrity.sql` theo thứ tự khi PostgreSQL khởi tạo:

```powershell
node scripts/import-source-catalog.cjs
docker compose up -d --build
```

Docker có volume database cũ cần áp dụng migration và dữ liệu sau khi PostgreSQL đã khởi động, trước khi chạy backend phiên bản mới:

```powershell
docker compose up -d --build postgres
node scripts/apply-source-catalog-docker.cjs
docker compose up -d --build
```

Lệnh thứ hai cũng có thể chạy bằng `npm run db:docker:source:apply`. Script sao lưu toàn bộ database bằng `pg_dump` vào `database/backups/docker-catalog-<UTC>.sql`, rồi gửi SQL qua `psql -v ON_ERROR_STOP=1` **bên trong service `postgres` của Docker Compose**. Script này không kết nối đến địa chỉ database từ xa trong `.env`; nó dùng tài khoản PostgreSQL của container. Nếu Docker CLI chưa nằm trong PATH, đặt biến môi trường `DOCKER_BIN` thành đường dẫn đến `docker.exe` trước khi chạy. Không cần xóa volume cũ.

`scripts/test-source-import.cjs --fresh` kiểm tra khởi tạo database mới từ đúng ba file được đóng gói trong image. Chạy không có `--fresh` sẽ mô phỏng volume cũ có 293 dòng mẫu và kiểm tra việc lưu trữ/làm sạch. Cả hai kiểm tra nhập lặp, giữ công thức nhập thủ công, trigger cache rồi rollback toàn bộ. Chạy với một PostgreSQL thử nghiệm có quyền tạo schema; không yêu cầu quyền này cho bản nhập thật trong schema hiện tại.

Build frontend/backend và các test phần món ăn/thực đơn mới đã qua. Bộ unit test toàn dự án hiện có 5 suite lỗi do test cũ không khớp API/types ở phần nhân sự, tenant, nutrition rules và password reset; các lỗi này nằm ngoài thay đổi dữ liệu nguồn.
