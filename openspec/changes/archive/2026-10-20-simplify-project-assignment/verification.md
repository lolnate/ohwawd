# Acceptance verification

Validated against the approved three capability specifications on 20 October 2026. Implementation execution is recorded in Beans `ohwawd-6jn7`, `ohwawd-zug9`, `ohwawd-jxom`, `ohwawd-uora`, `ohwawd-83dp`, and `ohwawd-1a8z`.

## Project assignment

| Requirement | Implementation and evidence |
| --- | --- |
| Project priority comes from Linear | `linear.ts` reads source priority; `import.ts` caches/reports changes; cards use `linearPriorityLabel`. Import priority-only preservation test, scope label tests, and pointer reorder browser test. |
| Assignment controls are lightweight | `project-plan-card.tsx` exposes location/insertion and scope; board API rejects retired properties. Browser test verifies removed controls; forecast test verifies retired scheduling fields have no effect. |
| Pause rationale is optional | Board API accepts an empty note without status-specific requirements. Browser test defers started work with a blank note; scenario activation preserves pause notes. |
| Assignment preserves project identity | Shared placement updates the existing scalar stream assignment; Needs assignment and Deferred retain distinct selection semantics. Import shared-outcome test, board assignment test, and cross-stream/deferral browser tests. |

## Stream sequencing

| Requirement | Implementation and evidence |
| --- | --- |
| Stream order is visible and persistent | Explicit lane sorting and `sequence_position` storage. Pointer browser test verifies visible order, persistence after reload, source priority context, and focus. |
| Moves have accessible equivalent controls | Native drag handles, arrow buttons, Alt+arrow shortcuts, Location/Place before controls. Pointer, keyboard, touch-context, and responsive browser tests. |
| Explicit placement is atomic | `planPlacements` validates the complete change before `placeProjects` writes it inside API transactions. Sequencing tests verify unchanged state on failed bulk plans and stale tokens; browser test verifies rejected stale drop recovery. |
| All assignment paths produce a valid sequence | Single/bulk buttons, location controls, deferral and retirement use shared placement logic. Sequencing tests cover last-valid insertion, dependency-valid bulk ordering and idempotency; stream lifecycle tests exercise retirement. |
| Effective dependencies constrain placement | Shared transitive paths include active Linear/local edges and respect waivers/completed predecessors. Sequencing tests include cross-stream paths, completion and waivers; browser Move form rejects reversal. |
| Source conflicts preserve user order | Board integration test syncs a new conflicting Linear edge, preserves the queue, withholds only affected lane dates, and restores dates after repair. Sequencing tests cover incremental repair; shared constraint checks reject local reversal/cycles. |
| Scheduling selects eligible work by queue order | Forecast tests cover WIP 1/2, blocked heads, carried work, next-cycle dependency unlocking, capacity conservation and ignored retired fields. |
| Scenarios preserve sequencing semantics and history | Scenario tests verify v1 capture/activation, dirty state, immutable published results, v0 adaptation and versioned comparison. Browser workflow saves, compares and publishes arranged queues. |

## Project scope readiness

| Requirement | Implementation and evidence |
| --- | --- |
| Extra scope is one remaining estimate | `scope-store.ts` validates a single points value and optional notes; scope tests cover zero/removal, precision and limits. Browser test verifies one editor without owner/review date. |
| Positive extra scope covers acknowledged unknown issues | Scope integration test covers capture, newly uncovered issues, re-save and removal. Forecast demand retains unknown rather than treating it as zero. |
| Scope reconciliation is manual and advisory | Scope/board tests verify unchanged budget as estimates appear, additive demand, source-review summaries and explicit re-save. Scenario test publishes with an outstanding advisory review. |
| Scoping lead time is configurable | Scope tests cover 0/14/365 and invalid values, persisted custom window; touch browser test saves a 21-day setting. |
| Needs scoping is derived from planned start | Pure readiness tests cover inclusive boundaries, team-local dates and DST; scope integration test preserves provisional dates at the due date. |
| Scoping reminders explain lifecycle and missing dates | Readiness tests cover in-progress, deferred, reconciled-complete and unavailable-start behavior. Cards retain the forecast blocker separately. |
| Reminder calculation responds to time and planning changes | Explicit board clock and team-local date-boundary timer. Readiness tests cover moved dates and independent source reminders; touch browser test crosses midnight without syncing Linear. |
| Scope reminders are actionable on the board | Card Review scope controls and Planning attention actions open the affected editor. Touch browser test verifies visible editor and input focus. |
| Scenario scope assumptions and historical output are preserved | Scenario tests round-trip notes/budget/lead days, retain published clock output, and compare v0/v1 without mutation. Migration tests verify effective residual conversion, fully consumed allowances and idempotency. |

## Environment validation

- `npm test`: 46 passing tests.
- `npm run test:ui`: 11 passing Chromium tests, including a touch-enabled context and 390/412/768/1440px layouts. The assignment browser fixture runs the real planning, forecast, scope, and scenario services against in-memory PostgreSQL.
- `npm run typecheck`: passed.
- Migration 3 applied successfully to the configured localhost development database. A real board read returns calculation version v1 with no order conflicts.
- `npm run build`: passed, including optimized compilation, type checking, and static page generation.
- `openspec validate simplify-project-assignment --strict`: passed. `git diff --check`: passed.
