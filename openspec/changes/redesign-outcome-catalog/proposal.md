# Outcome Catalog and unified outcome workspace

## Why

Planners need a compact, searchable outcome inventory and a predictable place to work on an outcome. The compact catalog addresses browsing, but creation, inspection, editing and project linking still use different inline and overlay surfaces; a shared sidebar will simplify those workflows without losing search or filter context.

## What Changes

- Replace the multi-column card grid with one compact, full-width list of outcomes, showing title, owner, assigned stream, needed-by date, and required/optional project counts.
- Add search, owner and stream filters, linked-project coverage and target-date filters, deterministic sorting, result counts, and clear/reset controls.
- Use one persistent outcome sidebar with Details and Projects sections for creation, inspection, editing and project linking; replace the inline editor and separate creation/link dialogs while reusing their field controls.
- Preserve drafts across internal section navigation. Existing outcomes use explicit Save details and Save links actions; creation saves details and initial links together, then shows the saved outcome in the same sidebar.
- Make outcome titles the catalog and delivery entry points, remove repeated Edit/Links/Delete row actions, and consolidate Add outcome at the Outcomes heading. Put confirmed deletion inside saved Details and retain delivery's Resolve blocker actions.
- Standardize Close/Escape/backdrop dismissal, focus restoration, full-screen mobile behavior, section-local feedback, and safe completion of submitted writes after dismissal.
- Preserve catalog search/filter/sort context across workspace view switches and saves. Handle outcomes leaving the result set without resetting filters or losing the editing context.
- Add direct section navigation to the catalog from the top of Outcomes so a growing delivery section does not obscure it.
- Keep catalog browsing usable without a forecast and make the list responsive and keyboard-accessible.

## Capabilities

### New Capabilities

- `outcome-catalog`: Scannable outcome inventory, search/filter/sort behavior, a unified outcome workspace, and context-preserving creation/edit/link/delete actions.

### Modified Capabilities

None. Existing project sequencing, capacity ownership, and project detail behavior remain governed by their current specifications.

## Impact

- UI: `src/app/workspace.tsx`, catalog and delivery entry points, a focused shared outcome-sidebar component, scoped styles, reused outcome/project fields, and existing create/link/editor callbacks.
- Persistence: retain atomic create-with-links and separate existing detail/link update APIs; capture created IDs and distinguish rejected writes from saved-but-not-refreshed results. No combined update API is introduced.
- Data: additive fields on `GET /api/state` for the outcome's actual `stream_id` and the saved workspace/team timezone; include already-returned `created_at` in client types and normalize needed-by dates as date-only values.
- Validation: pure catalog-query tests and browser coverage of larger lists, combined filters, details/editing, creation/linking/deletion, error handling, and desktop/mobile interaction.
- No database migration, new dependency, scheduling calculation, scenario-persistence change, or remote infrastructure work is needed.

The unified-sidebar direction was accepted from `docs/outcomes-ux-review.md` on October 25, 2026. Saved-data/query work and compact browsing are verified complete; the sidebar and integration work remain tracked by the linked Beans in `tasks.md`.
