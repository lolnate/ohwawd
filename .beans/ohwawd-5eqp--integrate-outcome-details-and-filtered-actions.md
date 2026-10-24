---
# ohwawd-5eqp
title: Integrate outcome details and filtered actions
status: todo
type: task
priority: normal
created_at: 2026-10-23T16:10:00Z
updated_at: 2026-10-23T16:11:04Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-sk0r
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md
Design: openspec/changes/redesign-outcome-catalog/design.md (Decisions 5–7)
Conventions: docs/ui-ux-conventions.md

Bounded scope: add an outcome inspection/edit sidebar and connect list and delivery actions without losing filters or duplicating modal state. Reuse the current creation-with-projects modal and project-link picker; preserve existing deletion confirmation.

- [ ] Add complete read-only outcome details and relocate the existing editor into the sidebar with explicit success/failure feedback
- [ ] Wire row and delivery entry points, one-overlay handoffs, saved-data refresh and background-draft protection
- [ ] Preserve context when edited/linked outcomes stop matching, offer View outcome for nonmatching creation, and restore valid focus after close/delete/external removal
- [ ] Add browser tests for creation with links, edit/link/delete under filters, picker return flow, backdrop/Escape/drag-out, failures, pending-save dismissal and focus fallbacks
- [ ] Update current workflow documentation and replace outdated card/inline-editor browser selectors

Completion: mutations update catalog/Board/delivery while keeping the current query; no nested outcome dialogs; no older request resets a newer draft; all affected action/accessibility tests pass.
