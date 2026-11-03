# Docker test với database mới nhất từ kiet

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