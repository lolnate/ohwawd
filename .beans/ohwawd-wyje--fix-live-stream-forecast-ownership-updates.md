---
# ohwawd-wyje
title: Fix live stream forecast ownership updates
status: completed
type: bug
priority: high
created_at: 2026-10-26T14:19:35Z
updated_at: 2026-10-26T14:30:58Z
---

Correct migrated Board behavior when a newly linked project is assigned through an outcome and stream.

- [x] Reproduce and identify the shared root cause for stale capacity/extra-scope updates, unexplained blocked state, and reference rendering
- [x] Fix persistence/refresh and ownership/scoping behavior without changing intended shared-project semantics
- [x] Add regression coverage for allocation, extra scope, blocked reasoning, and counted timeline placement
- [x] Run relevant typecheck, unit, browser, and build validation
- [x] Summarize the root cause and verified changes

OpenSpec: `openspec/changes/auto-scope-unique-outcome-projects/`.

## Summary of Changes

Fixed existing and future unambiguous project workflows by atomically including a candidate when it is minimum-required by its sole assigned outcome, regardless of whether linking or outcome placement happens first. An idempotent migration repairs already-saved matching candidates. Optional, multiply linked, deferred and dismissed work remains explicit. Board references now distinguish Shared from Needs assignment/Deferred/Dismissed, blocked outcomes expose concise causes, and accepted allocation and Extra scope writes immediately refresh totals and timeline geometry. Preserved exact scenario restoration and added regression coverage for the reported 13 estimated + 140 extra = 153 point case. Verified typecheck, 142 unit/database tests, 115 browser tests, production build, strict OpenSpec validation and diff checks.
