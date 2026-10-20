# Simplify project assignment

## Why

The board currently asks planners to maintain numeric priorities, start constraints, and allowance administration instead of arranging work. Its alphabetical display also differs from the scheduler's numeric order, making the effect of assignment hard to see.

## What Changes

- Import and display Linear project priority as read-only source information. User-defined stream sequence controls scheduling, even when it differs from Linear priority.
- Add persistent, dependency-aware drag-and-drop ordering within and between streams, with equivalent keyboard and touch-accessible move controls. Show the sequence directly in each stream.
- **BREAKING** Remove editable priority rank, preferred start, hard not-before, and must-include from the current planning model and API. Existing published scenario results remain intact.
- Allow deferring any project with an empty pause rationale, including in-progress work. Continue distinguishing planning deferral from Linear execution status.
- **BREAKING** Replace the two allowance categories with one **Extra scope** points estimate and optional notes. Remove allowance owner, manual review date, and required rationale.
- Use explicit manual adjustment of Extra scope when Linear issue scope changes, with a visible review reminder instead of automatic budget consumption.
- Add **Needs scoping** reminders for projects with generic scope within a configurable lead time before their forecast start: 14 calendar days by default. Reminders preserve provisional forecasts.
- Include sequence, extra-scope assumptions, and the scoping window in saved scenarios and comparisons.

## Capabilities

### New Capabilities

The repository has no existing OpenSpec capabilities. These specs establish the revised behavior previously described in `docs/scheduling-contract.md` and `docs/product-design.md`.

- `project-assignment`: Lightweight project planning controls, Linear-sourced priority, and optional pause notes.
- `stream-sequencing`: Persistent user order, accessible moves, dependency restrictions, deterministic scheduling, and scenario compatibility.
- `project-scope-readiness`: One extra-scope estimate, manual reconciliation, and forecast-relative scoping reminders.

### Modified Capabilities

None in `openspec/specs/`.

## Impact

- UI: `src/app/board.tsx`, board styles, scenario comparison presentation, and UI coverage.
- Data and API: board reads/mutations, schema migration, Linear adapter/import/reporting, assignment helpers, and stream retirement migration.
- Calculation: forecast inputs and selection order; a new calculation version for the revised rules.
- Scenarios: capture, dirty detection, activation, rebase, publication, comparison, and legacy snapshot adaptation.
- Documentation: the scheduling contract and product design identify the revised v1 workflow and retain historical v0 context. The user approved this proposal for implementation on 20 October 2026.
- Dependencies: no new runtime dependency is selected by this proposal. Any drag-and-drop library choice requires an explanation of its accessibility/touch benefits during implementation.
