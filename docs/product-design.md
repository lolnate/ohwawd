# Oh, WAWD! — initial product and technical design

Status: proposed design, 15 October 2026. Initial scope: the Sequencing Board.

The exact first-proof calculation and state rules are in [scheduling-contract.md](scheduling-contract.md). This document describes the product direction and staged delivery; the contract governs behavior when the two differ.

Confirmed proof boundaries: an in-progress Linear package may be paused in a scenario from the next full cycle, and the proof uses the default five streams with no stream-count editor. Stream add/retire remains in the first usable release.

## The decision this product helps make

In a planning conversation, a product leader should be able to ask, “Can we deliver this outcome by January?” The engineering leader should be able to show the linked work, what else is using capacity, which dependencies govern the date, and what changes if a project is deferred or a stream gets more capacity. The answer must be explainable, saveable, and honest about missing estimates.

Linear is the system of record for execution. Oh, WAWD! owns the planning layer: product outcomes, scenarios, stream assignments, capacity assumptions, forecast dates, and decision history. Changes to planning scope do not silently change Linear projects or issues.

Linear already supports project timelines and end-to-start project dependencies, and it estimates upcoming cycle capacity from recent velocity. Oh, WAWD! should build on those facts. Its distinctive job is to connect product outcomes to a conserved capacity model and compare explicit portfolio tradeoffs across saved scenarios. [Linear timeline](https://linear.app/docs/timeline), [Linear cycles](https://linear.app/docs/use-cycles).

## Impactful design elements worth keeping in mind

- A five-row timeline that groups related work into outcome-level execution projects.
- A target line, capacity summary, and immediate recalculation when scope or the weekly rate changes.
- Presets for a proposed focus, a minimum demo, and everything funded.
- A project drawer that shows underlying work and estimate provenance.
- Visible paused work, plus an explicit distinction between changing a filter and changing what is funded.

These behaviors are worth keeping. The reference also reveals the main design work ahead: its project data and dates are embedded in the page; changes are saved only in browser storage; bars in each row are scheduled one after another; one stream is actually a deferred bucket; and its stream capacity shares total 120% (25% + 20% + 35% + 20% + 20%). A production forecast must conserve each team's capacity, model dependencies explicitly, and share saved decisions among users.

The reference contains organization-specific project details. We will not copy the HTML or its embedded data into this repository. Product behavior is the reusable part.

## Product principles

1. **Start with the outcome.** A customer or business outcome can exist before any Linear project does.
2. **Keep execution in Linear.** Imported project fields link back to Linear; planning fields live here. Explicitly creating a Linear project is a separate user action.
3. **Show the math.** Every forecast exposes its source cycles, scope estimate, reserve, stream allocation, and blockers.
4. **Make uncertainty visible.** Unknown size is not zero size. A date based on a planning allowance looks different from one based on estimated issues.
5. **Make decisions reversible.** Saved drafts can be revised; published revisions are frozen, and one may be designated as the comparison baseline.
6. **Prefer one useful board.** The graph view is a later lens on the same relationships, not a second planning model.

## Core concepts

| Concept | Meaning | Source of truth |
| --- | --- | --- |
| Outcome | Desired customer or business change, owner, success signal, and needed-by date | Oh, WAWD! |
| Linear project | Execution container with status, dates, issues, and URL | Linear; cached here |
| Planning item | Work not yet represented by a Linear project | Oh, WAWD! |
| Work package | One schedulable piece of project or planning-item effort, with a capacity-owning team and a planning stream | Oh, WAWD! |
| Stream | A configurable focus lane with a stable ID, name, WIP limit, and team-capacity allocation | Oh, WAWD! |
| Team capacity pool | A team's cycle throughput, calendar, and estimate scale; separate from the streams used to plan its work | Linear observations; Oh, WAWD! assumptions |
| Dependency | A finish-to-start requirement between work packages; may cross streams | Oh, WAWD! |
| Target | A broad delivery date, such as a January launch, attached to outcomes or milestones | Oh, WAWD! |
| Scenario | A saved set of scope, priority, allocation, reserve, and scheduling assumptions | Oh, WAWD! |

An outcome can depend on multiple projects, and one project can contribute to multiple outcomes. Linking the same project to two outcomes never doubles its capacity cost. A project spanning two streams or two teams has distinct work packages with separately estimated effort; the project finishes when its required packages finish. It may appear in two lanes, with each card labeled by its team's contribution and linked to the same project detail. A stream is a planning focus lane, not a synonym for a Linear team or a fixed group of engineers.

## Sequencing Board

The main screen should read from top to bottom:

```text
Oh, WAWD!   [Scenario: January plan ▾] [Compare] [Save] [Share]
January target · cycle ending 22 Jan     Forecast: at risk     1,420 / 1,280 pts
Available / selected / unestimated     Critical blocker: Identity

Outcomes due by target     [show linked work] [add outcome]
──────────────────────────────────────────────────────────────
Stream 1   [project A ━━━━━]        [project C ━━━]
Stream 2       [project B ━━━━━] [project D ━━━]
Stream 3   [project E ━━━━━━━━━]
Stream 4         [project F ━━━━━]
Stream 5   [project G ━━━]        [project H ━━━]
          [+ Add stream]
──────────────────────────────────────────────────────────────
Needs assignment           [selected project I] [unplanned outcome]
Deferred                   [paused project J]
```

The board starts with five parallel streams, but the workspace can add or retire streams. They are focus lanes, not a required serial chain or a proxy for headcount. A lane has a configurable focus limit, initially one active package; a planner can overlap work with an explicit capacity split and a visible WIP warning. The Needs assignment shelf holds newly imported candidates and selected work without a stream. Selected unassigned work has visible demand, but no credible delivery date until it is assigned. The separate Deferred shelf holds paused work and consumes no forecast capacity; moving work marked “must include” there requires an explicit override.

The header answers four questions without opening a detail view: what target is being discussed, whether linked outcomes fit, how much capacity is available and selected, and what most threatens the target. The point total shown above is valid only in the initial single-team context. When more teams are present, the header shows each team's points and capacity utilization separately, plus one overall outcome risk verdict; it never sums unlike point scales. The timeline shows only the useful planning horizon, with week/month zoom. A target is a vertical line; milestone markers are distinct from project bars. Bar width represents forecast cycles, not importance or a precise daily completion date. A project card/drawer shows linked outcomes, Linear status and URL, work packages, estimate basis, dependencies, and the assumptions behind its forecast.

Default interactions:

- Drag a bar to change its preferred cycle, or enter a hard earliest cycle in the detail panel; the distinction remains visible.
- Link a project or planning item to an outcome; create an outcome directly from the board.
- Select/pause a work package within a draft scenario; immediately see target fit and the displaced work.
- Add a dependency by choosing “blocked by”; reject cycles and show the affected chain.
- Change a stream allocation or target date and preview the delta before saving.
- Add, rename, reorder, or retire a stream with a preview of affected work and forecasts.
- Open a comparison of two saved scenarios: scope added/removed, forecast dates, target gaps, and capacity by stream.
- Filter visibility without changing scenario funding. These controls must be visually separate.

The first version can use an accessible timeline with explicit start, dependency, and stream controls. Dragging is an enhancement, not the sole editing path. A later graph lens can size nodes by remaining points and color them by target risk; it should answer “what does this unlock?” and “what is the cost?” without replacing the board.

### Changing the stream configuration

Five is an onboarding default, not a schema limit. A planner can add a stream with a name, focus limit, and capacity allocation. A new stream begins empty with zero allocated capacity; the planner explicitly moves capacity from unallocated headroom or other streams before it can produce a forecast. Renaming or reordering a stream keeps its stable ID and does not change project links.

“Remove” means **retire**, with a review step. The app lists every package in the stream, including selected, in-progress, and paused work, their dependent work and outcomes, the draft scenarios referencing the stream, and the forecast effect. For each package the planner chooses another active stream or Needs assignment while preserving its selected/paused state. Selected work moved to Needs assignment has its outcome forecast marked blocked; it is not silently paused. The retired stream's allocation returns to the unallocated pool until deliberately reassigned. Apply the migration to the active draft atomically, record who made it and why, and leave published scenario revisions intact. Other drafts that still reference the retired stream must reconcile it before publication. The retired stream remains in history and may be restored.

This keeps stream count adjustable without rewriting past decisions or pretending that removing a lane removes the underlying work. A bulk “move all to stream X” action should be available, with individual exceptions and an over-capacity preview.

### Streams and teams are different axes

The first deployment is one Oh, WAWD! workspace connected to one Linear organization, with one engineering team supplying the initial capacity pool. A workspace is not a team: its model stores Linear team IDs and a team owner on each work package. Later, DevOps, infrastructure, and other engineering teams each have their own cycle observations, calendar, reserve, and estimate scale. A project involving two teams is split into team-owned work packages; each package is assigned to a planning stream. One stream may draw allocations from more than one team, but allocations are conserved **within each team**. We never add unlike point scales into a single unexplained total.

Product-owned outcomes can exist without engineering work. A product decision or approval can also be a dated dependency that gates engineering work; it should not consume engineering points. If a product team later tracks estimated delivery work, it can have its own capacity pool. The board can filter or group by team while retaining the stream view used for focus and tradeoff discussions.

This two-axis model is preferable to making every lane a team: teams describe who has capacity, while streams describe what the organization chooses to focus on in parallel. Outcome and dependency views can use the same data without being forced into either grouping.

## First-run and everyday workflow

1. A workspace admin connects Linear with an API key stored server-side. The app verifies access and asks which teams, project states, and optional initiatives to include. It shows an import preview before saving. A read-scoped key is sufficient until someone deliberately creates a Linear project.
2. Imported projects appear in Needs assignment. The planner links them to outcomes, creates team-owned work packages, assigns streams, and records missing estimates or planning allowances.
3. The board imports the first team's cycle schedule and timezone from Linear. The planner confirms a historical or provisional throughput baseline, a reserve for support/interrupt work, and initial allocation across the default five streams. A calendar shows the imported current and upcoming cycles and lets the planner choose holiday/leave exceptions by cycle. The board labels the forecast as provisional until capacity assumptions are set. Stream count and names are editable in the later release.
4. Product adds outcomes and target dates even if no Linear project exists. Such outcomes remain visibly unplanned. A user can link an existing Linear project, keep a planning-only item, or explicitly create a new Linear project and link its returned ID.
5. In a meeting, the team forks a scenario, selects or pauses work, adjusts allocation, compares results to the designated baseline, saves its draft, and publishes a decision with a short rationale and author/time.
6. Sync creates a new source snapshot from Linear. Existing drafts and published revisions keep their previous inputs and display a source-change badge. A planner explicitly rebases a draft to see forecast deltas before publishing it.

## Capacity and scheduling contract

Capacity is measured per engineering team and per cycle. Linear's cycle capacity uses velocity from the previous three completed cycles; our initial heuristic uses the median completed estimated points from the last six comparable, completed cycles of the same configured length. Show the observations and allow an override with a reason. If the team changes cycle length or has fewer than three comparable cycles, require a provisional manual baseline. Do not combine points across teams that use different estimate scales without an explicit conversion. [Linear cycles](https://linear.app/docs/use-cycles), [Linear estimates](https://linear.app/docs/estimates).

For each future cycle:

`available points = max(0, baseline points/cycle × availability fraction − reserve points/cycle)`

The availability fraction is the planner's explicit estimate of the cycle's working capacity after leave and holidays (1.0 means a normal cycle); it does not promise linear day-by-day delivery. Reserve is estimated work absent from the roadmap, expressed in points per cycle. Historical throughput includes that work, so the reserve is deducted once; any work modeled as a package must be removed from the reserve. Stream allocations draw from a team's available pool and must total at most 100% for that team. Base allocations apply across a scenario's horizon in the first proof; there are no per-cycle allocation overrides. Unused stream capacity is not borrowed automatically. Unallocated capacity remains visible.

For the first proof, each imported Linear project has one work package containing its open issues; no issue can contribute to another package. Later decomposition requires explicit, exclusive issue-to-package assignment, with an unassigned remainder visible until reconciled. Add a separately named planning allowance for known unestimated or undiscovered scope. Explicit zero estimates remain zero; missing estimates remain unknown until covered by an allowance. Completed issue points are throughput history, not remaining demand. A planning-only item uses an allowance with an estimate owner and review date. The exact allowance and completion rules are in the scheduling contract.

The engine schedules work in whole cycle buckets with a deterministic order described in the contract. Independent packages can run at the same time; a dependent package starts no sooner than the cycle after its predecessor finishes. Selected work without a team, stream, or finite estimate blocks its outcome forecast rather than receiving an invented date. Outcome links are marked **minimum required** or **optional**; only the minimum set determines the first delivery forecast. A missed target is reported as a gap in cycles, never hidden by sliding the target.

The first proof shows a base forecast and a capacity what-if control, with no probability claim or automatic confidence interval. Forecast results include “why this cycle?” details: capacity used per cycle, waiting dependencies, and unknown scope. Finish dates land at cycle boundaries; a target inside a cycle is assessed against the preceding cycle end unless product explicitly accepts delivery at the next cycle end. In-progress Linear work is shown as an execution fact; scenario pausing follows the separate lifecycle rules in the contract.

## Data ownership and sync

Linear is authoritative for project ID, name, description, status, URL, issues, issue estimates, cycle dates, and completion facts. Oh, WAWD! is authoritative for outcome relationships, planning-only items, work-package breakdown, stream assignment, local dependencies, scenario choices, targets, and estimate allowances. Imported Linear dependencies constrain the forecast by default. A scenario may explicitly waive an imported edge with a reason; the UI marks its Linear provenance and waived state. Local dependencies add constraints and never write silently to Linear. [Linear project dependencies](https://linear.app/docs/project-dependencies).

Use the [Linear TypeScript SDK](https://linear.app/developers/sdk) from the Node server. Initial import and manual refresh use paginated, filtered reads. Cache source IDs and last sync timestamps, upsert by Linear ID, and retain local relationships when a project changes status. A deleted or inaccessible Linear project is flagged for review rather than removing local planning history. GraphQL responses may include partial errors, so sync must validate both the data and errors fields. [Linear GraphQL API](https://linear.app/developers/graphql).

For a hosted multi-user product, Linear recommends OAuth. The requested API-key path is appropriate for the first controlled workspace: store the key encrypted on the server, never send it to the browser or logs, allow rotation, and show which Linear identity and teams it can access. A key with write permission is required only for the explicit “Create in Linear” action. Later OAuth can use the same connection interface. [Linear authentication](https://linear.app/developers/graphql), [API key permissions](https://linear.app/docs/api-and-webhooks).

After the first release, verified Linear webhooks for projects, issues, and cycles can make sync timely; keep a manual refresh and periodic reconciliation as recovery paths. Polling each issue is discouraged, and API requests have rate and complexity limits. [Linear webhooks](https://linear.app/developers/webhooks), [rate limits](https://linear.app/developers/rate-limiting).

## Implementation shape

Use React and TypeScript in a Next.js app running on Node, with PostgreSQL for shared, durable state. Next.js route handlers can serve the small initial API; the forecasting engine should be a pure TypeScript module so the UI and server use the same calculation contract and it can be tested independently. Keep the Linear adapter behind an interface so API-key and later OAuth connections share the same sync pipeline. [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers).

Suggested persistence entities: `workspace`, `member`, `linear_connection`, `linear_team`, `linear_project_cache`, `linear_issue_cache`, `cycle_observation`, `outcome`, `outcome_project_link`, `planning_item`, `work_package`, `dependency`, `stream`, `stream_team_allocation`, `target`, `scenario`, `scenario_revision`, `capacity_profile`, and `decision_event`. Streams have stable IDs and active/retired state; work packages have an owning team and stream assignment. A draft remains pinned to its imported source snapshot until the planner explicitly rebases it. A published scenario revision freezes the resolved Linear estimates and statuses, stream configuration, planning inputs, and calculation version needed to reproduce its forecast. When Linear changes, show a source-change badge and let the planner fork/rebase the scenario. Persist the inputs, not only the rendered bar dates.

The app needs authenticated workspace access and roles for viewing versus editing plans. A public shared view can come later, with sensitive project details hidden by default. Hosting must provide a persistent Node runtime, PostgreSQL, and server-side secrets. The design does not depend on a particular hosting vendor.

## Product proof and delivery order

The **first product proof** is a private, single-owner workflow using one Linear team. It imports projects read-only, creates outcomes and one package per project, uses the default five streams, applies the [v0 scheduling contract](scheduling-contract.md), and saves and compares scenarios. Cross-team projects are flagged for later decomposition rather than included in a misleading single-team forecast. It has no Linear writes, stream-count editor, routine resync, public sharing, or multi-team forecast. Stream count is a fixed UI setting only for this proof; stable stream IDs and the data model allow later configuration. The proof still needs server-side key handling, a durable data store, and a small authenticated environment because decisions and source data must survive a meeting.

| Slice | Shippable result | Acceptance check |
| --- | --- | --- |
| 1. Source and outcome | Read-only Linear import for one team; add an outcome and link imported projects | Import deduplicates by Linear ID; unlinked outcomes say “Unplanned”; a shared project costs capacity once |
| 2. Explainable board | Five default streams, Needs assignment and Deferred shelves, minimum-required links, cycle capacity, and dependency-aware forecast | Independent packages can run in parallel; a blocked package has an explained missing date; allocations conserve capacity |
| 3. Decision proof | Save two drafts, publish a baseline revision, change scope/allocation, compare forecasts and reasons | A planner can explain which change moved an outcome across the target without inspecting code |

The **first usable release after the proof** adds stream add/retire with migration preview, invited viewer/planner access, routine source refresh and rebasing, and deliberate creation of a Linear project from planning work. Multi-team capacity, split project packages, and a graph view follow only after the single-team decision workflow proves useful. The data model anticipates them; their forecast rules need separate calculation versions.

The proof demo uses one real team and a small import: connect Linear, create an outcome with a January target, link existing work, place it in default streams, model one cross-stream dependency, pause a competing package, and compare the outcome forecast with the baseline. The first usable release then tests adding and retiring a stream without losing or silently deferring its work.

## Measures for the pilot

- **Planning speed:** time from a synced project set to a first saved scenario, and time to compare a second option in a meeting. Aim for under 30 minutes for the first and under 3 minutes for a change once the workspace is set up.
- **Explainability:** in a short user study, a product and an engineering participant can each identify the capacity assumption, minimum-required scope, and top blocking dependency behind a forecast without help from the implementer.
- **Decision use:** record whether a scenario comparison led to an explicit include/pause/reallocate decision, and how often published revisions are revisited in later planning conversations.
- **Estimate coverage:** report the share of selected demand backed by explicit Linear estimates versus allowances, and the number of minimum-required packages still unforecastable. Do not hide missing size inside a precision-looking date.
- **Forecast calibration:** after each completed cycle, compare the prior published cycle-level forecast with actual completion, record why it diverged, and use several cycles of observations before changing the baseline heuristic.

## Decisions to validate with early users

- What names and focus limits make useful default streams for the first team? Five is the initial count, and the count is editable.
- Which completed-cycle measure best matches how the team actually estimates work, and what support/incident reserve is already implicit in that history?
- What should “required for an outcome” mean when a project contributes value in increments rather than only at completion?
- Which roles may publish a scenario, change capacity assumptions, or create a project in Linear?
- Which other Linear teams will join next, and do they use comparable estimate scales? The initial workflow uses one team while the data model supports several within the same workspace.
