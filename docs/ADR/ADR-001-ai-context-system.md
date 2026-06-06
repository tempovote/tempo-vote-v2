# ADR-001: AI Context System for Claude Code

**Status:** Accepted
**Date:** 2026-06-06

## Context

tempo-vote-v2 là polyglot monorepo (Next.js + Kotlin/Ktor) với nhiều layers phức tạp: wallet bridge, on-chain data via Ogmios, off-chain DB, IPFS integration. Mỗi session Claude Code mới bắt đầu không có context từ session trước — AI cần khám phá lại codebase từ đầu, dẫn đến lãng phí context window và thời gian.

## Problem

1. **Context loss**: Mỗi session mới, Claude phải đọc nhiều files để hiểu kiến trúc và trạng thái dự án
2. **Inconsistent onboarding**: Không có quy trình rõ ràng về việc AI nên bắt đầu từ đâu
3. **Stale knowledge**: Không có cơ chế cập nhật trạng thái dự án theo thời gian
4. **Wasteful exploration**: AI có xu hướng scan toàn bộ codebase khi không chắc, dẫn đến context window overflow

## Decision

Tạo hệ thống Markdown context files trong `docs/` làm lớp onboarding chính cho Claude Code, với:
- `CLAUDE_START_HERE.md` — quy trình khởi động bắt buộc
- `AI_CONTEXT.md` — tổng quan dự án (đọc trước tiên)
- `CURRENT_STATUS.md` — trạng thái hiện tại (cập nhật theo thời gian)
- `CURRENT_TASK.md` — task đang làm (cập nhật mỗi khi chuyển task)
- `REPOSITORY_MAP.md` — bản đồ file → task mapping
- `ARCHITECTURE.md` — kiến trúc hệ thống với data flows
- `API_CONTRACTS.md` — spec API đầy đủ
- `ADR/` — lịch sử quyết định kiến trúc
- `SESSION_SUMMARY_TEMPLATE.md` — template ghi lại session

## Reasoning

**Tại sao Markdown files?**
- Claude Code đọc file text trực tiếp — không cần tool đặc biệt
- Nằm trong git repository — version controlled cùng code
- Dễ cập nhật bởi cả human và AI
- Không phụ thuộc vào external service

**Tại sao không dùng CLAUDE.md duy nhất?**
- CLAUDE.md đã có (project conventions + git workflow) — không muốn bloat nó với architecture docs
- Tách biệt concern: conventions vs context vs current state
- CURRENT_TASK.md và CURRENT_STATUS.md cần cập nhật thường xuyên, tách ra dễ quản lý hơn

**Tại sao không dùng comment trong code?**
- Comments giải thích WHAT/HOW của code cụ thể
- AI Context giải thích WHY của toàn bộ system design
- Hai mục đích khác nhau

**Alternatives considered:**
- External wiki (Notion/Confluence): không nằm trong repo, dễ stale, cần browser access
- Inline CLAUDE.md expansion: file sẽ quá dài, khó scan
- No system: status quo — AI scan toàn bộ codebase mỗi session

## Consequences

**Tích cực:**
- Session mới bắt đầu trong < 5 phút thay vì 15-20 phút
- Nhất quán hơn: AI luôn biết bắt đầu từ đâu
- Living documentation: docs cập nhật cùng code
- Giảm context window waste

**Tiêu cực:**
- Cần maintain thêm files — CURRENT_TASK.md và CURRENT_STATUS.md phải được cập nhật
- Nguy cơ docs stale nếu không có discipline cập nhật
- Thêm cognitive load khi bắt đầu session

## Maintenance Rules

- `CURRENT_TASK.md`: cập nhật khi bắt đầu task mới hoặc kết thúc task
- `CURRENT_STATUS.md`: cập nhật khi hoàn thành feature hoặc phát hiện technical debt mới
- `ARCHITECTURE.md`: cập nhật khi có thay đổi kiến trúc lớn (thêm service, thay đổi data flow)
- `API_CONTRACTS.md`: cập nhật khi thêm/sửa endpoint
- `REPOSITORY_MAP.md`: cập nhật khi thêm file/directory quan trọng
- ADR mới: tạo khi có quyết định kiến trúc lớn
