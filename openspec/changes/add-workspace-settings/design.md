# Design

## Context

See `proposal.md` for motivation and scope. The user selected a centered overlay during planning.

- `src/app/workspace.tsx` owns the signed-in header, four local workspace views, and refresh fan-out through `reload()` / `boardVersion`. Board stays mounted inside a hidden view and publishes its latest `BoardState` for Outcomes delivery.
- `src/app/board.tsx` currently owns the capacity and scoping drafts, all three requested editors, Board mutations, and DOM-based reveal/focus helpers. Several actions depend on `capacity-settings` or `calendar-availability` being on the Board.
- `src/app/calendar-availability.tsx` already implements the holiday toggle, week normalization, effective-value display, override saving/removal, and timeline-selected-week focus. Its outer `details` and scrolling behavior assume Board placement.
- `GET /api/board` supplies all required values and evidence. Its `PUT` accepts `capacity`, `scoping`, `weeklyAvailability`, and `holidayPreset` changes and returns a recomputed board. Existing validation and scenario persistence already cover these assumptions.
- `src/app/project-drawer.tsx` demonstrates native modal focus containment, pointer-origin-aware backdrop dismissal, and focus restoration. `docs/ui-ux-conventions.md` defines the interaction contract.
- Existing Playwright coverage uses `tests/ui/assignment-fixture.ts` with real planning calculations. Timeline and workspace tests currently expect inline weekly editing.

## Goals / Non-Goals

**Goals:**
- Add one coherent settings entry point without changing the workspace's view state.
- Keep settings forms decoupled from Board rendering while reusing current planning APIs and refresh lifecycle.
- Make the relocation transparent to contextual planning actions, calculated results, and scenario capture.

**Non-Goals:**
- Introduce a settings route, URL persistence, preferences framework, or generalized modal library.
- Refactor all Board state/mutations into a new global store.
- Add batch Save all, autosaving numeric fields, a new holiday provider, or new planning controls.

## Decisions

### 1. Centered native modal, owned by the workspace

Add a header gear button beside the existing header actions, with accessible name `Settings`, a tooltip, and `aria-haspopup="dialog"`. A small inline SVG avoids adding an icon dependency. Place a dedicated Settings controller alongside the workspace views, outside the Board's hidden container, so it opens from every view without switching `activeView`.

Use a native `dialog` with `showModal()` and the established project-drawer dismissal pattern. Capture the opener before opening. Initial gear entry focuses the Settings heading; contextual entry focuses the relevant input after data is ready. Close, Escape, and valid backdrop clicks restore the captured opener, or the visible header gear as fallback. Keep Close usable during loading and saving, and retain native modal background inertness.

Alternatives considered: a fifth view fits the navigation model but displaces the current planning context; the user chose the overlay. A side drawer competes visually with project inspection and constrains evidence-heavy capacity forms.

### 2. A roomy, restrained layout with three sections

Suggested desktop starting point: approximately 960px maximum width, 24px viewport gutters, a bounded height of about `90dvh`, rounded light surface, subtle border/shadow, and dim backdrop. Use the existing typography and green accent colors. A persistent header contains `Settings`, short planning-assumptions copy, and Close. A roughly 220px left section navigation sits beside a scrollable editor area. Keep observation details secondary to effective capacity and editable fields.

Section navigation uses ordinary buttons in a labeled navigation region with an indicated current section, matching the application's existing view-button convention. Do not introduce ARIA tabs without implementing their associated keyboard contract. Show one editor at a time, keeping all section drafts in the opening's state. The three sections retain their requested names.

Below the existing narrow-screen breakpoint (760px), use a full-screen dialog, wrapping section buttons above the editor, single-column fields, and internal scrolling. Header and Close remain reachable; long evidence and override lists wrap or scroll without widening the page. Check 390px, 768px, and 1440px widths. Add scoped Settings CSS and import it through the existing stylesheet entry point.

Alternatives considered: one long accordion page is simple but obscures section targeting and produces a long modal. Independent section navigation provides a clearer destination for existing Board actions.

### 3. Reuse the board API with settings-local drafts and feedback

Load a fresh board snapshot when opening Settings; show loading or retryable errors before enabling editors. Reuse `readApiResponse` / the existing client API conventions. Initialize capacity and lead-day drafts from that response and resolve weekly values from current overrides, enabled holidays, and contextual cycle availability. Preserve all current evidence and warning copy from the moved panels.

Persist through the existing four `PUT /api/board` mutation types. Keep existing explicit save buttons; the holiday checkbox and Remove override remain immediate actions. Serialize Settings writes, display feedback beside the affected section, and use the successful response to refresh saved evidence without resetting unsaved drafts in other sections. Errors retain the submitted draft. Background Board reloads must not reinitialize Settings drafts. Successful saves stay open.

Keep the Settings controller and mutation lifecycle mounted at workspace level while signed in; the visible dialog can close independently. Dismissal discards unsubmitted drafts but does not abort a submitted mutation. A completion still invokes workspace refresh. Reopening during an in-flight write shows pending state and waits for its settled saved state before enabling conflicting edits. Guard request generations so a late load or prior opening cannot replace newer data or a new opening's fields.

