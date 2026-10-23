---
# ohwawd-mrzq
title: Validate integrated Settings UX and planning regressions
status: todo
type: task
priority: normal
tags:
    - settings
    - verification
created_at: 2026-10-23T14:36:33Z
updated_at: 2026-10-23T14:37:00Z
parent: ohwawd-0nj1
blocked_by:
    - ohwawd-bgm3
---

Perform cross-view acceptance validation after the implementation tasks have landed their own focused tests. Covers OpenSpec task 4.1.

## References
- openspec/changes/add-workspace-settings/proposal.md
- openspec/changes/add-workspace-settings/design.md (verification, risks, migration)
- openspec/changes/add-workspace-settings/specs/workspace-settings/spec.md
- openspec/changes/add-workspace-settings/specs/project-scope-readiness/spec.md
- openspec/changes/add-workspace-settings/specs/weekly-capacity/spec.md
- openspec/changes/add-workspace-settings/specs/planning-timeline/spec.md
- openspec/changes/add-workspace-settings/tasks.md (4.1)

## Acceptance / verification
- [ ] Review every delta scenario against the integrated implementation and existing focused tests; resolve any gaps in the owning implementation Bean.
- [ ] Inspect rendered Settings at desktop, tablet, and phone widths for visual integration, bounded scrolling, long-list handling, and reachable navigation/save/Close controls. Record observations.
- [ ] Verify a saved change from a non-Board view updates delivery/forecast/reminders and scenario readiness/dirty state; reopening after scenario activation shows restored assumptions while published output remains unchanged.
- [ ] Run npm run typecheck and npm test; record actual results.
- [ ] Run npm run test:ui -- tests/ui/workspace-settings.spec.ts tests/ui/workspace-organization.spec.ts tests/ui/planning-timeline.spec.ts tests/ui/cycle-calendar-projection.spec.ts tests/ui/responsive-workspace.spec.ts; record actual results.
- [ ] Run openspec validate add-workspace-settings --strict; after the implementation Beans and acceptance checks are verified, reconcile openspec/changes/add-workspace-settings/tasks.md and the epic acceptance items from verified results.

Blocked by completed Board/contextual integration. This task checks broader integration; earlier tasks own their focused tests. Do not archive the change while implementation remains incomplete or unresolved.
