---
# ohwawd-d92k
title: Implement v5 outcome-priority scheduling and waiting explanations
status: completed
type: task
priority: normal
created_at: 2026-10-25T18:37:50Z
updated_at: 2026-10-25T21:01:00Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-sug7
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decision 4); openspec/changes/implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (3.1).

- [x] Feed outcome rank, exclusive ownership and roadmap state to the scheduler; share effective required-closure and actual-completion predicates for subsequent lifecycle work.
- [x] Carry started work, then choose one eligible project per stream by required tier, owner rank, scoped sequence and stable ID; retain finish-to-start, capacity conservation, no borrowing and next-cycle unlocking.
- [x] Exclude candidate/dismissed/deferred future demand while retaining unresolved dependency constraints and actually-complete prerequisite satisfaction; scope source-order conflicts to the owning outcome.
- [x] Produce structured waiting/bypass context with prerequisite identity, owning location or excluded state and affected successors, without priority donation or invented dates.
- [x] Verify rank effects, required-before-optional, carried optional work, lower-ranked shared prerequisite, independent stream concurrency, immediate-versus-deep closure, zero/unknown demand and capacity rounding with meaningful forecast tests; update docs/scheduling-contract.md with the planned v5 rules and explicit implementation staging, run typecheck and affected unit/database tests.

Completion: the design worked example schedules C then A then B and all prior conserved-capacity/actual-fact semantics remain tested. Scenario publication adoption is completed in the dependent compatibility task before release.

## Writer-stage handoff

Activated sequencingState now carries outcomeScoped, ownerId/roadmapState per package, saved outcome ranks and linked-owner eligibility. orderConflicts scopes precedence to the owning outcome; cross-owner same-stream inversions are allowed. Board reads currently use v5-pending until forecast and scenario adoption are complete. The forecast still needs the planned owner-rank/required-tier inputs, correctly owner-scoped source-conflict withholding and structured waiting/bypass output; do not treat the mutation foundation as the v5 scheduler.

## Scheduler implementation progress

Activated Board inputs now select outcome mode with persisted owner/rank/membership. Added shared delivery-scope predicates/closure, required-tier/owner-rank/scoped-order selection, actual excluded-work satisfaction, honest zero-budget starts and owner-only source-conflict withholding. Structured waiting and actual simulated priorityBypass events retain prerequisite identity/location/excluded state and affected successors without fabricated dates or rank donation. Focused tests cover the approved C → A → B example, optional carry/tier rules, shared/deep/missing/waived dependencies, capacity rounding and activated Board integration; final combined verification follows. The outer v5-pending and publication guard remain for scenario adoption.

## Summary of Changes

Implemented the v5 scheduling core behind explicit activated outcome mode: valid linked owner/stream/rank and roadmap membership feed required-tier → owner-rank → scoped-sequence → stable-ID selection, with non-preemptive carry and unchanged one-slot/capacity/dependency-cycle rules. Candidate/dismissed/deferred demand is excluded while actually complete excluded prerequisites satisfy dependencies; owner-scoped source conflicts withhold only that owner. The approved example schedules C, A, then B, with no hidden priority donation.

Added shared isActuallyComplete/effectivePredecessors/effectiveRequiredClosure helpers and structured per-outcome waiting/priorityBypass output including prerequisite names/locations/state, affected successors, required-versus-optional context, simulated wait intervals, eventual forecast resolution and inspection/include/resume guidance. Bypass events reflect real new lower-ranked selections, not missing scope, carry or zero capacity. Positive-demand work receives no false zero-budget start; explicit zero demand still obeys dependencies. Effective duplicate edges produce one wait, and Linear waivers do not remove independent local constraints.

Added 18 meaningful pure/PGlite tests covering the design examples, optional carry/tier rules, same/cross-stream shared work, excluded/actual completion, deep/missing/waived/cyclic scope, stable ordering, conservation/rounding, zero/unknown demand and persisted Board rank/source-conflict integration. Documented delivered scheduling/output/staging contracts and reconciled OpenSpec task 3.1. Activated output remains v5-pending with publication blocked until scenario adoption; no existing database migration was executed.

Verification: npm run typecheck passed; npm test passed all 116 unit/database tests; npm run build passed; 54 affected assignment/catalog/sidebar/ownership/workspace/Settings browser tests passed; strict all-current/change and seven-archive validation plus git diff --check passed. Next ready task: ohwawd-gqh7 (actual-evidence completion service).
