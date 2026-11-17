# Triển khai frontend lên Vercel

Frontend đã triển khai ngày 05/11/2026 tại https://kidmeal.vercel.app, deployment `dpl_JDRzR8uitWY75jKa2vNz41FsXdrP`. Đã xác nhận `/`, `/login` và JavaScript chính trả HTTP 200. API `/api/v1/auth/tenants` trả 404 vì chưa có URL backend public để kết nối. Đây mới là bản frontend, chưa phải bản ứng dụng đầy đủ dịch vụ.

Frontend Vite nằm trong `apps/frontend`; backend NestJS, PostgreSQL, Redis và MinIO hiện chạy riêng bằng Docker. Đưa frontend lên Vercel không tự triển khai những dịch vụ đó hay áp dụng migration vào database public.

Trước khi build bản dùng đầy đủ chức năng, cấu hình `VITE_API_BASE_URL` bằng URL HTTPS của API public, bao gồm `/api/v1`, và `VITE_WS_URL` bằng origin HTTPS của backend Socket.IO. Không dùng `localhost` hay địa chỉ container cho bản public. Các biến `VITE_` được nhúng vào JavaScript gửi cho trình duyệt; không đặt mật khẩu hoặc token bí mật trong các biến đó.

Project Vercel đã được liên kết cục bộ ở `apps/frontend/.vercel/project.json`. Lần đầu liên kết: `npx vercel link --yes --project kidmeal --cwd apps/frontend`. Bản liên kết và các file môi trường được Git bỏ qua.

Build bằng `npm --prefix apps/frontend run build`, rồi chạy `node scripts/prepare-vercel-frontend.cjs`. Script trả về thư mục artifact mới trong `.tmp/vercel`, chứa duy nhất frontend đã build và cấu hình [Build Output API](https://vercel.com/docs/build-output-api/configuration). Cách này tránh lỗi quyền tạo symlink của builder Vercel trên Windows, đồng thời không gửi source backend hoặc file môi trường lên dịch vụ.

Triển khai artifact bằng `npx vercel deploy --prebuilt --prod --yes --cwd <thư-mục-artifact>`. Cấu hình giữ tài nguyên tĩnh và fallback về `index.html` cho route SPA; `/api` và `/socket.io` không bị trả nhầm HTML. Khi có URL backend, cập nhật biến môi trường, build và triển khai lại. Cần triển khai riêng backend mới và migration `20261105-drink-recipes.sql` vào đúng database public để thay đổi món nước xuất hiện trên bản public.
