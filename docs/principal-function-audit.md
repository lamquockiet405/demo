# Đối chiếu chức năng Hiệu trưởng

Ngày rà soát: 04/11/2026. Nhánh `test`. Phạm vi kiểm tra: frontend máy tính, API/backend và nguồn dữ liệu. Không phát triển hoặc kiểm thử giao diện điện thoại trong đợt này.

Trước đợt này chưa đủ: các mục điều hướng đã có nhưng tài khoản nhân viên gửi/nhận sai cấu trúc vai trò và phân trang; dịch vụ ăn phụ lưu một số thông tin trong bộ nhớ; thiếu chỗ nhập số suất ở màn hình hiệu trưởng; xuất thực đơn trả đường dẫn file không tồn tại; một số báo cáo lỗi với dữ liệu NULL; hồ sơ chung có thông tin giả khi tải lỗi.

Đường dẫn API dưới đây bắt đầu bằng `/api/v1`.

| STT | Chức năng | Giao diện | Backend / kết quả đối chiếu |
| --- | --- | --- | --- |
| 7 | Cấu hình thông tin trường | `/settings` | `GET/PATCH /tenant/profile`, tải logo và cấu hình vận hành; dữ liệu trường, cấu hình và logo lưu thực tế. Bỏ chỉ tiêu 200 học sinh tự điền và bản xem trước phụ huynh chứa dữ liệu giả. |
| 8 | Xem nhân viên | `/staff` | `GET /users/staff`, `/:id`; sửa cấu trúc trả về gồm vai trò có tên và thông tin phân trang. |
| 9 | Tạo nhân viên | `/staff` → Thêm nhân viên | `POST /users/staff`; nhận đúng `roleCodes` từ frontend, kiểm tra vai trò và email; không dùng mật khẩu mặc định viết sẵn. |
| 10 | Cập nhật nhân viên | `/staff` → Chỉnh sửa | `PUT /users/staff/:id`; cập nhật nhiều vai trò, trạng thái, thông tin và mật khẩu mới nếu được nhập. |
| 11 | Tìm kiếm nhân viên | `/staff` | Backend tìm theo tên/email/điện thoại, lọc vai trò/trạng thái và phân trang. |
| 12 | Xem danh sách lớp | `/classes` | `GET /classes`; giữ dữ liệu thực. |
| 13 | Tạo lớp | `/classes` → Tạo lớp | `POST /classes`; chọn giáo viên từ tài khoản thật. |
| 14 | Cập nhật lớp | `/classes` → Chỉnh sửa | `PATCH /classes/:id`. |
| 15 | Tìm kiếm/lọc lớp | `/classes` | Tên lớp, nhóm tuổi và trạng thái được gửi vào API. |
| 16 | Xem chi tiết lớp | `/classes` → Chi tiết | `GET /classes/:id`, `/classes/:id/students`. |
| 17 | Xem phụ huynh | `/parents` | `GET /users/parents`, chi tiết và liên kết học sinh từ DB. |
| 18 | Tạo phụ huynh | `/parents` → Tạo tài khoản | `POST /users/parents`; vai trò PARENT được lưu; yêu cầu mật khẩu ban đầu, không dùng 123456 dự phòng. |
| 19 | Cập nhật phụ huynh | `/parents` → Chỉnh sửa | `PUT /users/parents/:id`; bổ sung nhận/lưu `childIds` và mật khẩu mới; không bỏ qua dữ liệu frontend gửi. |
| 20 | Tìm kiếm phụ huynh | `/parents` | API hỗ trợ tìm kiếm, lọc trạng thái và phân trang. |
| 21 | Vô hiệu hóa phụ huynh | `/parents` | Trạng thái INACTIVE lưu trong users; giữ khôi phục tài khoản. |
| 22 | Xem/lọc nhật ký dữ liệu nhạy cảm | `/audit-logs` | `/audit-logs`, `/filters`, `/stats`; dữ liệu nhật ký thật, che các khóa nhạy cảm trước khi trả về. |
| 23 | Xem học sinh | `/students` | `GET /children`. |
| 24 | Tìm kiếm/lọc học sinh | `/students` | Tìm tên/mã và lọc lớp qua API. |
| 25 | Tạo học sinh | `/students` → Thêm học sinh | `POST /children`. |
| 26 | Xem hồ sơ học sinh | `/students` → Chi tiết | `GET /children/:id`. |
| 27 | Cập nhật học sinh | `/students` → Chỉnh sửa | `PATCH /children/:id`. |
| 28 | Nhập danh sách học sinh | `/students` → Import | `POST /children/import`; kiểm tra dữ liệu và xem trước; thiếu ngày sinh/giới tính/lớp không tự tạo dữ liệu thay thế. |
| 44 | Cấu hình tiêu chuẩn dinh dưỡng | `/nutrition-standards` | `/nutrition-rules`; giữ tạo/sửa/bật tắt tiêu chuẩn; giao diện hiệu trưởng chỉ hiện nhóm tiêu chuẩn. Không báo đồng bộ RDA thành công khi chưa có kết nối. |
| 51 | Xem phiên bản thực đơn | `/menu-versions` | `GET /menus`, `GET /menus/:id/versions`, `GET /menus/:id?versionNumber=...`; xem đúng nội dung phiên bản cũ, không thay bằng bản mới nhất. |
| 52 | Lọc thực đơn/phiên bản | `/menu-versions` | Bộ lọc tên/trạng thái/nhóm tuổi, thực đơn và số phiên bản/ghi chú/người tạo trong lịch sử. |
| 53 | Phê duyệt/từ chối thực đơn | `/menu-approval` | `POST /menus/:id/approve`, `/reject`; giữ xử lý lý do từ chối và lịch sử người duyệt. |
| 54 | Công bố/xuất thực đơn | `/menu-approval` | `POST /menus/:id/publish`; bổ sung `GET /menus/:id/export/data` và file CSV UTF-8 thực tế tại `/export/excel`. Bản in lấy món đúng ngày và người duyệt đã lưu; không tạo tên người ký. |
| 56 | Xem dịch vụ ăn phụ | `/snack-services` | `GET /snack-services`; dữ liệu từ bảng kỳ dịch vụ và đăng ký. |
| 57 | Lọc dịch vụ ăn phụ | `/snack-services` | Tìm tên và lọc trạng thái API. |
| 58 | Tạo dịch vụ ăn phụ | `/snack-services` → Tạo dịch vụ | `POST /snack-services/periods`; nhập ngày, hạn đăng ký và tổng phí cả kỳ; số 0 được giữ đúng. |
| 59 | Xem chi tiết dịch vụ | `/snack-services` → Chi tiết | `GET /snack-services/:id`; hiển thị mô tả, thực đơn đã lưu và danh sách đăng ký. |
| 60 | Cập nhật dịch vụ ăn phụ | `/snack-services` → Chỉnh sửa | `PUT /snack-services/:id`; mô tả/cấu hình/thực đơn lưu bền vững theo kỳ trong `system_configs`; không mất khi khởi động lại backend. |
| 63 | Lịch sử thanh toán/nhắc phí | `/payments` | `GET /payments/invoices`, `POST /payments/invoices/:id/remind`; lịch sử từ đăng ký/giao dịch, nhắc phí tạo thông báo ứng dụng thực tế. |
| 64 | Xem danh sách đăng ký ăn phụ | `/snack-roster` | `GET /snack-roster`; danh sách lấy từ dữ liệu đăng ký. |
| 65 | Lọc danh sách ăn phụ | `/snack-roster` | Ngày, lớp, khối, thanh toán, từ khóa và phân trang. |
| 66 | Đăng ký/lập kế hoạch suất ăn | `/meal-portions` | Giữ tab tổng hợp/chốt lớp; bổ sung tab nhập số suất chuẩn bị: `GET/PUT /meal-portions`, lớp + ngày + bữa + số suất cụ thể. |
| 76 | Quản lý/lọc mẫu lưu 24h | `/food-samples` | `GET /inspections/samples`, `/:id`; giữ lọc ngày/trạng thái/từ khóa, chi tiết, tạo mẫu theo dữ liệu nhập. |
| 77 | Cảnh báo hủy mẫu/xuất báo cáo | `/food-samples` | Cảnh báo mẫu đủ 24h, CSV; bổ sung quyền hiệu trưởng ở cả nút và API hủy mẫu. Backend vẫn chặn hủy trước hạn. |
| 81 | Xem thể chất học sinh | `/growth` | `GET /growth`, `/growth/child/:childId`; hiệu trưởng xem lịch sử và biểu đồ, không thêm quyền nhập/sửa ngoài danh sách này. |
| 82 | Lọc dữ liệu thể chất | `/growth` | Tên/mã, lớp và phân loại thể trạng. |
| 85 | Thông báo phát triển | `/growth-notifications` | `/growth-notifications`, `/scan-dispatch`; vai trò lấy từ người đăng nhập, thông báo xuất phát từ phép đo lưu thực tế. |
| 86 | Xuất báo cáo phát triển | `/growth` → Xuất báo cáo | `GET /growth/export` và CSV; không điền cân nặng/chiều cao giả. |
| 89 | Xem đánh giá phụ huynh | `/services` | `GET /parent-evaluations`; giữ danh sách, nội dung và người phản hồi. |
| 90 | Lọc đánh giá phụ huynh | `/services` | Từ khóa, trạng thái, sao, bữa ăn, lớp và phân trang. |
| 91 | Phản hồi đánh giá | `/services` | `POST/PUT /parent-evaluations/:id/respond`; lưu phản hồi/người thực hiện; tùy chọn thông báo tạo bản ghi cho phụ huynh liên kết. |
| 92 | Dashboard | `/dashboard` | `/dashboard/nutrition-physical/school-manager`; tổng hợp số học sinh/cân đo thật; bỏ bộ chuyển vai trò và biểu mẫu ngân sách/tư vấn có dữ liệu viết sẵn. |
| 93 | Tổng hợp cảnh báo trẻ | `/child-alerts` | Chỉ gọi `/child-alerts/school-manager`; không gọi API giáo viên/phụ huynh. Bổ sung xung đột dị ứng từ dữ liệu thực đơn đã công bố và khai báo thực tế. |
| 94 | Báo cáo vận hành bữa ăn | `/meal-operations-report` | `/meal-operations/report`; giữ chọn ngày, số suất, kiểm thực, tiêu thụ và xuất CSV/in. Bỏ biểu mẫu ký tên/đánh giá cảm quan điền sẵn. |
| 95 | Báo cáo an toàn thực phẩm | `/food-safety` | `/food-safety/compliance-report`, `/export-compliance-dossier`; theo ngày, bằng chứng và mẫu thật; xuất JSON. Thiếu dữ liệu không suy ra tuân thủ an toàn. |
| 96 | Báo cáo doanh thu ăn phụ | `/snack-revenue-report` | `/snack-revenue/report`, `/export-financial-report`; theo tháng, khối lớp, đăng ký và giao dịch. Không tự tính cơ cấu chi phí 70/20/10 khi không có sổ chi phí. |
| 97 | Báo cáo đánh giá phụ huynh | `/parent-evaluation-report` | `/parent-evaluations/summary-report`, `/summary-report/export`; lọc tháng, thống kê và xuất dữ liệu thật. |

