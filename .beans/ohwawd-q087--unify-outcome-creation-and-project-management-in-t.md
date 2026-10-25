---
# ohwawd-q087
title: Unify outcome creation and project management in the sidebar
status: completed
type: task
priority: normal
created_at: 2026-10-25T17:05:12Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-5eqp
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/archive/2026-10-25-redesign-outcome-catalog/specs/outcome-catalog/spec.md (section navigation/save scopes, creation, project editing, dismissal, save outcomes, submitted writes)
Design: openspec/changes/archive/2026-10-25-redesign-outcome-catalog/design.md (Decision 5)
Conventions: docs/ui-ux-conventions.md

Depends on the persistent sidebar and opening-scoped draft/submission contract from ohwawd-5eqp. Reuse outcome/project field controls and existing APIs inside that shell.

- [x] Add new-outcome mode with blank Details/title focus and Projects navigation; preserve both drafts and project search/status state across section switches and validate/reveal inactive-section errors
- [x] Create metadata plus initial links through the existing single transactional POST, capture its ID and transition to saved Details without remounting the dialog; keep zero-project and optional-only creation valid
- [x] Add saved Projects inspection and Manage projects editing with Required/Optional selection, complete link maps including hidden/unavailable links, explicit unavailable-link removal, Save links and Cancel links
- [x] Preserve the other section draft/mode when saving or cancelling one section; keep catalog membership based on saved values and project search/status independent of the catalog query
- [x] Use the shared submission contract for creation/link writes, freeze submitted fields, handle rejection and refresh-only retry, retain created snapshots after refresh failure, and provide View outcome notices after dismissed creation without reopening or altering a newer dialog
- [x] Add browser tests for same-dialog creation transitions, cross-section save/cancel scopes, filtered/hidden/unavailable project links, validation, creation/link rejection and refresh failures, and completion after dismissal; document the workflow and run typecheck plus affected tests

Completion: all create/detail/link operations are available inside one persistent shell with honest atomic-create versus separate-update save scopes. No sequential detail+link operation is presented as a global atomic save. Dependent integration work retires the old page containers and repeated entry points.

## Summary of Changes

Unified new-outcome creation and saved Projects inspection/editing in the persistent sidebar. Creation uses one POST and retained returned-ID snapshot; section saves/cancels remain independent. Project search stays mounted across navigation and saves, complete link maps count hidden/unavailable projects, and unavailable links require explicit removal. Captured writes survive dismissal and successful late creation offers View outcome. Updated workflow conventions. Verified typecheck and all 10 focused browser tests, including same-dialog transitions, hidden-section validation, separate save scopes, hidden/unavailable links, rejection/refresh failure for all write types and late creation.
