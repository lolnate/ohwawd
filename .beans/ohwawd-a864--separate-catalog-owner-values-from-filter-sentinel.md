---
# ohwawd-a864
title: Separate catalog owner values from filter sentinels
status: completed
type: bug
priority: normal
created_at: 2026-10-24T16:59:00Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-2ods
---

Review finding from completed Bean ohwawd-t9oa: src/lib/outcome-catalog.ts:16–20,58–59,93 use raw normalized owner strings alongside all/none sentinels. A saved owner All becomes value all and selects every outcome; owner None becomes none and selects blank owners instead. Reproduced with four owners All, None, Engineering, and blank.

References: openspec/changes/archive/2026-10-25-redesign-outcome-catalog/design.md (decisions 2–4); openspec/changes/archive/2026-10-25-redesign-outcome-catalog/specs/outcome-catalog/spec.md.

- [x] Represent owner filter modes and saved owner values without collisions, updating facet/query types and consumers consistently.
- [x] Add tests proving saved owners All and None are selectable separately from unrestricted and No owner filters.
- [x] Run catalog unit tests and npm run typecheck.

## Summary of Changes

Namespaced saved owner facet values with a typed owner: prefix, keeping All owners and No owner modes distinct even for saved values All, None, or owner:all. Added normalization/collision regression coverage. Verified all five catalog unit tests and npm run typecheck.
