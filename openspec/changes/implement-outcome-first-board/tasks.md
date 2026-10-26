# Tasks

Beans is the source of truth for execution state and dependencies. Reconcile these deliverables from verified Bean completion; planning artifact completion does not imply implementation. Planning: **ohwawd-a5j9**. Implementation epic: **ohwawd-5q71**.

## 1. Persisted model and conservative conversion — ohwawd-rc2m

- [x] 1.1 Add outcome ranks, explicit roadmap state/selected invariants, independent lifecycle records/events, typed reads and shared conservative legacy/live conversion per design Decisions 2, 6 and 8; provide tested coordinated activation for candidate import defaults and strict backfill; verify migration idempotency, owner ambiguity, preserved scope/visibility/deferred state, rank stability and untouched published JSON with PGlite tests, update migration/contract notes and run typecheck plus affected database tests.

## 2. Transactional placement and membership — ohwawd-sug7

- [x] 2.1 Implement atomic outcome before/after placement, owner-scoped project order, inclusion/deferral/dismissal/restore, explicit ownership transfer, lifecycle cleanup on unlink/delete/unassign/retirement and expanded concurrency tokens per Decisions 2–3 and 7; update sidebar link/delete token handling and fixture contracts; verify all mutation paths, stale rejection, rollback, scoped source conflicts, no ownerless charge and accessible affected-work feedback with database/API and existing sidebar tests, document mutation changes and run typecheck plus affected tests.

## 3. Outcome-priority forecast — ohwawd-d92k

- [x] 3.1 Implement shared effective closure/actual-completion predicates and v5 one-slot selection by carried work, required tier, owner rank, scoped order and stable ID, with excluded-demand semantics and structured waits/bypasses per Decision 4; verify the worked example, optional/carry rules, lower-ranked shared prerequisites, deep dependencies, excluded versus completed work and conserved capacity using forecast/database tests, document staged v5 scheduling rules and run typecheck plus affected tests.

## 4. Actual-evidence completion service — ohwawd-gqh7

- [x] 4.1 Implement explicit completion/reopen persistence, current saved-scope eligibility, lifecycle-version/evidence-token concurrency, sticky required-scope/source review, history and additive reads per Decisions 6–7; verify optional/empty/missing/cyclic/canceled/source-discrepant work, excluded completed prerequisites, stale/source-race rejection and rollback with unit/PGlite/API tests, document lifecycle contracts and run typecheck plus affected tests.

## 5. Versioned scenario compatibility — ohwawd-mg25

- [x] 5.1 Adopt v5 saves/publications, shared legacy conversion notices, rank/membership/scoped-order fingerprints/activation/comparison, frozen lifecycle display and workspace-global lifecycle preservation per Decision 8; verify v0–v4 published byte-equivalence, legacy save-before-publish, retired-stream/source reconciliation, v5 round trips, lifecycle-only scheduling cleanliness and temporary scenario outcome omission/return with database and focused scenario UI tests, update scheduling compatibility documentation and run typecheck plus affected tests.

## 6. Accessible Board controls and waiting feedback — ohwawd-0lzq

- [x] 6.1 Build equivalent outcome drag/keyboard/touch before/after/stream controls, owner-scoped project controls, explicit roadmap membership and ownership actions, migration/wait/bypass feedback and Board title entry into the existing outcome sidebar per Decisions 1–4 and 7; verify persistence, actual forecast changes, default insertion/idempotency, excluded prerequisites, stale errors and opener/stream focus without stacked modals at desktop/tablet/phone using real-app browser tests, update product workflow documentation and run typecheck plus affected UI tests.
- [x] 6.2 Incorporate the manual density review in ohwawd-r568: reduce each sticky outcome label to drag handle/title, remove inline wait/bypass/rank/arrow/move sections, and move equivalent destination/before/after controls into clean saved sidebar Details; verify stale writes, open-dialog preservation, drag equivalence and responsive density, then update workflow documentation and validation evidence.
- [x] 6.3 Incorporate the follow-up density review in ohwawd-m65h: remove counted-points/direct-project copy from timeline labels and show the equivalent current planning facts in saved sidebar Details; preserve delivery state and accounting semantics, update browser coverage/docs and run affected validation.

## 7. Immediate prerequisite timeline and connectors — ohwawd-npmi

- [ ] 7.1 Derive immediate-only deduplicated appearances without saved-link writes, retain actual shared dates/accounting/context and add truthful noninteractive row-local connectors per Decision 5; verify direct/derived deduplication, optional scope, deeper constraint preservation, missing endpoints, geometry on scrolling/resizing, accessible text/deep tracing, keyboard/reduced-motion/forced-color and 1440px/768px/390px screenshots with unit and browser tests, document connector conventions and run typecheck plus affected timeline/theme tests.

## 8. Unified sidebar completion experience — ohwawd-4oo7

- [ ] 8.1 Add saved-Details Mark complete/Reopen, readiness/review/history context, clean-only actions, captured lifecycle submissions and accepted snapshots with refresh-only retry per Decisions 6–7; preserve Details/Projects draft/save scopes, stable dialog, catalog context and Board opener fallback; verify actual-versus-forecast eligibility, source/link review, rejection/stale evidence, pending dismissal/new openings, refresh failures and consistent Board/catalog/delivery labels with browser tests, update product/convention docs and run typecheck plus affected sidebar/catalog/Settings tests.

## 9. Cross-feature verification — ohwawd-r2nj

- [ ] 9.1 After every prior implementation task has its own tests/documentation, verify all delta scenarios across Board, source triage, scenarios, catalog, delivery, sidebar and Settings; run typecheck, all unit/database tests and affected browser suites, inspect 1440px/768px/390px plus keyboard/reduced-motion/forced-color behavior, record actual walkthrough/visual evidence, reconcile delivered scheduling/product docs and this checklist from verified Beans, and run strict change/global validation.

## Dependencies

`ohwawd-a5j9` → `ohwawd-rc2m` → `ohwawd-sug7` → `ohwawd-d92k` → `ohwawd-gqh7` → `ohwawd-mg25` → `ohwawd-0lzq` → `ohwawd-r568` → `ohwawd-m65h`.

From the compact Board follow-up, `ohwawd-npmi` (timeline) and `ohwawd-4oo7` (sidebar lifecycle, also depending on the completion service) can proceed independently. Both block `ohwawd-r2nj`. Scenario compatibility also directly depends on the scheduler. All implementation children belong to `ohwawd-5q71`.

The first six deliverables and both compact Board review follow-ups (`ohwawd-r568`, `ohwawd-m65h`) are verified complete. Activated reads/saves/publications now use v5; the transitional publication pause is retired, and legacy drafts require explicit conversion/save. Migration 6 is additive and migration 7 registers coordinated activation; no further schema migration is required for lifecycle/scenario adoption. Compact Board controls passed all 135 unit/database and 101 browser tests plus typecheck/build; the follow-up count relocation passed 36 affected browser tests and typecheck, with responsive visual evidence and a manual checkpoint in docs/board-controls.md. The remaining three deliverables—prerequisite timeline/connectors, sidebar completion and cross-feature acceptance—stay unchecked until verified. Beans remains the live execution tracker.

## Workflow follow-up

- Keep this change active while implementation or unresolved acceptance work remains.
- Complete the implementation epic only after every child is verified, then reconcile tasks and use normal OpenSpec spec synchronization/archive.
- Update Bean/document artifact references to the archived path and validate current specs and archived checklists afterward.
