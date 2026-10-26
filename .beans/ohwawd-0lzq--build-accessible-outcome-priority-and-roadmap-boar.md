---
# ohwawd-0lzq
title: Build accessible outcome-priority and roadmap Board controls
status: completed
type: task
priority: normal
created_at: 2026-10-25T18:38:41Z
updated_at: 2026-10-25T23:54:37Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-mg25
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 1–4, 7); openspec/changes/implement-outcome-first-board/specs/outcome-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (6.1); docs/ui-ux-conventions.md; docs/visual-theme.md.

- [x] Add outcome drag/drop, keyboard up/down and before/after stream insertion controls backed by saved rank; keep project reorder controls scoped to owner and expose explicit linked-owner transfer.
- [x] Add candidate/included/deferred/dismissed triage and include/dismiss/resume/restore actions; require an owning outcome, remove Other selected work ownership choices, keep Hide visibility-only and surface migration/owner-removal feedback.
- [x] Render structured prerequisite waits and priority bypass distinctly from missing scope/capacity; offer prerequisite inspection and explicit inclusion guidance.
- [x] Route Board outcome title controls to the existing outcome sidebar with stable stream/opener focus fallback; keep drag handles separate and prevent stacked project/outcome/Settings modals.
- [x] Verify drag/non-drag equivalence, default append and same-stream no-op, rank effects, explicit transfers, dismissed prerequisites, late/stale errors, source refresh and Board/sidebar focus at 1440/768/390px with real-app browser coverage; update product workflow docs, preserve forecast values and run typecheck plus affected UI tests.

Completion: visible outcome order controls actual scheduling preference, every primary project has an owner, and users can resolve excluded prerequisites without implicit links or extra overlays.

## Scenario adoption handoff

Activated Board reads now report calculationVersion v5 and scenarios can save/publish v5 after normal validation. Scenario capture/restore includes outcome rank, membership, scoped order, ownership and outcomeCatalogIds managed omissions. Loading can remove explicitly managed definitions while preserving newer unrelated outcomes and independent completion history; the existing outcome sidebar handles confirmed external removal, and Board opener fallbacks must account for removed rows. Current source/lifecycle facts never restore from historical snapshots. Scenario comparison already renders membership/rank changes and frozen lifecycle evidence. The remaining primary Board controls must use the existing owner-safe APIs and tokens, not cosmetic ordering.

## Summary of Changes

Implemented persistent outcome drag/keyboard/arrows/before-after/stream moves, owner-scoped project ordering and explicit linked-owner transfer; added candidate/deferred/dismissed triage and explicit membership actions, source membership/Plan on Board with visibility-only Hide, conversion feedback, structured waits and bypass explanations. Board titles and explicit linking use the shared outcome sidebar with single-overlay handoff, stable focus and late-save isolation. Long rows resize with their controls.

Added 12 fixture-backed real-application Board browser cases and updated legacy stale-message assertions. Standalone typecheck, production build, all 135 unit/database tests and all 101 Chromium browser tests passed. Visually inspected Board and project screenshots at 1440/768/390px; browser checks exercise keyboard, reduced motion and forced colors. Documented delivered workflow and manual checkpoint in docs/board-controls.md and updated docs/product-design.md and docs/board-design-validation.md. Prerequisite timeline/connectors and visible completion actions remain tracked by ohwawd-npmi and ohwawd-4oo7.
