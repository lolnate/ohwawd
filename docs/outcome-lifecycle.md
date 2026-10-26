# Outcome completion service

Implementation task: **ohwawd-gqh7**, under **ohwawd-5q71**. Source requirements: `openspec/changes/implement-outcome-first-board/specs/outcome-lifecycle/spec.md`; design Decisions 6–7. This is the backend/evidence layer. The later sidebar task **ohwawd-4oo7** adds visible Mark complete/Reopen actions using the existing outcome workspace.

## Readiness uses actual saved evidence

`completionEvidence` uses at least one persisted minimum-required link and the full effective prerequisite closure. It reuses the scheduler's `isActuallyComplete`, `effectivePredecessors` and `effectiveRequiredClosure` helpers. Required source work must be completed with no open issues, remaining Extra scope, missing-source review, cross-team reconciliation or unresolved external blockers. Canceled is not completed. Missing nodes and cycles within required scope prevent completion; unrelated optional work and unrelated cycles do not.

Capacity setup, forecast dates, outcome targets, membership, stream/rank, visibility and existing business markers do not authorize completion. An actually complete excluded prerequisite satisfies the proof; an unfinished dismissed prerequisite does not. A project marked completed while open issues or scope remain needs reconciliation. Closed unestimated issues do not become unfinished work merely because they lack estimates.

The current delivery-scope signature records sorted direct required IDs, full closure IDs and normalized effective dependency pairs. Duplicate Linear/local edges represent one effective relationship; waiving a Linear edge does not remove an independent local edge. Changing direct required roots or the effective graph changes scope even if all resulting work is already complete. Unrelated optional links and metadata do not change that signature.

The evidence signature covers relevant current source status, open issue identity/state/estimate, Extra scope, source review/cross-team flags and external blockers. Names, descriptions, import timestamps and unrelated source work are excluded. Equivalent source refreshes therefore do not invalidate evidence just because time passed.

## Read contract

`GET /api/state` and Board reads attach an additive **`lifecycle`** object to each saved outcome:

- `completedAt`, `lifecycleVersion`, `completedScopeSignature`: persisted business marker, or open/null/version zero when no record exists.
- `ready`, `reasons`, `blockers`: actual required-work readiness and structured project/reconciliation explanations. `ready` can be true while an outcome remains manually open or while a completed outcome awaits explicit reopening; it is not an automatic action.
- `directRequiredIds`, `requiredIds`, `scopeSignature`: current saved delivery scope.
- `reviewNeeded`, `reviewReasons`: sticky persisted review context plus any currently observed discrepancy.
- `eligibilityToken`: opaque proof bound to outcome identity, current scope/evidence and lifecycle state/version.

Reads are read-only and independent of forecast availability. They never mark complete, reopen, append audit events or manufacture a catalog row from retained history. A stored business record for an absent planning definition remains history; live readiness resumes when that stable ID is restored.

## Completion endpoint

`PUT /api/outcomes/[id]/completion` uses the existing owner authentication and same-origin checks:

```json
{
  "completed": true,
  "expectedLifecycleVersion": 0,
  "eligibilityToken": "opaque proof from the latest saved outcome read"
}
```

Use `completed: false` to explicitly reopen. The endpoint accepts no metadata, links or client-supplied actor. It recomputes current persisted evidence while holding workspace row 1 in the same transaction as lifecycle persistence and audit. Source, scope, graph and scenario writers share that lock, so a displayed proof cannot authorize a write against intervening facts.

- **200**: `{ saved: true, lifecycle }` is the accepted snapshot, including its new version/token. Complete persists server time and scope; reopen clears the current marker/review fields but keeps prior events.
- **400**: malformed action/ID/version or unsupported combined-save fields.
- **401 / 403**: existing authentication/origin guards reject the request.
- **404**: no current planning definition exists for the outcome.
- **409 `OUTCOME_EVIDENCE_CONFLICT`**: displayed proof/version is stale or absent; the response supplies current `lifecycle` evidence for review.
- **409 `OUTCOME_ALREADY_COMPLETED` / `OUTCOME_ALREADY_OPEN`**: action conflicts with current business state. Completed outcomes must be reopened before recording another completion.
- **422 `OUTCOME_NOT_READY`**: current proof is validly displayed but required work is not actually complete.

Rejected actions do not alter history or planning inputs. A replay with an old version cannot add duplicate completion events. Completion, review and reopen events have monotonically increasing versions. An audit failure rolls back its marker change, and a review-audit failure rolls back the source/scope write that triggered it.

## Sticky review and writer hooks

Relevant writes re-evaluate completed outcomes after their final changes:

- Linear source import, including newly missing work and changed effective source dependencies.
- Outcome required links; accepted link/create responses also carry current lifecycle evidence for later sidebar integration.
- Extra scope changes, including removal.
- Local dependency add/remove and Linear waiver/restore, through the shared dependency store.
- Final scenario restoration, including direct scope/dependency restoration paths.

The first failed actual proof or changed required scope latches Review completion needed and appends one review event, preserving the original completion time. Reverting facts or scope does not clear that flag. Further refreshes do not repeatedly increment its version; read responses still show current reasons alongside the saved first-review context. Explicit reopen clears review, and a later eligible Mark complete records a new completion.

Lifecycle tables remain independent of scenario-managed definitions and survive ordinary deletion/recreation. Definition removal latches review in the same transaction while retaining completion time/history, so restoration cannot silently erase that invalidation. Scenario restoration never copies old lifecycle fields back into business storage. Lifecycle-only writes change no planning token, project execution, links, rank, capacity or scenario scheduling-dirty state. Markers never satisfy a project dependency or suppress newly unfinished work from normal scheduling.

## Integration boundary and verification

The later sidebar implementation must serialize complete/reopen with the existing captured outcome submissions, disable actions for dirty sections/pending writes, retain Close/Escape/backdrop availability, isolate newer openings and distinguish persistence from follow-up refresh failures. It should apply accepted lifecycle evidence from completion/link/create responses without treating a simulated finish or wait resolution as completion. [Scenario adoption and frozen historical comparison](scenario-v5-compatibility.md) are implemented; activation retains live history and publication freezes the saved draft's lifecycle evidence.

`tests/outcome-lifecycle.test.ts` covers proof semantics, validation, stale/current evidence, history, sticky source/link/graph/scope review, rollback, serialized source-update rejection, scenario/history retention and lifecycle-only scheduling cleanliness using PGlite. Historical migration tests seed the old writer's rows directly rather than running the current lifecycle-aware importer against a pre-foundation schema. `tests/ui/outcome-completion-api.spec.ts` verifies the real unauthenticated route guard and API-shaped completion/read/reopen behavior using the existing intercepted PGlite fixture; it does not claim live-Linear or production-database verification.

Verified results: typecheck, **127 unit/database tests** (11 new lifecycle cases), production build including the new route, **56 affected browser/API cases** (including both new completion API cases), strict current-spec/change and seven-archive validation, and whitespace checks passed. No existing local or remote database was migrated during this task.
