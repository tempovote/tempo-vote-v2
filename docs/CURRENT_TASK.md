# Current Task

*Cập nhật cuối: 2026-06-06*

---

## Task hiện tại: AI Context System

**Branch:** `docs/ai-context-system`

**Mục tiêu:** Tạo hệ thống Markdown context để Claude Code có thể nhanh chóng onboard vào dự án trong mỗi session mới, không cần scan toàn bộ codebase.

**Kết quả mong muốn:**
- Claude đọc 3-4 files là biết cần làm gì
- Không lãng phí context window vào việc khám phá codebase thừa
- Future sessions có thể pick up ngay tại điểm dừng

---

## Files liên quan

### Files đã tạo (branch này)
```
docs/CLAUDE_START_HERE.md    ← Entry point: quy trình khởi động
docs/AI_CONTEXT.md           ← Tổng quan dự án, tech stack, ràng buộc
docs/REPOSITORY_MAP.md       ← Cấu trúc thư mục, file nào dùng cho task gì
docs/ARCHITECTURE.md         ← System design, data flows (thay thế docs/architecture.md cũ)
docs/CURRENT_STATUS.md       ← Tính năng done/pending/debt
docs/CURRENT_TASK.md         ← File này
docs/API_CONTRACTS.md        ← API spec đầy đủ
docs/SESSION_SUMMARY_TEMPLATE.md ← Template cuối session
docs/ADR/README.md           ← ADR system intro
docs/ADR/ADR-001-ai-context-system.md ← Decision record
```

### Files tham chiếu (không sửa)
- `CLAUDE.md` — project-level instructions (đã có, không thay thế)
- `docs/architecture.md` — file cũ (superseded bởi ARCHITECTURE.md)
- `docs/api-contracts.md` — file cũ (superseded bởi API_CONTRACTS.md)

---

## Không nên sửa trong task này

- Source code (`.ts`, `.tsx`, `.kt`)
- Existing docs plans (`plan-*.md`)
- `CLAUDE.md` (project instructions)

---

## Bước tiếp theo sau task này

1. Merge branch `docs/ai-context-system` vào `main` qua PR
2. **Next feature task (ưu tiên cao):**
   - Implement Active Voting Power via Kupo UTxO query
   - Hoặc: Delegation TX UI trên DRep profile page
   - Hoặc: Auth enforcement cho Community/Poll endpoints

---

## Lệnh test

```bash
# Kiểm tra FE build không lỗi
cd apps/web && pnpm build

# Kiểm tra TS types
pnpm --filter @tempo/types build
```
