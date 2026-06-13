# Tempo V2 — QA UI Mobile — Improvement Log

Ghi lại chi tiết từng lỗi đã sửa theo thứ tự hoàn thành. Tham chiếu số thứ tự từ [QA-UI.md](QA-UI.md).

---

## #1 — Modal "Connect Wallet" không có nền/backdrop đặc
**Phát hiện:** Modal trong suốt trên mobile, nội dung trang lộ xuyên qua.
**Nguyên nhân:** WalletModal render trong Navbar fragment; `nav` có `backdrop-filter` tạo stacking context riêng, làm `position:fixed` overlay không hoạt động đúng trên mobile Chrome.
**Giải pháp:**
- Dùng `createPortal(content, document.body)` trong `WalletModal.tsx` để mount overlay trực tiếp vào `<body>`.
- Nâng `z-index` overlay từ `100` → `9999`.
- Xóa `backdrop-filter` khỏi overlay.
- Hardcode `background: #0f1424` cho modal panel.
- Thêm `max-height: calc(100dvh - 2rem); overflow-y: auto`.

---

## #2 — Mở Connect Wallet không đóng menu mobile
**Phát hiện:** Menu hamburger + modal ví cùng hiển thị, chồng 2 lớp.
**Nguyên nhân:** `openModal` callback chỉ gọi `openWalletModal()`, không đóng menu.
**Giải pháp:** Thêm `setMobileOpen(false)` vào `openModal` callback trong `Navbar.tsx`.

---

## #3 — Trộn lẫn tiếng Anh – tiếng Việt
**Phát hiện:** "Become a DRep", "Help to grow Cardano", "Join our community", "Deposit", "Anchor" trong UI VI.
**Giải pháp:**
- `HomeHeroSections.tsx`: "Become a DRep" → "Trở thành DRep", "Register as a DRep" → "Đăng ký DRep", "Delegate To DRep" → "Delegate cho DRep".
- `Footer.tsx`: "Join our community" → "Tham gia cộng đồng".
- `Navbar.tsx` banner: dịch sang VI.
- `ActionDetailCard.tsx`: "Stake Address" → "Địa chỉ Stake".
- GA detail `page.tsx`: "Deposit" → "Đặt cọc", "Anchor" → "Tài liệu đính kèm".

---

## #4 — Menu mobile: contrast thấp + không có overlay
**Phát hiện:** Chữ xám mờ trên nền tối, không có overlay khi mở menu.
**Giải pháp:**
- Thêm `<div className="md:hidden fixed inset-0 bg-black/60 z-40">` (backdrop overlay).
- Đổi nền menu từ `bg-bg-secondary/95` → `bg-bg-card` (solid).
- Đổi text link từ `text-text-secondary` → `text-text-primary`, hover → `text-accent-light`.
- Thêm `relative z-50` cho menu panel.

---

## #5 — Vote page (GA detail): 2 cột YES/NO quá chật ở mobile
**Phát hiện:** Tên DRep bị cắt cụt, inner scroll trapping.
**Giải pháp:**
- `VoteHistoryTab.tsx`: Thêm mobile filter tabs (YES / NO / ABSTAIN) chỉ trên mobile (`sm:hidden`).
- Mobile: 1 cột duy nhất `<VoteTable votes={mobileFiltered} ... hideHeader />`.
- Desktop: giữ nguyên 2 cột (`hidden sm:flex`).
- Inner scroll: `sm:overflow-y-auto sm:max-h-[500px]` (chỉ desktop).
- Thêm `hideHeader?: boolean` prop cho `VoteTable`.

---

