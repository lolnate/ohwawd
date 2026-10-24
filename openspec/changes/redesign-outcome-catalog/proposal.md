# Outcome Catalog list redesign

## Why

The Outcome Catalog repeats full notes and linked-project lists in large cards, making it difficult to scan the defined outcomes as the portfolio grows. Planners need a compact, searchable inventory with useful filters while retaining clear access to outcome details and editing.

## What Changes

- Replace the multi-column card grid with one compact, full-width list of outcomes, showing title, owner, assigned stream, needed-by date, and required/optional project counts.
- Add search, owner and stream filters, linked-project coverage and target-date filters, deterministic sorting, result counts, and clear/reset controls.
- Open full outcome information in a sidebar and move the existing outcome editor there; retain the existing create-with-projects modal, project-link picker, and deletion behavior.
- Preserve catalog search/filter/sort context across workspace view switches and saves. Handle outcomes leaving the result set without resetting filters or losing the editing context.
- Add direct section navigation to the catalog from the top of Outcomes so a growing delivery section does not obscure it.
- Keep catalog browsing usable without a forecast and make the list responsive and keyboard-accessible.

## Capabilities

### New Capabilities

- `outcome-catalog`: Scannable outcome inventory, search/filter/sort behavior, detail inspection, and context-preserving catalog actions.

### Modified Capabilities

None. Existing project sequencing, capacity ownership, and project detail behavior remain governed by their current specifications.

## Impact

- UI: `src/app/workspace.tsx`, new focused catalog/list and outcome-detail components, scoped styles, and existing create/link/editor callbacks.
- Data: additive fields on `GET /api/state` for the outcome's actual `stream_id` and the saved workspace/team timezone; include already-returned `created_at` in client types and normalize needed-by dates as date-only values.
- Validation: pure catalog-query tests and browser coverage of larger lists, combined filters, details/editing, creation/linking/deletion, error handling, and desktop/mobile interaction.
- No database migration, new dependency, scheduling calculation, scenario-persistence change, or remote infrastructure work is needed.

This change is a design and implementation plan. The implementation Beans remain to do until explicitly selected for development.
