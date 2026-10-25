---
# ohwawd-vart
title: Validate integrated catalog redesign
status: todo
type: task
priority: normal
created_at: 2026-10-23T16:10:00Z
updated_at: 2026-10-25T17:05:43Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-xlk3
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md
Design: openspec/changes/redesign-outcome-catalog/design.md (Decision 7, Risks, Migration Plan)
Task checklist: openspec/changes/redesign-outcome-catalog/tasks.md

Bounded scope: cross-feature verification after sidebar foundation (ohwawd-5eqp), creation/Projects (ohwawd-q087) and page/context integration (ohwawd-xlk3) have each landed their own tests and documentation. This Bean does not defer those tasks individual acceptance coverage to the end.

- [ ] Run npm run typecheck, npm test and npm run test:ui -- tests/ui/outcome-catalog.spec.ts tests/ui/workspace-organization.spec.ts tests/ui/outcome-sequencing.spec.ts tests/ui/responsive-workspace.spec.ts tests/ui/visual-theme.spec.ts
- [ ] Inspect 1440px, 768px and 390px views with many outcomes and long text; verify keyboard navigation, selected sections, inert background, normal catalog page scrolling, reachable sidebar header/actions, visible draft/save status, no horizontal overflow, reduced motion and forced colors
- [ ] Verify the integrated create/view/edit/link/delete workflows use one persistent dialog and preserve separate save scopes, cross-section drafts, hidden-section validation, pending-write dismissal and generation guards, refresh-only retries, filtered membership and focus recovery
- [ ] Review Board/delivery title and Resolve blocker paths, scenario/source refreshes, hidden/unavailable links and interactions with Workspace Settings; confirm repeated row actions and legacy overlay/inline containers are retired
- [ ] Record browser/visual evidence and actual walkthrough observations where available, reconcile OpenSpec tasks from completed Beans, and run openspec validate redesign-outcome-catalog --strict

Completion: revised requirement scenarios and existing affected flows pass, all other implementation children are complete, and evidence identifies any remaining blocker. Keep the change active until resolved; record the normal archive step on the parent without archiving incomplete work.
