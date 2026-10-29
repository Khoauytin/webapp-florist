# Bản 2: quản lý đơn theo lịch và catalog cho khách

Trạng thái: **đã duyệt và đã xây** (27/10/2026). Các điểm làm khác hoặc làm thêm so với đặc tả: xem mục "Ghi chú khi xây" ở cuối. Nhánh `v2-personal`. Bản cũ (tồn kho, nhân viên) lưu ở tag `milestone-1-v1`.
Mockup: [ui-mockups-v2/admin.html](ui-mockups-v2/admin.html) (trang quản trị) và [ui-mockups-v2/catalog.html](ui-mockups-v2/catalog.html) (trang khách).

## 1. Mục tiêu

Một web app cho riêng chủ shop, gồm hai mặt:

| Mặt | Đường dẫn | Ai dùng |
|---|---|---|
| Trang khách | `/` | Khách xem mẫu, giá, rồi liên hệ đặt qua Facebook, Zalo, TikTok hoặc gọi điện |
| Trang quản trị | `/admin` (đăng nhập tại `/admin/login`) | Chỉ chủ shop |

Shop làm hoa theo đơn, không làm sẵn, nên **không có tồn kho**. Một đơn là một việc cần làm, nằm trên lịch theo ngày giao.

## 2. Trang khách

- Giữ giao diện catalog hiện tại (ảnh hero, tab danh mục, lưới ảnh 3:4, bảng chi tiết trượt từ dưới lên). Dữ liệu lấy từ database thay vì viết cứng trong HTML.
- Có ô tìm kiếm theo tên mẫu.
- Mỗi mẫu hiện tên, mã mẫu, giá, nhiều ảnh, kích thước, màu sắc, mô tả. Mẫu chưa có giá hiện "Liên hệ báo giá". Mẫu có biến thể cho khách chọn card tên tự do (ví dụ Size S, 3 gấu) với giá riêng; card đầu tiên được chọn mặc định và là giá hiện trên lưới.
- Mẫu hoặc danh mục đang tắt "Hiện trên web" thì không xuất hiện.
- **Đặt mẫu:** trong chi tiết mẫu có nút "Đặt mẫu này", mở bảng chọn kênh:
  - Facebook (Messenger), Zalo, TikTok: trang tự sao chép sẵn tin nhắn, ví dụ "Mình muốn đặt mẫu BO-012 · Hoa bó hồng pastel (350.000đ)", rồi mở kênh chat. Khách chỉ cần dán và gửi. Lý do: các kênh này không cho điền sẵn nội dung tin nhắn qua đường link.
  - Gọi điện: gọi thẳng số của shop.
- Thanh liên hệ cố định ở cuối màn hình: Gọi, Zalo, Facebook, TikTok.
- Không có giỏ hàng, form đặt hàng hay thanh toán online.
- Mỗi mẫu có đường dẫn riêng để shop gửi link một mẫu cho khách.

## 3. Trang quản trị

Giao diện theo màu và bố cục của hai ảnh mẫu: nền lavender nhạt, thẻ trắng bo tròn, bốn thẻ tổng quan màu pastel, chip đen, nút "+" đen ở giữa thanh điều hướng dưới, lịch tháng có chấm màu dưới ngày có đơn. Ưu tiên điện thoại; trên máy tính thanh dưới chuyển thành thanh bên.

Thanh điều hướng dưới: **Tổng quan · Lịch · (+) Tạo đơn · Sản phẩm · Khách hàng**.

