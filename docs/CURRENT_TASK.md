# Current Task

*Cập nhật cuối: 2026-07-09*

## Task vừa xong: Design system @tempo/ui — hoàn tất 4/4 đợt

Merged vào main (PR #113 → #115 → #117 → #118), theo spec `docs/superpowers/specs/2026-07-08-tempo-design-system-design.md`:

- **Đợt 1**: scaffold package (source-exports) + tokens light/dark + `cn()`/format + Storybook
- **Đợt 2**: 14 primitives (shadcn-style trên Radix, restyle Tempo)
- **Đợt 3**: 11 domain components (VoteBar, GaStatusBadge, ActionIdChip, CopyButton/CopyableId, DRepAvatar, StatCell, AdaAmount, NetworkBadge, MarkdownEditor, RichMarkdownEditor, WalletConnectModal)
- **Đợt 4**: `packages/ui/README.md` + quy tắc CLAUDE.md — **UI mới bắt buộc import từ @tempo/ui**

Trước đó (cùng giai đoạn): alliance feature (PR #109), fix SPO vote bar/voting power, VoteIndexer checkpoint pre-Conway.

---

## Bước tiếp theo

**Next task — chọn 1:**

1. **Migrate apps/web sang @tempo/ui**: từng domain 1 PR riêng (so màn hình cũ–mới), sau đó gỡ dần CSS class legacy khỏi `globals.css`. Bảng mapping token: `packages/ui/README.md`.
2. **Backlog high-priority** (từ trước, chưa làm — chi tiết `CURRENT_STATUS.md`):
   - Active Voting Power (Kupo): query UTxO cho `stakeKeyBalance` + `votingPower` trong polls
   - Auth enforcement: quyết định scope rồi enforce JWT trên community/poll endpoints
   - DRep Registration e2e test thủ công trên preprod
