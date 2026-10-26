---
# ohwawd-4oo7
title: Integrate manual completion into the unified outcome sidebar
status: todo
type: task
priority: normal
created_at: 2026-10-25T18:39:05Z
updated_at: 2026-10-25T21:42:31Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-0lzq
    - ohwawd-gqh7
---

OpenSpec: implement-outcome-first-board.
References: openspec/changes/implement-outcome-first-board/design.md (Decisions 6–7); openspec/changes/implement-outcome-first-board/specs/outcome-lifecycle/spec.md; openspec/changes/implement-outcome-first-board/tasks.md (8.1); openspec/specs/outcome-catalog/spec.md; docs/ui-ux-conventions.md. Foundation: completed epic ohwawd-2ods and src/app/outcome-workspace.tsx.

- [ ] Show completion time, ready/not-ready/review reasons and explicit Mark complete/Reopen outcome in saved Details; disable actions while either section is dirty or any outcome write is pending.
- [ ] Extend the existing captured submission controller with current eligibility/version tokens, serialized lifecycle writes, accepted snapshots and refresh-only retry; retain Close/Escape/backdrop during saves and generation isolation after dismissal/new openings.
- [ ] Keep Details/Projects drafts and scoped saves independent, use saved required scope only, preserve catalog query/sort/page/focus and the stable dialog, and provide navigation to relevant required projects without stacked overlays.
- [ ] Display completion/review context consistently on Board, catalog and delivery without hiding/reordering rows or using business markers as scheduler gates.
- [ ] Verify actually-ready versus forecast-only, optional/empty scope, reopen and sticky review after source/link changes, rejected/stale proof, saved-refresh-failed retry, dismissed completion with newer opening, dirty sections and Board opener fallback in browser tests; retain existing catalog/sidebar acceptance coverage, update product/convention docs and run typecheck plus affected tests.

Completion: manual completion is an explicit business action coordinated with the shipped outcome sidebar, never a global Save or another overlay.

## Completion-service handoff

PUT /api/outcomes/[id]/completion accepts only completed, expectedLifecycleVersion and eligibilityToken, returning {saved:true,lifecycle}. State/Board outcome.lifecycle exposes ready/reasons/blockers, direct/effective required IDs, current/stored scope signatures, completedAt/version, sticky review context and token. Link/create accepted responses also include lifecycle. Apply these accepted snapshots without letting captured metadata or another section overwrite newer lifecycle evidence after refresh failure. ready is actual-work eligibility, not auto-completion; completed outcomes require explicit reopen before another completion. 409 responses provide current lifecycle evidence; 422 is current proof but unfinished/reconciliation-needed work. Reuse captured-submission serialization/generation/focus/refresh-only behavior; no new overlay. docs/outcome-lifecycle.md and tests/ui/outcome-completion-api.spec.ts document and exercise the contract.
