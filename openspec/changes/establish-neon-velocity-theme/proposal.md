# Establish Neon Velocity

## Why

Oh, WAWD! needs a distinctive visual identity that expresses the energy of moving a team toward the future. The current light/green styles are distributed across feature stylesheets; a documented, accessible theme will give future work a coherent foundation.

## What Changes

- Establish **Neon Velocity**: midnight motorsport and orbital-future surfaces, electric-cyan interactions, laser-magenta identity accents, and crisp instrument-panel typography.
- Define shared semantic tokens for surfaces, text, actions, states, focus, and planning graphics; migrate the existing interface to them.
- Apply consistent treatments across authentication, workspace navigation, Board, Outcomes, Linear projects, scenarios, drawers, pickers and any Settings/catalog components present at implementation time.
- Preserve explicit visual distinctions between owned/shared work, provisional forecasts, reduced availability, missing calendar coverage and planning blockers.
- Require readable contrast, visible focus, reduced-motion and forced-color support, and responsive density without changing planning behavior.
- Maintain an agent-accessible theme reference and a standalone visual study, linked from `AGENTS.md` and the UI/UX conventions.

## Capabilities

### New Capabilities

- `visual-theme`: Shared visual identity, semantic styling, accessible interaction states, and truthful planning graphics across the application.

### Modified Capabilities

None. Existing outcome, forecasting, sequencing and interaction requirements retain their meanings and behavior.

## Impact

The implementation affects the global stylesheet entry point and existing feature CSS. Small markup changes may be needed for non-color state cues or provenance markers. Exact design values and recipes live in `docs/visual-theme.md`; `docs/theme-preview.html` is an illustrative reference, not production functionality.

No database migration, API change, new runtime dependency, planning calculation change, theme picker, or persisted theme preference is required. A display font may be bundled locally with its license; builds and page loads must not depend on an external font service.

This change is currently a design/implementation plan. Production restyling remains pending the linked implementation Beans.
