# Design: simplified project assignment

## Context

See `proposal.md` for motivation and the three capability specs for acceptance criteria. The existing implementation has:

- One `work_package` per imported project. `priority_rank`, two start-cycle constraints, and `must_include` are stored locally. The API requires pause notes for in-progress or must-include work.
- Alphabetical board reads in `src/lib/board.ts`, while `src/lib/forecast.ts` orders eligible work by preferred cycle, priority rank, and ID. Assignments only update `stream_id` and `selected`.
- Imported project dependency edges, local edges, explicit Linear waivers, and external-blocker information. The Linear adapter does not import project priority.
- Separate `unestimated` and `discovery` allowances. The former is automatically reduced as its captured issues gain estimates; the latter blocks publication when new issues might overlap it. Both require owner, review date, and rationale, although review date currently has no readiness calculation.
- Scenario snapshots containing both planning/source inputs and calculated output. Activation restores old planning fields; comparisons and dirty detection name those fields explicitly. Revisions store calculation version `v0` and their frozen result.

The existing Markdown scheduling contract explicitly describes the controls being removed. During implementation, update it and the product design to point to the new OpenSpec requirements for the revised calculation version; retain a clearly labeled description of legacy v0 semantics where needed for history.

## Goals / Non-Goals

**Goals:** Make visible stream order the authoritative scheduling input; preserve capacity, WIP, and finish-to-start dependency rules; minimize scope administration; retain usable historical scenarios.

**Non-Goals:** Timeline date dragging, Linear writes, multi-team forecasting, automatic priority-based reshuffling, or introducing an approval workflow for scope reminders.

## Decisions

### 1. Separate source priority from local sequence

Import Linear's project priority value and display its corresponding label, including No priority. Unavailable legacy values display Unknown until a successful project sync. Include priority in source change reports and scenario source snapshots. Project priority is source evidence, never a local planning override or scheduling tie-breaker.

Use an internal integer `sequence_position` on selected, stream-assigned work packages. Normalize affected lanes to a contiguous order within each assignment/move transaction. There is no editable numeric control. Readers explicitly sort lanes and timeline rows by this position, with immutable ID as a defensive deterministic tie-breaker.

Manual sequence wins over Linear priority, as confirmed by the user. Sorting automatically after sync or grouping moves by priority was rejected because either would undermine deliberate sequencing. Needs assignment and Deferred use stable name/ID ordering; they have no execution sequence.

### 2. Make the ordered queue the primary stream interaction

Show each stream's ordered project queue without opening Manage work. Timeline dates remain calculated output. Each queue item exposes project name, Linear priority/status, forecast, scope reminders, and dependency context; details contain Location, optional pause rationale when deferred, Extra scope points, and optional notes.

Support dragging within a stream, between streams, and from/to Needs assignment and Deferred. Use explicit insertion targets rather than timeline dates. Provide a non-drag Move action with a location and before-project choice, plus keyboard reordering. The same operation must work on touch and keyboard without requiring precise dragging.

Location changes and existing single/bulk assignment buttons use the same placement service. A location-only assignment appends at the last dependency-valid position, preserving existing members' relative order. For bulk assignment, use a stable topological order of incoming members, inserting each at the last valid position; do not reposition members already assigned there. Reject the whole mutation if no valid result exists. Repeating an already-satisfied assignment is a no-op.

Moving to Deferred removes the project from the active queue and excludes future demand; moving to Needs assignment removes its stream but keeps it selected. Resuming appends to its selected destination using the same valid-placement rule, rather than claiming its former queue slot.

### 3. Enforce precedence in both placement and calculation

Use the existing effective graph: imported Linear edges minus explicit waivers, plus local dependencies. For unfinished selected projects sharing a stream, every predecessor in the graph's transitive closure must appear before its successor, even when the connecting path passes through another stream. Completed, reconciled predecessors impose no queue-position restriction.

Validate the complete proposed affected queues, not only the moved item's direct neighbors. A move that reverses a relationship is rejected with the relevant projects and dependency path; it does not move another project automatically. Cross-stream projects have no globally comparable queue position: their forecast still waits until all effective predecessors finish in an earlier cycle. A missing, deferred, unknown, or external blocker remains visible and prevents a credible successor date; dragging cannot waive it.

New source dependencies can invalidate a saved order. Preserve that order, identify the conflict, and leave the affected lane's unfinished work without calculated dates until repaired or an existing explicit waiver resolves it. Other valid lanes remain usable, subject to their own dependencies. Dependency cycles retain the existing invalid-forecast behavior. Permit repair moves that reduce the existing set of order violations without introducing new violations, so multiple source conflicts can be repaired incrementally. Final validity is required before the lane resumes forecasting. Adding a local edge or restoring a waiver that would invalidate an otherwise valid lane returns an actionable conflict rather than silently reordering it.

