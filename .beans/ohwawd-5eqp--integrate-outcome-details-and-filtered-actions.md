---
# ohwawd-5eqp
title: Build persistent outcome sidebar and Details editing
status: todo
type: task
priority: normal
created_at: 2026-10-23T16:10:00Z
updated_at: 2026-10-25T17:05:12Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-sk0r
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md (shared sidebar, inspection, section drafts, save outcomes, submitted writes, responsive operation)
Design: openspec/changes/redesign-outcome-catalog/design.md (Decisions 5 and 7)
Conventions: docs/ui-ux-conventions.md
UX rationale: docs/outcomes-ux-review.md

Revised scope after approval of the unified-sidebar design. This Bean replaces the former separate-overlay handoff plan. Build the stable sidebar, opening-scoped draft/controller contract and existing Details workflow; subsequent dependent Beans complete creation/Projects and simplify all page entry points.

- [ ] Add one native-dialog sidebar with persistent header, Details/Projects section navigation, selected state, full-screen narrow layout, contained focus, backdrop pointer-origin protection and opener/fallback restoration
- [ ] Route catalog-title inspection to complete saved Details and existing direct-link inspection in Projects; move metadata editing into Details with Edit details, Save details and Cancel details, keeping stream assignment read-only
- [ ] Own drafts, edit modes and section context at opening scope; mark unsaved sections, preserve metadata drafts through navigation and background refresh, discard unsubmitted work on all dismissals, and keep Close available during saves
- [ ] Introduce explicit mutation outcomes and controller-owned captured submissions/generation guards; freeze submitted fields, serialize conflicting writes, preserve newer openings, and distinguish rejected metadata writes from saved-but-refresh-failed state with refresh-only retry
- [ ] Add focused browser coverage for inspection/details navigation, validation, metadata save/cancel/dismissal, refresh failure, late saves, focus and backdrop/drag-out; update workflow documentation for the foundation and run typecheck plus affected tests

Completion: title-driven inspection and metadata editing work in the stable sidebar with tested draft/save/focus behavior. Expose a controller/component contract for dependent creation/Projects work; legacy creation/link entry points may coexist temporarily during development but are removed before final integration ships. No project/link or combined-update API changes.
