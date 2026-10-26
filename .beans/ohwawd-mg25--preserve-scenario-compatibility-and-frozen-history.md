---
# ohwawd-mg25
title: Preserve scenario compatibility and frozen history under v5
status: completed
type: task
priority: normal
created_at: 2026-10-25T18:38:26Z
updated_at: 2026-10-25T22:16:52Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-d92k
    - ohwawd-gqh7
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 6, 8); openspec/changes/implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/implement-outcome-first-board/specs/outcome-lifecycle/spec.md; openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (5.1).

- [x] Adopt calculationVersion v5 for new saves/publications and round-trip rank, membership, ownership and scoped order in scenario fingerprints, activation and comparisons.
- [x] Apply shared conservative conversion after older legacy adapters; report inferred ownership, excluded candidates and scoped conflicts; require explicit v5 save before old draft publication and leave stored old draft JSON unchanged until saved.
- [x] Freeze displayed lifecycle evidence in new historical snapshots, but never restore/clear live lifecycle records on scenario activation or dirty scheduling inputs for lifecycle-only actions.
- [x] Preserve lifecycle history when a draft temporarily omits an outcome and latch required-scope review when restored planning changes evidence; reconcile retired streams without ownerless included work.
- [x] Verify v0–v4 published inputs/output/version byte-equivalence, legacy conversion/save/publication, changed-source and retired-stream behavior, v5 rank/state round trips, lifecycle-only clean state and scenario omission/return with database and focused scenario UI tests; update scheduling compatibility documentation and run typecheck plus affected tests.

Completion: the new calculation is explicit, historical results remain frozen and activating a what-if plan cannot roll back actual business completion.

## Writer-stage handoff

The writer task registers migration 7 and a minimal conservative activated scenario restore preserving membership/rank/owner invariants and independent lifecycle history. Activated Board reads are temporarily labeled v5-pending; publishScenario rejects active roadmap publication with CALCULATION_UPGRADE_PENDING. Replace this temporary label/guard only when full v5 scheduling, scenario fingerprints/compare/activation/conversion and publication version checks are delivered; never let altered membership semantics publish under v4. Preserve raw missing-owner ambiguity by using adaptScopePlanning plus convertRoadmapPlanning rather than old earliest-owner inference.

## Scheduler-core handoff

Activated Board inputs now explicitly select forecast schedulingMode=outcome with ownerOutcomeId, roadmapState, outcome streamId/rank. The v5 selection algorithm and optional waiting/priorityBypass output are verified; pre-activation inputs retain project mode. The outer Board calculationVersion is still v5-pending and publication guard remains. Complete scenario adoption/versioning/fingerprints/history checks before changing that outer label to v5 or removing the guard.

## Lifecycle-service handoff

src/lib/outcome-lifecycle.ts now reads current lifecycle evidence independently of forecasts and reconciles completed markers after final source/link/Extra scope/dependency/scenario changes. Existing activateScenario invokes final reconciliation and never restores lifecycle fields from snapshot JSON. getBoard/getWorkspaceState attach outcome.lifecycle; new snapshots naturally include that display evidence, while planningState explicitly ignores it for dirty detection (verified). Complete v5 history display/comparison/publication rules, including Lifecycle not recorded for older frozen inputs. Preserve independent business records/events when scenario definitions are omitted/restored and keep reconciliation after final restored facts, not transient intermediate states.

## Reconciliation details

Design Decision 8 now specifies per-draft outcomeCatalogIds: capture merges previously managed IDs with live definitions, and activation removes only managed omissions while preserving newer unrelated outcomes. Legacy inputs without a roster infer no deletions. Saved lifecycle display is frozen as-is at publication; lifecycle-only changes remain planning-clean and can be captured with an explicit Save board. Stream autosave must not implicitly convert legacy JSON before explicit save/rebase. These choices reconcile omission/history requirements with the existing preservation of newer unrelated outcomes.

## Adoption implementation progress

Activated Board/scenario capture now uses v5 and the temporary publication guard is removed in favor of normal current-version/readiness/source/dirty checks. Fingerprints/comparisons retain rank, membership, ownership, scoped order and managed omission scope separately from source priority and lifecycle display. Legacy activation preserves raw owner ambiguity and stored JSON until explicit save/rebase; stream autosave does not silently convert it. V5 managed rosters support omission/return without deleting newer unrelated definitions or rolling back business history. Comparisons expose frozen lifecycle evidence and Lifecycle not recorded for missing historical fields. Focused backend and scenario UI suites passed; final broader validation and delivered documentation follow.

## Summary of Changes

Adopted v5 for activated Board reads, scenario capture/save/rebase/publication and removed the transitional publication pause. Current-version, readiness, edit-version, source/retired-stream and planning-dirty checks now govern publication. Fingerprints/activation/comparisons round-trip rank, candidate/included/deferred/dismissed membership, linked ownership, scoped order and managed outcome scope separately from Linear priority and business lifecycle display.

Legacy editable conversion retains raw missing-owner ambiguity and budget/sequence semantics, exposes named reconciliation feedback, requires explicit Save board or reviewed rebase before publication and leaves stored old JSON untouched until that action. Stream autosave does not silently convert legacy snapshots. Published v0–v4 source/input/output/version remain byte-equivalent; comparison never recalculates them or injects live completion facts.

Added v5 outcomeCatalogIds rosters for intentional omission/return while preserving newer unrelated definitions. Removal downgrades owned work safely and retains independent business history; completed definition removal latches scope review atomically, and reintroduction preserves the saved creation time and original completion timestamp. Lifecycle-only writes remain scheduling-clean. Publication freezes the saved snapshot evidence, with Lifecycle not recorded for absent old fields and separate frozen lifecycle/readiness comparison UI.

Added eight v5 scenario/PGlite cases and three browser cases for actual v5 save/publish/compare, legacy conversion/save gating and frozen lifecycle after live reopen; extended lifecycle deletion audit rollback. Inspected the generated 390px comparison screenshot for wrapping/containment. Documented behavior and activation boundary in docs/scenario-v5-compatibility.md and current scheduling/lifecycle/migration docs; reconciled OpenSpec task 5.1. No new dependency, schema migration, deployment or existing database migration occurred.

Verification: typecheck, all 135 unit/database tests, production build, full 89-case browser suite, follow-up five scenario/completion browser cases after review-removal finalization, strict all-current/change and seven-archive validation plus whitespace checks passed. Next ready task: ohwawd-0lzq (accessible Board controls).
