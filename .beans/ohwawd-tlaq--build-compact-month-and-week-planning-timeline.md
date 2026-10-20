---
# ohwawd-tlaq
title: Build compact month and week planning timeline
status: completed
type: feature
priority: normal
created_at: 2026-10-20T20:06:36Z
updated_at: 2026-10-20T20:29:59Z
---

User requests a month-first stream timeline subdivided into compact weeks, roughly 2–3 months visible with horizontal scrolling, supporting Linear cycle context and highlighted 50% Thanksgiving/Christmas holiday weeks.

- [x] Define OpenSpec timeline and weekly capacity behavior
- [x] Implement month/week timeline and editable reduced-capacity weeks
- [x] Integrate forecast and scenario assumptions with migration
- [x] Verify calendar/capacity calculations, responsive UI and production checks

OpenSpec: openspec/changes/archive/2026-10-20-month-week-planning-timeline/proposal.md, design.md, specs/planning-timeline/spec.md, and specs/weekly-capacity/spec.md. Related dependency bug: ohwawd-d5v8 (completed). Holiday assumptions are real availability changes, with editable Thanksgiving/Christmas/following-week defaults and visible unsupported-calendar coverage.

## Implementation progress

Added compact month/week tables with sticky names, precise cycle-context tooltips, dependency explanations, partial continuing bars and unsupported-calendar shading. Added editable US Thanksgiving/Christmas/following-week 50% defaults and manual weekly overrides with weekday-weighted cycle capacity and weekly-first precedence. Migration 4 is applied to localhost; real v2 board returns the expected 2026-11-23, 2026-12-21 and 2026-12-28 holiday weeks. Scenarios capture/restore/compare v2 settings; v0/v1 published outputs remain frozen and old editable capacity defaults are preserved. Current checks: 53 unit/integration tests, 15 browser tests, typecheck and strict change validation pass. Production build and final archive reconciliation were subsequently completed as recorded below.

## Summary of Changes

Implemented the month/week timeline and real weekly availability model described in openspec/changes/archive/2026-10-20-month-week-planning-timeline/. Tables use sticky project labels, compact 80px desktop weeks (56px mobile), grouped months, secondary cycle context, aligned holiday bands, explicit blockers and honest continuing/missing-calendar states. Editable presets and weekly overrides affect forecast budgets with working-day weighting and no double reduction. V2 scenarios persist/restore/compare these assumptions while v0/v1 published results remain unchanged. Migration 4 applied to localhost. Verified actual Identity/RBAC → Client Self Service order and dependency, zero order conflicts, and the three default 50% holiday weeks. Final checks: npm test (53 passed), npm run test:ui (15 passed; timeline suite also verifies native keyboard scrolling), npm run typecheck, npm run build, strict OpenSpec validation and git diff --check pass. No runtime dependencies added. Acceptance evidence: openspec/changes/archive/2026-10-20-month-week-planning-timeline/verification.md.
