# Đối chiếu chức năng Chuyên gia dinh dưỡng

Ngày rà soát: 04/11/2026. Nhánh: `test`. Đối chiếu cả giao diện và backend; dữ liệu kiểm thử chỉ nằm trong test, không dùng làm dữ liệu mặc định của ứng dụng.

Các đường dẫn màn hình dưới đây bắt đầu bằng `/nutritionist`. API bắt đầu bằng `/api/v1`.

| STT | Màn hình | API / xử lý backend | Kết quả rà soát |
| --- | --- | --- | --- |
| 23, 24, 26 | `/children` | `GET /children`, `GET /children/:id`, `/classes` | Bổ sung màn hình xem, tìm kiếm, lọc lớp và chi tiết học sinh. |
| 29 | `/children` → Chi tiết & hồ sơ dinh dưỡng | `GET/PATCH /children/:id/nutrition-profile` | Bổ sung lưu hồ sơ theo từng học sinh; chưa có hồ sơ hiển thị trống; lỗi lưu giữ nội dung đang nhập. |
| 31, 32 | `/allergens`, `/alerts` | `/student-allergies`, `/allergens`, `/child-alerts/nutritionist` | Giữ chức năng, bỏ danh sách học sinh/lớp/dị nguyên dự phòng giả; cảnh báo dựa trên dữ liệu lưu. |
| 33, 34 | `/foods` | `GET /foods` | Giữ danh sách, tìm kiếm và bộ lọc; bỏ KPI không có nguồn. |
| 35 | `/foods` → Thêm nguyên liệu | `POST /foods` | Giữ luồng tạo nguyên liệu. |
| 36, 37 | `/foods` → Chi tiết/chỉnh sửa | `GET/PUT /foods/:id` | Giữ luồng chi tiết và cập nhật. |
| 38, 39 | `/dishes` | `GET /dishes` | Giữ danh sách và bộ lọc; bỏ KPI giả. |
| 40 | `/dishes` → Thêm món | `POST /dishes` | Giữ tạo món và công thức định lượng. |
| 41, 42 | `/dishes` → Chi tiết/chỉnh sửa | `GET/PUT /dishes/:id` | Giữ chi tiết/cập nhật món và công thức. |
| 43 | `/dishes` → Công thức | Bộ tính dinh dưỡng từ nguyên liệu/công thức | Giữ tính toán; backend kiểm tra nguồn công thức trước khi dùng đánh giá thực đơn. |
| 44 | `/rules` | `/nutrition-rules` | Sửa lưu tên, khoảng năng lượng/macronutrient, bật/tắt, khôi phục và thống kê thực tế; bỏ giá trị số tự điền. |
| 45 | `/allergens`, `/rules` | `/allergens` | Sửa bật/tắt dị nguyên để lưu thực tế; tìm kiếm và trạng thái hoạt động lấy từ DB. |
| 46 | `/food-group-rules` | `/nutrition-rules/frequency-rules`, `/spacing-rules`, `/intake-standards` | Giữ quản lý quy tắc thực phẩm và định mức; bỏ định mức giả khi chưa cấu hình. |
| 47 | `/menu-evaluation` | `POST /rule-engine/evaluate-menu` | Bổ sung chọn đúng thực đơn để đánh giá 6 tiêu chí: năng lượng, đa lượng, vi chất, dị ứng, tần suất, giãn cách. Thiếu cấu hình trả UNKNOWN, không báo đạt. |
| 48 | `/menus` | `POST /menus` | Giữ tạo thực đơn tuần. |
| 49 | `/menus` | `/menus/:id/create-version`, `/:menuId/adjust-dish` | Giữ điều chỉnh và phiên bản. |
| 50 | `/menus` | `POST /menus/:id/submit` | Giữ gửi hiệu trưởng phê duyệt; quyền công bố nằm ở người quản lý. |
| 51, 52 | `/menus` | `GET /menus`, `GET /menus/:id/versions` | Giữ xem/lọc thực đơn và lịch sử phiên bản. |
| 55 | `/menus` → Tạo gợi ý | `POST /menus/auto-generate` | Có bộ sinh ứng viên bằng thuật toán ràng buộc, dùng món và tiêu chuẩn đã cấu hình. Chưa tích hợp nhà cung cấp AI/LLM bên ngoài; không coi thuật toán này là tích hợp LLM hoàn chỉnh. |
| 71 | `/picky-eating` | `/nutrition-advice/detect`, `/history`, `/send` | Bổ sung màn hình phát hiện từ bữa ăn đã ghi nhận và nhập tư vấn thực tế; bỏ thực đơn/lời khuyên tạo sẵn giả. |
| 73, 74 | `/inspections` | `GET /inspections`, `GET /inspections/:id` | Giữ xem/lọc, bổ sung chế độ người duyệt theo yêu cầu riêng. Duyệt yêu cầu cả 3 bước đạt và có ảnh; yêu cầu bổ sung phải có lý do. |
| 75 | `/inspections` → Xem / bổ sung minh chứng | API nộp minh chứng kiểm thực | Dinh dưỡng có chế độ bổ sung ảnh; tách khỏi thao tác duyệt. |
| 76 | `/samples` | `GET /inspections/samples` | Bổ sung đường dẫn riêng; xem/lọc mẫu thực tế. Không cho vai trò dinh dưỡng thực hiện hủy mẫu ngoài phạm vi. |
| 78, 79, 80 | `/growth` | `POST /growth`, `PUT /growth/:id`, `POST /growth/import` | Giữ nhập/sửa/import; mẫu CSV chỉ có tiêu đề, không chèn cân nặng giả vào học sinh thật. |
| 81, 82 | `/growth` | `GET /growth`, `/growth/child/:childId` | Giữ xem/lọc và lịch sử cân đo. |
| 83 | `/growth` → Biểu đồ | GrowthService, bảng WHO, Z-score lưu | Giữ tính và biểu đồ; bỏ kết luận BMI người lớn ở phần xem trước frontend. Không thay thế việc xác minh bộ chuẩn WHO đang cài trong DB. |
| 84 | `/alerts`, `/growth` | `/child-alerts/nutritionist`, `/growth` | Cảnh báo dựa trên kết quả đã lưu; thiếu Z-score không tự tạo số âm giả. |
| 85 | `/growth-notifications` | `/growth-notifications`, `POST /growth-notifications/scan-dispatch` | Bổ sung trang đúng vai trò, bỏ bộ chuyển vai trò giả; thông báo phát sinh từ phép đo thật, lưu bền vững. |
| 86 | `/growth` → Xuất báo cáo | `GET /growth/export` | Giữ xuất dữ liệu tăng trưởng thực tế. |
| 92 | `/dashboard` | `/dashboard/nutrition-physical/nutritionist` | Thay màn hình bằng tổng quan dinh dưỡng và học sinh nguy cơ từ API; bỏ tỷ lệ/chỉ số dự phòng giả. |
| 93 | `/alerts` | `/child-alerts/nutritionist` | Bổ sung trang riêng, không gọi API của các vai trò khác. |
| 95 | `/food-safety` | `/food-safety/compliance-report`, `/export-compliance-dossier` | Báo cáo theo ngày, bằng chứng/mẫu thực tế và xuất JSON; thiếu thông số để trống, bỏ nhà cung cấp/chứng nhận/ảnh và tỷ lệ an toàn giả. |
| 97 | `/parent-evaluations` | `/parent-evaluations/summary-report`, `/summary-report/export` | Báo cáo theo tháng từ đánh giá đã lưu; sửa lọc ngày và bỏ thống kê giả; xuất JSON. |
| 98 | `/gross-weight` | Công thức frontend từ định lượng, số suất và tỷ lệ thải bỏ đã nhập | Bổ sung đường dẫn dinh dưỡng, tính khối lượng thô theo hiệu suất thu hồi; kiểm tra dữ liệu không hợp lệ và xuất CSV. |