| Màn hình | Nội dung |
|---|---|
| Tổng quan | Hàng trên cùng hiển thị tên shop và mở màn hình **Thông tin shop**, cùng chuông (số đơn hôm nay). Bốn thẻ: **Hôm nay**, **Tuần này**, **Cần làm** (số đơn Mới), **Tiền cần thu** (còn lại của đơn Mới). Danh sách đơn sắp tới, lọc bằng chip theo trạng thái; mỗi thẻ đơn có menu Sửa, Hủy, Xóa. |
| Hôm nay | Các đơn có ngày giao hôm nay, xếp theo giờ. Không có đơn thì ghi "Hôm nay không có đơn". |
| Lịch | Xem theo tháng hoặc tuần, chọn tháng và năm. Mỗi ngày có chấm màu theo trạng thái các đơn. Bấm một ngày thì hiện danh sách đơn của ngày đó ngay dưới lịch. Có khối **Tổng hợp cần làm** của khoảng đang xem. |
| Chi tiết đơn | Mở khi bấm vào một đơn ở bất cứ đâu. Hiện: mã đơn, trạng thái, giờ tạo, hạn giao, khách (tên, số điện thoại, địa chỉ), người nhận, hình thức nhận, người giao, các sản phẩm (ảnh, tên, số lượng, đơn giá, ghi chú từng dòng), lời chúc, ghi chú, tổng tiền, đã cọc, còn lại. Nút chuyển trạng thái, Sửa, Hủy, Xóa. |
| Tạo / sửa đơn | Tìm khách theo số điện thoại (khách mới tự tạo), lọc mẫu theo danh mục, tìm theo tên hoặc mã, chọn mẫu trong lưới ảnh dọc 3:4, chọn biến thể và chỉnh số lượng. Mẫu có biến thể mặc định chọn card đầu tiên; các biến thể khác tạo dòng riêng. Mẫu "Liên hệ báo giá" vẫn chọn được và phải nhập đơn giá đã báo khách. Có ngày giao (bắt buộc), giờ giao, hình thức nhận, địa chỉ, người nhận, người giao, phí ship, giảm giá, đã cọc, lời chúc, ghi chú. Thanh tổng tiền cố định ở cuối. |
| Sản phẩm | Lưới 2 cột có ảnh dọc 3:4 giống trang khách, lọc theo danh mục, tìm kiếm, công tắc "Hiện trên web". Chế độ **Sửa nhanh**: bảng sửa tên, giá và công tắc hiện trên web ngay trên từng dòng; sản phẩm có biến thể chỉ hiện số biến thể và không cho sửa giá chính. |
| Thêm / sửa sản phẩm | Tên, danh mục, giá (để trống là "Liên hệ báo giá"), hoặc các card biến thể tên tự do và giá riêng; có thể thêm, xóa, đổi thứ tự card. Khi có biến thể thì ẩn và không dùng giá chính, card đầu tiên là mặc định. Các trường còn lại: kích thước, màu sắc, mô tả, ảnh (nhiều ảnh, chọn ảnh chính), hiện trên web, lưu trữ và xóa vĩnh viễn. **Không có ô nhập mã**: mã tự sinh khi lưu. |
| Danh mục | Tên, tiền tố mã, thứ tự hiển thị, hiện trên web và xóa danh mục trống. Mở từ màn hình Sản phẩm. |
| Khách hàng | Danh sách, tìm theo tên hoặc số điện thoại. Chi tiết khách: thông tin, số đơn, tổng tiền đơn hoàn thành, danh sách đơn. |
| Thông tin shop | Các chỉ số toàn hệ thống gồm **Tổng doanh thu** của đơn Hoàn thành, **Tổng công việc**, **Tỷ lệ hủy đơn**, và **Top 5 sản phẩm bán chạy** có thể xếp theo số lượng hoặc doanh thu. Bên dưới là tên shop, số điện thoại, link Facebook, Messenger, Zalo, TikTok dùng cho trang khách. Sửa được trên giao diện, không cần sửa code. Mở từ ảnh đại diện. |
| Đăng nhập, đổi mật khẩu | Như bản cũ. |

## 4. Quy tắc nghiệp vụ

### Trạng thái đơn
`Mới` → `Đang giao` → `Hoàn thành`, cùng trạng thái phụ `Hủy`.
- Tạo đơn thì đơn ở trạng thái Mới.
- Mỗi đơn có nút chuyển sang bước kế tiếp, và nút "Quay lại bước trước" để sửa khi bấm nhầm.
- Hủy được từ Mới hoặc Đang giao, cần xác nhận. Đơn đã hủy có thể khôi phục về Mới.
- Xóa hẳn chỉ áp dụng cho đơn Mới hoặc Hủy (đơn nhập nhầm), cần xác nhận.

