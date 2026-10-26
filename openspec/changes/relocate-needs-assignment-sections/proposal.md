# Relocate Needs Assignment sections

## Why

The Board's project-level Needs Assignment shelf no longer matches the outcome-first planning model: projects need an owning outcome, while outcomes need a stream. Each unresolved entity should appear in the workspace where that relationship is managed.

## What Changes

- Add a Needs Assignment section to Outcomes for candidate projects that do not have an active owning outcome, with an entry point to their existing planning controls.
- Make the Board's Needs Assignment section contain outcomes that have not been assigned to a stream, retaining existing outcome placement controls.
- Remove candidate projects from the migrated Board triage area while retaining Deferred and Dismissed project triage there.
- Route Board candidate-attention actions to the new Outcomes section and preserve accessible section focus and responsive behavior.
- Keep the compact outcome catalog first, add one concise forecast-health column, and place project Needs Assignment below the catalog.
- Remove the separate Outcome delivery section and route outcome forecast attention to the catalog instead.
- Keep the legacy pre-migration project assignment surface unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `outcome-catalog`: Make the catalog the primary outcome summary with one compact forecast-health column and place candidate-project assignment below it.
- `project-assignment`: Define the Outcomes tab as the visible home and planning entry point for candidate projects needing an owner.
- `outcome-sequencing`: Define the Board Needs Assignment section as the placement surface for outcomes without a stream.

## Impact

- UI: `src/app/workspace.tsx`, `src/app/board.tsx`, `src/app/outcome-catalog.tsx`, `src/app/roadmap-board-work.tsx`, Outcomes section navigation, and scoped styles.
- Documentation and browser tests for Board/Outcomes organization, focus, assignment controls, and responsive behavior.
- Existing Board and workspace responses already contain the required project membership and outcome stream data. No API, database, dependency, forecast, persistence, or scenario-format change is required.
- Tracked by Bean `ohwawd-t8we`, which references this change's artifacts.