On successful mutations, invoke the existing workspace reload fan-out to refresh Board, its published Outcomes forecast, and ScenarioPanel readiness/dirty state. Account for failures in this follow-up refresh separately from mutation failure: a persisted write must not be labeled unsaved merely because refresh failed. Show a retryable refresh error when applicable. Reopening and scenario activation read canonical saved values, not cached drafts.

Alternatives considered: lifting all Board state would broaden the refactor unnecessarily; a new Settings endpoint would duplicate existing validation and persistence. Reusing the current API confines the change to UI ownership and integration.

### 4. Move editors rather than duplicating their authority

Extract capacity and scope-readiness content from `board.tsx` into Settings section components or simple local sections. Adapt `calendar-availability.tsx` into the weekly section body: remove its Board-only `details`, automatic page scrolling, and local panel-opening concerns. Keep date normalization, optional labels, holiday explanation, saved override list, and save payloads.

Remove the three inline editors and their Board-only draft state/imports. Leave cycle-wide overrides and all other Board operations in place. Preserve capacity context in Settings, including imported/projected counts and missing-calendar explanations. A short weekly link remains in the cycle-wide panel. No data conversion is needed.

### 5. Explicit contextual open requests replace moved DOM targets

Introduce a small typed callback/request for `capacity`, `scope`, and `availability`, optionally carrying the selected `PlanningWeek`. Each invocation is a new open request, including repeated selection of the same week. Workspace owns this request and forwards it to Settings.

Update these call sites:

| Existing entry point | New destination / focus |
| --- | --- |
| Header gear | Capacity assumptions / dialog heading |
| Planning attention: Set capacity baseline | Capacity assumptions / manual baseline |
| Project resolution: Review stream capacity | Capacity assumptions / manual baseline |
| Cycle-calendar weekly-availability link | Weekly availability and holidays / week selector |
| Timeline `onEditWeek` | Weekly availability and holidays / selected Monday week selector |

Keep DOM reveal helpers only for controls that remain on Board. Preserve the existing project-drawer handoff: close project details before opening Settings rather than stacking modal dialogs. If the original control disappears during that handoff, restore focus to the header gear. ScenarioPanel's existing Configure board path can still reach Planning attention, whose baseline action now opens Settings; changing its readiness routing is outside this relocation.

The weekly editor uses the latest saved override or enabled preset when present, falling back to the passed week's cycle availability. Retain the selected local date and timezone context. Do not add new Board anchors pretending the moved editor still lives there.

### 6. Focused behavioral verification

Add `tests/ui/workspace-settings.spec.ts` using the assignment fixture for saving and computed effects, and extend existing workspace/timeline cases to expect Settings. Cover all three sections, load/save failures and retry, section-draft preservation, discard/reopen, repeated week selection, contextual focus, modal dismissal including drag-out, and refresh after saving over a non-Board view. Exercise scenario dirty state and reopening after scenario activation through existing scenario helpers where available.

Use keyboard and pointer assertions for focus containment/restoration and inert background behavior. Inspect desktop and narrow-screen screenshots during implementation; geometric containment and control reachability assertions provide stable automated checks without introducing a visual-baseline framework. Read the relevant installed Next.js guides before implementation as required by `AGENTS.md`.

Required implementation checks: `npm run typecheck`, `npm test`, and `npm run test:ui -- tests/ui/workspace-settings.spec.ts tests/ui/workspace-organization.spec.ts tests/ui/planning-timeline.spec.ts tests/ui/cycle-calendar-projection.spec.ts tests/ui/responsive-workspace.spec.ts`. Expand only for changed behavior or unresolved failures. The package has no lint script; use its configured checks rather than adding tooling.

## Risks / Trade-offs

- [Duplicate/stale board snapshots] → Load on open, serialize Settings writes, guard stale responses, and use existing refresh fan-out after every successful mutation.
- [Refresh erases an unrelated draft] → Separate saved evidence from opening-local drafts and only reconcile submitted fields after their successful save.
- [A moved DOM target silently stops working] → Audit the named baseline, project-resolution, calendar-link, and timeline call sites; cover them through user-visible navigation tests.
- [A close/reopen races an outstanding save] → Keep mutation ownership outside the visible dialog and wait for completion before enabling a reopened editor.
- [Long capacity evidence overwhelms a phone-sized modal] → Secondary observation styling, wrapping content, stacked forms, bounded internal scrolling, and viewport checks.
- [Unsaved values are discarded on dismissal] → Retain explicit section save actions and visible success feedback; reopening always uses saved values. This matches the chosen simple interaction without adding a confirmation workflow.

## Migration Plan

Implement the linked Beans in dependency order: overlay shell, editor/data relocation, contextual integrations, and final behavioral validation. Ship the relocation and entry-point updates together so Board actions do not target removed content. Reuse stored planning values and APIs without a database migration. UI rollback restores the previous Board editor rendering against the same saved data; no snapshot or calculation-version change is needed.

Keep this change active until implementation Beans are completed and verified. Reconcile `tasks.md` from Beans at completion, then use the normal OpenSpec validation/archive workflow.