### Ngày
- Đơn nằm trên lịch theo **ngày giao** (deadline). Ngày giao bắt buộc khi tạo đơn; giờ giao không bắt buộc.
- Mọi ngày tính theo giờ Việt Nam. Tuần tính từ Thứ Hai đến Chủ Nhật.

### Tiền
- Tổng tiền = Σ(đơn giá × số lượng) − giảm giá + phí ship.
- **Đã cọc** là một số tiền, sửa được bất cứ lúc nào. Khách trả nốt thì sửa đã cọc bằng tổng tiền.
- Còn lại = tổng tiền − đã cọc. Đã cọc không được lớn hơn tổng tiền.
- Mỗi dòng đơn lưu tên sản phẩm, tên biến thể (nếu có) và giá **tại thời điểm đặt**. Sửa hoặc xóa biến thể, hay sửa giá sản phẩm sau đó, không làm đổi đơn cũ.
- Tổng doanh thu toàn hệ thống = tổng tiền của các đơn Hoàn thành. Tổng công việc = số lượng mọi đơn đang lưu trong hệ thống, gồm cả đơn Hủy.
- Tỷ lệ hủy đơn = số đơn Hủy / tổng số đơn đang lưu; khi chưa có đơn thì bằng 0%.
- Top 5 sản phẩm bán chạy chỉ tính các dòng sản phẩm của đơn Hoàn thành. Có thể xếp theo tổng số lượng hoặc doanh thu sản phẩm (`số lượng × đơn giá tại thời điểm đặt`).

### Tổng hợp cần làm
- Chỉ tính **đơn Mới**. Đơn Đang giao, Hoàn thành và Hủy không nằm trong số đơn cần làm và không nằm trong tổng tiền.
- Tính theo khoảng đang xem trên lịch (ngày, tuần hoặc tháng): số đơn, tổng tiền, đã cọc, còn lại, và **số lượng cần làm theo từng mẫu** (ví dụ: 12 Hoa bó hồng pastel, 3 Hoa giỏ hướng dương).

### Thẻ tổng quan
- Hôm nay: số đơn có ngày giao hôm nay, trừ đơn Hủy.
- Tuần này: số đơn có ngày giao trong tuần hiện tại, trừ đơn Hủy.
- Cần làm: số đơn Mới (mọi ngày).
- Tiền cần thu: tổng còn lại của các đơn Mới.

### Mã sản phẩm
- Tự sinh khi tạo sản phẩm: tiền tố của danh mục + số thứ tự 3 chữ số, ví dụ BO-055.
- Số thứ tự = mã lớn nhất hiện có của tiền tố đó + 1. Mã là duy nhất và không đổi, kể cả khi chuyển sản phẩm sang danh mục khác.
- Danh mục mới được đề xuất sẵn tiền tố từ tên (ví dụ "Hoa cưới" → HC), chủ shop sửa được trước khi lưu.
- 68 sản phẩm đã nhập giữ nguyên mã (BO-001, HOP-001, GIO-001, LD-001...).

### Xóa sản phẩm và danh mục
- Tắt "Hiện trên web" chỉ ẩn sản phẩm khỏi trang khách; sản phẩm vẫn dùng được khi tạo đơn.
- Lưu trữ sản phẩm làm sản phẩm biến khỏi trang khách, trang quản trị và danh sách chọn khi tạo đơn, nhưng vẫn giữ liên kết với đơn cũ.
- Chỉ xóa vĩnh viễn sản phẩm chưa từng xuất hiện trong đơn hàng. Khi xóa, toàn bộ ảnh của sản phẩm cũng bị xóa.
- Chỉ xóa được danh mục không còn sản phẩm, kể cả sản phẩm đã lưu trữ. Không xóa dây chuyền sản phẩm trong danh mục.

