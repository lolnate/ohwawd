# Scheduling and scenario contract

## Current calculation: v5 for activated roadmap planning

Activated roadmap Board reads, scenario saves and new publication now use **v5**. [Scenario compatibility](scenario-v5-compatibility.md) preserves membership/ranks/scoped order, explicit legacy conversion and frozen lifecycle history; the temporary publication pause has been removed. Pre-activation reads retain v4 scheduling. Published historical results are never recalculated by this change. Compact Board controls are implemented; immediate-prerequisite timeline appearances/connectors and their visible dependency context remain in the dependent timeline task.

### Inputs and selection

- Each scheduled project has `roadmapState='included'` and one linked owning outcome with a positive saved rank in the same active stream. Candidate, dismissed and deferred demand is excluded; stale `selected` flags cannot include it. Invalid/missing ownership or membership is explained without scheduling an ownerless charge.
- Expand every outcome's minimum-required links through the full effective dependency closure. Its portfolio-wide union is the **required tier**; other included work is optional tier. An optional project becomes effectively required only through a minimum-required link or a real dependency path, never merely because it appears as a shared reference.
- Carry the single project already started in a prior simulated cycle while unfinished. Otherwise select one eligible project per stream by `(required tier first, owning outcome rank, project sequence within that owner, stable package ID)`. No rank is donated from a higher-ranked dependent to a lower-ranked prerequisite owner, and Linear priority/manual completion markers are not scheduling inputs.
- Dependencies remain finish-to-start: a predecessor completing in cycle C unlocks its successor in a later cycle. Actually reconciled-complete work satisfies dependencies before C1 even when excluded from the roadmap. Unfinished excluded or unavailable prerequisites remain unresolved; neither dismissal nor deferral satisfies an edge.
- Required-tier work can run before a higher-ranked outcome's optional-only work. Started optional work is carried rather than preempted when required work later becomes eligible. Priority therefore does not guarantee finish order.

The approved same-stream example has H ranked 1 owning B, M ranked 2 owning C, L ranked 3 owning A, and A → B. With 5 points each and 10 points/cycle, **C runs in C1, A in C2, B in C3**. Moving L above M produces A, B, C. There is no automatic rank edit or duplicate prerequisite charge.

### Capacity, conflicts and honest dates

The existing availability/calendar, reserve, allocation, thousandth-point rounding, one-project execution slot and no-borrowing rules continue to apply. Unused budget does not start another project in the same stream/cycle. A positive-demand project is not assigned a start in a zero-budget cycle; explicitly estimated zero-demand work still waits for its dependencies and occupies its chosen cycle slot without consuming points. When Linear aggregate remaining project scope is unavailable, unknown issue estimates without acknowledged Extra scope still prevent finite completion. Projected-cycle provenance remains independent of ownership and outcome priority.

Within one owner, source-introduced direct/transitive precedence conflicts preserve saved project order and withhold unfinished dates for that owner. Other valid owners in the same stream remain schedulable subject to their dependencies. Cross-owner same-stream priority inversions are dependency waits rather than queue-order conflicts. Effective dependency cycles remain invalid for forecasting.

### Structured wait and bypass output

Activated `forecast.outcomes[]` has two additive fields (older outputs can lack them):

- **`waiting`**: deduplicated prerequisite identity/full name, owning outcome/stream or excluded/unavailable state, affected `successorIds`, whether it gates required delivery, first/last simulated waiting cycle, eventual `forecastFinish`, unresolved `reason`, and an inspection/include/resume/source-review action. Required scope includes deeper prerequisites; optional-only context does not silently gate delivery. Missing setup uses null cycle context without inventing dates. A finite prerequisite forecast does not mean it is actually complete now.
- **`priorityBypass`**: each newly selected lower-ranked project, its owner and cycle, plus the more-preferred local owned projects blocked by dependencies and the prerequisite IDs they were waiting for. This records actual simulated choices, not a strict completion-order guarantee. It is not emitted merely for unknown estimates, zero capacity, required-before-optional selection, or non-preemptive carry when a higher-ranked project is independently eligible.

