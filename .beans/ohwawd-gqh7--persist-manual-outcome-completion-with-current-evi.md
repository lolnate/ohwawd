---
# ohwawd-gqh7
title: Persist manual outcome completion with current-evidence validation
status: todo
type: task
created_at: 2026-10-25T18:38:12Z
updated_at: 2026-10-25T18:38:12Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-d92k
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 6–7); openspec/changes/implement-outcome-first-board/specs/outcome-lifecycle/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (4.1).

- [ ] Compute lifecycle readiness from at least one saved required link and actual reconciled completion of the full effective required closure, independently of forecasts/capacity and unrelated optional work.
- [ ] Implement authenticated PUT /api/outcomes/[id]/completion with expected lifecycle version and current eligibility token validated atomically under the planning/source lock; retain audit history and explicit reopen without changing planning inputs.
- [ ] Expose accepted marker, readiness/reasons, scope signature and review state in state/Board reads; keep lifecycle records independent of scenario-managed outcome definitions and ordinary deletion.
- [ ] Latch completion-review feedback on relevant source, required links/dependencies, Extra scope and later scenario changes; unrelated imports/optional metadata do not invalidate evidence and reverted edits do not silently clear a latched review.
- [ ] Verify completed-source discrepancies, canceled versus completed, unknown/missing/cyclic/deep prerequisites, excluded-but-actually-complete work, optional-only outcomes, stale/source-race rejection, event history and rollback with unit/PGlite/API tests; document lifecycle endpoint/semantics and run typecheck plus affected tests.

Completion: no forecast date or lifecycle marker can substitute for actual prerequisite completion; completion/reopen changes business history only. Scenario hooks are finished with the dependent compatibility task and sidebar controls follow separately.
