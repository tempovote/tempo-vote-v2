# ADR-001: AI Context System for Claude Code

**Status:** Accepted (revised 2026-06-06)
**Date:** 2026-06-06

## Context

tempo-vote-v2 là polyglot monorepo (Next.js + Kotlin/Ktor) với nhiều layers phức tạp: wallet bridge, Ogmios chain-sync, IPFS, PostgreSQL. Mỗi AI session mới bắt đầu không có context từ session trước.

## Decision

Duy trì **5 files** trong `docs/` làm AI onboarding layer:

| File | Đọc khi nào | Cập nhật khi nào |
|------|-------------|-----------------|
| `AGENT_CONTEXT.md` | Mỗi session | Thay đổi stack/arch/routes |
| `CURRENT_TASK.md` | Mỗi session | Đổi task |
| `CURRENT_STATUS.md` | Khi plan feature | Hoàn thành feature / phát hiện debt |
| `architecture.md` | Khi thay đổi data flow | Thay đổi kiến trúc |
| `API_CONTRACTS.md` | Khi sửa endpoints | Thêm/sửa endpoint |

## Reasoning

Markdown trong repo: version-controlled, đọc trực tiếp bằng Read tool, không cần external service.
Tách `CURRENT_TASK.md` riêng vì thay đổi nhiều nhất (mỗi task). Tách `CURRENT_STATUS.md` vì dài và chỉ cần đọc khi planning.

**Không dùng:**
- External wiki: không trong repo, dễ stale
- Single CLAUDE.md: sẽ quá dài và mix conventions với architecture

## Consequences

- Session start: đọc 2 files (~1000 tokens) thay vì 4 files (~4000 tokens)
- Cần discipline cập nhật `CURRENT_TASK.md` khi đổi task và `CURRENT_STATUS.md` khi ship feature
- ADR mới: chỉ tạo khi có quyết định kiến trúc thật sự quan trọng (không cần ADR cho mọi decision nhỏ)
