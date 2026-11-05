# Kiểm tra phạm vi dữ liệu theo vai trò — 05/11/2026

Kiểm tra trên bản Docker tại `http://127.0.0.1:5174`, bằng phiên đăng nhập thực cho PARENT, TEACHER và NUTRITIONIST. Đối chiếu quan hệ phụ huynh–trẻ và phân công chủ nhiệm trong database, sau đó gọi trực tiếp các API GET. Không thay đổi phân quyền trong lần kiểm tra này.

## Kết quả

| Yêu cầu | Kết quả hiện tại |
|---|---|
| Parent chỉ xem trẻ của mình | **Chưa đạt trên toàn hệ thống.** API hồ sơ và portal đánh giá có kiểm tra liên kết, nhưng các API tăng trưởng, sức ăn, danh sách lớp, tư vấn và biên lai còn truy cập vượt phạm vi. |
| Teacher chỉ xem trẻ thuộc lớp được phân công | **Đạt trong các đường đọc đã thử với tài khoản chỉ mang vai trò TEACHER.** Danh sách trả đúng lớp; truy cập trẻ ngoài lớp và gọi các API chung đã thử đều bị chặn 403. |
| Nutritionist chỉ xem thông tin cần cho nghiệp vụ | **Chưa giới hạn đủ.** Ngoài hồ sơ/dị ứng/tăng trưởng, tài khoản còn đọc được thông tin quản lý phụ huynh, nhân sự và phí gói. API chi tiết lớp còn trả trường hash mật khẩu của giáo viên. |

## Bằng chứng API

Tài khoản phụ huynh dùng để thử chỉ liên kết với trẻ ID 3. Giáo viên được phân công lớp ID 2, có trẻ ID 4 và 5. Trẻ ID 1 nằm ngoài cả hai phạm vi đó. Chỉ lưu mã và trạng thái kiểm tra, không đưa tên, thông tin liên hệ hoặc giá trị hash mật khẩu vào báo cáo.

| Vai trò | API / tình huống | Kết quả |
|---|---|---|
| Parent | `GET /children` | Chỉ trả trẻ ID 3. |
| Parent | `GET /children/1` | 403, đúng giới hạn. |
| Parent | `GET /parent-evaluations/portal-data?childId=1` | 403, đúng giới hạn. |
| Parent | `GET /growth/child/1` | **200 và trả hồ sơ tăng trưởng trẻ khác.** |
| Parent | `GET /classes/1/students` | **200, trả cả các trẻ không liên kết.** |
| Parent | `GET /parent-evaluations/child-menu-consumption?childId=1` | **200, trả thông tin sức ăn của trẻ khác.** |
| Parent | `GET /parent-evaluations?limit=200` | **200, trả 10 đánh giá với nhiều mã trẻ ngoài phạm vi.** |
| Parent | `GET /nutrition-advice/child-advice?childId=1` | **200 và trả hồ sơ trẻ ID 1.** Không cần có tư vấn mới để xác định đã vượt phạm vi hồ sơ. |
| Parent | `GET /payments/receipt/1`, biên lai thuộc phụ huynh khác | **200, trả đối tượng student ID 1 và thông tin biên lai.** |
| Parent | `GET /payments/invoices` | 403. |
| Teacher | `GET /teacher/classes`, `GET /teacher/children` | Đúng lớp ID 2, trẻ ID 4 và 5. |
| Teacher | `GET /teacher/children/1`, `GET /teacher/growth/child/1` | 403. |
| Teacher | Các đường chung `/children`, `/children/1`, `/growth/child/1`, `/classes/1/students`, `/parent-evaluations/child-menu-consumption?childId=1`, `/nutrition-advice/history?studentId=1` | Đều 403 nhờ interceptor giới hạn cổng giáo viên. |
| Nutritionist | `GET /children`, `GET /growth` | Đọc được dữ liệu phục vụ nghiệp vụ; cần tiếp tục xác định chính xác trường dữ liệu và phạm vi trường học được phép. |
| Nutritionist | `GET /users/parents?limit=100` | **200, 12 bản ghi, có email, điện thoại, địa chỉ, nghề nghiệp, ghi chú và danh sách con.** |
| Nutritionist | `GET /users/staff?limit=100` | **200, 12 bản ghi, có email, điện thoại, vai trò và dữ liệu tài khoản nhân sự.** |
| Nutritionist | `GET /snack-services`, `GET /snack-services/9` | **200, còn giá trị phí gói.** Cờ `hidePaymentInfo` không loại phí khỏi phản hồi backend. |
| Nutritionist | `GET /classes/1` | **200, đối tượng `homeroomTeacher` có trường `passwordHash`.** Giá trị hash không được ghi vào báo cáo. |
| Nutritionist | `GET /payments/invoices`, `GET /payments/my-invoices`, `GET /audit-logs` | 403. |