## Phần tài khoản chung

Đối chiếu theo 7 luồng đang có trong mã nguồn: đăng nhập, đăng xuất, quên mật khẩu, đặt lại mật khẩu, đổi mật khẩu, xem hồ sơ và sửa hồ sơ. Danh sách STT gốc của 7 chức năng chung chưa được cung cấp nên cách nhóm này cần được phân biệt với khẳng định 58 chức năng theo tài liệu gốc.

- Sửa đổi mật khẩu gọi đúng `/auth/change-password`, không gọi endpoint `/users/change-password` không tồn tại.
- Cho hiệu trưởng cập nhật hồ sơ cá nhân; cập nhật ảnh gửi đúng trường backend, không dùng thông tin trường giả khi API lỗi.
- Bỏ nút điền tài khoản/mật khẩu demo trên trang đăng nhập và giao diện 2FA gọi các endpoint chưa có. Bỏ mã OTP bỏ qua xác thực trong tiện ích 2FA.
- Không gửi OTP/email thật, đổi mật khẩu tài khoản thật, gửi nhắc phí hoặc công bố thực đơn trong kiểm tra triển khai.

## Phạm vi giữ lại và giới hạn

- Giữ trang duyệt kiểm thực do người dùng yêu cầu riêng ở các lượt trước, dù không nằm trong danh sách 51 chức năng này.
- Gỡ các trang dư đã được thay thế, API ăn phụ trùng không được đăng ký vào module và dữ liệu giả trong các trang này. Không xóa dữ liệu đang có trong DB; fixture kiểm thử và dữ liệu tham chiếu/ký hiệu trạng thái không phải dữ liệu nghiệp vụ giả.
- Xuất thực đơn hỗ trợ CSV dùng được trong Excel và bản xem trước để In / Lưu PDF của trình duyệt. Chưa có bộ sinh PDF server riêng; endpoint PDF không trả đường dẫn file giả.
- Chưa cấu hình tích hợp CSDL ngành giáo dục, nguồn đồng bộ RDA và SMTP trong Docker test. Các phần này không báo thành công giả. Thông báo nhắc phí/phản hồi lưu trong ứng dụng, không giả lập đã gửi SMS.
- Việc có dữ liệu trong cơ sở dữ liệu hiện tại không được coi là bằng chứng đó là dữ liệu sản xuất. Không tự xóa các bản ghi có sẵn hoặc coi chúng là dữ liệu do đợt rà soát này tạo.

