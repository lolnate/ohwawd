---
# ohwawd-r33j
title: Reconcile team issue and blocker caches
status: completed
type: task
priority: high
created_at: 2026-11-03T12:26:35Z
updated_at: 2026-11-06T11:41:18Z
parent: ohwawd-t8lm
blocked_by:
    - ohwawd-qfbc
    - ohwawd-fd4p
---

OpenSpec task 2.2. Persist team issues and normalized blocker edges by complete import generation without project-scoped deletion. References: openspec/changes/visualize-ongoing-work/design.md Decision 4. Complete when import tests verify moves, removals, blockers, labels, stale generations, and source reports in npm test and task 2.2 is checked.

## Checklist

- [x] Add nullable team-issue, URL, import-generation, and blocker-cache schema
- [x] Wire complete team issue and project-label source into import route
- [x] Reconcile labels, issues, blockers, removals, and reports transactionally
- [x] Add migration and import coverage for moves, removals, stale generations, and failures
- [x] Run typecheck and npm test
- [x] Reconcile OpenSpec task 2.2 and summarize completion

## Summary of Changes

Added migration 11 for nullable or unavailable issue project IDs, issue URLs, project lookup indexing, and normalized blocker edges. Wired the complete team issue feed into Linear sync and reconciled labels, issues, removals, moves, blockers, and source reports by import generation inside the existing transaction. Added migration and import tests for unattached and cross-team projects, stale generations, rollback after deletion, blocker direction, and legacy evidence preservation; typecheck, all 156 unit tests, and strict OpenSpec validation pass.