### Khách hàng
- Số điện thoại là duy nhất và được chuẩn hóa (+84, 84, 0 đều về dạng 0xxxxxxxxx).
- Tạo đơn với số điện thoại mới thì tự tạo khách.
- Tổng tiền đã mua chỉ tính đơn Hoàn thành.

## 5. Dữ liệu

| Bảng | Nội dung |
|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth, một tài khoản chủ shop. Bỏ vai trò và các cột khóa tài khoản. |
| `shop_settings` | Một dòng: tên shop, số điện thoại, link Facebook, Messenger, Zalo, TikTok. |
| `categories` | Tên, tiền tố mã, thứ tự, hiện trên web. |
| `products` | Mã (tự sinh, duy nhất), tên, danh mục, giá (cho phép trống), kích thước, màu sắc, mô tả, hiện trên web, lưu trữ. |
| `product_images` | Như bản cũ. |
| `product_variants` | Card biến thể của sản phẩm: tên tự do, giá, thứ tự. Card đầu tiên theo thứ tự là mặc định. |
| `customers` | Tên, số điện thoại (duy nhất), địa chỉ, ghi chú. |
| `orders` | Mã đơn tự sinh (DH-yymmdd-NNN), khách, người nhận, số điện thoại người nhận, kênh đặt (Facebook, Zalo, TikTok, Điện thoại, Tại tiệm), hình thức nhận, địa chỉ, **ngày giao (bắt buộc)**, giờ giao từ và đến, người giao, phí ship, giảm giá, tạm tính, tổng tiền, **đã cọc**, lời chúc, ghi chú, trạng thái, thời điểm giao, hoàn thành, hủy. |
| `order_items` | Sản phẩm, biến thể được chọn (cho phép trống nếu card bị xóa), mã, tên sản phẩm, tên biến thể và đơn giá lúc đặt, số lượng, ghi chú dòng. |
| `order_counters` | Như bản cũ, để sinh mã đơn không trùng. |

**Bỏ:** `inventory_movements`, `payments`, `audit_logs`, các cột tồn kho (đang có, đã giữ), phương thức đáp ứng, giá vốn, các cột phân bổ và số đã làm trên dòng đơn, dòng tự do.

Ràng buộc ở database: tiền không âm, giảm giá ≤ tạm tính, tổng tiền đúng công thức, đã cọc ≤ tổng tiền, số lượng > 0, mã sản phẩm và số điện thoại khách duy nhất. RLS bật như bản cũ.

## 6. Công nghệ

Giữ: Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL, Better Auth (đăng nhập bằng tên đăng nhập), Zod, sharp, Vitest, Docker cho Postgres ở máy.
Bỏ: ExcelJS, plugin admin của Better Auth, phân quyền.
Database làm lại bằng migration mới, sau đó nhập lại 68 sản phẩm và ảnh. Dữ liệu thử của bản cũ bị xóa.

Code dùng lại từ bản cũ: đăng nhập, xử lý ngày giờ, định dạng tiền, chuẩn hóa số điện thoại, sinh mã đơn, lưu và xử lý ảnh, script nhập catalog, khách hàng. Phần viết lại: schema, đơn hàng, lịch, tổng quan, sản phẩm, trang khách, toàn bộ giao diện quản trị.

## 7. Tiêu chí hoàn thành

