# Design

## Context

See `proposal.md` for motivation and `docs/board-design-validation.md` for the seven confirmed author clarifications. Current code has one work package/stream/nullable capacity owner, separate outcome links, a project-first v4 scheduler, dependency-aware required closure, and outcome rows that show direct links only. Relevant modules are `forecast.ts`, `sequence-store.ts`, `sequencing.ts`, `outcome-ownership.ts`, `outcome-planning.ts`, `board.ts`, `scenarios.ts` and their browser fixtures.

The catalog/sidebar epic **ohwawd-2ods** is verified and archived at `openspec/changes/archive/2026-10-25-redesign-outcome-catalog/`. `src/app/outcome-workspace.tsx` now owns captured serialized writes outside dialog lifetime and opening-scoped Details/Projects drafts. Extend that controller rather than restoring a separate outcome overlay. Settings has also shipped; preserve its independent modal and planning refresh integration.

## Goals / Non-Goals

**Goals:** one coherent priority model across persistence, scheduler and Board; explicit ownership and membership invariants; zero duplicate charges; truthful, accessible dependency presentation; manual completion based on actual evidence; conservative versioned conversion and immutable historical results.

**Non-goals:** within-cycle starts, preemption, priority donation, automatic project-to-outcome creation, transitive visual expansion, cross-panel arrow routing, project/estimate splitting, Linear writes, forecast-derived completion, autosave or a combined metadata/link/lifecycle transaction disguised as one Save.

## Decisions

### 1. Resolve the remaining design details explicitly

| Review question | Chosen behavior | Rationale / alternative |
| --- | --- | --- |
| Higher optional work versus lower required work | Carry started work first; among unstarted eligible work, required-delivery closure precedes optional-only work, then owning outcome rank | First delivery takes precedence over enhancements; strict outcome rank including optional work would delay required delivery in later outcomes |
| Lower outcome owns a higher outcome's prerequisite | Keep the owner's rank; skip blocked higher work, select the next eligible same-tier work and explain the wait/bypass | No hidden priority inheritance or automatic rank edits; rank cannot guarantee finish order |
| Destination insertion | Append to destination tail by default; explicit before/after available; same-stream no-target operation is a no-op | Predictable placement without silently stealing first priority |
| Owning link/outcome removed | Included work becomes excluded Needs assignment candidate; do not guess a replacement owner | Rejecting every unlink/delete would complicate the completed sidebar; retaining an ownerless charge violates confirmed ownership |
| Connector extent | Only immediate effective edges between endpoints in each outcome row; local shared reference boxes for cross-stream prerequisites | Avoid a cross-panel arrow overlay and retain textual/deep tracing |
| Dotted versus dashed | Keep the existing semantic dashed reference border | Same zero-count meaning and established Neon Velocity treatment; literal dotted styling adds no new behavior |
| Completed display/reopen/change | Retain row/rank, label/time; explicit reopen; scope/evidence change shows Completed · Review completion needed until reopened | No automatic business-state rewrite; completion never changes scheduling gates |

These are resolved choices for this proposal, not additional author quotations. The seven confirmed clarifications remain recorded verbatim in the review. No unresolved requirement-level design question is deferred to implementation.

### 2. Persist ranks and explicit roadmap membership

Add nullable `outcome.stream_position`, unique within an assigned stream, with positive contiguous positions normalized transactionally. Unassigned outcomes have null position. Seed each stream using the pre-migration displayed order (`created_at DESC, id`) so initial visual priority is stable. Ranks are per stream; independent streams retain their allocation/concurrency and no global ordinal is invented.

Add `work_package.roadmap_state` with values:

| State | Scheduling | Ownership / placement | Visible home |
| --- | --- | --- | --- |
| `candidate` | Excluded | No capacity owner or stream | Needs assignment / source triage |
| `included` | Count remaining demand once | Exactly one linked owner in an active stream; package stream matches owner | Owner's primary Board row plus references |
| `deferred` | Excluded | Keep valid owner/stream as return context, nullable if removed | Deferred shelf and explanatory outcome chips |
| `dismissed` | Excluded | No capacity owner or stream; retain links and scope | Dismissed source triage and unresolved dependency references |

