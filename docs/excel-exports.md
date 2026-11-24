# Xuất báo cáo Excel

Các nút tải báo cáo dữ liệu trên giao diện dùng chung bộ xuất trong
`apps/frontend/src/core/utils/excel-export.ts` và `excel-workbook.ts`.

- Định dạng tải xuống là `.xlsx`, gồm cả các chức năng trước đây tải CSV hoặc JSON.
- Logo, tên trường, địa chỉ và liên hệ lấy từ cấu hình Thông tin trường.
- Logo được nhúng vào workbook, giữ đúng tỷ lệ; hỗ trợ ảnh logo được trình duyệt đọc được.
- Khi không có hoặc không tải được logo, ứng dụng báo lỗi và không thông báo xuất thành công.
- Báo cáo có hàng tiêu đề màu theo thương hiệu trường, dòng xen kẽ, bộ lọc, cố định tiêu đề và thiết lập in A4.
- Số đo được giữ dạng số; mã học sinh và số điện thoại giữ dạng văn bản.
- Nội dung bắt đầu bằng dấu `=` được ghi dưới dạng văn bản, không thực thi như công thức.

Các nhóm giao diện áp dụng: thực đơn, suất ăn, danh sách đăng ký ăn sáng/ăn phụ,
dị ứng và chế độ ăn, thể chất, kiểm thực/lưu mẫu, bảng tổng quan, ý kiến phụ huynh,
biên lai thanh toán và mẫu nhập học sinh. Các thao tác In vẫn mở hộp thoại máy in.

Mẫu nhập học sinh giữ tiêu đề cột tiếng Việt để đọc lại ổn định. Bộ nhập nhận diện
dòng tiêu đề bên dưới phần logo/thông tin trường và tiếp tục hỗ trợ mẫu cũ.

Kiểm tra từ thư mục `Kidmeal`:

```powershell
npm --prefix apps/frontend run test:excel
npm --prefix apps/frontend run build
```
