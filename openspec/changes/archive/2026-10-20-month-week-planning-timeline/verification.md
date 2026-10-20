# Verification evidence

Execution: Bean `ohwawd-tlaq`. Related source-dependency defect: completed Bean `ohwawd-d5v8`.

## Planning timeline

| Requirement | Evidence |
| --- | --- |
| Month and week calendar headers | `planningWeeks` creates local Monday weeks and month grouping. Calendar tests cover a cycle spanning months; browser tests verify month headers and subdued cycle context. |
| Compact horizontal navigation | Fixed 80px desktop weeks and a 240px sticky project column provide roughly 12–14 visible weeks. Browser geometry checks validate column widths, keyboard/horizontal scrolling, fixed label position and 390/412/768/1440px containment. |
| Honest date and dependency presentation | Date-to-week spans use actual imported forecast boundaries. Browser tests verify continuing bars stop at simulated capacity and successors show After/Waiting for their blockers without earlier delivery bars. |
| Visible unsupported calendar coverage | Week coverage is full/partial/none; unsupported weeks are hatched with calendar-end guidance. Browser tests ensure bars end before unsupported weeks. |
| Capacity bands are actionable | Week-header buttons open the availability editor. Browser tests verify three default highlighted bands, editing 0%/100%, restored capacity, override removal and reload. |

## Weekly capacity

| Requirement | Evidence |
| --- | --- |
| Editable holiday availability defaults | Calendar tests and real localhost read confirm 2026 weeks November 23, December 21 and December 28 at 50%; year-boundary test covers January 1 in a following week. Preset state and resolved dates are captured in scenarios. |
| Persisted weekly availability overrides | Database tests validate Monday dates, 0–100% fractions, removal and idempotent schema updates; browser tests exercise editing, precedence, removal and reload. |
| Weekly capacity maps to imported cycles | Forecast/calendar tests verify weekday averaging, 75% fortnight capacity, reserve once, no doubled 50% reductions, midweek cycle boundaries, DST and weekend-only fallback. Browser tests verify budget changes in the real forecasting service. |
| Weekly assumptions are scenario-safe | Scenario tests cover weekly capture/activation/comparison, dirty detection, frozen preset dates, unchanged published JSON and pre-weekly drafts loading with holidays disabled. |

## Current-data dependency repair

Read-only Linear inspection confirmed the named edge is `dependency` with `end`/`start` anchors; the previous `blocks` filter dropped it. Normalization now reads both relation collections and import accepts inverse-only edges. Adapter/import regressions cover the real payload shape. The local source refresh imported 77 projects and 11 edges. Identity/RBAC is position 1; Client Self Service is position 2 and explicitly waits for Identity. No saved-order conflicts remain. New unknown issue demand remains visible rather than being silently acknowledged.

## Validation

- `npm test`: 53 passed.
- `npm run test:ui`: 15 passed, including PostgreSQL-backed planning-service fixtures, mobile/touch workflows, source conflict repair, month/week geometry and actual capacity edits.
- `npm run typecheck`: passed.
- `openspec validate month-week-planning-timeline --strict`: passed.
- Migration 4 applied to localhost; a real board read confirms v2, enabled holiday defaults, the expected three dates and correct named-project dependency/order.
- `npm run build`: passed, including optimized compilation, TypeScript checks and static generation.
- `git diff --check`: passed. The implementation checklist is reconciled with verified Bean completion before archive.
