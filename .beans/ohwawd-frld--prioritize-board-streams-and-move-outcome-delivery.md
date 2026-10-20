---
# ohwawd-frld
title: Prioritize board streams and move outcome delivery to Outcomes
status: completed
type: task
priority: normal
created_at: 2026-10-20T21:00:39Z
updated_at: 2026-10-20T21:09:57Z
---

Reorganize the existing planning views per user feedback. This is a bounded UI organization change; forecasting and capacity semantics remain governed by openspec/specs/planning-timeline/spec.md and openspec/specs/weekly-capacity/spec.md.

- [x] Put stream lanes immediately below Planning attention and Manage streams immediately below the lanes
- [x] Move Outcome delivery to Outcomes, preserving edit/link/delete and cross-tab blocker actions
- [x] Clarify cycle-wide overrides versus weekly availability/holidays
- [x] Verify section order, navigation, fresh delivery data and responsive behavior, then update documentation

## Verification progress

All 20 browser tests pass, including dynamic stream creation, exact section order, outcome edit/link/delete, forecast freshness after sequencing, cross-tab blocker focus, initial forecast-load errors and mobile calendar guidance. Typecheck and git diff --check pass. Product design documentation updated; production build verification passed.

## Summary of Changes

Placed configurable stream lanes directly after Planning attention and Manage streams immediately after the lanes, ahead of assignment shelves and settings. Moved Outcome delivery to the Outcomes tab using shared board forecast state, reused catalog edit/link/delete actions, and preserved cross-tab blocker navigation with focused project controls. Added visible forecast-load errors. Renamed and explained whole-cycle versus weekly availability controls and linked the cycle panel to weekly settings. Updated docs/product-design.md. Verification: 20 Playwright tests passed, including new organization, CRUD/freshness, blocker-navigation, failure-state and mobile guidance regressions; npm run typecheck, npm run build and git diff --check passed. No forecasting semantics, dependencies or database migrations changed.