Wait intervals describe dependency constraints encountered during the forecast; they can remain explanatory even when that prerequisite eventually receives a finite forecast. Current saved source facts remain authoritative. The later Board presentation can target project inspection using the supplied prerequisite IDs without parsing prose or requiring connector graphics.

### Shared actual-completion and closure helpers

`src/lib/delivery-scope.ts` exports `isActuallyComplete`, `effectivePredecessors` and `effectiveRequiredClosure` for forecast and subsequent lifecycle work. Actual completion requires completed source status, zero open issues, no remaining Extra scope, no missing-source review, no cross-team decomposition and no unresolved external blockers. A canceled status or a forecast finish is insufficient. Closure retains missing nodes as unresolved scope, deduplicates source/local edges, excludes waived edges and terminates safely on cycles without mutating input data.

Verification is recorded in `ohwawd-d92k` and `tests/outcome-priority-forecast.test.ts`: priority/tier/carry examples, excluded versus actual completion, scoped conflicts, deep/missing/waived constraints, unknown/zero demand, capacity conservation, deterministic tie-breaks and activated PGlite Board/rank/source integration.

Scheduler-core verification passed: typecheck, **116 unit/database tests** (including 18 new outcome-priority/closure/integration cases), production build, **54 affected browser tests**, strict current-spec/change and archived-checklist validation, and whitespace checks. The browser regression suites cover assignment, catalog/sidebar, ownership, workspace organization and Settings editors; new scheduling acceptance evidence comes from pure and activated PGlite tests rather than a completed Board-control walkthrough. No existing database was migrated during this task.

## Legacy calculation: v4 before roadmap activation

**Implemented successor:** [implement-outcome-first-board](../openspec/changes/archive/2026-10-25-implement-outcome-first-board/design.md) defines v5 outcome-priority scheduling, explicit roadmap membership and compatibility rules. Manual outcome completion remains a workspace business fact independent of scheduling and scenario activation.

The [data foundation](roadmap-migration.md) provides migration 6's additive storage and migration 7's coordinated writer activation. Before activation, nullable fields preserve v4 selection semantics. Activated plans use v5 scheduling and versioned scenario publication. The v4 rules below describe legacy results; existing published inputs/output/version remain frozen. [Mutation contracts](roadmap-mutations.md) document the delivered activation stage.

V4 forecasts execute at most one project per stream per cycle, regardless of outcome or saved legacy WIP limit. Carry unfinished work first; otherwise select the earliest eligible project in queue order, skipping blocked projects. Another project in that stream cannot start until the cycle after its predecessor finishes. Independent streams may run concurrently, unused budgets are not borrowed across streams, and moving a project recalculates its forecast. New streams have WIP one; older saved WIP limits above one cannot enable overlap. Older published revisions retain their frozen results; older editable drafts display a conversion notice and must be loaded and saved before publishing under v4.

## Projected calendar introduced in v3, retained in v4

Calendar labeling and projection requirements are maintained in [cycle calendar](../openspec/specs/cycle-calendar/spec.md), with design and verification in the [archived projection change](../openspec/changes/archive/2026-10-20-project-linear-cycle-calendar/).

Cycle labels prefer the name visible in Linear. A source cycle with internal ordinal 26 and name “Cycle 46” displays as Cycle 46 / C46; its ID and ordinal remain source metadata. Numbered name suffixes continue in projected cycles, independently of internal ordinals.

The planning calendar extends beyond the latest imported boundary using the connected team's enabled cycle configuration: duration and cooldown in weeks, starting weekday and timezone. Projected boundaries retain the source boundary's local clock time across DST. Known source dates and gaps are preserved; projection only appends after the last actual cycle, and cooldowns supply no cycle capacity. Missing/invalid settings or a missing dated anchor leave the imported calendar usable with an explanation instead of inventing a cadence.

