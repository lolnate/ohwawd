---
# ohwawd-0lzq
title: Build accessible outcome-priority and roadmap Board controls
status: todo
type: task
created_at: 2026-10-25T18:38:41Z
updated_at: 2026-10-25T18:38:41Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-mg25
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 1–4, 7); openspec/changes/implement-outcome-first-board/specs/outcome-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (6.1); docs/ui-ux-conventions.md; docs/visual-theme.md.

- [ ] Add outcome drag/drop, keyboard up/down and before/after stream insertion controls backed by saved rank; keep project reorder controls scoped to owner and expose explicit linked-owner transfer.
- [ ] Add candidate/included/deferred/dismissed triage and include/dismiss/resume/restore actions; require an owning outcome, remove Other selected work ownership choices, keep Hide visibility-only and surface migration/owner-removal feedback.
- [ ] Render structured prerequisite waits and priority bypass distinctly from missing scope/capacity; offer prerequisite inspection and explicit inclusion guidance.
- [ ] Route Board outcome title controls to the existing outcome sidebar with stable stream/opener focus fallback; keep drag handles separate and prevent stacked project/outcome/Settings modals.
- [ ] Verify drag/non-drag equivalence, default append and same-stream no-op, rank effects, explicit transfers, dismissed prerequisites, late/stale errors, source refresh and Board/sidebar focus at 1440/768/390px with real-app browser coverage; update product workflow docs, preserve forecast values and run typecheck plus affected UI tests.

Completion: visible outcome order controls actual scheduling preference, every primary project has an owner, and users can resolve excluded prerequisites without implicit links or extra overlays.
