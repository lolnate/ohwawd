---
# ohwawd-sk0r
title: Build compact searchable outcome list
status: todo
type: task
priority: normal
created_at: 2026-10-23T16:10:00Z
updated_at: 2026-10-23T16:11:04Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-t9oa
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md
Design: openspec/changes/redesign-outcome-catalog/design.md (Decisions 1–4 and 7)

Bounded scope: implement the full-width catalog browse surface using the query model, with title/owner/stream/needed-by/direct-link-count rows, labeled filters, search, sorting, result counts, reset and section navigation. Keep view state local and persistent across workspace view switches/reloads; handle local-midnight date updates and loading/error/empty distinctions. Expose explicit inspection/edit/link/delete callbacks for the following sidebar-integration task.

- [ ] Replace the card grid with compact semantic rows and scoped responsive styling
- [ ] Add composable filters, search, sort, N-of-M counts, reset, zero-result choices and jump-to-catalog navigation
- [ ] Add many-outcome fixtures and browser coverage for reaching the final row, combined filters, sorting, reset, local-date refresh, forecast failure independence and view-state preservation
- [ ] Document the implemented browsing controls in docs/product-design.md and verify desktop/mobile row geometry and keyboard controls

Completion: all matching rows are reachable with ordinary page scrolling; all metadata/actions fit at 1440px, 768px and 390px without page overflow; filtering never writes planning changes. Full sidebar workflows are completed by the dependent task before shipping the replacement.
