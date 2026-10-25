---
# ohwawd-d92k
title: Implement v5 outcome-priority scheduling and waiting explanations
status: todo
type: task
created_at: 2026-10-25T18:37:50Z
updated_at: 2026-10-25T18:37:50Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-sug7
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decision 4); openspec/changes/implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (3.1).

- [ ] Feed outcome rank, exclusive ownership and roadmap state to the scheduler; share effective required-closure and actual-completion predicates for subsequent lifecycle work.
- [ ] Carry started work, then choose one eligible project per stream by required tier, owner rank, scoped sequence and stable ID; retain finish-to-start, capacity conservation, no borrowing and next-cycle unlocking.
- [ ] Exclude candidate/dismissed/deferred future demand while retaining unresolved dependency constraints and actually-complete prerequisite satisfaction; scope source-order conflicts to the owning outcome.
- [ ] Produce structured waiting/bypass context with prerequisite identity, owning location or excluded state and affected successors, without priority donation or invented dates.
- [ ] Verify rank effects, required-before-optional, carried optional work, lower-ranked shared prerequisite, independent stream concurrency, immediate-versus-deep closure, zero/unknown demand and capacity rounding with meaningful forecast tests; update docs/scheduling-contract.md with the planned v5 rules and explicit implementation staging, run typecheck and affected unit/database tests.

Completion: the design worked example schedules C then A then B and all prior conserved-capacity/actual-fact semantics remain tested. Scenario publication adoption is completed in the dependent compatibility task before release.
