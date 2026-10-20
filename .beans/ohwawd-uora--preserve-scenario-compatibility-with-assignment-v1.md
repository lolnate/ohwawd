---
# ohwawd-uora
title: Preserve scenario compatibility with assignment v1
status: completed
type: task
priority: normal
created_at: 2026-10-20T18:49:58Z
updated_at: 2026-10-20T19:18:55Z
blocked_by:
    - ohwawd-jxom
---

Approved OpenSpec: openspec/changes/archive/2026-10-20-simplify-project-assignment/design.md decision 7; all specs; tasks.md group 4.

- [x] Update snapshot capture, fingerprints, activation and comparisons
- [x] Adapt legacy editable drafts without changing revisions
- [x] Verify scenario round-trips, versions and frozen outputs

## Summary of Changes

V1 snapshots now capture and restore sequence, Extra scope/coverage and lead time; comparisons separate local order from Linear priority and identify versions. Legacy draft inputs adapt without rewriting frozen v0 output. Optional scope reminders do not gate publication. Removed retired planning fields from current fingerprints, writes, source reads and comparison UI. Preview tokens ignore the changing readiness clock. Scenario/stream tests pass (11 tests); typecheck passes.
