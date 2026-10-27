# Bích Ngọc Florist: catalog cho khách và sổ đơn cho chủ shop

Bản 2 là công cụ cá nhân cho một người chủ shop:

- **Trang khách** (`/`): khách xem mẫu hoa, giá, nhiều ảnh, tìm theo tên hoặc mã. Bấm "Đặt mẫu này" để sao chép tin nhắn đặt mẫu rồi mở Facebook, Zalo, TikTok, hoặc gọi điện. Không có giỏ hàng.
- **Trang quản trị** (`/admin`, đăng nhập ở `/admin/login`): đơn hàng theo lịch (ngày, tuần, tháng), màn Hôm nay, tổng hợp cần làm, sản phẩm và danh mục, khách hàng, thông tin liên hệ của shop.

Tài liệu:

- Đặc tả bản 2: [docs/v2-spec.md](docs/v2-spec.md)
- Mockup đã duyệt: [docs/ui-mockups-v2/admin.html](docs/ui-mockups-v2/admin.html), [docs/ui-mockups-v2/catalog.html](docs/ui-mockups-v2/catalog.html)
- Bản 1 (tồn kho, nhân viên, Excel) lưu ở tag `milestone-1-v1`; tài liệu cũ: [docs/milestone-1-spec.md](docs/milestone-1-spec.md)
- Catalog tĩnh cũ: [legacy/](legacy/)

## Công nghệ

Next.js 16 (App Router, server actions), React 19, TypeScript, Prisma 7 + PostgreSQL, Better Auth (đăng nhập bằng tên đăng nhập, tắt đăng ký), Zod, sharp, Vitest.

## Chạy ở máy

Yêu cầu: Node.js 22+, Docker.

```bash
npm install
cp .env.example .env          # rồi sửa BETTER_AUTH_SECRET và SEED_OWNER_PASSWORD
npm run db:up                 # Postgres trong Docker, cổng 5433 (tạo sẵn florist_v2 và florist_v2_test)
npx prisma migrate deploy     # tạo bảng, ràng buộc, RLS
npm run db:seed               # tài khoản chủ shop, 4 danh mục (BO, HOP, GIO, LD), thông tin shop
npm run db:import-catalog     # (một lần) nhập 68 sản phẩm và ảnh từ legacy/
npm run dev                   # http://localhost:3000 và http://localhost:3000/admin
```

Đăng nhập bằng `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` trong `.env`. Sản phẩm nhập từ catalog cũ chưa có giá (trang khách hiện "Liên hệ báo giá"). Khi thêm mẫu chưa có giá vào đơn, chủ shop nhập đơn giá đã báo khách ngay trên dòng sản phẩm; cũng có thể vào Sản phẩm và chọn **Sửa nhanh** để cập nhật giá catalog.

Nếu máy đã có volume Postgres từ bản 1 (database `florist`), script tạo database không chạy lại. Tạo tay hai database mới:

```bash
docker exec florist-db psql -U florist -d postgres -c "CREATE DATABASE florist_v2" -c "CREATE DATABASE florist_v2_test"
```

## Kiểm thử

```bash
npm test             # toàn bộ: logic thuần + tích hợp với Postgres thật
npm run test:unit    # chỉ logic thuần (không cần database)
npm run typecheck
npm run lint
```

Kiểm thử tích hợp chạy trên database `florist_v2_test` (`TEST_DATABASE_URL`) và xóa sạch dữ liệu của database đó mỗi lần chạy. Trước lần đầu, tạo bảng cho nó:

```bash
DIRECT_URL="postgresql://florist:florist@localhost:5433/florist_v2_test" npx prisma migrate deploy
```

## Cấu trúc

```
src/
  app/page.tsx         trang khách (dữ liệu thật) + app/catalog.css
  app/admin/(app)/     các màn quản trị: tổng quan, hôm nay, lịch, đơn, sản phẩm, danh mục, khách, cài đặt
  app/admin/login/     đăng nhập
  app/api/             auth, phục vụ ảnh khi lưu cục bộ
  proxy.ts             chuyển về /admin/login khi chưa có phiên
  server/domain/       logic thuần: tính tiền, chuyển trạng thái, mã sản phẩm, mã đơn, số điện thoại
  server/services/     nghiệp vụ, mỗi thao tác ghi là một transaction
  server/actions/      server action: kiểm đăng nhập + Zod, rồi gọi service
  components/admin/    giao diện quản trị
  components/catalog/  giao diện trang khách
  lib/                 ngày giờ (Asia/Ho_Chi_Minh), định dạng tiền, nhãn tiếng Việt
prisma/                schema, migrations (có SQL viết tay cho CHECK và RLS), seed, import
tests/                 domain/ (thuần) và integration/ (Postgres)
```

Quy tắc chính:

- Mã sản phẩm tự sinh theo tiền tố danh mục (`BO-055`), lấy số từ bảng `product_code_counters`, không bao giờ đổi.
- Mỗi dòng đơn lưu mã, tên và giá lúc đặt. Sửa đơn chỉ đổi số lượng và ghi chú của dòng cũ, không tính lại giá.
- "Cần làm", "Tiền cần thu" và Tổng hợp cần làm chỉ tính đơn **Mới**.

## Đưa lên mạng

Kiến trúc dự kiến là Vercel cho ứng dụng và Supabase cho Postgres và ảnh. Cả hai đều cần tài khoản của chủ dự án:

1. Tạo project Supabase (khu vực Singapore). Lấy chuỗi kết nối **pooler** cho `DATABASE_URL` và **direct** cho `DIRECT_URL`. Tạo bucket công khai `product-images`.
2. Chạy `npx prisma migrate deploy` với `DIRECT_URL` của Supabase, rồi `npm run db:seed`.
3. Trên Vercel, khai báo các biến trong `.env.example`, đặt `STORAGE_DRIVER=supabase`, `BETTER_AUTH_URL` là địa chỉ thật, và chọn region gần Supabase.

### Cài ứng dụng trên điện thoại (PWA)

PWA chỉ hoạt động trên HTTPS, vì vậy hãy deploy lên Vercel trước. Sau đó đăng nhập, mở **Thông tin shop** và dùng thẻ **Cài Bích Ngọc Florist**:

- Android/Chrome: bấm **Cài ứng dụng** hoặc chọn **Cài đặt ứng dụng** trong menu trình duyệt.
- iPhone/iPad: mở bằng Safari, bấm **Chia sẻ** rồi chọn **Thêm vào Màn hình chính**.

Ứng dụng mở thẳng vào `/admin`. Dữ liệu quản trị không được lưu offline; khi mất mạng ứng dụng hiển thị trang yêu cầu kết nối lại để tránh dùng dữ liệu cũ.

Lưu ý: gói Hobby của Vercel chỉ dành cho mục đích phi thương mại. Khi tiệm dùng thật cần gói trả phí, hoặc một nơi host Node.js khác.
