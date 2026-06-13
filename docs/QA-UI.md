# Tempo V2 — Báo cáo QA UI Mobile

**URL test:** http://192.168.1.124:3000
**Ngày:** 13/06/2026
**Thiết bị mục tiêu:** iPhone 12 Pro (390×844)
**Viewport thực tế khi test:** ~500px (Chrome chặn min window width ~500px; không emulate được đúng 390px). Lưu ý: hầu hết lỗi layout/truncation/overflow sẽ **nặng hơn** ở 390px, nên các phát hiện dưới đây là mức tối thiểu.
**Trang đã duyệt:** Home, DReps list, Governance Actions list, GA detail (vote), DApp Ranking, DRep Register.
**Console:** Sạch, không có lỗi runtime (chỉ có log React DevTools).

---

## Todos — Thứ tự ưu tiên

### 🔴 CRITICAL

- [ ] **#1** — Modal "Connect Wallet" không có nền/backdrop đặc — panel modal trong suốt, nội dung trang lộ xuyên qua, chữ chồng chữ không đọc được. Thêm backdrop opaque/blur + nền đặc cho panel modal; đảm bảo z-index cao hơn toàn bộ nội dung.
- [ ] **#2** — Mở Connect Wallet không đóng menu mobile — menu hamburger + modal ví cùng hiển thị, chồng chéo 2 lớp. Đóng menu mobile khi mở bất kỳ modal nào (hoặc khi điều hướng).

### 🟠 HIGH

- [ ] **#3** — Trộn lẫn tiếng Anh – tiếng Việt khắp nơi — Home: "Become a DRep" (EN) cạnh "Tìm DRep phù hợp" (VI); GA detail: "Khoản rút" (VI) cạnh "Stake Address", "Anchor", "Guardrails Script Hash" (EN); Footer: "Join our community" (EN). Thống nhất 1 ngôn ngữ hoặc làm i18n toàn diện.
- [ ] **#4** — Menu mobile: chữ xám mờ trên nền đen → contrast thấp + không có overlay làm tối nền. Tăng contrast text menu; thêm overlay nền mờ/đặc khi menu mở.
- [ ] **#5** — Trang vote (GA detail): 2 cột YES/NO quá chật ở mobile, tên DRep bị cắt cụt, inner scroll trapping. Ở mobile stack 1 cột + tab lọc Yes / No / Abstain; bỏ inner-scroll hoặc dùng "xem thêm".
- [ ] **#6** — DApp Ranking: cột TVL bị cắt cụt ("$25.08B" → "$25.08l"). Cho bảng cuộn ngang có chỉ báo, hoặc đổi layout card ở mobile.
- [ ] **#7** — DApp Ranking: biểu đồ TVL trống (chỉ thấy lưới, không có đường/cột dữ liệu). Kiểm tra data series + màu line/area trên nền dark.

### 🟡 MEDIUM

- [ ] **#8** — Banner khuyến mãi trên cùng không tắt được, chiếm ~110px chiều cao trên mobile, không có nút đóng, lại là tiếng Anh. Thêm nút dismiss (lưu trạng thái), cân nhắc giảm chiều cao.
- [ ] **#9** — DReps list: placeholder ô tìm kiếm bị cắt ("...creder"); tab "Whale Delegators >1M ₳ / Voting Power" tràn ngang, "Voting Power" bị cắt. Rút gọn placeholder cho mobile; cho tab cuộn ngang có chỉ báo.
- [ ] **#10** — Governance Actions list: filter "Loại GA" tràn ngang, chip "No Confidence" bị cắt; card "Đề xuất" 2 cột khiến mô tả dồn cột hẹp. Ở mobile stack dọc: mô tả full-width rồi nút bên dưới.
- [ ] **#11** — Home: card "Become a DRep" căn giữa, card "Delegate To DRep" căn trái — thiếu nhất quán thị giác. Thống nhất 1 kiểu căn lề.
- [ ] **#12** — GA detail: chính sách truncate hash không nhất quán — một số full 64 ký tự wrap 2 dòng, số khác truncate. Thống nhất truncate (đầu…cuối) + nút copy cho mọi hash/address.
- [ ] **#13** — GA detail: breadcrumb hiển thị "Governance Action" generic trước khi load tên đề xuất thật. Dùng skeleton cho breadcrumb.

### 🟢 LOW / Polish

- [ ] **#14** — Next.js dev indicator ("N" tròn góc dưới-trái) che button "Khám phá DReps" và các element khác. Xác nhận không có widget cố định nào che element tương tự ở production.
- [ ] **#15** — Header sticky cần nền đặc hoàn toàn khi cuộn — đảm bảo header có nền đặc/blur rõ để không bị nội dung "đè".
- [ ] **#16** — Ký hiệu ₳ dính sát số: "26.91M₳", "5.8B₳". Thêm spacing trước ₳ và kiểm tra hiển thị glyph.
- [ ] **#17** — Register page: empty state không có nút Connect Wallet inline — người dùng phải tự lên header. Thêm nút CTA inline.

---

## ✅ Điểm tốt đã ghi nhận
- Console sạch, không lỗi runtime.
- Không có tràn ngang ở cấp trang (body) — `scrollWidth == clientWidth` trên các trang đã test.
- Có loading skeleton cho list/table và GA detail.
- Empty state trang Register gọn gàng, có hướng dẫn.
- DReps list (rank/avatar/name/delegators) hiển thị sạch, dễ đọc.
- Modal ví có badge CIP-95 và link "Install" cho ví chưa cài — UX tốt về mặt nội dung.
