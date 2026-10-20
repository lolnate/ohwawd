---
# ohwawd-jxom
title: Implement extra scope and readiness reminders
status: completed
type: task
priority: normal
created_at: 2026-10-20T18:49:58Z
updated_at: 2026-10-20T19:18:55Z
blocked_by:
    - ohwawd-zug9
---

Approved OpenSpec: openspec/changes/archive/2026-10-20-simplify-project-assignment/design.md decisions 5–6; specs/project-scope-readiness/spec.md; tasks.md group 3.

- [x] Implement unified scope API, demand, coverage and manual review
- [x] Derive configurable date-based scoping reminders
- [x] Verify boundary, lifecycle and source-change tests and update contract

## Summary of Changes

Added one Extra scope budget with optional notes, explicit unknown coverage and manually acknowledged source baselines; scope review is advisory. Added configurable 0–365-day scoping windows, explicit evaluation clocks, timezone-safe due dates, and lifecycle-aware readiness. Updated API and scheduling documentation. Scope/board tests pass (4 tests including integration across sync and source changes).
