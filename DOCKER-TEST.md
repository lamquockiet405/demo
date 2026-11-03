# Docker test với database mới nhất từ kiet

Sửa lỗi đổi món theo nhóm trẻ ngày 03/11/2026: giữ bố cục, nhãn nhóm và hai chế độ đổi món hiện có. Hộp chọn dùng ID/tên/dinh dưỡng của món trong database thay cho danh sách ID mẫu viết sẵn; đối chiếu các dị ứng đang áp dụng của trẻ bị ảnh hưởng. Mỗi yêu cầu kèm ID ô món gốc để cập nhật đúng bữa trong phiên bản hiện tại. Backend kiểm tra món tồn tại/đang áp dụng, không mặc định về món ID 1, và lưu món thay thế trước khi xóa món gốc trong cùng transaction. Món không tồn tại hoặc ô món đã thay đổi trả lỗi rõ ràng, không làm mất món gốc.

Kiểm tra đổi món: 37 unit test backend liên quan và 4 test chọn món phía frontend pass; kiểm tra 99 liên kết tĩnh pass. `node scripts/verify-menu-substitution-docker.cjs` tạo thực đơn thử riêng, kiểm tra cả ALLERGIES/OBESE/STUNTED/COMMON với hai chế độ suất riêng và thay toàn bộ, đối chiếu tên/ID đã lưu với database, kiểm tra mã không tồn tại/món gốc bị thay đổi và dọn sạch 4 thực đơn thử. Không có tham chiếu món mồ côi. Frontend/backend build thành công; không thay đổi thực đơn đang sử dụng để thử nghiệm.

Dọn giao diện ngày 03/11/2026: bỏ 61 file giao diện cũ và phần hỗ trợ không còn được gọi, gồm các bản sao điểm danh/đánh giá/ăn xế, các trang độc lập chưa được gắn route và hai header trùng. Bỏ thanh chuyển cổng nổi, menu trùng, menu dẫn tới chức năng chưa được đăng ký và các nút thông báo/tin nhắn/tìm kiếm minh họa trên header. Nút đăng xuất được đặt trong các cổng đang dùng; giáo viên dùng chung một header và các tab điểm danh hiện có.

Các trang ý kiến phụ huynh, tổng quan suất ăn và phục vụ ăn xế của BGH được gắn trực tiếp vào router, thay cho điều kiện pathname trong layout. `/tablet/record` chuyển về tab đánh giá hiện có; các liên kết ghi chú điều phối đi qua `/tablet?tab=notes`. Các alias cũ vẫn được giữ khi có trang đích phù hợp.

Chạy `npm run check:frontend` để rà soát import, file không được dùng và liên kết nội bộ tĩnh. Sau dọn, 164 file nguồn được kiểm tra, 99 liên kết tĩnh có route đích; không có import thiếu hoặc file nguồn không được gọi (trừ khai báo kiểu ambient). Frontend build thành công; Docker frontend đã được cập nhật. Kiểm tra này không thay thế kiểm tra bố cục/tương tác trong trình duyệt.

Trang `/parents` đã được đăng ký dưới cổng BGH, cùng mục “Tài khoản phụ huynh” ngay dưới “Nhân sự & Bếp”. Chỉ các vai trò quản lý trường/hiệu trưởng/quản trị được mở trang này. Nút “Tạo tài khoản phụ huynh” dùng form hiện có; backend đã được sửa để lưu quan hệ vai trò PARENT cho tài khoản mới. Hai unit test liên quan pass; đã tạo một tài khoản thử qua API, đăng nhập bằng email/mật khẩu và xác nhận vai trò PARENT, sau đó xóa đúng tài khoản thử này. Frontend/backend Docker build thành công.

Đã bổ sung hai route phụ huynh bị thiếu: `/submit-evaluation` (Đánh giá & Góp ý) và `/declare-allergy` (Khai báo Dị ứng). Các liên kết trên thanh điều hướng trỏ đúng vào hai component hiện có, cùng quyền truy cập với cổng phụ huynh. Frontend Docker build thành công; các API tải dữ liệu góp ý, danh sách trẻ, danh mục dị ứng, chi tiết trẻ và lịch sử dị ứng trả HTTP 200 khi đăng nhập PARENT.

Trang dị ứng được bố trí lại với bộ chọn bé, danh sách đang/ngưng áp dụng, tìm kiếm và biểu mẫu thêm/sửa. Biểu mẫu hỗ trợ danh mục hoặc thực phẩm tự nhập, mức độ, triệu chứng, hướng dẫn đã được cung cấp và ghi chú; bỏ dữ liệu trẻ giả và nhãn khẳng định an toàn tuyệt đối. Tài khoản chỉ có vai trò phụ huynh được giới hạn vào trẻ đã liên kết khi đọc hồ sơ và cập nhật dị ứng. Ngưng áp dụng giữ lại bản ghi thay vì xóa.

