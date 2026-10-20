# Implementation tasks

Approved implementation. Beans own execution state; this checklist is reconciled from verified completion. Groups 1–5 correspond to `ohwawd-6jn7`, `ohwawd-zug9`, `ohwawd-jxom`, `ohwawd-uora`, and `ohwawd-83dp`; integrated validation is tracked by `ohwawd-1a8z`.

## 1. Data and source foundation

- [x] 1.1 Add idempotent sequence, Extra scope/baseline, and scoping-window schema changes plus legacy conversion helpers; verify in `tests/migrations.test.ts` that reruns are safe, effective legacy totals/coverage are retained, dependency-valid order is seeded, and scenario JSON is unchanged.
- [x] 1.2 Import/cache Linear project priority and include it in sync reports and board source data; verify priority/no-priority/legacy-unknown and priority-only sync cases in import/board tests, including unchanged manual sequence and assignments.

## 2. Queue placement and scheduling

Depends on group 1.

- [x] 2.1 Implement shared placement validation and atomic mutations with sequencing tokens across single/bulk assignment, deferral, dependencies, and stream retirement; verify stale writes, same-stream no-ops, cross-stream moves, all-or-nothing bulk behavior, and direct/transitive restrictions in board/stream tests.
- [x] 2.2 Implement queue-ordered v1 scheduling and source-conflict handling; verify WIP one/two, skipped blocked heads, cross-stream predecessor timing, incremental conflict repair, and unchanged capacity conservation in forecast tests; update `docs/scheduling-contract.md` with the revised order and clearly identified legacy rules.

## 3. Extra scope and readiness

Depends on groups 1 and 2 for source data and forecast start dates.

- [x] 3.1 Replace allowance mutations/demand construction with one remaining Extra scope value, optional notes, captured unknown coverage, and manual source-change reminders; verify blank notes, zero/removal, newly unknown issues, estimated-issue transitions, and unchanged budget on sync in board/import/forecast tests.
- [x] 3.2 Implement configurable lead days and post-forecast readiness with an explicit evaluation clock; verify exact boundary, 0/14/365-day windows, invalid input, team timezone/DST, in-progress/deferred/complete states, missing starts, and reordered dates; document reminder and reconciliation behavior in `docs/scheduling-contract.md`.

## 4. Scenario compatibility

Depends on groups 1 through 3.

- [x] 4.1 Update scenario capture, fingerprints, activation, rebase, and comparison for v1 sequence, source priority, Extra scope, and lead days; verify round-trips, dirty detection, new-source conflicts, manual scope-review reminders without publication gates, and calculation-version labeling in scenario tests.
- [x] 4.2 Adapt legacy editable drafts and preserve frozen v0 revisions; verify both allowance kinds, consumed residuals, retired controls, priority-unknown fallback, snapshot immutability, and frozen reminder evaluation; update the historical compatibility section of the scheduling contract.

## 5. Board interaction

Depends on groups 2 through 4. Read the relevant installed Next.js guides before writing application code.

- [x] 5.1 Build visible ordered stream queues and drag/drop insertion targets with equivalent keyboard/touch Move controls; verify pointer reorder, cross-stream/shelf movement, invalid dependencies, stale rollback, focus/announcements, and small-screen usability in Playwright; document any proposed new library before adding it.
- [x] 5.2 Simplify project controls, display read-only priority, add Extra scope/optional notes and the board-wide lead setting, and surface actionable reminders; verify removed controls, blank pause notes for in-progress work, one scope budget, refreshed reminders across local midnight, and Planning attention navigation in UI tests; reconcile `docs/product-design.md` with the new interaction.

## 6. Integrated validation

Depends on all previous groups.

- [x] 6.1 Run `npm test`, `npm run typecheck`, `npm run test:ui`, and `npm run build`; verify an end-to-end sync → assign/reorder → scope reminder → save/load → compare/publish workflow and record results in implementation Beans.
- [x] 6.2 Run `openspec validate simplify-project-assignment --strict`, verify every requirement against implementation/test evidence, and reconcile this checklist with completed Beans before requesting archive.

## Workflow follow-up

- Review and refine this design before implementing; create bounded implementation Beans linked to the specific spec/design sections and prerequisite Beans after approval.
- Archive through the OpenSpec CLI only when associated implementation work is verified complete, and update Bean references to the archived artifacts.