The extension covers the configured forecast horizon and at least 26 visible calendar weeks. Synthetic projected entries are never written to Linear or the Linear cache; the next refresh replaces them with actual IDs/names/dates and regenerates later assumptions. Week headers mark projected labels with an asterisk. Date calendars show them as view-only, while weekly availability remains editable by calendar date.

V3 forecasts may use projected cycle capacity. Those packages and required outcomes are provisional and explicitly identify projected cycle dates. V3 snapshots freeze the resolved calendar, cadence/provenance and output; published v0/v1/v2 results remain intact. Older editable drafts retain their planning inputs and transition explicitly when saved under the current version.

## Capacity and timeline rules introduced in v2, retained in v4

The calendar requirements are maintained in [planning timeline](../openspec/specs/planning-timeline/spec.md) and [weekly capacity](../openspec/specs/weekly-capacity/spec.md). Design and acceptance evidence are in the [archived calendar change](../openspec/changes/archive/2026-10-20-month-week-planning-timeline/).

Stream timelines are month-first and subdivided into Monday-start calendar weeks, with compact scrolling and sticky project labels. Resolved imported/projected cycles supply scheduling buckets and secondary timeline context. Unsupported dates, including cooldowns, remain shaded without cycle capacity; blocked projects explain their predecessors, and unfinished projects get continuing bars without asserted completion dates.

V2 adds weekly availability. The live-board default is a labeled 50% planning preset for US Thanksgiving week, Christmas week and the following week. It can be disabled, and explicit date-based week overrides (0–100%) take precedence. Week assumptions are evaluated in the team's timezone and apply across cycle boundaries.

For each Monday–Friday date belonging to an imported cycle, use explicit weekly availability first, then an enabled holiday preset, then cycle availability (default 100%). Average those values. For a cycle with no weekdays, use its calendar dates instead. Multiply baseline by that effective availability, subtract reserve once, then apply the stream allocation. Overlapping 50% week/cycle assumptions yield 50%, not 25%; a fortnight with one full week and one half week yields 75%.

V2 and later snapshots capture weekly overrides, enabled state and resolved holiday dates. Comparisons identify the changed assumptions and calculation versions. Published earlier results remain frozen. Loading pre-weekly editable drafts defaults to no weekly overrides and disabled holiday presets, preserving former capacity assumptions until deliberately changed.

## Assignment and sequencing rules introduced in v1, retained in v2

The maintained requirements are the OpenSpec capabilities for [project assignment](../openspec/specs/project-assignment/spec.md), [stream sequencing](../openspec/specs/stream-sequencing/spec.md), and [project scope readiness](../openspec/specs/project-scope-readiness/spec.md). The design and verification evidence are in the [archived change](../openspec/changes/archive/2026-10-20-simplify-project-assignment/). V1 replaces local priority ranks, preferred/hard start dates, must-include, and categorized allowances. The historical v0 contract below explains frozen legacy results; it does not govern new edits.

### Source priority and stream sequence

Linear owns project priority. The board displays it read-only, including No priority and Unknown for legacy data. Sync reports priority changes but never rearranges an existing queue.

Each stream has a saved ordered project queue. Dragging or equivalent keyboard/touch Move controls changes that order or moves work between streams and shelves. Assignment without an explicit insertion target uses the last dependency-valid position. Bulk assignment inserts incoming work in stable topological order and leaves existing members in place. Mutations are atomic, and a stale sequencing token requires refreshing instead of overwriting another edit.

Effective dependencies remain `(Linear edges − explicit waivers) ∪ local edges`. An unfinished predecessor must precede its successor in the same stream, including transitive paths through other streams. Cross-stream successors still wait until the cycle after predecessor completion. A move cannot waive a dependency. Local edges or waiver restoration that contradict a valid queue are rejected with the required precedence.

