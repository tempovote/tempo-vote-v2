# Current Task

*Cập nhật cuối: 2026-06-06*

## Task: Optimize AI context system

**Branch:** `docs/ai-context-system`

**Mục tiêu:** Giảm token cost khi bắt đầu session mới — từ 4 files (~4000 tokens) xuống 2 files (~1000 tokens).

**Thay đổi:**
- Tạo `AGENT_CONTEXT.md` — file entry duy nhất, thay thế 3 files cũ
- Xóa `CLAUDE_START_HERE.md`, `AI_CONTEXT.md`, `REPOSITORY_MAP.md`, `ADR/README.md`, `SESSION_SUMMARY_TEMPLATE.md`
- Trim `CURRENT_STATUS.md` — bỏ 50-line checkbox "Đã hoàn thành", giữ pending + debt

**Kết quả mong muốn:** Đọc `AGENT_CONTEXT.md` + `CURRENT_TASK.md` là đủ cho 90% tasks.

---

## Bước tiếp theo (sau merge)

**Next feature task — chọn 1:**
1. **Active Voting Power**: implement Kupo UTxO query cho `stakeKeyBalance` trong `DRepRoutes.kt`
2. **Delegation UI**: nối flow `buildDelegation()` vào FE, tạo DelegateModal trên DRep profile
3. **Auth enforcement**: quyết định scope rồi add JWT middleware cho community/poll endpoints