Retain `selected` as a compatibility projection of `roadmap_state === included`; it is not a second independent membership switch. New imports create candidates. Hide/Restore continues to update `in_scope` only; Dismiss/Restore roadmap controls use explicit membership terminology and endpoints. Restore dismissed → candidate; Resume deferred → included only with valid owner. Actually complete work can satisfy dependencies while excluded because completion evidence is evaluated before scheduling eligibility.

Use database checks for state/selected/nullability, the existing owner-link FK, and transactional validation for active stream and owner-stream agreement. Lock the workspace planning row while applying multi-record placement/rank/membership writes; validate final state before commit. Update owned included projects to candidate **before** removing their owner link/outcome so FK cleanup cannot leave an included ownerless row. Keep estimates, Extra scope and remaining links. Return affected candidate IDs/names for feedback. Deferred work remains deferred if its owner is removed, clearing invalid return context.

Alternative: reuse `in_scope` or `selected` alone. Rejected because visibility, a planning pause and an explicit off-roadmap dismissal have different meanings and restoration behavior.

### 3. Make project order subordinate to outcome order

Retain `sequence_position` as the stable project preference, interpreted only among projects with the same owner. Presentation composes outcome rank and scoped project preference. Project Up/Down and Place before controls operate within that owner; moving across owners is a named ownership transfer to an existing link. A candidate can be linked in outcome Projects first, then explicitly included with that owner from Board/project inspection. Derived appearance alone creates no saved link.

Ownership transfer preserves all links, adopts the owner's stream/rank and inserts at the last scoped dependency-valid position unless explicitly placed. Outcome placement moves only already-owned included work; it does not claim arbitrary candidates or select dismissed/deferred links. Stream retirement migrates outcomes in source rank order to the destination tail with their owned included projects, or unassigns them and converts included projects to candidates. A project cannot be independently moved into a different active stream while retaining an incompatible owner.

Within one owner, effective direct/transitive predecessors must precede successors, including paths leaving and re-entering that owner. Across owners, a lower-ranked prerequisite is allowed even within the same stream: dependency-safe selection skips the blocked higher outcome. Source-introduced within-owner violations retain saved order and withhold dates for that owner's unfinished work until repaired; other valid owners continue subject to effective dependencies. Incremental repair cannot introduce new scoped violations. Dependency cycles still invalidate forecasts.

Alternative: preserve the global project queue as a competing priority. Rejected because outcome dragging would then remain cosmetic or unpredictably alter unrelated projects. This explicitly supersedes the old same-stream cross-owner order restrictions.

### 4. Version v5 selects by required tier, owner rank and scoped order

Expand the effective closure of every outcome's direct minimum-required links. Its union forms the **required-delivery tier** of projects. Other included projects form the optional tier; an optional saved link is effectively required only if a real dependency places it in that union. Keep per-outcome closure separately for its delivery/eligibility explanations.

Per cycle and free stream:

1. Reconcile actual completion independently of membership. Excluded unfinished prerequisites remain unresolved; exclude their demand from totals and capacity simulation.
2. Carry the single project started in an earlier cycle if unfinished. A new recalculation starts afresh; there is no persisted in-simulation active slot.
3. Consider included projects with valid owner/stream, finite reconciled scope, no scoped-order conflict and every effective predecessor complete before this cycle.
4. Sort eligible work by `(requiredTier first, owner.stream_position, sequence_position, package.id)`; choose at most one. Do not donate a dependent outcome's rank to the prerequisite owner.
5. Apply unchanged availability, reserve, allocation, thousandth-point rounding and one-slot capacity rules. A finish unlocks successors only in a later cycle; unused capacity is not borrowed or used for another same-stream start in that cycle.

Minimum-required closure still determines first-delivery dates. Immediate visual references are not the scheduling graph. Optional-only outcomes remain unplanned for delivery; their included work can run in optional tier when no required-tier project is eligible. Completed outcome markers are never inspected by the scheduler; unfinished optional work continues normally.