Source changes can introduce order conflicts. They preserve user order and identify the dependency path. Affected lanes have no unfinished-work forecast until repaired; unrelated valid lanes continue normally. Repair moves may reduce existing violations incrementally without introducing new ones. Dependency cycles remain invalid for forecasting.

V1–V3 filled WIP slots from the earliest eligible projects in queue order, skipping blocked heads. Queue adjacency was not a dependency: a WIP limit above one permitted overlap and equal budget sharing. V4 replaces this with one execution slot per stream as described above.

Moving to Needs assignment preserves selected demand without a stream. Deferred work consumes no future capacity and has no active queue position. Pause rationale is optional even for in-progress work; deferral does not change execution in Linear.

### Extra scope and scoping readiness

One Extra scope value is the remaining generic budget beyond Linear's aggregate remaining project scope, or beyond estimated open issues when aggregate scope is unavailable. It covers acknowledged unestimated issues and work not yet represented in Linear. Saving positive points captures current unknown issue IDs and an issue-scope baseline; no category, owner, review date, or rationale is required. Blank/zero removes the budget. Missing estimates without coverage prevent a finite forecast only when usable aggregate remaining scope is unavailable.

Demand is `Linear aggregate remaining project scope + remaining Extra scope` when aggregate scope is available; otherwise it is `estimated open issue points + remaining Extra scope`. Aggregate remaining scope is total project scope minus the latest completed-scope history value. Any Extra scope makes dates provisional. New source estimates never automatically consume Extra scope: scope membership, estimate, or completion changes show Review extra scope. The planner adjusts or re-saves the remaining points to acknowledge the current source.

The board-wide scoping lead time defaults to 14 calendar days and accepts whole numbers from 0 through 365. A selected generic project's due date is its forecast-start local date minus lead days in the team's timezone. Needs scoping begins inclusively on that local date. In-progress selected projects need scoping immediately; deferred and reconciled-complete work has no active reminder. An undated selected generic project shows Scoping date unavailable with its existing blocker.

Readiness is derived after forecasting and never feeds back into demand or eligibility. It recalculates on planning changes, fetch, and local-date rollover without requiring a Linear sync. Moving work farther out can clear Needs scoping, but not an independent Review extra scope reminder. Saved scenarios capture the setting, evaluation time, and reminder output; published reminders do not age when read later.

### Scenario compatibility

V1 and later snapshots retain queue positions, source priority, one Extra scope budget and its coverage baseline, the scoping window, evaluation time, and calculated reminders. Dirty detection tracks planning inputs rather than the changing evaluation clock. Comparisons separate local placement from Linear priority and identify calculation versions.

Legacy editable drafts are adapted when loaded and converted when saved. Queue seeding uses old rank then immutable ID as the stable topological preference. Preferred/hard starts and must-include no longer affect new forecasts. Extra scope is the effective residual unestimated allowance plus discovery, with former rationales retained as optional notes. Existing unknown coverage is preserved rather than expanded. Published v0 revisions retain stored inputs, outputs, and version, including legacy fields; reading/comparing them never recalculates their historical forecast.

## Historical calculation: v0

The following contract is retained to explain published v0 snapshots. New snapshots use v4 and comparisons identify differing calculation versions. Published historical inputs and outputs remain immutable.

### Original v0 contract

This is the normative contract for the first product proof. The forecast is a cycle-level planning heuristic, not a promise of a day of delivery. All calculations use the frozen inputs identified by a scenario revision. Rules for multiple capacity-owning teams and split Linear projects are described as extensions below; those forecasts require a later calculation version.

## Vocabulary and lifecycle

- **Linear execution state** is imported evidence: planned, in progress, completed, canceled, or another source status. It is never overwritten by a scenario choice.
- **Selected** means the scenario includes a package's remaining demand. **Paused** means the scenario excludes its future demand. The board may label paused work “Deferred,” but deferral is a planning decision, not a Linear status.
- **Needs assignment** means a package is selected but lacks an active stream or capacity-owning team. It remains visible in selected demand and prevents a delivery forecast for any minimum-required outcome that depends on it.
- **Must include** is an optional local planning constraint. Pausing such a package requires an explicit override and rationale. The word “committed” is reserved for an annotated business decision, not a scheduler state.
- **Complete** is an execution fact. A completed Linear project has zero forecast demand after its issues and allowances are reconciled. A planning-only package is marked complete by its owner, with an audit event. Any mismatch between project status, open issues, and allowances requires review rather than silently setting demand to zero.

