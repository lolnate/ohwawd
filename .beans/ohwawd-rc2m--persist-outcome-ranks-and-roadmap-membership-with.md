---
# ohwawd-rc2m
title: Persist outcome ranks and roadmap membership with conservative conversion
status: completed
type: task
priority: normal
created_at: 2026-10-25T18:37:18Z
updated_at: 2026-10-25T19:45:46Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-a5j9
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 2, 6, 8); openspec/changes/implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/implement-outcome-first-board/specs/outcome-sequencing/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (1.1).

- [x] Add numbered idempotent schema migration for per-stream outcome rank, roadmap state/selected invariants and independent workspace-global lifecycle records/events keyed by stable outcome identity.
- [x] Add shared conservative live/legacy conversion: preserve valid owners; infer only one unambiguous linked owner in the existing stream; otherwise excluded Needs assignment candidate with prior-stream review context; preserve deferred state, scope and links; seed ranks from previous displayed order.
- [x] Provide activated candidate defaults for future imports without conflating source visibility; expose typed rank/membership data and conversion feedback in state/Board contracts, with explicit null/unconverted pre-activation state.
- [x] Verify migration idempotency, included-owner/nullability constraints, zero/one/multiple legacy owner cases, deferred/hidden/source preservation, rank stability and untouched published JSON using PGlite tests; update migration/contract notes and run typecheck plus affected database tests.

Completion: persisted invariants and deterministic conversion are tested; no automatic outcome/link creation or silent ownerless charge. This task owns schema/conversion tests; dependent mutations/scheduler complete runtime behavior before release.

## Coordinated rollout refinement

Source inspection found the v4 mutation paths still create ownerless selected work, so activating new constraints in a foundation-only migration would break current editing. Design Decision 8 now stages migration 6 as additive nullable storage, with a shared pure converter and tested transactional activation helper. The dependent writer task registers activation in its following numbered migration, which performs backfill, strict nonnull enforcement and excluded-candidate defaults once writers are ready. Before activation typed fields explicitly report unconverted state. This Bean verifies both stages and activated import behavior; final requirements are unchanged. Legacy conversion must retain raw owner ambiguity instead of first applying the old arbitrary earliest-owner inference.

## Summary of Changes

Implemented numbered additive migration 6 (outcome-roadmap-foundation), conditional membership/rank constraints, deferrable per-stream rank uniqueness and independent lifecycle marker/event storage. Added pure conservative conversion shared by live activation and future editable-draft conversion, preserving valid owners, raw missing-owner ambiguity, prior-stream feedback, ranks, scoped sequence, hidden/deferred states, scope and links. A transactional/idempotent migration-only activation helper backfills once and enables strict nonnull/candidate defaults when the dependent v5 writers are ready; current v4 behavior remains intact before activation.

Extracted and database-tested saved workspace-state reads independently of forecasts and added typed rank/membership/conversion status to state/Board/client contracts. Added docs/roadmap-migration.md and updated README, scheduling/design/staging records. No new dependency or existing database migration was executed.

Verification: npm run typecheck passed; npm test passed all 88 tests (10 new roadmap conversion/schema/import/rollback/history tests); npm run build passed; 41 affected project-assignment/catalog/sidebar/ownership/workspace browser cases passed. Strict validation of the active change/all current specs and all 7 archives plus git diff --check passed. Reconciled OpenSpec task 1.1. Next unblocked implementation task is ohwawd-sug7 (atomic writers and coordinated activation).