Migration `20261103-allergy-declaration.sql` cho phép cả mức độ cũ LOW/MEDIUM/HIGH và MILD/MODERATE/SEVERE/ANAPHYLACTIC; đã sao lưu rồi áp dụng trên volume hiện tại, image database nạp ở bước 08 cho volume mới. Quét thực đơn lấy cả khai báo tự nhập đang áp dụng, đối chiếu tên món, nguyên liệu công thức và nhãn dị nguyên; giữ đúng mức độ và hướng dẫn được khai báo. Thẻ món có xung đột hiện cảnh báo đỏ, tên bé và thực phẩm cần tránh. Cảnh báo tải lại khi quay về trang, có sự kiện cập nhật trong cùng trình duyệt hoặc mỗi 30 giây khi trang đang hiển thị. Cảnh báo không tự thay món.

Kiểm tra bản sửa dị ứng: 37/37 test liên quan pass, 7 nhóm schema/seed pass; frontend/backend build thành công và Docker healthy. `node scripts/verify-allergy-docker.cjs` kiểm tra API với phụ huynh/học sinh thử riêng rồi dọn sạch: giới hạn hồ sơ, thêm thực phẩm tự nhập, mức độ nặng/sốc phản vệ, chống trùng, đổi danh mục ↔ tự nhập, ngưng/áp dụng lại. Khai báo thịt bò đang có được phát hiện tại 28 vị trí món trong 13 thực đơn; không sửa khai báo thực tế. Chưa kiểm tra giao diện bằng trình duyệt do quyền điều khiển Chrome chưa được cấp.

Sửa mã hóa tiếng Việt ngày 03/11/2026: đã sao lưu và sửa 525 bản ghi hiển thị, gồm tên người dùng/học sinh/lớp, tên trường, thực đơn, thông báo, bản dịch, địa chỉ và ghi chú. Các chuỗi như `L├¬ Ho├ái Nam` được khôi phục thành `Lê Hoài Nam`. Các cột mật khẩu, token, email, URL và bản lưu trữ nguồn được giữ nguyên. Frontend làm mới thông tin tên/hồ sơ từ API khi tải trang, giữ các role alias và phiên đăng nhập.

Chạy `node scripts/repair-vietnamese.cjs` để rà soát, không ghi dữ liệu; thêm `--apply` để sao lưu database Docker test và áp dụng sửa mã hóa theo transaction, kèm kiểm tra chống ghi đè thay đổi đồng thời. Script chỉ kết nối database test cục bộ trên cổng 55432. Sau sửa, lượt rà soát trả 0 bản ghi và 0 file nguồn cần sửa. 25 test công cụ/profile/encoding pass; API đăng nhập, hồ sơ, trường, lớp, thực đơn, phụ huynh và món ăn đã kiểm tra trả tiếng Việt đúng.

Quy tắc bữa trưa bổ sung ngày 03/11/2026: thứ Hai–thứ Năm có cơm thường và món mặn; thứ Sáu có cơm chiên Dương Châu/hải sản và không có món mặn riêng. Quy tắc áp dụng cho thực đơn tạo tự động mới, cả xem trước và lưu. Thiếu loại cơm đủ dữ liệu thì báo lỗi rõ ràng. Cơm thường được phép lặp lại giữa các ngày.

Migration `20261103-lunch-rice-recipes.sql` phục hồi ba công thức tham khảo từ định lượng seed lưu trữ: cơm thường, một món Dương Châu và một món cơm chiên hải sản. Không thay đổi công thức đã tồn tại. Nguồn, ID công thức cũ và trạng thái tham khảo được lưu trong metadata; đây không phải định lượng bếp mới được đo/xác minh. Chạy `node scripts/prepare-lunch-rice.cjs` để sinh lại migration. Image database mới nạp migration này ở bước 07; volume hiện tại đã áp dụng sau khi sao lưu. Các thực đơn đã lưu trước thay đổi cần tạo lại để áp dụng quy tắc mới.

Kiểm tra quy tắc cơm: 9 test liên quan pass, gồm giữ đúng thứ Sáu khi lưu hai quy ước đánh số ngày, từ chối kế hoạch thiếu cơm hoặc thêm món mặn vào thứ Sáu. Đã kiểm tra API xem trước cho hai tuần 09/11 và 16/11/2026: cả 10 bữa trưa đều đúng cơ cấu; kế hoạch thứ Sáu có món mặn bị từ chối HTTP 400 trước khi lưu. Việc đúng cơ cấu bữa không thay thế các cảnh báo dinh dưỡng còn lại của thực đơn. Migration đã chạy lặp hai lần không nhân đôi công thức.