An in-progress Linear package enters a newly created draft selected. A scenario may model stopping its remaining work from the next full cycle, with an explicit “pause in Linear separately” warning and a recorded rationale. The model does not claim that changing a scenario stopped execution. Work already performed is never undone. This behavior is confirmed for the first proof.

## Scenarios and shared state

One workspace can have many named scenarios. Each has an editable **draft** and zero or more immutable **published revisions**. Saving persists the draft and increments its edit version; it does not make a decision official. Publishing validates the draft, records a rationale and author/time, and freezes a published revision. One published revision may be designated the **baseline** for comparisons. A new workspace has no baseline until a revision is published and designated. The term “working plan” in earlier drafts means the currently open draft; it is not another state.

The scenario revision freezes: selected/paused and must-include flags; package-to-stream assignment and stream order; explicit package priority order; stream definitions, WIP limits, and allocations; team baseline override, reserve, availability factors, and cycle calendar; package estimate allowances and issue assignment; earliest and preferred start cycles; local dependencies and waivers of imported dependencies; outcomes, their minimum-required/optional links, targets, and target interpretation. It also references a frozen Linear source snapshot and a calculation version. Workspace membership and the current Linear cache are global, but cannot alter a published revision's result.

Sync creates a new source snapshot. It marks drafts as stale but does not change their input snapshot or published revisions. Rebase is an explicit preview and acceptance step that reconciles new/changed issues, estimates, project statuses, and dependencies before updating the draft. Optimistic locking applies to draft saves: the client sends the draft edit version; a stale save is rejected with the changes since that version and options to reload or fork. There is no silent last-write-wins merge. Publishing a stale draft requires rebase or an explicit “publish against older Linear snapshot” confirmation that is visible in the revision.

A read-only shared link opens a published revision with its outcomes, timeline, capacity assumptions, source as-of time, estimate provenance, dependency waivers, and decision rationale. It does not expose a mutable draft or a Linear API key. In the private product proof, only the workspace owner can publish. The first shared release adds invited viewer and planner roles; planners can save drafts, while the owner can publish and manage the Linear connection. Drafts may be archived. Published revisions and audit events are retained for decision history; deletion and retention controls need a separate policy before external customers are onboarded.

## Demand reconciliation

In v0, each eligible imported Linear project has exactly one Linear-backed work package. It owns all open issues in that project. A project with open issues belonging to other teams is visible but excluded from the single-team forecast until decomposed in a later calculation version. Remaining issue demand is the sum of explicit estimates on open issues in the frozen source snapshot. A missing estimate is unknown, never zero and never silently treated as Linear's configured default. A project with no issues can still have a planning-only allowance.

Each allowance has a kind, points, owner, review date, and rationale:

1. **Unestimated-issue allowance** covers a named set of currently unestimated issue IDs. The set has a positive finite point budget; zero is not coverage. At rebase, newly estimated issues from that set contribute their own estimates and the allowance's residual falls by those newly known points, to a floor of zero. If an issue closes without an estimate, or new issues appear, the draft needs reconciliation before publish.
2. **Discovery allowance** covers work not represented by current issues. New issues do not automatically consume it: the planner explicitly identifies which new issues replace discovery scope. Until that decision, publishing is blocked by a possible double-count warning.
3. **Planning-only estimate** is the finite effort for a package with no Linear issue mapping. It remains provisional until linked to Linear work or manually completed.

