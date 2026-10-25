---
# ohwawd-rc2m
title: Persist outcome ranks and roadmap membership with conservative conversion
status: todo
type: task
priority: normal
created_at: 2026-10-25T18:37:18Z
updated_at: 2026-10-25T18:39:23Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-a5j9
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 2, 6, 8); openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/specs/outcome-sequencing/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (1.1).

- [ ] Add numbered idempotent schema migration for per-stream outcome rank, roadmap state/selected invariants and independent workspace-global lifecycle records/events keyed by stable outcome identity.
- [ ] Add shared conservative live/legacy conversion: preserve valid owners; infer only one unambiguous linked owner in the existing stream; otherwise excluded Needs assignment candidate with prior-stream review context; preserve deferred state, scope and links; seed ranks from previous displayed order.
- [ ] Default future imports to candidate without conflating source visibility; expose typed rank/membership data and conversion feedback in state/Board contracts.
- [ ] Verify migration idempotency, included-owner/nullability constraints, zero/one/multiple legacy owner cases, deferred/hidden/source preservation, rank stability and untouched published JSON using PGlite tests; update migration/contract notes and run typecheck plus affected database tests.

Completion: persisted invariants and deterministic conversion are tested; no automatic outcome/link creation or silent ownerless charge. This task owns schema/conversion tests; dependent mutations/scheduler complete runtime behavior before release.
