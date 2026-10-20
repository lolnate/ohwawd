---
# ohwawd-d5v8
title: Fix missing Linear project dependency ordering
status: completed
type: bug
priority: high
created_at: 2026-10-20T20:06:36Z
updated_at: 2026-10-20T20:11:28Z
---

Investigate why Client Self Service MVP is scheduled before Identity & RBAC Across Services - Foundry and Vision despite the source dependency. Existing requirements: openspec/specs/stream-sequencing/spec.md.

- [x] Identify the source/import or ordering root cause against current data
- [x] Correct dependency ingestion and show clear blocker context and repair actions
- [x] Repair the affected local planning data and verify regression coverage

## Root cause

Confirmed against the read-only Linear API: the Identity → Client Self Service relationship is type dependency, anchorType end, relatedAnchorType start. The old adapter filtered only blocks, dropping the real edge entirely. Updated normalization to use canonical end-to-start project relations from either collection, with deduplication and inverse-only import support. Added adapter/import regressions and explicit blocker context plus a stream repair action.

## Summary of Changes

Normalized Linear project dependency/end/start relations from both relation collections and imported inverse-only internal edges with deduplication. Added highlighted blocker context and explicit Put blocker first repair controls. Refreshed the local workspace from read-only Linear: 77 projects, 11 dependency edges; repaired Identity/RBAC to position 1 and Client Self Service MVP to position 2. Client now correctly waits for Identity, whose newly uncovered issue estimates remain visible for review. No unresolved stream-order conflicts remain. Adapter/import/sequencing tests pass (11 tests); browser regression verifies source conflict explanation and explicit repair.
