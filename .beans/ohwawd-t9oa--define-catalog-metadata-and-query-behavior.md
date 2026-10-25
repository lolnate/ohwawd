---
# ohwawd-t9oa
title: Define catalog metadata and query behavior
status: completed
type: task
priority: normal
created_at: 2026-10-23T16:10:00Z
updated_at: 2026-10-24T16:32:44Z
parent: ohwawd-2ods
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md
Design: openspec/changes/redesign-outcome-catalog/design.md (Decisions 2–4)

Bounded scope: expose persisted outcome stream_id, date-only needed_by, existing created_at and resolved workspace/team timezone through the workspace state contract; implement a pure indexed catalog-query model. No database migration or forecast dependency.

- [x] Add and type source metadata without deriving outcome streams from shared projects
- [x] Implement normalized search, owner/stream/project-coverage/target-date facets and deterministic sorting with explicit today
- [x] Add meaningful query/state-contract tests for combined facets, whitespace/case, hidden/shared/missing projects, optional-only links, null dates, 30-day boundaries, stable ties and unchanged inputs
- [x] Document the additive state contract in the module/design as needed and verify focused tests plus TypeScript

Completion: all required query cases pass; required and optional counts are direct links; catalog-query operations cannot mutate planning state.

## Summary of Changes

Extended GET /api/state and the workspace contract with outcome stream/date/creation metadata and resolved timezone. Added an immutable indexed catalog-query model with normalized facets, direct-link counts and deterministic sorting, plus focused coverage for hidden/shared/missing links, dates and input immutability. Verified with npm run typecheck, npm test, npm run build, strict OpenSpec validation, and responsive/settings UI suites.
