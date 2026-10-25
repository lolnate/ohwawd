---
# ohwawd-2ods
title: Outcome catalog and unified outcome workspace
status: todo
type: epic
priority: normal
created_at: 2026-10-23T16:09:20Z
updated_at: 2026-10-25T17:05:43Z
---

Deliver the compact, filterable Outcome Catalog designed in OpenSpec change redesign-outcome-catalog.

Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md
Design: openspec/changes/redesign-outcome-catalog/design.md
Proposal: openspec/changes/redesign-outcome-catalog/proposal.md
Plan: openspec/changes/redesign-outcome-catalog/tasks.md

Completion: all implementation children are verified; the compact searchable/filterable catalog opens one persistent Details/Projects sidebar for create/view/edit/link/delete with section drafts, accurately scoped saves and accessible desktop/mobile context preservation. Repeated row actions and separate outcome overlays/inline editors are retired. Reconcile the OpenSpec checklist and archive only after implementation is complete.

Approved UX rationale: docs/outcomes-ux-review.md. Verified prerequisites: ohwawd-t9oa (data/query) and ohwawd-sk0r (browsing). Remaining dependency chain: ohwawd-5eqp (sidebar/Details) → ohwawd-q087 (creation/Projects) → ohwawd-xlk3 (page/context integration) → ohwawd-vart (cross-feature verification). Each implementation task owns its focused tests and documentation.

The independently planned Workspace Settings overlay is not a prerequisite; coordinate edits to shared workspace/modal integration.
