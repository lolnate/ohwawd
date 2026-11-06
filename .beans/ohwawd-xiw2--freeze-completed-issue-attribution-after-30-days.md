---
# ohwawd-xiw2
title: Freeze completed issue attribution after 30 days
status: completed
type: task
priority: high
created_at: 2026-11-03T12:26:35Z
updated_at: 2026-11-06T12:56:55Z
parent: ohwawd-t8lm
blocked_by:
    - ohwawd-r33j
---

OpenSpec task 2.3. Add immutable completed-issue attribution snapshots and migration backfill while deriving cycle placement from actual cycles. References: openspec/changes/visualize-ongoing-work/design.md Decision 5 and specs/ongoing-work-insights/spec.md. Complete when tests cover recent movement, cutoff freezing, unresolved/no-project attribution, and cycle coverage in npm test and task 2.3 is checked.

## Checklist

- [x] Add immutable completed-issue attribution schema and migration backfill
- [x] Snapshot newly eligible issues after successful full imports
- [x] Implement live/frozen attribution and actual-cycle history derivation
- [x] Add focused cutoff, movement, attention, and coverage tests
- [x] Run typecheck, tests, and strict OpenSpec validation
- [x] Reconcile OpenSpec task 2.3 and summarize completion

## Summary of Changes

Added migration 12 with immutable completed-issue attribution snapshots and first-full-sync current-at-migration provenance. Successful complete issue imports now freeze newly eligible completions at the exact 30x24-hour cutoff using the shared classification resolver, with unavailable projects treated as unresolved. Added issue-level history derivation that keeps recent attribution live, frozen attribution stable, and cycle placement derived from active completed Linear cycle dates. Focused tests cover movement, classification attention, no-project evidence, exact cutoff, later source removal, cycle correction and missing coverage, immutability, rollback, and 101-row batching. Typecheck, all 163 unit tests, strict OpenSpec validation, and whitespace checks pass.
