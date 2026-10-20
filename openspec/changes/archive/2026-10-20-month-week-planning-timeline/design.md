# Design

## Context

The current stream table spends at least 150px on each Linear cycle. Only four cycles exist in the user's imported calendar, while the desired view spans several months. The forecast uses whole-cycle buckets and explicit per-cycle availability/reserve. See proposal.md for motivation; existing dependency sequencing remains authoritative.

## Goals / Non-Goals

Goals: compact calendar-first visibility, explainable dependency timing, real holiday availability, scenario-safe planning assumptions.

Non-goals: daily delivery precision, fabricated future Linear cycles, automatic Linear configuration changes, or a visual-only holiday shading system detached from capacity.

## Decisions

### 1. Week-based display independent of cycle duration

Use Monday-start local calendar weeks. The scrollable timeline starts with the week containing the first forecast cycle (or the board evaluation date when no future cycle exists). Render at least 26 weeks; include imported coverage up to 104 display weeks. Use fixed 80px week columns and a sticky approximately 240px project column (160px on small screens, with 56px weeks). This keeps about 12–14 weeks visible on a desktop board and permits scrolling further out. The width was tuned against the actual full-width workspace so it presents roughly a quarter rather than four months at once.

Group weekly headers by their Monday's month, show week-of dates underneath, and add a subdued cycle-context header with tooltips giving precise imported boundaries. A week crossing a month boundary remains one week; its label/tooltips make the dates explicit.

Use an accessible table with project row headers and an overflow region that is keyboard scrollable. Forecast bars map actual cycle start/end local dates onto fractional week positions. The timeline's date axis is a display calendar, not a forecast calendar.

### 2. Keep forecast honesty and dependency context

Rows follow saved sequence. Each row can show After [blocker] and the actual waiting reason. A project with finite start but unfinished demand at the last imported cycle gets a dashed continuing bar only through the imported capacity already simulated, with no asserted end date. Unknown/unassigned/blocked work has explanatory text instead of a finite bar. Shade missing-calendar columns and state that the app cannot forecast there until Linear provides cycles.

The dependency import defect was caused by filtering project relationships as issue-style blocks edges. It is fixed separately by normalizing Linear dependency/end/start edges from both relation collections. Source conflicts still preserve manual order and offer an explicit Put blocker first repair; the user's named pair was repaired locally as requested.

### 3. Weekly capacity and holiday defaults

Add `weekly_capacity_adjustment(week_start date primary key, availability numeric, label text)` and `capacity_profile.holidays_enabled` default true. Weekly records refer to stable Monday calendar dates, independent of changing Linear cycle IDs. Manual overrides support any 0–100% availability, optional labels and removal. A 100% override can neutralize a holiday week without turning off all defaults.

The preset generates the Monday-start week containing US Thanksgiving (fourth Thursday in November), the week containing December 25, and the following week, each at 50%. The preset is a planning assumption, clearly labeled and switchable, rather than inferred employee leave. It is computed for relevant years and frozen as explicit resolved holiday weeks in saved snapshots.

For each cycle, enumerate its team-local Monday–Friday dates. On each date use explicit weekly availability first, then the enabled holiday preset, then the cycle's configured availability (default 100%). Average those daily fractions and apply that average to the cycle baseline. If a cycle has no weekdays, average its calendar dates instead. Reserve is deducted once per cycle after availability; stream allocations and WIP rules remain unchanged.

This replacement precedence avoids multiplying two holiday reductions (50% week plus 50% cycle must not become 25%). A two-week cycle with one normal and one half-capacity week receives 75% availability. Cycle dates remain the source of forecast boundaries; weekly columns do not imply day-level delivery precision.

### 4. Editing and feedback

Add Calendar availability controls for the holiday preset, Monday-start week, optional label, and availability percentage. List saved overrides with Remove actions. Clicking a visible week header selects that week for editing and opens the controls. Bands and headers state their effective percentage/label; tooltips expose overlapping cycle assumptions. An explicit override takes visual and calculation precedence over the preset.

### 5. Versioned persistence

V2 board/scenario snapshots include weekly overrides, holiday enabled state and resolved preset dates. Dirty detection and comparisons include the settings; activation restores them without changing source cycles or dependencies. Published v0/v1 snapshots remain unchanged. Loading an older editable draft adapts to v2 with holidays disabled and no weekly overrides, preserving its former capacity assumptions until deliberately edited. New live-board defaults enable the requested holiday preset.

Resolved preset dates in frozen snapshots keep historical calculations reproducible even if future preset rules evolve. Old published snapshots are displayed using their stored output, never recomputed.

## Risks / Trade-offs

- The visible calendar can exceed imported cycles → distinguish missing calendar visually and keep bars bounded by simulated capacity.
- A week can cross month/cycle boundaries → use Monday week labels, exact-date tooltips, day-overlap capacity calculation and fractional bar placement.
- Existing cycle exceptions can overlap holidays → show and document weekly-first replacement, avoiding accidental double reduction.
- A preset is not universally appropriate → label US Thanksgiving/Christmas assumptions and allow disabling or overriding individual weeks.

## Migration Plan

Add idempotent migration 4 without changing prior migration history or published JSON. Introduce v2 snapshot adapters and retain previous revision inputs/output. Apply to the local development database after tests. Verify the approved requirements and complete the linked Bean before archiving. Rollback requires restoring matching database/application state if v2 plans have been edited.
