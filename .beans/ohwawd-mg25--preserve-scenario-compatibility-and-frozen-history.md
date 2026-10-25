---
# ohwawd-mg25
title: Preserve scenario compatibility and frozen history under v5
status: todo
type: task
created_at: 2026-10-25T18:38:26Z
updated_at: 2026-10-25T18:38:26Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-d92k
    - ohwawd-gqh7
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 6, 8); openspec/changes/implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/outcome-lifecycle/spec.md; openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (5.1).

- [ ] Adopt calculationVersion v5 for new saves/publications and round-trip rank, membership, ownership and scoped order in scenario fingerprints, activation and comparisons.
- [ ] Apply shared conservative conversion after older legacy adapters; report inferred ownership, excluded candidates and scoped conflicts; require explicit v5 save before old draft publication and leave stored old draft JSON unchanged until saved.
- [ ] Freeze displayed lifecycle evidence in new historical snapshots, but never restore/clear live lifecycle records on scenario activation or dirty scheduling inputs for lifecycle-only actions.
- [ ] Preserve lifecycle history when a draft temporarily omits an outcome and latch required-scope review when restored planning changes evidence; reconcile retired streams without ownerless included work.
- [ ] Verify v0–v4 published inputs/output/version byte-equivalence, legacy conversion/save/publication, changed-source and retired-stream behavior, v5 rank/state round trips, lifecycle-only clean state and scenario omission/return with database and focused scenario UI tests; update scheduling compatibility documentation and run typecheck plus affected tests.

Completion: the new calculation is explicit, historical results remain frozen and activating a what-if plan cannot roll back actual business completion.
