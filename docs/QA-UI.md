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

- [x] **#1** — Modal "Connect Wallet" không có nền/backdrop đặc — portal + z-index 9999 + hardcode bg. ✅
- [x] **#2** — Mở Connect Wallet không đóng menu mobile — `setMobileOpen(false)` trong openModal. ✅

### 🟠 HIGH

- [x] **#3** — Trộn lẫn tiếng Anh – tiếng Việt — dịch Home, Footer, banner, "Stake Address", "Deposit", "Anchor". ✅
- [x] **#4** — Menu mobile: contrast + overlay — `bg-black/60` backdrop, `bg-bg-card` solid, text-primary. ✅
- [x] **#5** — Vote page 2 cột quá chật mobile — mobile filter tabs YES/NO/ABSTAIN + 1 cột. ✅
- [x] **#6** — DApp Ranking TVL bị cắt — ẩn cột 1d%/7d% trên mobile, Vol/Fees/Revenue trên md-; bỏ min-w lớn khi chỉ còn 5 cột. ✅
- [x] **#7** — DApp Ranking biểu đồ TVL path bị co cụm — `ResponsiveContainer height={192}` cố định thay vì `"100%"`. ✅

### 🟡 MEDIUM

- [x] **#8** — Banner không tắt được — dismiss button + localStorage `tempo:banner-dismissed-v1`. ✅
- [x] **#9** — DReps list placeholder cắt + tab tràn — placeholder rút gọn, "Whales >1M ₳". ✅
- [x] **#10** — GA list filter tràn + card chật — `min-w-0` cho filter, `flex-col sm:flex-row` cho card. ✅
- [x] **#11** — Home card căn lề không nhất quán — thêm `text-center` cho card Delegate. ✅
- [x] **#12** — GA detail hash truncate không nhất quán — `slice(0,12)…slice(-8)` + copy button. ✅
- [x] **#13** — GA detail breadcrumb generic — skeleton `animate-pulse` khi loading. ✅

### 🟢 LOW / Polish

- [ ] **#14** — Next.js dev indicator che content — chỉ xuất hiện ở dev, không ảnh hưởng production.
- [ ] **#15** — Header sticky nền cần solid khi cuộn — nav đã có `bg-bg-primary/80 backdrop-blur-xl`.
- [x] **#16** — ₳ dính sát số — thêm space trước ₳ trong VoteHistoryTab. ✅
- [x] **#17** — Register page thiếu nút Connect inline — thêm `<button onClick={openWalletModal}>`. ✅

---

## 🔄 Re-test lần 2 (2026-06-13)

### 🆕 Lỗi phát sinh từ fix trước

- [x] **N1** — Tab "Whales >1M ₳>1M ₳" bị lặp ngưỡng — xóa badge `>1M ₳` thừa (đã có trong label). ✅
- [x] **N2** — Tab "VP Changeepoch Δ" thiếu dấu cách — merge thành label `"VP Change / epoch Δ"`. ✅

---

## ✅ Điểm tốt đã ghi nhận
- Console sạch, không lỗi runtime.
- Không có tràn ngang ở cấp trang (body) — `scrollWidth == clientWidth` trên các trang đã test.
- Có loading skeleton cho list/table và GA detail.
- Empty state trang Register gọn gàng, có hướng dẫn.
- DReps list (rank/avatar/name/delegators) hiển thị sạch, dễ đọc.
- Modal ví có badge CIP-95 và link "Install" cho ví chưa cài — UX tốt về mặt nội dung.