The scheduler carries previously started forecast work across cycles, then fills free WIP slots from the earliest **eligible** projects in saved queue order. It skips a blocked project and can run later independent work. Queue position is selection preference, not a new finish-to-start edge between adjacent projects. WIP greater than one continues to permit overlap and equal budget sharing. User sequencing never preempts carried work within a single forecast run; editing the queue recalculates the run from its beginning.

### 4. Save sequence changes atomically with stale-write detection

Retain the existing workspace transaction lock. Return a `sequenceToken` fingerprint of assignments, selection state, queue positions, active stream IDs, completion/review facts relevant to ordering, and the effective dependency graph. Placement requests include the token plus package ID, destination, and optional before-package ID. Reject a stale token with HTTP 409 and refreshed sequencing information; never replay a stale drop onto different neighbors.

Validate destination, membership, uniqueness, dependency precedence, and token under the lock, then update both lanes atomically and return fresh board/forecast data. Include all mutation paths that affect sequencing: bulk assignment, deferral, stream retirement, dependency edits, source sync, and scenario activation. Server validation is authoritative; client preview highlights invalid targets and explains failures. On failure, retain the last saved order and keep focus on the moved card/control.

A token avoids a broader revision retrofit for unrelated board settings while preventing lost reorders and stale dependency decisions. Reuse the placement/validation service across mutation paths instead of maintaining UI-only restrictions.

### 5. Represent Extra scope as one remaining budget

Use one `package_extra_scope` record per package with positive finite remaining points, optional notes, captured unknown issue IDs, and an issue-scope baseline used to identify source changes. The user edits only Points and Notes (optional). Clearing the value or entering zero removes the record; negative or non-finite values fail validation. Keep thousandth-point precision and the current 100,000-point upper bound.

`demand = estimated open Linear issue points + remaining Extra scope points`

Saving a positive budget records all currently open unestimated issue IDs as covered, as well as a baseline of issue IDs, estimates, and open/closed state. The budget covers both these missing estimates and work not represented in Linear. Do not imply a per-issue allocation. A project without issues can be forecast provisionally from this budget alone.

When issue scope changes, retain the budget exactly and show **Review extra scope** with a compact change summary. Do not automatically consume it as estimates appear: the user confirmed manual adjustment. Newly appearing unestimated issues are uncovered until the planner saves a positive budget against the new issue set. Unknown demand without coverage still prevents a finite date. For covered demand, retain provisional dates and make possible overlap explicit; this reminder itself does not block save or publication.

The planner edits (or re-saves) the same remaining-points field after reviewing Linear. This acknowledges the current source baseline and replaces coverage with the current unknown issue set. No separate owner, date, required explanation, or approval step is added. Removing Extra scope does not resolve still-unestimated issues.

Example: 20 estimated points + 10 extra = 30 provisional points. An existing unknown issue gains 4 estimated points. Show 24 + 10 = 34 and Review extra scope until the planner changes the remaining budget to 6, restoring 30. If the 4 points are genuinely added work, keeping/re-saving 10 deliberately accepts 34. The software cannot infer which interpretation is correct.

Automatic consumption was rejected because it can hide newly added work. A total-project estimate with automatic subtraction was rejected because the requested input describes additional remaining scope, not a cap on the entire project.

### 6. Derive scoping reminders from forecast start

Store `scoping_lead_days` with the board's planning assumptions, default 14, configurable as a whole number from 0 through 365. Label it **Scope projects [14] days before start**. Capture it in scenarios so comparisons retain their own assumption; it is one board-wide setting, not an extra project field.

Calculate the forecast first, then derive readiness without feeding reminders back into scheduling:

- A selected project with positive Extra scope has generic scope. Its forecast remains provisional wherever it is in the queue.
- For a finite forecast start, `scoping due = forecast start local date − scoping_lead_days`, using calendar-date arithmetic in the connected team's timezone. Mark **Needs scoping** when the evaluation local date is on or after that date.
- An imported in-progress project with Extra scope needs scoping immediately; waiting for the next full forecast cycle would misrepresent current execution.
- Deferred projects and reconciled completed projects have no active scoping reminder. Selected generic projects without a forecast start show **Scoping date unavailable** alongside the existing forecast blocker, not an invented deadline.
- Removing generic scope clears Needs scoping only when no unresolved unknown issue demand remains. Otherwise show the existing missing-estimate action.
- Reordering, capacity/calendar changes, scope edits, or lead-time changes recalculate the derived date. If work moves outside the window, the reminder clears; no sticky audit state is needed. Scope-review reminders caused by changed issue data remain independent.

