# Current Task

*Cập nhật cuối: 2026-06-06*

## Task: Hoàn thiện DRep Community — poll voting

**Branch:** `feature/community-polls`

**Đã làm xong:**
- `CommunityRoutes.kt`: auto-create Yes/No/Abstain khi tạo BASIC poll
- `CommunityRoutes.kt`: `GET /communities/polls/{pollId}` — poll detail với options + vote counts + userVote
- `CommunityRoutes.kt`: `POST /communities/polls/{pollId}/vote` — cast vote (validate active, no dup, option belongs)
- `community.ts` types: thêm `PollDetail`, `PollOptionWithCount`, `CastVoteRequest`
- `useCommunity.ts`: thêm `usePollDetail` hook
- `[pollId]/page.tsx`: rewrite — hiển thị poll title/abstract/status + voting UI + result bars + comments

**Còn lại (nếu muốn mở rộng):**
- `votingPower` trong `PollVotes` đang là `0L` — cần Kupo UTxO query để lấy actual voting power
- Weighted results (by votingPower) vs simple count — hiện dùng simple count

---

## Bước tiếp theo

**Next feature task — chọn 1:**
1. **Active Voting Power (Kupo)**: implement Kupo UTxO query cho `stakeKeyBalance` + `votingPower` trong polls
2. **Delegation UI**: nối flow `buildDelegation()` vào FE, tạo DelegateModal trên DRep profile
3. **Auth enforcement**: quyết định scope rồi add JWT middleware cho community/poll endpoints
