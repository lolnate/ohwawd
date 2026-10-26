---
# ohwawd-5q71
title: Implement outcome-first Board planning and lifecycle
status: in-progress
type: epic
priority: normal
created_at: 2026-10-25T18:37:04Z
updated_at: 2026-10-26T00:36:03Z
blocked_by:
    - ohwawd-a5j9
---

Implement OpenSpec change implement-outcome-first-board after planning task ohwawd-a5j9. Sources: openspec/changes/implement-outcome-first-board/proposal.md, design.md, tasks.md and specs/. Review input: docs/board-design-validation.md. Completion: dependency-linked implementation children verified; v5 rank/tier scheduling, mandatory roadmap ownership, truthful immediate prerequisites/connectors and manual completion integrated with the existing outcome sidebar; scenario history preserved; documentation and OpenSpec reconciled and strict validation passing before normal archive. Beans own execution status; no Board implementation has started.

## Implementation dependency map

Planning ohwawd-a5j9 is completed. Implement in dependency order: ohwawd-rc2m (schema/conversion) → ohwawd-sug7 (atomic mutations) → ohwawd-d92k (v5 forecast) → ohwawd-gqh7 (completion service) → ohwawd-mg25 (scenarios) → ohwawd-0lzq (Board controls), then ohwawd-npmi (timeline) and ohwawd-4oo7 (sidebar lifecycle), both prerequisites of ohwawd-r2nj (integration verification). The first six implementation children through Board controls ohwawd-0lzq are completed; the remaining three implementation children remain todo. The complete mapping and verification deliverables are in openspec/changes/implement-outcome-first-board/tasks.md; strict proposal/spec/design/task validation passed.

## Foundation progress

Completed ohwawd-rc2m with migration 6 additive storage, conservative live/legacy conversion, migration-only transactional activation, typed reads and lifecycle history storage. Evidence: docs/roadmap-migration.md; typecheck, production build, 88 unit/database tests and 41 affected browser tests passed. Design Decision 8 documents coordinated activation in ohwawd-sug7 so old v4 writers remain valid during staging. OpenSpec task 1.1 is reconciled; the epic remains in progress.

## Writer activation progress

Completed ohwawd-sug7 with owner-safe mutations, scoped precedence/rank handling, migration 7 activation, lifecycle cleanup, planning tokens and sidebar reviewed retry/impact feedback. Verified typecheck, production build, 98 unit/database tests and 54 affected browser cases; strict change/spec/archive validation passed. Evidence: docs/roadmap-mutations.md. Activated output is v5-pending and cannot publish until v5 scheduler/scenario adoption. The epic remains in progress; ohwawd-d92k is next.

## Scheduling-core progress

Completed ohwawd-d92k with required-tier/outcome-rank scheduling, owner-only source-conflict withholding, actual/excluded prerequisite reconciliation and structured wait/bypass data. Evidence: docs/scheduling-contract.md and 18 new cases in tests/outcome-priority-forecast.test.ts. Typecheck, production build, all 116 unit/database tests, 54 affected browser tests and strict spec/change/archive validation passed. The outer v5-pending/publication boundary remains until scenario adoption. The epic remains in progress; ohwawd-gqh7 is next.

## Completion-service progress

Completed ohwawd-gqh7 with current-evidence readiness, versioned complete/reopen persistence, sticky review hooks, audit/history and additive state/Board/accepted-response evidence. Verification: 127 unit/database tests, 56 affected browser/API cases, typecheck, production build and strict change/spec/archive/whitespace validation passed. Contract: docs/outcome-lifecycle.md. No additional migration or existing database migration occurred. Scenario adoption ohwawd-mg25 is next; visible completion controls remain pending in the sidebar task.

## Scenario-adoption progress

Completed ohwawd-mg25: activated v5 capture/publication, conservative explicit legacy conversion, new planning fingerprints/comparisons, managed omission rosters and frozen lifecycle history. Transitional publication pause retired. Verified typecheck/build, 135 unit/database tests, full 89-case browser suite and targeted scenario/completion follow-up; strict spec/change/archive and whitespace checks passed. Evidence: docs/scenario-v5-compatibility.md. Board controls, prerequisite connectors, sidebar completion and final acceptance remain; ohwawd-0lzq is next.

## Board-controls progress

Completed ohwawd-0lzq with persistent outcome ordering, owner-scoped project controls, explicit membership/owner actions, wait/bypass and migration feedback, source visibility separation and shared-sidebar focus-safe handoff. Verified standalone typecheck, production build, all 135 unit/database tests and all 101 Chromium browser tests; strict validation passed for 11 current spec/change items and 7 archives, and git diff --check passed. Visually inspected Board/project screenshots at 1440/768/390px. Evidence and manual walkthrough checkpoint: docs/board-controls.md; product workflow updated in docs/product-design.md. OpenSpec task 6.1 reconciled. Next dependent tasks are ohwawd-npmi (immediate prerequisites/connectors) and ohwawd-4oo7 (visible sidebar lifecycle), followed by ohwawd-r2nj acceptance.

## Compact Board review progress

Completed high-priority follow-up ohwawd-r568 from the first manual Board walkthrough. Sticky labels now contain only drag handle/title plus compact outcome facts; rank/arrows/move forms and expandable wait/bypass content were removed. Equivalent destination/end/before/after controls live in clean saved sidebar Details with stale-token/focus handling. Verified 135 unit/database tests, 101 browser tests, typecheck/build, responsive captures and strict OpenSpec/archive/whitespace validation. IRAS-to-CSSM timing and connector feedback is recorded on ohwawd-npmi, now the next Board task.

## Outcome-count density follow-up

Completed ohwawd-m65h from the second manual Board review. Removed counted-points/direct-project blurbs from all timeline labels and moved equivalent current planning facts to saved outcome Details, retaining delivery state on the Board. Typecheck, 36 affected browser tests, responsive screenshot inspection, strict OpenSpec validation and whitespace checks passed. ohwawd-npmi remains next.
