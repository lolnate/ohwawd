# Outcome-first Board controls

Implemented by **ohwawd-0lzq**, against task 6.1 of [implement-outcome-first-board](../openspec/changes/implement-outcome-first-board/tasks.md). The [design](../openspec/changes/implement-outcome-first-board/design.md) and [scheduling contract](scheduling-contract.md) govern behavior.

## Delivered workflow

- Outcome rows contain only a separate pointer-drag handle, title and delivery state. Counted points and direct-project count live in saved Details. Titles open the shared outcome sidebar, where Board placement offers destination plus explicit move-before/move-after controls for keyboard and touch use. Placement is unavailable while Details or Projects has unsaved changes. Saved order affects scheduling, subject to required-work tier, carried work and dependency eligibility.
- Stream moves append by default. A same-stream move without an insertion target is an exact no-op. Unassigning an outcome excludes its included owner work as candidates and explains the affected work.
- Manage work groups projects by owner. Project drag, arrow and insertion controls change only that owner's sequence. Explicit transfer chooses another linked outcome assigned to an active stream, moving the sole capacity charge.
- Candidate, deferred and dismissed shelves expose include, defer, resume, dismiss and restore actions. Inclusion/resumption requires a valid owner. Restore returns to candidate status. Hidden work remains available through show-hidden; source Hide only changes visibility.
- Conversion feedback identifies excluded ambiguous/invalid work and opens inspection. Structured prerequisite wait/bypass evidence remains available to timeline/project dependency context and the scheduler contract, but the sticky outcome label has no expandable wait block. Missing scope/capacity remains distinct.
- Inspection performs no planning write. Link an outcome explicitly hands off to the shared sidebar's Projects section, then inclusion remains an explicit Board action. Project-to-outcome/Settings handoffs close the current overlay first. In-drawer resolution focuses existing controls without replacing the dialog.
- Writes carry current planning tokens and serialize while pending. Stale edits reload saved state with an accessible error and useful focus. A late save cannot steal focus from or reset a newer outcome-sidebar draft.

## Manual walkthrough checkpoint

Use a migrated workspace with assigned outcomes, linked projects and at least one excluded prerequisite:

1. Reorder two eligible outcomes by dragging, then open one title and undo using Board placement's move-before/move-after controls. Confirm saved order and forecast changes after reload.
2. Move an outcome to another stream without a target and confirm it appends with its owned work. Apply the same destination again and confirm rank is unchanged.
3. Inspect a candidate. Link it explicitly through outcome Projects, return to the Board, choose its owner and include it. Defer/resume, dismiss/restore and include again; confirm one capacity charge throughout.
4. Transfer shared work to another linked owner and reorder within that owner. Confirm all appearances share dates and other owners' sequences remain intact.
5. Open a waiting project block and follow its dependency navigation to a dismissed prerequisite. Confirm inspection itself changes no links or demand; explicitly link/include it and confirm the dependent can receive a forecast. Compare dependency context with separate scope/capacity explanations.
6. Open an outcome from the Board, edit then dismiss; confirm opener/stream focus and catalog query context. Hand off from a project to outcome Projects and confirm only one dialog is open.
7. Repeat at desktop, tablet and phone sizes, including long titles, many outcomes, keyboard-only navigation, reduced motion and forced colors. Confirm Close stays reachable and project fields do not overflow horizontally.

## Verification evidence

`tests/ui/outcome-board.spec.ts` exercises 12 real-application Chromium cases with the PGlite-backed assignment fixture: persistent pointer/sidebar order and actual forecast changes, explicit before/after placement, append/no-op/unassignment, explicit links and membership transitions, dismissed prerequisites, scoped drag/transfer, stale saves, late-save isolation, sidebar/delete focus recovery, source Hide and 1440/768/390px layouts. It exercises reduced-motion and forced-color modes and captures `outcome-board-{width}.png` and `roadmap-project-{width}.png` under Playwright's ignored `test-results/` directory.

Visual inspection of all six captures confirmed wrapped long labels, owner movement controls, visible keyboard focus, contained fields and reachable drawer Close at each width. The long-row captures intentionally show the final outcome and open movement form after scrolling, rather than a top-of-page overview. The project captures show the focused explicit-link control after in-place resolution. These fixture-backed checks are independent of live Linear and production database migration.

Immediate-prerequisite boxes/connectors (**ohwawd-npmi**) and visible manual completion/reopen (**ohwawd-4oo7**) have separate acceptance work in the active change.

Completion checks: all 135 unit/database tests and all 101 Chromium browser tests passed, as did standalone typecheck and the production build. Two older stale-edit assertions were updated to match the expanded project-sequence/outcome-priority/dependency message; their stale rejection, rollback and focus checks remain intact.
