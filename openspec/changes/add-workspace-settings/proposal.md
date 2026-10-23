# Proposal

## Why

The Board mixes day-to-day sequencing with workspace-wide planning assumptions, making both harder to find and scan. A dedicated Settings surface gives capacity, scope-readiness, and weekly availability controls a consistent home while preserving quick access from planning problems.

## What Changes

- Add a globally available gear button in the signed-in header that opens a centered Settings overlay. The user selected this presentation over a fifth workspace view.
- Organize Settings into **Capacity assumptions**, **Scope readiness**, and **Weekly availability and holidays**, with clear section navigation, responsive layouts, and section-local feedback.
- Move those three editors out of the Board, retaining their existing fields, defaults, validation, persistence, forecast effects, and scenario behavior.
- Route Board baseline/setup actions, capacity-resolution actions, the cycle-calendar weekly link, and timeline week editing into the appropriate Settings section. Preserve the selected week and return focus to the originating control.
- Apply the established backdrop, Escape, Close, and focus-restoration conventions to the centered overlay and document the shared overlay convention.

## Capabilities

### New Capabilities

- `workspace-settings`: A discoverable, accessible Settings overlay for shared planning assumptions, including its editors, saving feedback, and synchronization with planning views.

### Modified Capabilities

- `project-scope-readiness`: Locate the configurable scoping lead-time editor in Settings while retaining Board reminders and existing calculation semantics.
- `weekly-capacity`: Locate holiday-preset and weekly-override editing in Settings and identify those values as planning assumptions there.
- `planning-timeline`: Open the weekly Settings editor directly from a timeline week and restore focus on dismissal.

## Impact

- UI: `src/app/workspace.tsx`, `src/app/board.tsx`, `src/app/calendar-availability.tsx`, relevant header/responsive styles, and a new Settings component/style module. Existing modal patterns in `src/app/project-drawer.tsx` provide interaction guidance.
- Integration: reuse `GET`/`PUT /api/board` and existing workspace refresh callbacks; update dependent forecast and scenario views after successful saves.
- Validation: extend the existing Playwright fixture and workspace/timeline coverage; retain underlying forecast, calendar, scope, and scenario regression checks.
- Documentation: `docs/ui-ux-conventions.md` and the linked implementation Beans.
- Scope boundary: cycle-wide overrides, Linear connection/import, streams, dependencies, per-project Extra scope, and scenario management retain their existing homes. No database migration, API contract change, new dependency, or forecast-model change is required.