## #6 — DApp Ranking: cột TVL bị cắt cụt
**Phát hiện (lần 1):** "$25.08B" → "$25.08l" — ký tự cuối bị clip. Fix lần 1: `min-w-[700px]`.
**Phát hiện (lần 2, re-test):** Vẫn clip. `min-w-[700px]` không giải quyết được vì bảng có quá nhiều cột so với viewport 500px.
**Nguyên nhân thực:** Table 10 cột + `w-full` → browser chia đều → cột TVL quá hẹp → nội dung bị clip.
**Giải pháp cuối:**
- Ẩn cột 1d%/7d% trên mobile (`hidden sm:table-cell`).
- Ẩn cột Vol/Fees/Revenue trên tablet- (`hidden md:table-cell`).
- Đổi min-width thành `md:min-w-[700px]` (chỉ áp dụng từ md trở lên).
- Kết quả: mobile chỉ còn 5 cột (#, logo, name, category, TVL) — TVL hiển thị đủ.

---

## #7 — DApp Ranking: biểu đồ TVL trống
**Phát hiện (lần 1):** Chỉ thấy lưới, không thấy đường dữ liệu. Fix lần 1: màu sáng hơn, empty state, w-full wrapper.
**Phát hiện (lần 2, re-test):** Path SVG có tồn tại trong DOM (stroke `#818cf8`) nhưng toạ độ co cụm vào vùng cực nhỏ (~vài px).
**Nguyên nhân thực:** `ResponsiveContainer height="100%"` phụ thuộc vào parent `h-48` div nhưng recharts đo container sai kích thước khi render trên mobile (ResizeObserver timing issue → báo height≈0 → tất cả điểm dữ liệu mapping vào top-left).
**Giải pháp cuối:** Dùng `height={192}` (số cố định) trực tiếp trên `ResponsiveContainer` thay vì `"100%"` → recharts luôn có đủ chiều cao để render đúng.

---

## #8 — Banner khuyến mãi không tắt được
**Phát hiện:** Banner không có nút đóng, chiếm ~110px mobile.
**Giải pháp:** Thêm state `bannerVisible` + check `localStorage` key `tempo:banner-dismissed-v1`. Nút × dismiss + lưu vào localStorage.

---

## #9 — DReps list: placeholder bị cắt + tab tràn ngang
**Phát hiện:** Placeholder cụt; tab "Voting Power" cắt mép phải.
**Giải pháp:**
- Placeholder: rút gọn → "Tên, drep1… hoặc 56-char hex".
- Tab: "Whale Delegators" → "Whales >1M ₳".
- Tab bar: thêm `scrollbar-none`.

---

## #10 — GA list: filter tràn + card "Đề xuất" chật
**Phát hiện:** Chip "No Confidence" bị cắt; card 2 cột quá hẹp mobile.
**Giải pháp:**
- Filter "Loại GA": thêm `min-w-0` vào flex wrapper và scrollable div.
- Card "Đề xuất": `flex-col sm:flex-row` cho mobile stack.

---

## #11 — Home: 2 card căn lề không nhất quán
**Phát hiện:** Card "Become a DRep" center, card "Delegate" trái.
**Giải pháp:** Thêm `text-center` + `mx-auto` cho card "Delegate cho DRep".

---

## #12 — GA detail: truncate hash không nhất quán
**Phát hiện:** `anchorHash` (64 ký tự) hiển thị đầy đủ, wrap 2 dòng.
**Giải pháp:** Truncate: `.slice(0, 12) + … + .slice(-8)`. Thêm copy button.

---

## #13 — GA detail: breadcrumb generic khi loading
**Phát hiện:** Breadcrumb hiện "Governance Action" trước khi load tên thật.
**Giải pháp:** Thêm skeleton `animate-pulse` khi `loading && !action`.

---

## #16 — Ký hiệu ₳ dính sát số
**Phát hiện:** `{lovelaceToAda(v.votingPower)}₳` thiếu space.
**Giải pháp:** `VoteHistoryTab.tsx`: thêm space trước ₳.

---

## #17 — Register page: thiếu nút Connect inline
**Phát hiện:** Empty state không có nút → user phải lên header.
**Giải pháp:** Thêm `openWalletModal` từ wallet store, render `<button onClick={openWalletModal}>Kết nối ví</button>` inline.

---

## N1 — Tab "Whales >1M ₳>1M ₳" bị lặp ngưỡng
**Phát hiện:** Tab thứ 2 render label "Whales >1M ₳" + badge span ">1M ₳" dính liền → "Whales >1M ₳>1M ₳".
**Nguyên nhân:** Label đã có ">1M ₳" nhưng vẫn còn `{t.id === "whales" && <span>...>1M ₳</span>}` thừa từ thiết kế gốc.
**Giải pháp:** Xóa span badge thừa, giữ nguyên label.

---

## N2 — Tab "VP Changeepoch Δ" thiếu dấu cách
**Phát hiện:** Label "VP Change" và span "epoch Δ" (có `ml-1.5`) nhưng render dính nhau.
**Nguyên nhân:** `ml-1.5` trên inline span không đủ rõ ràng; trên một số viewport/font rendering bị bỏ qua.
**Giải pháp:** Merge thành một chuỗi label duy nhất `"VP Change / epoch Δ"`, bỏ span riêng.