Worked same-stream example (10 points/cycle, no reserve): H ranked 1 owns required B (5), M ranked 2 owns independent required C (5), L ranked 3 owns required A (5), with A → B. C runs in C1, A in C2, B in C3. H's row explains Waiting for A in L and the priority bypass. Moving L above M changes selection; no automatic rank change or donated priority occurs. If C were optional-only instead, A would run before C because A belongs to required closure. A started optional project carries before newly eligible required work.

Add structured `waiting` / `priorityBypass` output per outcome with prerequisite IDs, owning outcome/stream or excluded state, affected successors and simulated bypass context. Distinguish dependency waits from missing estimates, source review, horizon and capacity. Keep this calculation evidence available to timeline/project inspection and accessibility text, but do not render expandable wait/bypass details in the sticky outcome label. UI wording is explanatory, not a guaranteed completion order. Inspect actions target the prerequisite's existing project sidebar.

The implemented scheduler aggregates each prerequisite's first/last simulated wait and eventual forecast finish, so a resolved forecast wait remains explanatory rather than implying actual completion. Bypass events record new lower-ranked selections while a more-preferred local owned candidate is dependency-blocked; ordinary carry, zero capacity, unknown estimates and required-before-optional selection do not fabricate bypass events. Positive-demand work receives no asserted start in a zero-budget cycle; explicit zero-demand work still observes dependency/cycle rules. Output fields and shared actual-completion/closure helpers are documented in `docs/scheduling-contract.md`. Activated scenario adoption now uses v5 saves/publication with explicit legacy conversion and frozen history.

Alternative: changing v4 outputs in place. Rejected because membership and priority change calculation results. New saves/publications use **v5**.

### 5. Derive appearances and draw local connectors

Extend `outcomeRows` to union direct linked package IDs with the **immediate effective predecessors of those direct links**, deduplicated by package ID. Do not recursively expand derived references. Carry provenance (`direct`, `prerequisiteFor`, `requiredForDelivery`, saved requirement when present) separately from saved links. A directly linked counted predecessor stays one counted box, not an additional shared copy. Same-stream derived references still charge zero locally unless this row is the actual owner.

Use one package forecast for all appearances and existing collision-free sublane packing. Retain solid counted bars and dashed references, full accessible names, project codes, Hidden/Deferred/Dismissed/Unavailable and Required/Optional context. Missing imported endpoints use unresolved labeled chips. No derived link enters the catalog search, direct counts or Projects save map.

Render a row-local SVG layer for immediate effective edges whose endpoints are present. Use restrained semantic-border/info tokens, thin elbow/curved paths with directional arrowheads, `pointer-events: none` and `aria-hidden`; text and project buttons carry the equivalent accessible relationship. Geometry derives from the same time scale and sublane layout as bars. Recompute on row geometry/viewport changes; horizontal scrolling moves the row and paths together. Never route through sticky labels or across outcome/stream panels. An undated endpoint uses its chip/text region without implying a time anchor; do not draw a finish-to-start dated path without both dates.

Preserve week action hit areas, timeline keyboard scrolling, reduced motion and forced colors. Selected rows/controls require a non-color cue; the dashed reference and textual prerequisite labels remain meaningful when backgrounds disappear.

Alternative: recursive visual expansion or cross-panel arrows. Rejected for density and routing complexity; deeper constraints remain available in project details and still gate scheduling/completion.

### 6. Business lifecycle is explicit and workspace-global

Add an `outcome_lifecycle` record keyed by stable outcome ID with completion time, monotonically increasing lifecycle version, captured required-delivery scope signature and a sticky review-needed flag/reasons. Keep it independent of scenario-managed outcome row replacement: activation can remove/reintroduce an outcome without clearing its business record or manufacturing a visible catalog row. Record complete/reopen events in a dedicated lifecycle event table with timestamp and identity; ordinary outcome deletion retains that history. Reads join the lifecycle record; an absent record means currently open/version zero. Completion is a business record, not a scenario variable or forecast status.

