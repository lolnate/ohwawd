---
# ohwawd-npmi
title: Render immediate prerequisite references and row-local connectors
status: todo
type: task
priority: normal
created_at: 2026-10-25T18:39:05Z
updated_at: 2026-10-26T00:34:19Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-0lzq
    - ohwawd-r568
    - ohwawd-m65h
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decision 5); openspec/changes/implement-outcome-first-board/specs/planning-timeline/spec.md; openspec/changes/implement-outcome-first-board/specs/outcome-sequencing/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (7.1); docs/visual-theme.md.

- [ ] Derive direct-plus-immediate effective prerequisite appearances, deduplicate against explicit links and other prerequisites, retain provenance and required-versus-optional context, and never write derived links or recursively expand boxes.
- [ ] Use the single package forecast everywhere; retain counted solid bars, dashed zero-charge references, excluded/unavailable chips, collision-free sublanes, sticky labels and actual month/week geometry.
- [ ] Draw noninteractive thin directional row-local paths only for present effective immediate edges, aligned on scroll/resize and avoiding labels/actions; use local references for cross-stream relationships and honest text/chips for undated endpoints.
- [ ] Preserve full accessible names, textual predecessor/deeper navigation, keyboard focus, reduced motion and forced-color selection/reference cues; catalog direct counts/search remain saved-link-only.
- [ ] Verify immediate-only expansion, deduplication, optional-only scope, deep constraints, shared-date/zero-charge geometry and row-local paths at desktop/tablet/phone using unit and fixture-backed browser tests; capture screenshots, document connector conventions and run typecheck plus affected timeline/theme tests.

Completion: implicit prerequisites are visible and traceable without duplicate capacity, fabricated dates, cross-panel arrow routing or altered catalog link state.

## Manual Board review handoff

The compact-row review confirmed that the timeline must show CSSM only after its prerequisite IRAS completes, with capacity-aligned spans and a connector between them. Implement this through the existing immediate-prerequisite appearance/connector acceptance rather than restoring expandable wait details to the sticky outcome label.
