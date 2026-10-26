# Proposal

## Why

The Board renders outcome rows but schedules by a separate project queue, omits implicit prerequisite appearances, and permits ownerless roadmap demand. The confirmed clarifications in `docs/board-design-validation.md` call for outcome-priority planning and explicit business completion; the completed outcome sidebar now provides a consistent integration point.

## What Changes

- **BREAKING:** require one owning outcome for included roadmap projects; distinguish imported candidates, included work, deferred roadmap work and dismissed off-roadmap work. Dismissed/candidate demand is excluded, while unfinished prerequisites remain unresolved.
- **BREAKING:** persist outcome order per stream and use it in calculation **v5**. Preserve one execution slot per stream, finish-to-start dependencies, additive estimates and conserved capacity. Required delivery work precedes optional-only work; rank prioritizes eligible work rather than guaranteeing finish order.
- Provide outcome drag/drop on the Board and equivalent before/after and stream-move controls in the shared outcome sidebar. Restrict project ordering to its owning outcome and make cross-owner moves explicit ownership transfers.
- Derive immediate prerequisite references without adding saved links, retain full effective dependency closure for delivery, and show row-local thin dependency connectors with accessible dependency context outside the sticky outcome label.
- Add manual Mark complete/Reopen actions in clean saved outcome-sidebar Details. Require actual reconciled completion of minimum-required work and its effective prerequisites; keep lifecycle markers separate from forecasts and scheduling eligibility.
- Migrate live data conservatively, adapt editable legacy scenarios with an explicit conversion notice, and preserve every published result/version.

## Capabilities

### New Capabilities

- `outcome-lifecycle`: explicit completion/reopen, actual-completion eligibility, changed-scope review, sidebar write behavior and historical lifecycle display.

### Modified Capabilities

- `outcome-sequencing`: ordered outcome placement, exclusive mandatory ownership, ownership lifecycle, derived prerequisite appearances and Board-to-sidebar inspection.
- `stream-sequencing`: outcome-first eligible selection, scoped project ordering, dependency-safe atomic edits, waiting warnings and v5 compatibility.
- `project-assignment`: mandatory roadmap ownership, explicit candidate/included/deferred/dismissed states and excluded-demand semantics.
- `planning-timeline`: ranked outcome rows, immediate-prerequisite references, dependency connectors and accessible tracing.

## Impact

Versioned database migration; state/Board reads; outcome placement, project assignment, ownership and link/delete mutations; forecast inputs/output; scenario adaptation/save/compare/publish; timeline/Board controls; project drawer; `src/app/outcome-workspace.tsx`; source triage; scheduling/product documentation and fixture-backed tests. Extend the existing Board mutation API and add a dedicated outcome completion endpoint, with stale-write protection. No additional dependency, Linear write, estimate split, within-cycle scheduling, new overlay container or combined metadata/link/lifecycle save is needed.

Planning task: **ohwawd-a5j9**. This proposal supersedes the ownerless accounting and no-connectors choices in archived `2026-10-20-outcome-led-sequencing`, Decisions 2–6, and explicitly extends the catalog redesign's lifecycle non-goal. Implementation work is tracked separately in dependency-linked Beans.
