---
# ohwawd-0nj1
title: Workspace Settings overlay
status: completed
type: epic
priority: normal
tags:
    - ux
    - settings
created_at: 2026-10-23T14:35:20Z
updated_at: 2026-10-25T18:26:38Z
---

Implement the user-selected centered Settings overlay and move the three planning-assumption editors out of Board.

## OpenSpec source of truth
- Change: openspec/changes/archive/2026-10-25-add-workspace-settings/
- Proposal: openspec/changes/archive/2026-10-25-add-workspace-settings/proposal.md
- Design: openspec/changes/archive/2026-10-25-add-workspace-settings/design.md
- Acceptance: openspec/changes/archive/2026-10-25-add-workspace-settings/specs/workspace-settings/spec.md
- Related deltas: openspec/changes/archive/2026-10-25-add-workspace-settings/specs/project-scope-readiness/spec.md; openspec/changes/archive/2026-10-25-add-workspace-settings/specs/weekly-capacity/spec.md; openspec/changes/archive/2026-10-25-add-workspace-settings/specs/planning-timeline/spec.md
- Deliverable outline: openspec/changes/archive/2026-10-25-add-workspace-settings/tasks.md

## Completion criteria
- [x] All child implementation and integration-validation Beans are verified and completed.
- [x] The three editors are available through the header gear and contextual Board actions, with no duplicate Board editors.
- [x] Reconcile OpenSpec tasks from verified Beans and validate the overall change.

Keep this epic open until implementation is complete. Ship relocation and contextual links together. Retain existing planning APIs, calculations, and scenario history; use docs/ui-ux-conventions.md for modal interactions.

## Summary of Changes

Completed and verified the full Settings overlay: capacity, scope-readiness and weekly/holiday editors now live in Settings, contextual Board actions open the correct section with focus, and saved assumptions refresh forecasts and scenario state. All child Beans are complete. The OpenSpec task checklist is reconciled and strict validation passes; the active change is ready for review and the normal sync/archive workflow.

Verification: TypeScript, production build, 77 unit/database tests, all 59 browser tests, rendered contrast, desktop/tablet/mobile screenshots, and whitespace checks passed. Implementation follows the approved Neon Velocity theme.

Archive reconciliation completed under ohwawd-xkv6: openspec/changes/archive/2026-10-25-add-workspace-settings/. Normative specs synchronized, implementation child references repaired, all associated Beans complete, strict global and archive validation passed.
