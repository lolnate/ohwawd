# Auto-scope unique outcome projects

## Why

Linking a new minimum-required project to one outcome and assigning that outcome to a stream currently leaves the project excluded as a candidate. The Board then shows zero demand, ignores saved capacity/scope changes, labels the project as a shared reference, and calls the outcome blocked without a visible cause even though ownership is unambiguous.

## What Changes

- Include a candidate automatically when it is minimum-required by exactly one outcome and that outcome is assigned to an active stream, whether linking or outcome placement completes the relationship.
- Preserve explicit selection for optional links, projects linked to multiple outcomes, deferred work, and dismissed work.
- Recompute and return Board forecasts immediately after stream allocation and Extra scope writes so the newly counted project updates without a page reload.
- Label excluded timeline appearances by their actual membership state rather than as shared work, and expose a concise cause for blocked outcome status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-assignment`: Treat an unambiguous minimum-required candidate relationship as an explicit inclusion result while preserving excluded and ambiguous states.
- `outcome-sequencing`: Keep unique candidate ownership coherent across link/placement order and make excluded references and blockers understandable.
- `planning-timeline`: Refresh counted geometry after planning inputs change and distinguish excluded references from shared included work.

## Impact

- Planning mutations in `src/lib/outcome-ownership.ts` and `src/lib/roadmap-mutations.ts`.
- Board timeline and project-detail labels in `src/app/stream-timeline.tsx`, `src/app/project-drawer.tsx`, and related Board presentation.
- Existing Board and outcome route responses remain authoritative; no database schema, external API, dependency, or scenario format changes.
- Regression coverage for mutation order, ambiguity, dynamic allocation/scope updates, and visible blocker/reference states.
- Tracked by Bean `ohwawd-wyje`.
