---
# ohwawd-mu1i
title: Build Ongoing work aggregate and detail APIs
status: completed
type: task
priority: high
created_at: 2026-11-03T12:26:35Z
updated_at: 2026-11-06T13:15:33Z
parent: ohwawd-t8lm
blocked_by:
    - ohwawd-xiw2
    - ohwawd-qi52
---

OpenSpec task 4.1. Build server aggregates for available work and completed history plus a validated lazy issue-detail endpoint. References: openspec/changes/visualize-ongoing-work/design.md Decision 6 and specs/ongoing-work-insights/spec.md. Complete when API/domain tests cover buckets, estimates, attention rows, history ranges, and filter rejection in npm test and task 4.1 is checked.

## Summary of Changes

Implemented server-side Ongoing available-work and completed-history aggregates, authenticated recent/all aggregate reads, and validated lazy issue-detail reads that recompute membership from cached and frozen evidence. Added Board aggregate integration without exposing all team issues, plus comprehensive bucket, blocker, estimate, ordering, attention, cycle-range, frozen-history, coverage, and untrusted-selector tests. Validated with npm run typecheck, npm test (169 passing), strict OpenSpec validation, and git diff --check.
