# Design

## Context

See `proposal.md` for motivation. In migrated workspaces, the Board currently renders candidate, deferred and dismissed project shelves through one triage component, while a separate Board block already renders outcomes whose `stream_id` is null. The Outcomes tab already has saved project membership in workspace state and can open the existing Board project drawer by stable package ID.

`roadmapPlanningMigrated` separates the current outcome-first model from legacy project-to-stream assignment. In the current model, `roadmap_state === "candidate"` is the authoritative Needs Assignment classification; checking only for a null capacity owner would incorrectly include intentionally deferred or dismissed work.

## Goals / Non-Goals

**Goals:**

- Relocate only the presentation and navigation entry points while preserving assignment mutations and state semantics.
- Keep keyboard focus, responsive containment and existing project/outcome detail workflows intact.
- Preserve at-a-glance outcome health without retaining a second outcome list.
- Preserve legacy pre-migration assignment behavior.

**Non-Goals:**

- Add a new assignment API, infer owners, or include candidate demand automatically.
- Move Deferred or Dismissed project triage from the Board.
- Change forecast, lifecycle, scenario, source visibility or persistence behavior.

## Decisions

### 1. Render candidate projects from workspace state on Outcomes

Derive the list from migrated workspace projects with `roadmap_state === "candidate"`. Render compact rows with source status and planning context, and use the existing workspace callback to switch to Board and open the project drawer for explicit linking/inclusion.

This keeps one authoritative project-planning implementation. Moving full Board cards into Outcomes would couple the Outcomes view to Board-local save, drag, sequencing and drawer state.

### 2. Reuse the existing Board unassigned-outcome controls

Rename the current unassigned-outcomes block to Needs Assignment and retain `OutcomeBoardControls`, drop behavior, lifecycle summaries and legacy stream selects. Add an explicit empty state in migrated mode so the section remains understandable when all outcomes are assigned.

This is preferable to creating a new shelf because the current block already implements the required mutations and focus fallback.

### 3. Remove only candidates from migrated Board triage

The migrated Board triage component will render Deferred and Dismissed shelves only. Legacy Board Needs Assignment remains unchanged because it represents selected projects without streams under the pre-migration model, not projects without owning outcomes.

Board candidate-attention actions will switch to Outcomes and focus the new section. Forecast-blocker actions will focus the catalog, where the affected rows expose compact health.

### 4. Preserve stable focus targets across the relocation

Add a stable Outcomes heading ID to the shared section-focus helper and section navigation. Candidate project actions return to the existing project drawer workflow. Board outcome assignment retains the existing `board-unassigned-outcomes-title` fallback ID even though its visible label changes.

### 5. Consolidate delivery health into one catalog column

Pass the already-loaded Board forecast to the catalog without copying it into catalog query state. Derive one short, non-color-only Health label per outcome from forecast status and target fit: blocked/setup/beyond-horizon/unplanned states take precedence, followed by missed/on-target target state, then provisional/no-target/ready states. An absent forecast renders Loading or Unavailable while saved catalog browsing continues.

Render Outcome catalog first and project Needs Assignment second. Remove the separate delivery component and its section navigation; Board forecast-attention actions focus the catalog. This avoids two outcome lists while retaining title-driven inspection and one compact status column.

## Risks / Trade-offs

- [Candidate actions briefly switch back to Board for the full project drawer] -> Keep the new Outcomes row explicit about opening project planning; reuse prevents divergent assignment behavior.
- [Null owner is mistaken for candidate state] -> Filter by migrated roadmap membership, not owner nullability.
- [Legacy fixtures lose their project assignment shelf] -> Gate the relocation on `roadmapPlanningMigrated` and preserve the legacy branch.
- [Board attention links target a removed candidate shelf] -> Add a dedicated Outcomes Needs Assignment callback and update migrated focus fallbacks.
- [Health labels hide detailed remediation] -> Keep labels deliberately compact; full evidence remains in outcome/project details and Board planning attention.

## Migration Plan

Ship as a presentation-only update against existing state and mutation contracts. Browser tests cover both migrated and legacy behavior. Rollback restores the prior component placement without stored-data conversion.
