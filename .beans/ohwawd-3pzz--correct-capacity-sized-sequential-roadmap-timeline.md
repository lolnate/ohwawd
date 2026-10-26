---
# ohwawd-3pzz
title: Correct capacity-sized sequential roadmap timeline
status: completed
type: bug
priority: high
created_at: 2026-10-26T10:53:44Z
updated_at: 2026-10-26T11:13:48Z
---

The delivered roadmap timeline ignores Linear project-level remaining scope, rounds bars to whole cycles, and renders verbose wait-warning rows.

- [x] Specify project remaining-scope precedence, fractional bar geometry, connector sequencing, and a no-bloat timeline convention in OpenSpec/docs.
- [x] Import and persist Linear project scope/completed scope as remaining capacity demand with an additive migration and sync-change reporting.
- [x] Use aggregate remaining scope for finite forecasts even when individual issues are unestimated; preserve completion evidence and fallback unknown-scope behavior.
- [x] Render fractional final-cycle bar widths, sequential project placement, and truthful dependency connectors without timeline wait-warning prose.
- [x] Add unit/database/browser coverage for 106 points at 30 points/week, fallback behavior, sync, responsive/accessible geometry, and no wait-warning rows.
- [x] Run typecheck, tests, build, strict OpenSpec validation, visual review, Beans integrity, and reconcile documentation.

## Summary of Changes

Imported and persisted validated Linear aggregate remaining scope, made it authoritative forecast demand with issue-level fallback, and added migration 8. Rendered capacity-proportional fractional bars with shared geometry, sequential dependency connectors, compact timeline states, and accessible 24px pointer targets without inflating visual spans. Added regression coverage and documentation, applied the local migration, refreshed 77 Linear projects, and passed 139 unit/database tests, 112 Chromium tests, typecheck, production build, strict OpenSpec validation, Beans integrity, and whitespace checks.
