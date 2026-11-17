# Demo miễn phí qua Cloudflare Tunnel

Đã mở ngày 05/11/2026: https://haven-transcript-parker-starts.trycloudflare.com. Link này có thể đổi sau khi tunnel khởi động lại; luôn lấy link mới nhất từ log.

Đã build lại frontend/backend và kiểm tra qua URL public: giao diện, JavaScript, danh sách trường, đăng nhập và hồ sơ của cả 5 vai trò, danh mục món ăn từ PostgreSQL, kết nối WebSocket và sự kiện tham gia phòng bếp đều thành công. Hai test migration món nước và ba unit test luân phiên món nước cũng pass.

Bản demo dùng toàn bộ frontend, API, WebSocket, PostgreSQL, Redis và MinIO của bộ Docker `kidmeal-test` trên máy hiện tại. Cloudflare chỉ chuyển tiếp HTTPS đến frontend Nginx; Nginx chuyển `/api/` và `/socket.io/` đến backend. Không cần thuê VPS, tài khoản Cloudflare hay tên miền. Database và console MinIO không được mở thêm ra Internet.

Đây là bản demo với chức năng đăng nhập nhanh theo vai trò. Người có link có thể dùng chức năng demo và thay đổi dữ liệu trong database test hiện tại. Không dùng bản này cho dữ liệu thật hoặc vận hành chính thức. Email đang bị tắt trong cấu hình Docker test.

## Khởi chạy

Chạy từ thư mục gốc dự án, với Docker Desktop đang mở:

```powershell
npm.cmd run docker:test:up
docker compose -f compose.demo.yml up -d
docker compose -f compose.demo.yml logs --tail 60 tunnel
```

Lấy URL `https://….trycloudflare.com` trong log để mở hoặc chia sẻ. Dùng trực tiếp URL này để cả giao diện và API cùng hoạt động; bản frontend Vercel cũ chưa được kết nối với tunnel.

## Kiểm tra và dừng

```powershell
docker compose -f compose.demo.yml ps
docker compose --env-file .docker-test/test.env -f compose.test.yml ps
node scripts/verify-demo.cjs https://your-demo.trycloudflare.com
docker compose -f compose.demo.yml down
```

Thay URL mẫu bằng link thực trong log. Script kiểm tra giao diện, tài nguyên JavaScript, API trường, đăng nhập và hồ sơ cho 5 vai trò, danh mục món ăn và kết nối WebSocket. Script không tạo dữ liệu nghiệp vụ; đăng nhập có thể sinh audit log.

Lệnh cuối chỉ dừng và gỡ tunnel, giữ nguyên ứng dụng cùng dữ liệu cục bộ. Để mở demo lại, chạy `docker compose -f compose.demo.yml up -d` và lấy link mới trong log.

Máy phải bật, có Internet, Docker và tunnel phải đang chạy. Link có thể đổi mỗi lần tunnel khởi động lại. Quick Tunnel không bảo đảm uptime và chỉ dành cho thử nghiệm/demo: [tài liệu Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
