# Outcome-first Board data foundation

Implementation task: **ohwawd-rc2m**, under epic **ohwawd-5q71**. Requirements and coordinated rollout: [implement-outcome-first-board design](../openspec/changes/implement-outcome-first-board/design.md), Decisions 2, 6 and 8.

## Migration 6: additive storage

`outcome-roadmap-foundation` is installed by the normal `npm run db:migrate` workflow. It is followed by migration **7**, `activate-outcome-roadmap`; the application now requires ledger version **7**. The runner executes SQL and data hooks transactionally under the migration advisory lock; requests verify the ledger rather than performing DDL.

This foundation adds:

- `outcome.stream_position`, a positive unique position within a stream, with a deferrable uniqueness constraint for atomic reordering.
- `work_package.roadmap_state` and `roadmap_conversion`, including conditional state/selection/owner/nullability checks.
- `workspace.roadmap_planning_migrated`, identifying whether live conversion has been activated.
- `outcome_lifecycle` and `outcome_lifecycle_event`, retaining explicit business history independently of scenario-managed outcome definitions. Deleting or recreating a planning outcome does not delete its lifecycle record/events. No outcome is marked complete by this migration.

Migration 6 deliberately leaves legacy membership/rank fields null and the conversion marker false. **Null means not converted**, not candidate or included. The existing v4 writer/scheduler/scenario behavior continues during this implementation stage. It does not rewrite live placement, source data, scope or any stored scenario JSON. New imports retain pre-activation defaults until coordinated activation.

`GET /api/state` and Board reads expose additive typed `stream_position`, `roadmap_state`, `roadmap_conversion`, `roadmapPlanningMigrated` and `roadmapConversionFeedback` data. State reads remain independent of forecasting. No completion action, rank control or membership UI is claimed by this foundation.

## Coordinated activation

`activateRoadmapPlanning(client)` in `src/lib/roadmap-store.ts` is a **migration-only helper**, not a request-time or operator-facing action. Writer task **ohwawd-sug7** registers it in migration **7**, together with invariant-preserving assignment, ownership, link/delete, retirement and scenario-restore writers. Its caller owns the migration transaction; the helper locks workspace row 1 and returns immediately after a prior successful conversion. Do not run activation with an older application binary whose writers do not understand roadmap membership.

Activation uses the shared pure `convertRoadmapPlanning` function, which can also adapt editable legacy inputs without mutating them:

1. Preserve valid linked owners in the existing active stream. Infer ownership only for legacy ownerless selection with exactly one eligible linked outcome in that stream. Multiple or zero choices become excluded Needs assignment candidates with their previous stream and eligible choices recorded for review. Invalid explicit owners are not guessed away.
2. Preserve deferred work and its valid owner/stream return context; clear incompatible context while leaving it deferred. Explicit candidates/dismissed work remain excluded, and broken current-model included work requires review rather than renewed legacy inference.
3. Seed each stream's outcome ranks from the previous displayed order (`created_at DESC, id`); preserve existing ranked relative order when adapting already-converted inputs. Retain within-owner project preferences, links, Extra scope, pause notes, source facts and source visibility. Never create an outcome/link or silently repair dependency order.
4. Set membership nonnull, require a rank for every assigned outcome and change new-package defaults to `roadmap_state='candidate', selected=false`. New source projects then enter as excluded candidates; sync does not alter membership, owners, hidden state or conversion feedback of existing work.

The old legacy adapter's outcome-placement inference remains usable, but its earliest-owner tie-break must not run before conservative ownership conversion: doing so would hide ambiguous missing-owner inputs. The converter reuses placement inference only and examines raw project owners.

Backfill, constraint/default changes and the conversion marker commit or roll back together. Source/graph writer locking, ongoing ownership/rank invariants, scenario activation and v5 scheduling are completed by the dependent Beans. Published snapshots are never passed through a writable conversion or relabeled as v5.

## Verification

`tests/roadmap-planning.test.ts` checks pure conversion and an actual pre-foundation PGlite schema upgraded through migration 6 and activation. Coverage includes owner ambiguity, deterministic ranks, immutable/idempotent conversion, activated defaults/imports, retained hidden/deferred/scope state, membership/FK/rank constraints, transactional rollback, unchanged scenario JSON and lifecycle history surviving definition deletion/recreation. The migration runner smoke test also applies the complete numbered ledger. Integration runs include the existing import, Board, ownership, sequencing, scenario and outcome-workspace regressions.

Foundation verification: `npm run typecheck`, `npm test` (**88 passed**, including 10 new roadmap tests), `npm run build`, and `npm run test:ui -- tests/ui/project-assignment.spec.ts tests/ui/outcome-catalog.spec.ts tests/ui/outcome-workspace.spec.ts tests/ui/outcome-sequencing.spec.ts tests/ui/workspace-organization.spec.ts` (**41 passed**). Migration/conversion tests use PGlite; no existing local or remote database was migrated during this task.

Activated reads and new publication now use [v5 scheduling](scheduling-contract.md) and [versioned scenario compatibility](scenario-v5-compatibility.md). See [roadmap mutation contracts](roadmap-mutations.md) for the activated APIs. The active OpenSpec change remains open until the remaining Board/sidebar controls and cross-feature acceptance tasks are verified.