Create a shared pure actual-completion predicate extracted from the existing forecast reconciliation rule: source project status is completed, open issue count is zero, no remaining Extra scope, no missing-source review/cross-team decomposition/unresolved external blockers. A canceled status or finish > 0 is insufficient. Evaluate the current persisted minimum-required closure, rejecting missing nodes and cycles; require at least one direct minimum-required link. This proof needs no successful forecast or configured capacity and allows an actually complete excluded prerequisite.

Eligibility response: `ready`, `reasons[]`, direct/effective required IDs, current completion marker/version, scope-review state and opaque `eligibilityToken`. Token covers the current required-scope graph/link requirements, relevant actual-completion facts, Extra scope and lifecycle version. A new import with identical relevant facts does not invalidate a marker merely because its timestamp changed; changed required scope or failed actual evidence does. Completion persists the normalized scope signature, not a forecast finish. Optional link/metadata changes outside the required closure do not invalidate completion.

After changed required scope or reopened source work, retain Completed with Review completion needed until explicit reopen. Source import, link/graph/Extra scope mutations and scenario activation must re-evaluate affected completed records and latch the review flag when evidence changes; unrelated source refreshes do not latch it. Reverting a scope/source edit does not silently erase an already-recorded review. Do not auto-reopen, suppress scheduling or treat the marker as a dependency fact. Display completion labels on Board, delivery and catalog title context without hiding rows or changing saved rank; existing catalog sorts/filters remain unchanged.

The service implementation exposes `outcome.lifecycle` through saved-state/Board reads and accepted completion/link/create responses. Scope signatures normalize direct roots, full closure and effective edge pairs; evidence signatures use relevant actual facts rather than names/import timestamps. Reconciliation latches the first invalidation once with an audit event/version increment. Read-only responses can surface current discrepancies without writing, and retain the first recorded review until explicit reopen. Source, link, Extra scope, dependency and final scenario writers invoke reconciliation under the shared workspace lock. Endpoint/error and evidence contracts are documented in `docs/outcome-lifecycle.md`; visible sidebar actions remain a separate implementation task.

Alternative: infer completion from dates or make it a scenario-local checkbox. Rejected because dates are predictions, and activating a what-if plan must not undo an actual business completion.

### 7. Extend current mutation boundaries and the completed sidebar

| API / contract | Change |
| --- | --- |
| `GET /api/state`, `GET /api/board` | Add ranks, membership, lifecycle/eligibility data and opaque `planningToken`; catalog inspection still works without a forecast |
| `PUT /api/board` outcome assignment | Extend existing `outcomeAssignment` with mutually exclusive before/after outcome IDs; destination omission means tail on cross-stream move, no-op on same-stream repeat |
| `PUT /api/board` project/ownership changes | Require eligible owning outcome for inclusion/active-stream transfer; expose candidate/defer/dismiss/restore actions; scoped insertion only |
| Board concurrency | Existing sequence/ownership tokens include rank, membership, scoped preference and relevant graph changes; stale clients receive 409 and reload instructions |
| Outcome links PUT / outcome DELETE | Add `planningToken` to `{ links, planningToken }` and `{ planningToken }` request bodies respectively; downgrade affected included owners before link/delete, return accepted result and affected-candidate feedback; preserve transactional cleanup |
| `PUT /api/outcomes/[id]/completion` | `{ completed: boolean, expectedLifecycleVersion, eligibilityToken }`; validate current persisted proof and state atomically; return accepted lifecycle/eligibility snapshot, 409 for stale evidence, validation error for not-ready completion |

Metadata PUT remains its existing independent save; creation remains its single metadata+initial-links POST. New outcomes start open and unplanned until required scope exists. Completion's write proof is recomputed on the server under the planning lock alongside its token check, including current saved source; client readiness cannot authorize a stale completion. Existing route authentication, input validation and transaction patterns apply.

`planningToken` hashes the same current rank/membership/sequence/ownership/link/effective-graph state protected by the existing Board sequence/ownership tokens. State reads can obtain it without a forecast. Missing tokens from old clients are rejected with reload guidance rather than allowing owner cleanup against stale planning. Source imports and source/graph/Extra scope writers take the same planning lock used by completion so proof validation and persistence cannot race an intervening source update.

