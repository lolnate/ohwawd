---
# ohwawd-vart
title: Validate integrated catalog redesign
status: todo
type: task
priority: normal
created_at: 2026-10-23T16:10:00Z
updated_at: 2026-10-23T16:11:04Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-5eqp
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md
Design: openspec/changes/redesign-outcome-catalog/design.md (Decision 7, Risks, Migration Plan)
Task checklist: openspec/changes/redesign-outcome-catalog/tasks.md

Bounded scope: cross-feature verification after the query, browse UI and sidebar tasks have each landed their own tests/documentation.

- [ ] Run npm run typecheck, npm test and the affected catalog, workspace-organization, outcome-sequencing and responsive-workspace browser suites
- [ ] Inspect 1440px, 768px and 390px views with many outcomes and long data; verify keyboard navigation, normal page scrolling, inert modal background and no horizontal overflow
- [ ] Review Board-to-delivery editing paths, scenario/source refreshes, filtered mutations and interactions with any Workspace Settings work already merged
- [ ] Record verification evidence, reconcile OpenSpec tasks from completed Beans, and run strict validation

Completion: all implemented requirement scenarios and existing affected flows pass; other implementation children are complete; record the remaining normal OpenSpec archive step on the parent epic without archiving incomplete work.
