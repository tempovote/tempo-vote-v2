# Architecture Decision Records (ADR)

ADR là các tài liệu ngắn ghi lại những quyết định kiến trúc quan trọng trong dự án — quyết định nào được đưa ra, tại sao, và hậu quả của nó là gì.

---

## ADR là gì?

Một ADR ghi lại **một quyết định kiến trúc cụ thể** tại một thời điểm nhất định. Nó không phải là tài liệu thiết kế toàn diện — chỉ là snapshot của một lựa chọn và lý do đằng sau nó.

Quan trọng: ADR **không thay đổi** sau khi được chấp nhận. Nếu quyết định thay đổi, tạo ADR mới (supersedes ADR cũ) thay vì sửa ADR hiện tại.

---

## Khi nào cần tạo ADR?

Tạo ADR khi:
- Chọn một công nghệ/thư viện quan trọng (Ogmios vs Blockfrost, Ktor vs Spring, ...)
- Quyết định kiến trúc có ảnh hưởng rộng (monorepo structure, auth strategy, ...)
- Trade-off quan trọng mà tương lai cần hiểu (tại sao không dùng X?)
- Thay đổi hướng lớn so với pattern hiện tại

Không cần ADR cho:
- Bug fixes
- UI changes
- Thêm API endpoint thông thường
- Refactor nhỏ

---

## Cách đặt tên

```
ADR-{NNN}-{kebab-case-title}.md

Ví dụ:
ADR-001-ai-context-system.md
ADR-002-ogmios-over-blockfrost.md
ADR-003-no-swr-plain-useeffect.md
```

---

## Template

```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Date:** YYYY-MM-DD

## Context
<!-- Vấn đề hoặc tình huống dẫn đến quyết định này -->

## Problem
<!-- Vấn đề cụ thể cần giải quyết -->

## Decision
<!-- Quyết định được đưa ra -->

## Reasoning
<!-- Tại sao chọn giải pháp này, tại sao không chọn các giải pháp khác -->

## Consequences
<!-- Hậu quả tích cực và tiêu cực của quyết định này -->

## Maintenance Rules
<!-- Khi nào cần review/cập nhật ADR này -->
```

---

## Danh sách ADR

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-ai-context-system.md) | AI Context System for Claude Code | Accepted |
