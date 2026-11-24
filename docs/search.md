# Tìm kiếm trên web

Các bộ lọc tìm kiếm trên giao diện và API chuẩn hóa chữ thường, bỏ dấu tiếng Việt
(bao gồm Đ/đ), chuẩn hóa Unicode và gộp khoảng trắng thừa.

- Giao diện dùng `core/utils/search.ts`; các màn hình bếp dùng cùng quy tắc trong `kds-data.ts`.
- API dùng `common/utils/search.ts`. Truy vấn SQL chuẩn hóa cả dữ liệu và từ khóa
  bằng hàm có sẵn của PostgreSQL, không cần cài extension hoặc thay đổi database.
- Bộ lọc trường/lớp, quyền truy cập và phân trang được giữ ở truy vấn gốc.
- Ký tự `%` và `_` trong từ khóa được xử lý như ký tự thông thường.
- Tìm kiếm phụ huynh tự cập nhật sau 300 ms và trở về trang đầu khi đổi từ khóa.

Kiểm tra giao diện: `npm --prefix apps/frontend run test:search`.

Đã kiểm tra riêng SQL bằng PostgreSQL nhúng (PGlite) với tên có dấu/không dấu,
Unicode tổ hợp, khoảng trắng, ký tự đặc biệt và giới hạn lớp/phân trang.