Lần gọi `/users/parents?limit=200` ban đầu trả 400 do tham số limit vượt 100. Đã gọi lại với limit hợp lệ và xác nhận trả 200; lỗi validation không phải bằng chứng chặn quyền.

## Nguyên nhân trong mã

- `children/services/children.service.ts`: kiểm tra quan hệ phụ huynh ở `parentOnly`, `assertChildAccess` và danh sách hồ sơ. Kiểm tra này chưa trở thành chính sách chung cho mọi API liên quan đến trẻ.
- `growth/controllers/growth.controller.ts`: lịch sử trẻ chỉ nhận `childId`, không chuyển người truy cập để kiểm tra quan hệ sở hữu/phân công. Service truy vấn theo mã trẻ.
- `parent-evaluations/services/parent-evaluation.service.ts`: portal và chỉnh sửa đánh giá có kiểm tra quyền; `getChildMenuConsumption` và danh sách đánh giá vẫn chưa áp dụng cùng chính sách.
- `nutrition-advice/services/nutrition-advice.service.ts`: `getChildAdvice` dùng trực tiếp `childId` nếu có, không kiểm tra quan hệ với người đọc.
- `payments/services/vnpay.service.ts`: `getElectronicReceipt` nhận `parentId` nhưng không dùng để kiểm tra chủ sở hữu biên lai.
- `teacher/teacher-boundary.interceptor.ts`: tài khoản Teacher thuần bị giới hạn vào `/teacher/...` cùng các đường xác thực/hồ sơ cơ bản. `TeacherService` kiểm tra `homeroom_teacher_id` và `school_id`.
- `users/controllers/parent-management.controller.ts` và `staff-management.controller.ts`: các đường GET quản lý thiếu danh sách vai trò cho phép; `RolesGuard` chấp nhận khi không có metadata `@Roles`.
- `classes/classes.service.ts`: trả thẳng entity lớp có quan hệ `homeroomTeacher`; entity người dùng có cột `passwordHash` được chọn mặc định.
- `snack-services/snack-services.service.ts`: vẫn đưa `feeAmount`, `monthlyEstimatedPrice` vào kết quả cho Nutritionist dù có cờ ẩn giao diện.

## Thứ tự khắc phục

1. Loại `passwordHash` và các bí mật xác thực khỏi mọi phản hồi API bằng DTO/allowlist; rà soát các quan hệ trả thẳng entity.
2. Áp dụng một cơ chế kiểm tra phạm vi trẻ thống nhất cho danh sách, chi tiết, tăng trưởng, sức ăn, tư vấn, đánh giá và biên lai. Lọc tại truy vấn backend và kiểm tra khi truyền mã đối tượng trực tiếp.
3. Chặn API quản lý phụ huynh/nhân sự đối với vai trò không được phép; định nghĩa riêng dữ liệu liên hệ cần cho từng nghiệp vụ nếu có.
4. Loại trường không cần thiết khỏi phản hồi cho Nutritionist thay vì chỉ đặt cờ ẩn ở giao diện.
5. Kiểm thử lại với Parent, Teacher, Nutritionist, tài khoản không có lớp/con liên kết, tài khoản nhiều vai trò và dữ liệu nhiều trường.

## Giới hạn kiểm tra

Đây là kiểm tra đọc trên các API được liệt kê, không phải chứng nhận toàn bộ phân quyền. Chưa thử quyền ghi bằng dữ liệu thật, mọi tổ hợp nhiều vai trò, nhiều trường học hoặc tất cả endpoint trong hệ thống. Phạm vi thông tin thực sự cần cho Nutritionist cần được chốt thành danh sách trường dữ liệu theo nghiệp vụ.