Extend the outcome controller's captured submission union with complete/reopen and link/delete planning tokens, reusing global outcome-write serialization and explicit rejected/saved/refresh-failed results. Only clean saved Details exposes lifecycle actions; no global Save is added. Show ready/not-ready/review reasons in Details, with a link to Projects for changing required scope and a Board/project inspection path for blockers. Closing during submission stays available; older completion cannot populate, close or focus a newer opening. Accepted lifecycle snapshots survive failed refresh and retry repeats only the read. Scope changes after completion never clear unrelated section drafts.

Board outcome titles call the workspace's stable-ID open request with a Board opener/fallback. Expand `OutcomeRequest.fallback` to a stable stream-heading target; keep compact drag handles separate. Sticky labels retain title and delivery state while counted points/direct-project totals move to saved Details. Put destination and explicit before/after placement controls in clean saved Details instead of the sticky Board label, using the same Board mutation and tokens while preserving the open dialog. Close a project drawer before opening outcome Details from it, as with the established Settings handoff. Catalog/direct link counts continue to use saved links only.

Alternative: embed completion in metadata Save details or introduce a Board-only outcome modal. Rejected because it would hide the explicit business action, mix save scopes or fragment the newly unified workspace.

### 8. Migrate editable planning, preserve history

Use a numbered, idempotent schema migration and shared pure conversion logic for live backfill and older editable drafts:

**Coordinated activation:** migration 6 installs additive storage with nullable pre-activation rank/membership fields and a workspace conversion marker. Existing v4 writers remain valid while the foundation is developed. The foundation supplies a tested transactional activation helper using the same pure converter as editable drafts; the dependent mutation task registers/runs activation in its subsequent numbered migration once all writers preserve the new invariants. Activation backfills live rows once, requires nonnull membership/assigned ranks, and changes new-package defaults to excluded candidates. Null membership before activation means Not converted, never an inferred v5 state. Do not enable activation against old writers. This staging changes no final membership or versioning requirement.

The writer implementation registers this activation as migration **7** (`activate-outcome-roadmap`) and extends the migration runner with transactional data hooks. During writer/scheduler staging, output used `v5-pending` with publication paused so altered membership inputs could not publish as v4. The completed scenario-adoption task replaces that transitional label/guard with v5 fingerprints, comparisons, conversion and publication checks; pre-activation compatibility continues to use v4.

The prior legacy outcome-placement inference can run before v5 conversion, but its arbitrary earliest-owner inference must not run on missing ownership fields: preserve raw owners for the v5 zero/one/multiple-owner decision. Otherwise an ambiguous old draft would be incorrectly made unambiguous before review.

1. Seed per-stream outcome ranks from old displayed order and retain valid owners.
2. For previously selected ownerless projects, infer an owner only if exactly one linked assigned outcome matches its current active stream. Otherwise clear active placement, set candidate and retain previous stream in conversion/review feedback. Do not invent outcomes or links or choose arbitrarily between several candidates.
3. Previously unselected projects become deferred, preserving their pause rationale and only valid return context. Future imported projects start candidate. Preserve Extra scope and source visibility independently.
4. Preserve scoped relative project preference from legacy sequence. Run prior legacy adapters before v5 conversion, retain invalid-with-source scoped orders as visible conflicts, and never introduce a hidden topological reorder on refresh.
5. Treat all existing live outcomes as manually open. Preserve legacy lifecycle history if present in future compatible inputs; absent historical markers mean Lifecycle not recorded, not retroactive completion.

Editable draft activation converts in memory/live state, reports inferred owners and excluded candidates, and recalculates under v5; it does not rewrite stored draft JSON until explicit save. Older drafts must be loaded, reviewed and saved as v5 before publishing. V5 snapshots store rank, membership, scoped order and frozen displayed lifecycle/eligibility evidence. Scheduling fingerprints include planning fields, not lifecycle-only facts or clock ticks. Comparisons identify rank, membership, scoped ordering and version differences; historical views show frozen lifecycle evidence separately.

