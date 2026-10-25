---
# ohwawd-sug7
title: Enforce atomic outcome placement ownership and roadmap lifecycle
status: todo
type: task
created_at: 2026-10-25T18:37:34Z
updated_at: 2026-10-25T18:37:34Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-rc2m
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 2–3, 7); openspec/changes/implement-outcome-first-board/specs/outcome-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (2.1).

- [ ] Extend outcomeAssignment with persisted before/after rank insertion, cross-stream append defaults and same-stream no-target idempotency; move only owned included work.
- [ ] Implement explicit include/candidate/defer/resume/dismiss/restore and linked-owner transfer with owner-scoped project insertion; keep Hide visibility-only and disallow active stream inclusion without an owner.
- [ ] Reconcile dependency placement/conflicts within one owner while allowing same-stream cross-owner rank inversions; preserve effective graph, atomic bulk edits and incremental repair.
- [ ] Update link removal, outcome deletion/unassignment and stream retirement to downgrade included owned work before owner removal or coherently migrate outcomes/work; return affected-candidate feedback and preserve deferred/dismissed state.
- [ ] Extend concurrency tokens/locking to rank, membership, ownership, links and relevant source/dependencies; update API contracts and the outcome sidebar link/delete token handling without changing save boundaries.
- [ ] Verify stale rejection, rollback, single charges, no guessed replacement owner, destination insertion/idempotency, source conflicts, all owner-removal paths and retired fields with database/API tests; retain sidebar link/delete browser coverage, document changed mutation contracts, run typecheck and affected tests.

Completion: every mutation preserves included-owner/stream agreement and produces no ownerless active roadmap charge. Update the existing PGlite browser fixture alongside API changes.
