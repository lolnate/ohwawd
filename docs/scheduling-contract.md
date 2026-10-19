# Scheduling and scenario contract (proposed v0)

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

The connected Linear team supplies the time zone, cycle numbers, cycle IDs, and start/end timestamps. All target dates and cycle ends are compared as dates in that team's zone. Internally, v0 forecast cycle `C1` is the first imported Linear cycle whose start timestamp is strictly later than the latest source refresh timestamp; the UI shows its actual Linear cycle number (for example, Cycle 45). The current partial cycle is displayed as execution context but not counted as available forecast capacity; this is conservative. Individual cycle date changes in Linear replace the cached boundaries on refresh. Availability and reserve exceptions, as well as package start preferences, refer to stable Linear cycle IDs, so they follow the same cycle if its date or number changes. No local cycle-length or anchor override is used. If Linear has not created enough upcoming cycles for the selected horizon, the forecast stops at the last imported cycle and reports the missing calendar coverage; it never fabricates later cycle dates. A package finishes at the end of the cycle in which its remaining demand reaches zero. A predecessor already complete in the source snapshot is satisfied before `C1`, once its source data is reconciled. No within-cycle interpolation is shown. A predecessor finishing in cycle `C` unlocks its successor in the next imported cycle. A date target inside a cycle is met only if the package finished by the previous cycle end; a target on a cycle-end date can be met by that cycle.

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
