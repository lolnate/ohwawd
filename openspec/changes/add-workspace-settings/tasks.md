# Tasks

Beans is the source of truth for execution status and dependencies. This checklist describes the implementation deliverables; reconcile it from completed, verified Beans rather than maintaining a second live tracker. Read `design.md` and the referenced delta specs before implementation.

Implementation epic: `ohwawd-0nj1`.

| Deliverable | Bean | Prerequisite |
| --- | --- | --- |
| 1.1 Overlay shell | `ohwawd-zm8w` | None |
| 2.1 Editors and data lifecycle | `ohwawd-7amk` | `ohwawd-zm8w` |
| 3.1 Board relocation and contextual actions | `ohwawd-bgm3` | `ohwawd-7amk` |
| 4.1 Cross-view acceptance validation | `ohwawd-mrzq` | `ohwawd-bgm3` |

## 1. Accessible overlay shell

- [ ] 1.1 Add the signed-in header gear, workspace-owned centered Settings dialog, three-section navigation, responsive styling, and accessible focus/dismissal behavior per `specs/workspace-settings/spec.md`; verify with new shell-focused Playwright coverage for all workspace views, focus containment/restoration, Close/Escape/backdrop/drag-out, and 390px/768px/1440px containment. Check the implementation against `docs/ui-ux-conventions.md`.

## 2. Settings editors and data lifecycle

- [ ] 2.1 Implement all three Settings editors using the existing board API and a settings-local draft/mutation lifecycle per `design.md` decisions 3–4 and the workspace-settings, project-scope-readiness, and weekly-capacity delta specs; verify capacity evidence/validation, scoping persistence, holiday toggle and override removal, draft preservation, retryable load/save errors, dismiss-during-save behavior, and fresh scenario values on reopening in focused Playwright tests. Verify successful changes refresh Board, Outcomes, and scenario state without a page reload, and run `npm run typecheck`.

## 3. Board relocation and contextual entry points

- [ ] 3.1 Remove the three Board editors and their obsolete local state, route baseline/capacity actions, cycle-calendar weekly links, and timeline week selection into Settings, and preserve project-drawer handoff per `specs/planning-timeline/spec.md` and `design.md` decision 5; verify target section/input focus, repeated same-week selection, return focus, live timeline changes, and absence of duplicate Board editors. Update the existing timeline, workspace-organization, and calendar-projection UI tests alongside the integration.

## 4. Cross-view acceptance validation

- [ ] 4.1 Validate the integrated Settings experience against all delta scenarios, inspect desktop/mobile visual composition, and run `npm run typecheck`, `npm test`, and `npm run test:ui -- tests/ui/workspace-settings.spec.ts tests/ui/workspace-organization.spec.ts tests/ui/planning-timeline.spec.ts tests/ui/cycle-calendar-projection.spec.ts tests/ui/responsive-workspace.spec.ts`; record results in the implementation Beans and validate this OpenSpec change before marking the implementation complete.

## Workflow follow-up

- Ship the editor relocation and contextual entry-point changes together.
- Once all associated implementation Beans are verified and completed, reconcile this checklist and use the normal OpenSpec archive workflow. Keep it active while work remains.
