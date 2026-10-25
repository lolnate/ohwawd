---
# ohwawd-bgm3
title: Move Board panels and contextual actions into Settings
status: completed
type: task
priority: normal
tags:
    - settings
    - board
created_at: 2026-10-23T14:36:17Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-0nj1
blocked_by:
    - ohwawd-7amk
---

Complete the relocation by replacing inline Board editors and DOM reveal targets with typed Settings-open requests for OpenSpec task 3.1.

## References
- openspec/changes/archive/2026-10-25-add-workspace-settings/proposal.md
- openspec/changes/archive/2026-10-25-add-workspace-settings/design.md (decisions 4–5, entry-point table)
- openspec/changes/archive/2026-10-25-add-workspace-settings/specs/workspace-settings/spec.md (Board actions and focus/dismissal)
- openspec/changes/archive/2026-10-25-add-workspace-settings/specs/planning-timeline/spec.md
- openspec/changes/archive/2026-10-25-add-workspace-settings/tasks.md (3.1)
- docs/ui-ux-conventions.md

## Scope
Wire Board, workspace, and timeline to the completed Settings editors, then remove the three old Board panels and their obsolete local state/imports. Keep cycle-wide overrides, stream management, dependencies, and project Extra scope in their existing homes.

## Acceptance / verification
- [x] Planning attention baseline setup and project Review stream capacity actions open Capacity assumptions with baseline focused.
- [x] Cycle-calendar weekly link opens the weekly section and focuses the week selector; remaining Board reveal actions still work.
- [x] Timeline pointer/keyboard week selection opens the weekly section for the exact Monday-start team-local week and shows current override/preset/cycle fallback. Reopening the same week works repeatedly.
- [x] Close returns focus to the initiating timeline/action control when available, otherwise the header gear; project details handoff closes the drawer before opening Settings with no stacked modals.
- [x] Remove inline Capacity assumptions, Scope readiness, and Weekly availability and holidays editors, plus Board-only drafts and removed-target logic. No duplicate editor remains.
- [x] Update tests/ui/planning-timeline.spec.ts, tests/ui/workspace-organization.spec.ts, and affected tests/ui/cycle-calendar-projection.spec.ts cases alongside integration; cover target focus, live capacity/band changes, same-week reopening, and retained Board controls. Run those cases and npm run typecheck.

Blocked by completed Settings editor/data lifecycle. Ship together with that task so no contextual action targets removed content.

## Summary of Changes

Removed the three inline Board panels and their drafts/imports. Typed Settings requests now carry section, optional week, focus target and original opener. Baseline setup, capacity resolution, cycle-calendar links, and keyboard/pointer timeline actions target the modal. Project details closes before Settings opens, with the disappearing opener correctly falling back to the header gear. Existing cycle controls use the full configuration row.

Verification: full browser suite passes (59 cases), including repeated same-week selection, input focus/return focus, no duplicate Board editors, real weekly capacity changes and retained Board controls. TypeScript and whitespace checks pass. Existing timeline/calendar/workspace and scope tests now follow the Settings paths.