No allowance may claim the same missing issue twice. Demand is `estimated open issue points + residual unestimated-issue allowance + discovery allowance + planning-only estimate`, using only the relevant terms for that package. A selected package with any uncovered unknown issue has no finite completion forecast. The UI may show the known-demand lower bound, but the outcome is labeled **Unforecastable**. A finite allowance permits a **Provisional** cycle forecast; it is not shown as a confident commitment. An optional package with unknown demand does not block the minimum-outcome forecast.

Later project decomposition assigns each Linear issue to exactly one package or to a visible unassigned remainder. Percentage splits and duplicate issue claims are not allowed. The sum of package issue demand must equal project open issue demand. A team or stream change moves the package and its issue ownership together. This avoids maintaining a second issue status system while preserving a path to cross-team project forecasts.

## Dependency and outcome semantics

Imported Linear project dependencies are active constraints by default and carry a Linear badge. Local package dependencies add to them and carry an Oh, WAWD! badge. In v0, one package per project makes a Linear project edge a package edge. A scenario can waive an imported edge only with a visible reason; this affects the forecast here and does not modify Linear. The effective dependency set is `(imported edges − explicit waivers) ∪ local edges`. Reject local edits that create a cycle. A source snapshot containing a cycle is invalid for forecasting until reviewed.

Each outcome link is **minimum required** or **optional/stretch**. The first delivery cycle is the latest finish of the minimum-required packages and their effective dependency closure. An optional package that blocks minimum-required work is therefore effectively required, and the UI explains this. Other optional work is shown separately as later value. If a minimum-required package is paused, unassigned, unknown, or blocked by a paused predecessor, the outcome has no forecast date and explains why. An outcome with no minimum-required link is **Unplanned**. This supports a minimum viable launch without requiring every enhancement to finish first.

## Cycle boundaries and capacity

The connected Linear team supplies the time zone, cycle numbers, cycle IDs, and start/end timestamps. All target dates and cycle ends are compared as dates in that team's zone. Internally, v0 forecast cycle `C1` is the first imported Linear cycle whose start timestamp is strictly later than the latest source refresh timestamp; the UI shows its actual Linear cycle number (for example, Cycle 45). The current partial cycle is displayed as execution context but not counted as available forecast capacity; this is conservative. Individual cycle date changes in Linear replace the cached boundaries on refresh. Availability and reserve exceptions refer to stable Linear cycle IDs. If the configured horizon lacks imported or valid cadence-projected cycles, the forecast stops without fabricating capacity. Scheduling and target evaluation remain cycle-level: a predecessor finishing in cycle `C` unlocks its successor in the next cycle. The timeline alone sizes a finite bar through the consumed fraction of its final cycle so scope/capacity proportions remain visible; this visual interpolation does not claim an intra-cycle successor start or a precise daily commitment.

The baseline rate is the median completed estimated points from up to six comparable, completed cycles of the same length, with at least three observations; for an even count, use the mean of the two middle values. Otherwise the planner supplies a labeled provisional rate. The baseline includes all estimated work completed by that team. For each future cycle, the planner sets an availability fraction between 0 and 1 for known leave/holidays and a reserve in points for expected non-roadmap work that is *not* also represented by selected packages. The calculation is:

`team available points(C) = max(0, baseline points/cycle × availability fraction(C) − reserve points(C))`

Availability is a cycle-level assumption, not an assertion that delivery is linear through the cycle. The default fraction is 1 and default reserve is 0 until set by the planner; an unset baseline blocks a capacity forecast. The UI shows the historical observations, explicit assumptions, and the source of each adjustment. A what-if capacity control changes the scenario's baseline rate and produces another deterministic forecast; it is not a confidence interval or probability.

In v0, each stream has one scenario-wide allocation percentage. The onboarding screen suggests an equal split across the default five streams, but the planner must confirm or edit it before a forecast appears. The sum of active-stream allocations is at most 100%; there are no per-cycle overrides or automatic borrowing. Each cycle's stream budget is `team available points(C) × allocation(stream)`. Unused budget remains unused, including when the stream's work is blocked. The planner may explicitly change allocations in a draft and compare the result. A new stream starts at 0%; a retired stream returns its allocation to the unallocated pool. All calculations retain thousandths of a point internally and round only for display.

