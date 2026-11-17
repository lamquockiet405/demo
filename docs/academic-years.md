# Quản lý năm học của Hiệu trưởng

Mã nguồn và Docker đang sử dụng nằm trong thư mục `Kidmeal/` của workspace.
Trong cổng Ban Giám Hiệu, vào **Quản trị trường → Quản lý năm học** (`/academic-years`).

- Tạo năm học với tên, ngày bắt đầu, ngày kết thúc và ghi chú. Có thể chọn năm nguồn để kế thừa lớp, học sinh đang học và liên hệ phụ huynh; không tạo trùng học sinh hay tài khoản.
- Năm mới ở trạng thái **Đang chuẩn bị**. Có thể thêm/sửa lớp, phân công giáo viên, thêm học sinh mới hoặc đã có hồ sơ, chuyển lớp và cập nhật thông tin liên hệ.
- Kết thúc năm đang áp dụng, sau đó áp dụng năm mới. Mỗi trường có tối đa một năm đang áp dụng. Lớp của năm đang chuẩn bị không hiển thị trong các danh sách vận hành hiện tại.
- Hồ sơ học sinh, liên hệ phụ huynh và trạng thái học tập được lưu riêng theo năm. Học sinh đã rút hoặc hoàn thành không được kế thừa. Các liên hệ trong trang này không tự tạo tài khoản đăng nhập; tài khoản phụ huynh vẫn quản lý ở trang hiện có.
- Migration bảo toàn lớp và danh sách học sinh hiện có. Có thể chạy lại mà không ghi đè hồ sơ đã chỉnh sửa.

Chạy từ thư mục `Kidmeal`:

```powershell
npm run test:academic-years
npm run db:academic-years:apply
docker compose --env-file .docker-test/test.env -f compose.test.yml up -d --build --wait backend frontend
```

Kiểm thử tạo schema PostgreSQL riêng rồi dọn schema đó khi kết thúc. Lệnh áp dụng migration sao lưu database đang dùng vào `database/backups` trước khi cập nhật. Docker PostgreSQL mới cũng tự chạy migration khi khởi tạo volume mới.

## Kiểm tra bản cập nhật

- 12 kiểm thử tích hợp năm học và 29 kiểm thử liên quan giáo viên, điểm danh, suất ăn đều đạt.
- Frontend và backend build thành công. Chạy `node scripts/verify-academic-years-docker.cjs` để kiểm tra bản đang phục vụ, menu, API và quyền truy cập bằng tài khoản demo.
- Có thể thêm URL demo vào lệnh kiểm tra, ví dụ `node scripts/verify-academic-years-docker.cjs https://your-demo.trycloudflare.com`. Ngày 07/11/2026 đã kiểm tra thành công qua tunnel công khai: menu mới, API Hiệu trưởng, 6 lớp và 38 học sinh của năm hiện tại; giáo viên không có quyền truy cập quản lý năm học.
- Bộ kiểm tra navigation không có liên kết hỏng hoặc import thiếu; vẫn báo các file cũ không được sử dụng.
- Ba kiểm thử dashboard cũ vẫn thất bại ở dữ liệu dinh dưỡng và xu hướng. Đã chạy đối chứng mã dashboard trước thay đổi và xác nhận ba lỗi giống hệt; không nằm trong thay đổi năm học.
