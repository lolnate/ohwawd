---
# ohwawd-gqh7
title: Persist manual outcome completion with current-evidence validation
status: completed
type: task
priority: normal
created_at: 2026-10-25T18:38:12Z
updated_at: 2026-10-25T21:42:31Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-d92k
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 6–7); openspec/changes/implement-outcome-first-board/specs/outcome-lifecycle/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (4.1).

- [x] Compute lifecycle readiness from at least one saved required link and actual reconciled completion of the full effective required closure, independently of forecasts/capacity and unrelated optional work.
- [x] Implement authenticated PUT /api/outcomes/[id]/completion with expected lifecycle version and current eligibility token validated atomically under the planning/source lock; retain audit history and explicit reopen without changing planning inputs.
- [x] Expose accepted marker, readiness/reasons, scope signature and review state in state/Board reads; keep lifecycle records independent of scenario-managed outcome definitions and ordinary deletion.
- [x] Latch completion-review feedback on relevant source, required links/dependencies, Extra scope and later scenario changes; unrelated imports/optional metadata do not invalidate evidence and reverted edits do not silently clear a latched review.
- [x] Verify completed-source discrepancies, canceled versus completed, unknown/missing/cyclic/deep prerequisites, excluded-but-actually-complete work, optional-only outcomes, stale/source-race rejection, event history and rollback with unit/PGlite/API tests; document lifecycle endpoint/semantics and run typecheck plus affected tests.

Completion: no forecast date or lifecycle marker can substitute for actual prerequisite completion; completion/reopen changes business history only. Scenario hooks are finished with the dependent compatibility task and sidebar controls follow separately.

## Scheduler handoff

Reuse src/lib/delivery-scope.ts: isActuallyComplete, effectivePredecessors and effectiveRequiredClosure are implemented and tested against excluded completed work, missing/deep/cyclic required scope, waivers and source discrepancies. Eligibility must use current actual facts and persisted required closure, never simulated forecast finishes or waiting intervals. Forecast waiting/priorityBypass are explanatory predictions; their finite resolution does not establish business completion.

## Completion-service progress

Implemented pure current-evidence readiness/signatures, shared-lock complete/reopen persistence, current version/token rejection, independent audit/history, additive lifecycle reads and accepted snapshots. Relevant source/link/Extra scope/dependency/scenario writes latch the first review event without auto-reopening; actual facts recovering do not erase it. Focused PGlite tests cover proof, source-update serialization, atomic audit rollback, history/scenario retention and planning cleanliness. The real unauthenticated route guard and API-shaped lifecycle round trip pass in browser tests; combined validation follows. Contract: docs/outcome-lifecycle.md. Visible sidebar actions remain in ohwawd-4oo7.

## Summary of Changes

Delivered pure actual-completion proof over persisted minimum-required roots and their full effective closure, with normalized scope/evidence signatures, structured reconciliation blockers and no forecast/capacity/membership gate. Added owner/origin-protected PUT /api/outcomes/[id]/completion with current lifecycle-version/token validation under the shared planning lock, explicit complete/reopen, accepted snapshots and atomic audit history. Duplicate/stale/not-ready requests reject without changing business state; canonical UUID handling follows database identity.

State/Board reads now attach current lifecycle readiness/marker/review evidence without writes or phantom historical rows. Link/create responses include current lifecycle evidence for later sidebar adoption. Source imports, link changes, Extra scope, dependency add/remove/waive/restore and final scenario restoration latch the first invalidation once, retaining original completion time and sticky review until explicit reopen. Lifecycle-only changes preserve planning tokens and scenario scheduling-clean state; source work can schedule again despite a retained completed marker. Stored business history survives planning definition deletion/recreation.

Added 11 pure/PGlite tests covering actual/optional/deep/missing/cyclic/canceled/unknown/discrepant scope, stale proof and serialized source updates, audit rollback, sticky review, history/scenario retention and scheduling independence. Added two browser/API cases for the real unauthenticated route guard and PGlite-backed API lifecycle round trips; aligned fixture error details with production. Updated historical-schema fixtures to seed old-writer rows rather than running current lifecycle-aware writes against absent tables. Documented contracts in docs/outcome-lifecycle.md and reconciled OpenSpec task 4.1. No new dependency, schema migration or existing database migration was needed.

Verification: typecheck, all 127 unit/database tests, production build, 56 affected browser/API cases, strict all-current/change and seven-archive validation plus whitespace checks passed. The v5-pending publication boundary remains. Next ready task: ohwawd-mg25 (scenario compatibility/adoption); visible sidebar actions remain in ohwawd-4oo7.