1. Khách mở `/` thấy các mẫu đang bật hiện trên web, lọc theo danh mục, tìm theo tên, xem giá và nhiều ảnh.
2. Bấm "Đặt mẫu này" rồi chọn Facebook, Zalo hoặc TikTok thì tin nhắn chứa mã, tên và giá mẫu được sao chép và kênh chat được mở; chọn Gọi điện thì gọi thẳng số shop.
3. Chủ shop sửa link liên hệ trong Thông tin shop và trang khách đổi theo.
4. Tạo sản phẩm không cần nhập mã; mã sinh đúng theo tiền tố danh mục và không trùng.
5. Tắt "Hiện trên web" thì mẫu biến khỏi trang khách nhưng vẫn chọn được khi tạo đơn; mẫu chưa có giá vẫn chọn được sau khi chủ shop nhập đơn giá báo khách.
6. Tạo đơn có ngày giao thì đơn hiện đúng ngày trên lịch, có chấm màu theo trạng thái.
7. Bấm vào đơn ở lịch, tổng quan hoặc hôm nay đều mở được chi tiết đầy đủ, gồm tổng tiền, đã cọc, còn lại.
8. Khối tổng hợp chỉ tính đơn Mới, đúng theo khoảng đang xem, có số lượng cần làm theo từng mẫu.
9. Màn hình Hôm nay liệt kê đúng đơn của hôm nay, hoặc hiện "Hôm nay không có đơn".
10. Đổi giá sản phẩm không làm đổi tiền của đơn cũ.
11. Giao diện dùng tốt ở màn hình điện thoại 375px, không tràn ngang.
12. Chủ shop tạo được nhiều card biến thể có tên và giá riêng; trang khách và form đơn mặc định card đầu tiên, còn đơn cũ giữ nguyên snapshot khi card bị sửa hoặc xóa.

## 8. Ngoài phạm vi

Thanh toán online, form hoặc giỏ đặt hàng cho khách, nhắc việc qua thông báo, xuất Excel, nhiều người dùng, tồn kho. PWA (cài lên màn hình điện thoại) làm ở bước sau.

## 9. Điểm cần duyệt

| # | Điểm | Đề xuất |
|---|---|---|
| 1 | Hình dạng: ảnh mẫu dùng thẻ bo tròn và nút, chip dạng viên thuốc. | Theo đúng ảnh mẫu: thẻ bo 16px, nút và chip bo tròn hẳn. |
| 2 | Sửa khi bấm nhầm trạng thái. | Có nút "Quay lại bước trước"; xóa hẳn chỉ cho đơn Mới hoặc Hủy. |
| 3 | "Tiền cần thu" trên thẻ tổng quan. | Chỉ tính còn lại của đơn Mới, giống khối tổng hợp. |
| 4 | Link liên hệ của trang khách. | Sửa trong màn hình Thông tin shop. Zalo dùng dạng `zalo.me/<số điện thoại>`. |
| 5 | Đặt mẫu qua Facebook, Zalo, TikTok. | Sao chép sẵn tin nhắn rồi mở kênh chat, kèm thông báo "Đã sao chép tin nhắn, dán vào khung chat để gửi". |

## 10. Ghi chú khi xây (27/10/2026)

- **Biến thể sản phẩm:** chủ shop tự đặt tên và giá cho tối đa 20 card, đổi thứ tự bằng nút lên/xuống. Thêm card đầu tiên sao chép giá chính hiện tại để tránh mất giá; xóa hết card thì ô giá chính xuất hiện lại.
- **Mẫu chưa có giá vẫn thêm được vào đơn.** Khi chọn mẫu "Liên hệ báo giá", form yêu cầu chủ shop nhập đơn giá đã báo khách trước khi lưu; giá này được lưu vào snapshot của dòng đơn để tổng tiền và đơn cũ luôn đúng.
- **Database mới** `florist_v2` và `florist_v2_test` thay vì xóa và tạo lại database cũ; database của bản 1 vẫn còn nguyên.
- **Tìm trên trang khách** theo cả tên và mã mẫu.
- **Sửa nhanh** chỉ lưu những dòng đã đổi; nút ghi số thay đổi.
- **Link riêng cho từng mẫu** trên trang khách (`/#bo-012`); nút Back của điện thoại đóng bảng chi tiết.
- **"Còn phải thu hôm nay"** trên màn Hôm nay cũng chỉ tính đơn Mới, giống thẻ Tiền cần thu.
- **Danh sách đơn Mới ở Tổng quan** gồm cả đơn Mới đã quá ngày giao (vẫn được tính vào Cần làm), để không bị sót.
- **Nút kênh chat khi đặt mẫu** là link thật: tin nhắn được sao chép ngay khi chạm và kênh chat mở luôn, để trình duyệt điện thoại (Safari, trình duyệt trong Facebook/Zalo) không chặn.
