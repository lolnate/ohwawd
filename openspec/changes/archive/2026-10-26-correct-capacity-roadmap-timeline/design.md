# Design

## Context

See `proposal.md`. The importer currently persists issue estimates but not Linear's aggregate project `scope` or completed-scope history. Forecast demand therefore becomes unresolved whenever any open issue estimate is null. Finite timeline spans also snap to complete forecast-cycle boundaries, and the recently added wait/bypass panel duplicates dependency information inside the densest planning surface.

## Goals / Non-Goals

**Goals:**
- Preserve a single authoritative demand value and one capacity charge per project.
- Use additive storage and conservative fallback for cached data that predates aggregate project scope.
- Make visual bar length proportional to consumed stream capacity without rewriting the cycle-based scheduler.
- Keep dependency inspection accessible while removing explanatory timeline panels.

**Non-Goals:**
- No Linear writes or automatic issue estimation.
- No intra-cycle scheduler handoff; a successor remains eligible in the next forecast cycle even when the predecessor's final bar uses only part of its cycle.
- No free-form drag positioning or alternate timeline model.

## Decisions

### 1. Persist remaining aggregate scope, not transient progress

Import Linear project `scope` and the latest `completedScopeHistory` value, validate both as finite non-negative values, and persist `remaining_scope = max(scope - completed, 0)` in an additive migration. This is more stable and auditable than multiplying scope by Linear's weighted `progress`, which discounts in-progress work by 25% and would understate remaining capacity.

When `remaining_scope` is present, it replaces the sum of open issue estimates as source demand and suppresses unknown-issue forecast gating; Extra scope remains additive. Null retains the existing issue-level fallback. Completion evidence still requires actual reconciled issue/project completion and is unchanged.

### 2. Fractional geometry is derived from forecast consumption

Keep cycle-level scheduling and conservation unchanged. For a finite package, calculate the final visual boundary from the fraction `final-cycle consumed points / final-cycle stream budget`, applied to that cycle's calendar interval. This produces 3.53 weeks for 106 points at 30 points in each one-week cycle while preserving holiday/cycle capacity effects. Shared and derived appearances reuse the same package projection.

### 3. Connectors replace timeline explanations

Remove the standalone wait/priority-bypass timeline control and its layout allocation. Finite immediate edges continue to use row-local SVG connectors between project controls. Unresolved projects retain compact selectable controls with full accessible dependency context; detailed blockers, excluded-state remediation and source evidence remain in the project drawer.

### 4. Timeline density becomes a shared convention

Record in `docs/ui-ux-conventions.md` that roadmap timelines show only schedule primitives: outcome labels, compact project bars/references, concise state, dates and connectors. Sentence-length explanations, repeated counts, remediation controls and warning panels belong in details or focused action surfaces.

## Risks / Trade-offs

- [Linear aggregate scope may be absent or zero for teams without estimation] -> Persist null unless positive scope evidence exists and retain the tested issue-level fallback.
- [Fractional bars can visually end before the next cycle-based successor starts] -> Keep the connector truthful across the idle remainder; do not imply unsupported intra-cycle handoff.
- [Removing visible wait prose could reduce discoverability] -> Preserve dependency names in accessible project labels and the project drawer, with connector geometry as the primary timeline cue.
- [Existing databases lack the new source field] -> Add migration 8 with a nullable column; the next Linear import populates it without rewriting planning state.

## Migration Plan

1. Apply migration 8 to add nullable `linear_project_cache.remaining_scope`.
2. Deploy importer and readers; existing rows continue issue-level fallback until refreshed.
3. Refresh Linear source to populate aggregate remaining scope and recalculate forecasts.
4. Rollback code safely leaves the additive column unused; do not remove it during rollback.