V5 snapshots also retain `outcomeCatalogIds`, the planning definitions that draft has captured/managed, including IDs deliberately omitted after deletion. Capture merges the prior active draft's roster with current definitions, so an omission alternative can later remove/reintroduce the same stable ID while preserving independent lifecycle history. Activation removes only managed IDs absent from the saved definitions, downgrading their included owned work before deletion; newer unrelated outcomes outside that roster remain. Legacy inputs without a roster manage only their explicitly saved outcome IDs and never infer historical deletions. Explicit save/rebase persists conversion; stream configuration autosave must not silently rewrite a legacy draft as v5.

Removing a completed definition, manually or through a managed omission, retains its completion time/history and latches review for that removed scope within the same transaction. No live row is manufactured from history. Reintroducing the stable ID retains that review until explicit reopen, so a temporary planning omission cannot silently erase a business-evidence invalidation or reset completion.

Published lifecycle display comes from the saved snapshot, not today's business records. Lifecycle-only actions remain scheduling-clean; explicitly saving a draft captures their latest display evidence if desired. Comparisons display frozen marker/readiness/review context separately from planning changes and label missing legacy lifecycle fields Lifecycle not recorded. Publication freezes the saved draft as-is after version/readiness/source/dirty checks, without injecting newer source or lifecycle facts.

Scenario activation restores planning fields but **does not overwrite live completion markers or lifecycle event history**. Recompute their review state against restored required scope. Never mutate/recalculate v0–v4 published inputs/output/version. Missing/retired streams use explicit reconciliation without creating ownerless included work. Update `docs/scheduling-contract.md` to retain v4 as history and describe v5 only when this implementation ships; `docs/product-design.md` then documents the delivered controls. A short planned-v5 reference can link to this active design meanwhile.

Rollback must be an explicit conversion: the prior binary does not understand candidate/dismissed membership, so additive-column compatibility alone is insufficient. Keep a pre-migration backup, or map excluded states to `selected=false`, preserve valid stream queues and retain lifecycle/rank columns for re-upgrade. Never relabel v5 snapshots as v4 or run them through an old publishing path. No deployment or database migration is performed by this planning task.

## Risks / Trade-offs

- [Legacy ownerless demand disappears from forecasts] → Conversion notice lists affected work and prior streams; test migration and explicit include paths, never silently invent outcomes.
- [Required-first scheduling surprises users expecting strict rank] → Explain required versus optional tiers and bypass reasons; test worked examples and carried optional work.
- [Lower owner delays a shared prerequisite] → Keep ownership/rank explicit, show waiting location and allow deliberate reorder/transfer; no hidden priority inheritance.
- [Unlink/delete changes totals] → Atomic candidate conversion, returned affected-work feedback and all-view refresh; retain the sidebar's existing clean-only delete action.
- [Source facts race with manual completion] → Server proof, lifecycle version and eligibility token under the same planning lock as source/graph writes.
- [Published history accidentally changes] → Byte-equivalence tests for every existing version; lifecycle is frozen display evidence, not replayed business state.
- [Connector density/geometry obscures work] → One level of derived boxes, row-local noninteractive paths, retained text, screenshots and geometry tests at 1440/768/390px.
- [Multiple outcome mutation surfaces regress the sidebar] → All title entries share its controller; pending-dismissal/new-opening/refresh-only tests extend the completed catalog acceptance suite.

## Verification strategy

Each implementation Bean owns focused tests and documentation. Use pure forecast/closure tests for rank/tier/skip examples, membership exclusion, actual completion and capacity conservation; database tests for migration/idempotency/atomic rollback/tokens, ownership lifecycle and scenario immutability; real application browser tests using the existing PGlite fixture for outcome reorder equivalents, move/transfer/dismiss/include, local connector geometry and shared dates, completion/reopen/review and sidebar late-write behavior. Final integration runs typecheck, all unit/database tests and affected Board, assignment, timeline, catalog/sidebar, Settings and scenario browser suites, inspects 1440/768/390px and keyboard/reduced-motion/forced-color behavior, and records actual evidence before reconciliation/archive.
