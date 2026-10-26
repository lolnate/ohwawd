# Activated roadmap mutation contracts

Task: **ohwawd-sug7**, under **ohwawd-5q71**. Source: `openspec/changes/implement-outcome-first-board/design.md`, Decisions 2–3, 7–8. Migration **7** activates the tested [foundation conversion](roadmap-migration.md) through the normal versioned migrator. No existing database was migrated during development verification.

## Atomicity and concurrency

Production writes run in a transaction holding workspace row 1. Source import, cycle refresh and Extra scope writers share that lock. Reads expose a forecast-independent `planningToken`; Board sequence/ownership tokens additionally cover activated membership, outcome rank, owning outcome, scoped sequence, effective graph and relevant source changes. Conflicts return HTTP 409 with reload guidance rather than overwriting the newer plan. Authentication/origin checks and retired-control rejection remain in the routes.

Internal services accept a transaction client; the caller must commit or roll back the complete operation. Included work always has a saved link to one owner in the same active stream. Candidate/dismissed work has no owner/stream and no selected demand; deferred work retains only valid owner/stream return context. API commits validate cross-table ownership/active-stream agreement alongside database membership, FK and rank constraints.

## Board API

`PUT /api/board` retains existing mutations and adds:

| Type | Inputs / behavior |
| --- | --- |
| `outcomeAssignment` | `outcomeId`, `streamId` (active ID or null), `sequenceToken`, `ownershipToken`, optional **one of** `beforeOutcomeId` / `afterOutcomeId`. Cross-stream moves append by default; same-stream no-target repeats preserve rank. Only owned included work moves; deferred return context follows without becoming included. |
| `roadmapMembership` | `packageId`, `action`, `sequenceToken`, `planningToken`, optional `outcomeId`, `beforeId`, `reason`. Actions: `include`, `resume`, `candidate`, `defer`, `dismiss`, `restore`. Include/resume require an eligible linked owner; Restore only changes dismissed → candidate. |
| `ownership` | Existing sequence/ownership tokens and eligible linked `outcomeId`, optional owner-scoped `beforeId`. Transfers move the sole charge and retain all links. Null ownership is rejected for included work; use candidate/dismiss to exclude it. |
| `package` / `assignment` | Existing package moves/bulk stream assignment can supply `outcomeId`. Inclusion without a valid owner is rejected; insertion targets must be within that owner. Bulk placement validates the whole plan before any row changes. |

Project order is subordinate to owner: direct/transitive unfinished predecessors within one outcome must precede successors, including paths through other owners. Cross-owner ranks can put the successor above its prerequisite; this is a dependency wait, not a queue-order violation. Source-introduced scoped conflicts retain saved order and permit repair moves that reduce existing violations without adding another. Dragging does not create or waive edges. Visible drag/triage controls are delivered in the later Board-control task.

## Link removal and deletion in the shared sidebar

- Links PUT sends `{ links, planningToken }`; DELETE sends `{ planningToken }`. Missing or stale tokens receive reload guidance. Metadata PUT and transactional creation keep their independent save scopes.
- Removing an owning link, deleting or unassigning its outcome first converts affected included work to excluded Needs assignment candidates. No remaining linked owner is guessed. Deferred work stays deferred with invalid return context cleared; hidden/source state, estimates, scope and other links remain.
- Responses return `affectedCandidates` and a new accepted `planningToken`. Link and creation responses now also carry current [lifecycle evidence](outcome-lifecycle.md); creation returns its ID as well. Sidebar accepted planning snapshots retain the token even if the follow-up read fails; lifecycle-action integration follows in its dedicated task.
- The Projects draft captures its planning token when editing begins. Background refresh cannot silently authorize an old draft against a new plan. A rejected save keeps both section drafts; **Review latest planning context** explicitly refreshes saved context and allows a reviewed retry while retaining inputs. No autosave, global Save or replacement overlay is introduced.
- Workspace notices name newly excluded work and explain the need to choose an owner. Submitted writes retain the existing dismissal/new-opening guards and refresh-only retry behavior.

## Stream retirement and scenarios

Retirement preview and confirmation include every affected package. All projects owned by an outcome must share its destination; split destinations reject atomically. Outcomes append to destination streams in source rank order with their owned included work and deferred context. Null destination unassigns the outcome and excludes its previously included work. `targetStreamId` can specify a common retirement destination, including for empty outcomes; explicit package destinations must agree with that choice. Preview tokens cover the destination, and preview/savepoints never persist changes. Audit failure rolls back placement, ranks and retirement together.

Activated scenario restoration uses conservative conversion with raw missing-owner ambiguity, restores only valid ownership/ranks, leaves independent lifecycle history intact and re-evaluates completion review against final restored scope. Stored legacy draft JSON and published revisions remain untouched. Full v5 fingerprints, historical comparisons and publication conversion belong to the scenario-adoption task.

## Calculation adoption boundary

Activated reads and new publication now use [v5 scheduling](scheduling-contract.md), with [scenario conversion and frozen-history compatibility](scenario-v5-compatibility.md). The transitional label and publication guard are retired; older drafts still require explicit v5 save/rebase before publication. Remaining Board/sidebar controls and integrated acceptance are tracked in the active OpenSpec change.

## Verification

`tests/roadmap-mutations.test.ts` exercises activated PGlite transactions for rank insertion/idempotency, cross-stream owner moves, explicit membership/transfer, one charge, scoped dependency rejection/repair, stale tokens, bulk rollback, owner/link/delete cleanup, coherent/empty-outcome retirement, audit rollback and safe legacy-scenario restoration. Browser fixture writes use the same link/delete services and tokens; focused sidebar cases verify stale-save draft preservation/reviewed retry and named excluded-work feedback. Migration tests execute both SQL entries and activation data hooks.

Verified results: `npm run typecheck`, `npm test` (**98 passed**, including 10 activated-mutation cases), `npm run build`, strict current-change/spec and archive validation, and `git diff --check` all passed. The affected project-assignment, catalog, outcome-workspace, ownership, workspace-organization and Settings-editor browser suites passed **54 cases**, including both new activated-sidebar cases. Tests use the existing PGlite fixtures, not a live Linear service or existing database.
