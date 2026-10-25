---
# ohwawd-sk0r
title: Build compact searchable outcome list
status: completed
type: task
priority: normal
created_at: 2026-10-23T16:10:00Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-t9oa
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/archive/2026-10-25-redesign-outcome-catalog/specs/outcome-catalog/spec.md
Design: openspec/changes/archive/2026-10-25-redesign-outcome-catalog/design.md (Decisions 1–4 and 7)

Bounded scope: implement the full-width catalog browse surface using the query model, with title/owner/stream/needed-by/direct-link-count rows, labeled filters, search, sorting, result counts, reset and section navigation. Keep view state local and persistent across workspace view switches/reloads; handle local-midnight date updates and loading/error/empty distinctions. Expose explicit inspection/edit/link/delete callbacks for the following sidebar-integration task.

- [x] Replace the card grid with compact semantic rows and scoped responsive styling
- [x] Add composable filters, search, sort, N-of-M counts, reset, zero-result choices and jump-to-catalog navigation
- [x] Add many-outcome fixtures and browser coverage for reaching the final row, combined filters, sorting, reset, local-date refresh, forecast failure independence and view-state preservation
- [x] Document the implemented browsing controls in docs/product-design.md and verify desktop/mobile row geometry and keyboard controls

Completion: all matching rows are reachable with ordinary page scrolling; all metadata/actions fit at 1440px, 768px and 390px without page overflow; filtering never writes planning changes. Full sidebar workflows are completed by the dependent task before shipping the replacement.

## Summary of Changes

Added the dedicated compact OutcomeCatalog with labeled composable search/facets/sorting, direct-link counts, full page scrolling, section navigation, session-local query state, disappearing-facet choices and team-local date refresh. Catalog loading/retry/stale-result feedback is independent of delivery forecasts. Exposed inspect/edit/link/delete callbacks and retained existing detail/edit controls on demand outside the rows pending ohwawd-5eqp sidebar integration; outcome overlays now mount outside hidden views. Added a 55-outcome database fixture and seven browse browser tests, updated affected existing selectors, and documented delivered controls and integration staging.

Verified npm run typecheck, all 78 unit/database tests, seven catalog browser tests and 19 workspace/responsive/theme browser tests. Inspected catalog screenshot evidence at 1440px, 768px and 390px; assertions cover desktop row height, keyboard control order, final-row reachability and no page overflow. Full sidebar and cross-feature integration remain with their existing dependent Beans.