## Deterministic scheduling order

For each cycle, process streams by stable stream ID. The stream ID order does not change results because streams do not borrow from one another in v0. Within each stream:

1. Carry forward packages started in an earlier cycle that still have demand. They occupy WIP slots. The scenario-wide WIP limit is a positive integer; a new draft recalculation starts from an empty schedule, so carried work cannot exceed that limit.
2. A new package is eligible only if it is selected, assigned to this active stream and team, has finite remaining demand, its hard earliest-start cycle has arrived, and every effective predecessor finished in a previous cycle. A completed package needs no capacity.
3. Fill remaining WIP slots in this order: packages whose soft preferred-start cycle has arrived first; then scenario priority rank (lower number first); then preferred-start cycle (earlier first); then immutable package ID. A package with a future preferred start can start early if a slot remains. An absent preferred start counts as the first forecast cycle. Priority ranks may tie; stable ID resolves that tie. Linear priority is displayed but does not silently affect scheduler order.
4. Split the stream's cycle budget equally among its active packages. If one package needs less than its share, redistribute its unused share equally among the still-active packages until the budget is exhausted or all finish. A package that finishes early does not free a WIP slot for a new package until the next cycle. No package consumes more than its remaining demand.
5. At cycle end, record points consumed, remaining demand, completed packages, idle stream capacity, and newly unblocked dependencies. Continue to the next cycle until all finite selected demand is scheduled or the configured horizon ends. Items beyond the horizon read “Beyond horizon,” not “Never.”

Start-window dragging writes a **soft preferred-start cycle**. A hard “not before” rule is a separate explicit control. Neither can override dependencies. Calendar unavailability, then team capacity, then stream allocation, then dependencies/earliest start, then WIP and ordering determine the result. There is no hidden second priority system.

### Worked example

The team has 12 points/cycle and a 2-point reserve, leaving 10. Stream A receives 60% (6 points), has WIP 2, and contains A1 (8 points) and A2 (4 points), both eligible. Stream B receives 40% (4 points) and contains B1 (4 points), which depends on A1. All preferred starts and ranks are equal; IDs sort A1 before A2 if a tie matters.

| Cycle | Stream A | Stream B | Why |
| --- | --- | --- | --- |
| C1 | A1 uses 3; A2 uses 3 | 4 idle | B1 is blocked; A's two packages split 6 equally |
| C2 | A2 uses its last 1; A1 uses 5 after redistribution | 4 idle | A1 completes at C2 end; B1 cannot start in C2 |
| C3 | 6 idle | B1 uses 4 | B1 was unlocked by A1 at the previous cycle end |

An outcome requiring A1 and B1 first delivers at **C3 end**. If A's WIP were 1, A1 would consume 6 in C1 and its last 2 in C2; A2 would wait until C3, but B1 would still become eligible in C3. If both A packages had equal rank with WIP 1, immutable ID would select A1 first. Reallocating B's idle capacity to A changes this example only through an explicit scenario edit.

## Proof boundary and deferred rules

V0 proves one decision loop: read-only Linear import for one team, one package per project, minimum-required outcome links, default five streams, cycle-level capacity, effective dependencies, two saved drafts/revisions, and side-by-side scenario comparison. The confirmed proof UI fixes the stream count at five. The schema uses stable stream IDs, and the first usable release includes the add/retire workflow in the product design. V0 excludes Linear writes, multi-team capacity calculations, issue-to-package decomposition, public sharing, and advanced drag interactions.

Before multi-team forecasting ships, the calculation version must define team-specific cycle calendars, per-team stream allocations, and how cross-team WIP slots are selected. The interface will show per-team point totals and utilization rather than summing unlike scales. Published v0 revisions remain reproducible under the v0 contract.