Đồng bộ ngày 03/11/2026 từ các thay đổi database mới nhất trong working tree nhánh `kiet`, trên nền nhánh `test` commit `1792b0c`. Nhánh `kiet` và Docker cũ không bị sửa.

## Khởi chạy

Chạy từ thư mục repository:

```powershell
node scripts/prepare-docker-test.cjs
docker compose --env-file .docker-test/test.env -f compose.test.yml up -d --build --wait
```

- Giao diện: http://localhost:5174
- Swagger: http://localhost:3001/api/docs
- MinIO console: http://localhost:19001
- PostgreSQL test: localhost:55432, user `kidmeal_test`.
- Tên database đang dùng nằm trong `TEST_POSTGRES_DB` của `.docker-test/test.env`; nếu chưa đặt thì dùng `kidmeal_test`.
- Mật khẩu và JWT key được sinh riêng trong file này và được bỏ qua bởi Git/Docker build context.
- Mạng, volume và container thuộc project `kidmeal-test`, tách khỏi bộ cũ ở 5173/3000.
- SMTP test trỏ vào loopback trong container.

## Dữ liệu và nâng cấp

Image PostgreSQL đóng gói schema, seed UTF-8, danh mục nguồn, migration quan hệ, reset sequence và phần schema bổ sung để tương thích chức năng của nhánh test. File Compose chính cũng dùng Dockerfile database này cho lần khởi tạo volume mới.

Database hiện tại đã có **56 bảng, 172 món active, 91 nguyên liệu có nguồn, 177 dòng công thức và 59 dòng dinh dưỡng**. Không có khóa ngoại chưa được validate. Công thức khôi phục là dữ liệu tham khảo chưa xác minh; ứng dụng giữ trạng thái nguồn và các giá trị dinh dưỡng chưa biết dưới dạng NULL.

Với bộ Docker test đang có dữ liệu, có thể sao lưu và nâng cấp trên một database mới trong cùng PostgreSQL:

```powershell
node scripts/sync-kiet-database-docker.cjs --apply
docker compose --env-file .docker-test/test.env -f compose.test.yml up -d --build --wait
```

Script lưu bản `pg_dump` trong `.docker-test/backups`, giữ nguyên database cũ, tạo database mới từ bản sao, chạy migration theo transaction và xác nhận số lượng trước khi cập nhật tên database trong file môi trường. Trạng thái lần nâng cấp nằm trong `.docker-test/database-sync-result.json`.

Quy trình chung và nguồn dữ liệu: [source-data-import.md](docs/source-data-import.md), [database-relations.md](docs/database-relations.md).

## Kết quả kiểm tra

- Frontend và backend build thành công; các container đang chạy, backend và PostgreSQL healthy.
- Giao diện, danh sách trường, món ăn, nguyên liệu, phụ huynh, thống kê phụ huynh và danh sách ăn xế trả HTTP 200.
- Đăng nhập mẫu cả 5 vai trò thành công.
- 18 test công cụ database pass; 7 nhóm kiểm tra schema/seed pass.
- Kiểm tra nhập dữ liệu trên database mới, volume cũ và cấu hình dinh dưỡng cũ đều pass; xác nhận nhập lặp, giữ dữ liệu thủ công và trigger tính lại dinh dưỡng. Các fixture đều rollback.
- Kiểm tra quan hệ với fixture mới/cũ đều pass: liên thông, từ chối FK mồ côi, giữ mẫu lịch sử, đăng ký mã rule và phạm vi cấu hình.
- Unit test toàn dự án: **19/27 suite pass; 134 testcase pass, 1 fail**. Còn 7 suite không biên dịch được do test cũ không khớp API/types. Lỗi testcase quota đăng ký ăn xế đã tồn tại trước đồng bộ.
- Lần chạy API e2e trước đồng bộ có 2 kỳ vọng lỗi thời về response danh sách trường và HTTP status quick-login; không chỉnh testcase để thay đổi kết quả. API thực tế đã được kiểm tra sau đồng bộ như trên.

## Vận hành

```powershell
docker compose --env-file .docker-test/test.env -f compose.test.yml ps
docker compose --env-file .docker-test/test.env -f compose.test.yml logs --tail 100 backend
docker compose --env-file .docker-test/test.env -f compose.test.yml down
```

Lệnh `down` giữ các volume và dữ liệu. Không xóa volume để cập nhật database đang dùng.