## Phần chung và phạm vi

Giữ các luồng đăng nhập, đăng xuất, quên/đặt lại mật khẩu, đổi mật khẩu và hồ sơ tài khoản hiện có. Danh sách 7 chức năng chung chưa được cung cấp theo STT nên không kết luận con số 53/53 dựa trên suy đoán. Không thử gửi OTP, thông báo cho phụ huynh hoặc đổi mật khẩu tài khoản thật khi kiểm tra triển khai.

Điều hướng dinh dưỡng chỉ giữ các nhóm được yêu cầu; đường dẫn vận hành bữa ăn và dịch vụ ăn phụ cũ chuyển về dashboard. Xóa màn hình thông báo tăng trưởng cũ có dữ liệu giả và bộ chọn vai trò. Dữ liệu tham chiếu khoa học, mã trạng thái và fixture trong test không bị coi là dữ liệu nghiệp vụ giả.

Không xóa dữ liệu đã có trong DB để giả lập trạng thái sạch. Migration `20261104-nutrition-workspace.sql` bổ sung cột/bảng còn thiếu và cho phép thông số mẫu chưa đo là NULL. Công thức món cũ chưa xác minh không được tự đánh dấu đã xác minh.

## Kiểm tra

- 55 kiểm thử backend qua: hồ sơ dinh dưỡng, kiểm thực/phê duyệt, tiêu chuẩn, 6 tiêu chí, tần suất/giãn cách, khẩu phần và nguồn công thức.
- 22 kiểm thử frontend qua: dữ liệu bếp, món đúng ngày công bố, dị ứng, lưu mẫu, khối lượng thô và xuất CSV.
- Kiểm thử trình duyệt có fixture riêng: lưu hồ sơ đúng học sinh; giữ bản nháp khi API lỗi; gửi tư vấn; duyệt/yêu cầu bổ sung kiểm thực; chọn thực đơn để đánh giá; phân quyền nút hủy mẫu và điều hướng.
- Build TypeScript/backend và frontend production thành công. Sau triển khai Docker test, 23 API đọc trả HTTP 200 với tài khoản dinh dưỡng; 18 màn hình không có lỗi JavaScript hoặc API lỗi. Trang học sinh không tràn ngang ở viewport điện thoại 390px.
- Kiểm tra điều hướng: 121 liên kết, không có import thiếu, đường dẫn hỏng hoặc trang dư không được tham chiếu. Đã sửa thứ tự đăng ký controller để API quy tắc thực phẩm không bị route chi tiết tiêu chuẩn che mất; sửa tên thuộc tính sắp xếp trong truy vấn cảnh báo tăng trưởng.

## Giới hạn được giữ rõ

- STT 55 hiện là bộ sinh thực đơn theo ràng buộc, chưa có kết nối AI/LLM bên ngoài.
- Đồng bộ RDA bên ngoài chưa có nguồn cấu hình: không tạo số liệu và không báo đồng bộ thành công giả.
- Báo cáo an toàn chỉ phản ánh dữ liệu nhập, không suy diễn chứng nhận tuân thủ pháp lý từ việc thiếu dữ liệu.
