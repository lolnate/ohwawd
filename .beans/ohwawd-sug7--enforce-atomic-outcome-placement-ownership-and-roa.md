---
# ohwawd-sug7
title: Enforce atomic outcome placement ownership and roadmap lifecycle
status: completed
type: task
priority: normal
created_at: 2026-10-25T18:37:34Z
updated_at: 2026-10-26T01:20:17Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-rc2m
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/archive/2026-10-25-implement-outcome-first-board/design.md (Decisions 2–3, 7); openspec/changes/archive/2026-10-25-implement-outcome-first-board/specs/outcome-sequencing/spec.md; openspec/changes/archive/2026-10-25-implement-outcome-first-board/specs/stream-sequencing/spec.md; openspec/changes/archive/2026-10-25-implement-outcome-first-board/specs/project-assignment/spec.md; openspec/changes/archive/2026-10-25-implement-outcome-first-board/tasks.md (2.1).

- [x] Extend outcomeAssignment with persisted before/after rank insertion, cross-stream append defaults and same-stream no-target idempotency; move only owned included work.
- [x] Implement explicit include/candidate/defer/resume/dismiss/restore and linked-owner transfer with owner-scoped project insertion; keep Hide visibility-only and disallow active stream inclusion without an owner.
- [x] Reconcile dependency placement/conflicts within one owner while allowing same-stream cross-owner rank inversions; preserve effective graph, atomic bulk edits and incremental repair.
- [x] Update link removal, outcome deletion/unassignment and stream retirement to downgrade included owned work before owner removal or coherently migrate outcomes/work; return affected-candidate feedback and preserve deferred/dismissed state.
- [x] Extend concurrency tokens/locking to rank, membership, ownership, links and relevant source/dependencies; update API contracts and the outcome sidebar link/delete token handling without changing save boundaries.
- [x] Verify stale rejection, rollback, single charges, no guessed replacement owner, destination insertion/idempotency, source conflicts, all owner-removal paths and retired fields with database/API tests; retain sidebar link/delete browser coverage, document changed mutation contracts, run typecheck and affected tests.

Completion: every mutation preserves included-owner/stream agreement and produces no ownerless active roadmap charge. Update the existing PGlite browser fixture alongside API changes.

## Activation prerequisite from foundation

Design Decision 8 uses additive migration 6 plus the foundation activation helper. Once all writers in this task preserve rank/membership/owner invariants, register activation in the next numbered migration and extend the migration runner for its transactional data helper as needed. Do not activate the new defaults/nonnull constraints with old v4 writers. Verify the integrated mutation/import/scenario contracts against activated state; keep published history frozen. Foundation conversion deliberately preserves raw missing-owner ambiguity rather than invoking old earliest-owner inference.

## Implementation progress

Implemented activated owner-scoped placements, rank insertion, membership actions, ownership transfer, unlink/delete/unassign cleanup, coherent retirement with empty-outcome destinations, expanded tokens/locks and sidebar captured-token/reviewed retry. Migration 7 registers the foundation data activation hook; minimal scenario restoration is invariant-safe without losing raw legacy-owner ambiguity or lifecycle history. Activated calculations are labeled v5-pending and publication is explicitly blocked until scheduler/scenario adoption to avoid generating mislabeled v4 results. Typecheck, 97 unit/database tests and 54 affected browser tests passed before a final exact-no-op preference regression refinement. Final build and focused regression verification follow; docs/roadmap-mutations.md records API and staging contracts.

## Summary of Changes

Delivered atomic before/after outcome rank insertion and default append/no-op semantics, explicit linked-owner inclusion/transfer and candidate/defer/resume/dismiss/restore actions, owner-scoped dependency placement with incremental source-conflict repair, safe owner/link/delete/unassign cleanup and coherent stream retirement including empty outcomes. Invalid bulk moves, split owner destinations, stale context and audit failures roll back without partial writes. Source visibility remains independent of membership.

Added forecast-independent planning tokens to reads and accepted mutations; expanded sequence/ownership concurrency and shared writer locks. Sidebar captures each Projects edit token, preserves both drafts on rejection, offers explicit reviewed refresh/retry, retains accepted tokens after refresh failure and names newly excluded work. Browser fixture uses real token/link/delete services and activated-state cases.

Registered migration 7 data activation with transactional migration hooks and safe minimal activated scenario restoration. Activated output uses v5-pending and publication is temporarily rejected until dependent scheduler/scenario adoption, preventing mislabeled v4 history. No existing local/remote database migration was executed. Documented API, staging and handoff in docs/roadmap-mutations.md, docs/roadmap-migration.md, design and dependent Beans.

Verification: typecheck, all 98 unit/database tests (including 10 new activated-mutation cases), production build, 54 affected browser cases (including two new activated-sidebar cases), strict all-current/change and seven-archive validation and whitespace checks passed. Fixed a deferred-context ordering bug revealed by move tests and ensured already-satisfied scoped assignments preserve exact numeric preferences. OpenSpec task 2.1 reconciled. Next ready task: ohwawd-d92k.
