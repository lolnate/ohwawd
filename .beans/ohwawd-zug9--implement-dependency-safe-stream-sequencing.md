---
# ohwawd-zug9
title: Implement dependency-safe stream sequencing
status: completed
type: task
priority: normal
created_at: 2026-10-20T18:49:58Z
updated_at: 2026-10-20T19:18:55Z
blocked_by:
    - ohwawd-6jn7
---

Approved OpenSpec: openspec/changes/archive/2026-10-20-simplify-project-assignment/design.md decisions 1–4; specs/stream-sequencing/spec.md; tasks.md group 2.

- [x] Implement shared placement, dependency validation, and stale tokens
- [x] Integrate assignment and stream lifecycle mutation paths
- [x] Implement queue scheduling and conflict repair
- [x] Verify board/stream/forecast tests and document contract

## Summary of Changes

Added shared dependency-path and placement planning, atomic server writes and sequencing fingerprints, assignment/dependency/retirement integration, v1 queue scheduling, source-order conflicts and incremental repair. Updated the current/legacy scheduling contract. Board, stream, sequencing and forecast tests pass (23 tests).