## Bằng chứng kiểm tra

- 88 kiểm thử backend đạt, gồm luồng cấu hình lưu qua phiên service mới, phí 0, tính theo tháng được chọn, CSV thật/chống công thức, hồ sơ, đa vai trò nhân viên, phụ huynh, nhật ký, kiểm thực, chọn đúng phiên bản cũ và Rule Engine.
- Kiểm thử trình duyệt với fixture riêng: tạo/sửa dịch vụ đúng ID; lỗi lưu giữ bản nháp; phí 0; nhập suất theo lớp/ngày; quyền hủy mẫu của hiệu trưởng.
- Kiểm tra điều hướng frontend: không có đường dẫn hỏng, import thiếu hoặc trang không được tham chiếu sau khi dọn các màn hình dư.
- 22 kiểm thử dữ liệu frontend đạt; các kiểm thử trình duyệt riêng cho hiệu trưởng, lịch sử phiên bản, dinh dưỡng và luồng công bố thực đơn đều đạt.
- Docker đã build và cập nhật cả frontend/backend. Tài khoản hiệu trưởng thật: 32 API đọc trả HTTP 200; 24 màn hình trên máy tính không có lỗi JavaScript/API hoặc tràn ngang. Tải thực đơn trả `text/csv`, nội dung chứa tên thực đơn đã chọn, không phải JSON chứa đường dẫn giả. Kiểm tra điều hướng có 122 liên kết, không có import thiếu/trang dư/đường dẫn hỏng.
