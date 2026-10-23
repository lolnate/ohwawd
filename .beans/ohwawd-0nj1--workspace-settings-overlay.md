---
# ohwawd-0nj1
title: Workspace Settings overlay
status: todo
type: epic
priority: normal
tags:
    - ux
    - settings
created_at: 2026-10-23T14:35:20Z
updated_at: 2026-10-23T14:35:20Z
---

Implement the user-selected centered Settings overlay and move the three planning-assumption editors out of Board.

## OpenSpec source of truth
- Change: openspec/changes/add-workspace-settings/
- Proposal: openspec/changes/add-workspace-settings/proposal.md
- Design: openspec/changes/add-workspace-settings/design.md
- Acceptance: openspec/changes/add-workspace-settings/specs/workspace-settings/spec.md
- Related deltas: openspec/changes/add-workspace-settings/specs/project-scope-readiness/spec.md; openspec/changes/add-workspace-settings/specs/weekly-capacity/spec.md; openspec/changes/add-workspace-settings/specs/planning-timeline/spec.md
- Deliverable outline: openspec/changes/add-workspace-settings/tasks.md

## Completion criteria
- [ ] All child implementation and integration-validation Beans are verified and completed.
- [ ] The three editors are available through the header gear and contextual Board actions, with no duplicate Board editors.
- [ ] Reconcile OpenSpec tasks from verified Beans and validate the overall change.

Keep this epic open until implementation is complete. Ship relocation and contextual links together. Retain existing planning APIs, calculations, and scenario history; use docs/ui-ux-conventions.md for modal interactions.
