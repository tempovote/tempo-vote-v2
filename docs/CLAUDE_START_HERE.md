# CLAUDE START HERE

## Quy trình khởi động (bắt buộc)

### Bước 1 — Đọc context nền

```
docs/AI_CONTEXT.md      ← Tổng quan dự án, tech stack, ràng buộc
docs/CURRENT_STATUS.md  ← Tính năng nào xong, đang làm, còn thiếu
docs/CURRENT_TASK.md    ← Task hiện tại, files liên quan
```

### Bước 2 — Tóm tắt hiểu biết

Sau khi đọc xong 3 files trên, tóm tắt ngắn:
- Task hiện tại là gì
- Trạng thái hiện tại thế nào
- Cần làm gì tiếp

### Bước 3 — Đề xuất file cần đọc thêm

Dựa trên task, xác định những file nào CẦN đọc (không phải có thể đọc). Ví dụ:
- Sửa backend route → đọc file route cụ thể + `Tables.kt` nếu liên quan DB
- Sửa UI → đọc page/component cụ thể + hook liên quan
- Thêm TX type → đọc `TxBuilder.kt` + `TransactionRoutes.kt`

Tham chiếu `docs/REPOSITORY_MAP.md` để biết file nào nằm ở đâu.

### Bước 4 — Chỉ đọc file thực sự cần thiết

**Không** scan toàn bộ repository khi chưa cần.
**Không** đọc file để "có thêm context" nếu không trực tiếp liên quan.

---

## Nguyên tắc làm việc

### Code
- TypeScript: strict mode, không dùng `any`, Zod cho mọi API boundary
- Kotlin: coroutines async, sealed classes cho Result<T, E>
- Network: luôn truyền `network` param, không hardcode
- Không thêm feature ngoài scope task

### Git
- Không commit vào `main`
- Branch naming: `feature/[desc]`, `bug/[desc]`, `refactor/[desc]`
- Commit prefix: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`

### Cuối session
Cập nhật `docs/CURRENT_TASK.md` nếu có tiến độ mới.
Dùng `docs/SESSION_SUMMARY_TEMPLATE.md` nếu cần ghi lại session.

---

## Quick Reference

| Cần làm | Đọc file nào |
|---------|-------------|
| Sửa / thêm API endpoint | `docs/REPOSITORY_MAP.md` → Backend section |
| Sửa / thêm UI page | `docs/REPOSITORY_MAP.md` → Frontend section |
| Thêm TX type mới | `TxBuilder.kt` + `TransactionRoutes.kt` |
| Thêm DB table | `db/Tables.kt` + tạo migration `V{N}__desc.sql` |
| Hiểu data flow | `docs/ARCHITECTURE.md` |
| Xem API spec | `docs/API_CONTRACTS.md` |