Evaluate live-board reminders using an explicit request-time clock, independent of the last Linear import timestamp. Re-evaluate on board fetch and on a client refresh at the next team-local date boundary while the page remains open; background jobs are unnecessary. Freeze evaluation time, lead days, due dates, and reminder results in saved snapshots/revisions. Reading an old revision must not age its badges or change its output.

Needs scoping and Review extra scope appear on project cards and in Planning attention with links to the scope editor. Neither suppresses finite provisional dates nor adds a publication gate. Missing finite demand, invalid dependencies, and source reconciliation unrelated to this reminder retain their separate explanations.

### 7. Version the transition without rewriting history

Use a new calculation version (`v1`) for queue-based scheduling and unified Extra scope. Published v0 revisions retain their stored inputs, output, provenance, and version; display adapters must not recalculate or mutate them. Comparisons explicitly identify differing calculation versions and separate Linear priority changes from local sequence changes.

Adapt legacy editable drafts when loaded into the new board, saving the conversion only through the normal draft-save flow. The same conversion rules apply to the live board migration:

1. Seed each lane using old priority rank then immutable ID; perform a stable topological sort to satisfy effective dependencies. Explain that start constraints and must-include are retired. Imported dependency cycles remain visible blockers rather than being discarded.
2. Preserve selected/paused, stream assignment, and optional pause notes. Remove obsolete fields from current writes, fingerprints, comparisons, and activation logic. Reject obsolete planning properties in current mutation requests with a clear unsupported-field error rather than letting them keep affecting forecasts invisibly.
3. Convert allowances using the **effective residual** of the old unestimated allowance plus discovery points, preserving the existing known-plus-allowed demand rather than summing the original budgets twice. Preserve notes from old rationales with kind labels where needed; historical owner and review date remain only in old snapshots. Carry old covered unknown IDs forward; do not silently cover previously uncovered issues. A zero residual without discovery becomes no Extra scope record.
4. Carry unresolved old issue-scope reconciliation forward as Review extra scope. Positive Extra scope receives the 14-day default scoping window. Legacy snapshots with no priority value show Unknown; a later source sync supplies the real value.
5. The first save of an adapted draft stores v1-shaped inputs/results. Rebase uses the current source and reports new dependency/order or scope conflicts. Activation must never restore retired controls or overwrite Linear priority from historical planning state.

Automatic dependency-valid seeding is limited to the one-time legacy conversion. Later sync never silently rearranges user queues.

## Risks / Trade-offs

- Manual scope adjustment can temporarily overstate demand when estimates replace generic work → keep the unchanged budget visible, label forecasts provisional, and surface an actionable source-change summary.
- A positive generic estimate cannot prove issue-level accuracy → describe it as planner-provided coverage; new unknown issues require re-saving coverage, and reminders never imply that an estimate has been verified.
- Dependency changes can leave a formerly valid lane without dates → preserve the user's sequence, explain the exact conflict, and support incremental repair with the same move controls.
- Queue order can be mistaken for strict serial execution → display WIP and actual forecast starts; explain why blocked work is skipped and why WIP permits overlap.
- Old scenarios have different calculation semantics → freeze published results, clearly label versions, and test conversion using snapshots containing every removed field and both allowance kinds.
- Native HTML dragging alone has weak touch/keyboard usability → require equivalent non-drag controls and validate pointer, touch, and keyboard workflows before selecting an implementation library.

## Migration Plan

1. After design review, create linked implementation Beans from `tasks.md` with dependencies. Beans own execution status; the OpenSpec checklist is reconciled from that status.
2. Add schema fields/tables and idempotent conversion support. Keep legacy fields readable for compatibility during rollout. Do not rewrite stored scenario JSON or remove legacy data in this migration.
3. Land v1 board/forecast, source import, scope calculation, scenario adapters, and accessible UI together. Update the scheduling contract/product design and run the task-specific tests plus the integration checks.
4. Verify converted totals, ordering, source sync, scenario round-trips, and frozen historical output against the specs before completing implementation Beans.
5. Rollback requires restoring the pre-migration database backup and application together: new sequence/scope decisions do not have a lossless representation in the old model. Do not serve a downgraded application over v1 planning state.
6. Archive only after implementation and validation are complete, retaining links from implementation Beans to the archived artifacts.
