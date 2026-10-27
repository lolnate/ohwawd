---
# ohwawd-t5ot
title: Filter projects without outcomes by status
status: completed
type: feature
priority: normal
created_at: 2026-10-26T23:24:39Z
updated_at: 2026-10-27T10:53:49Z
---

Implement the approved Outcomes refinement in openspec/changes/filter-unassigned-projects-by-status/.

- [x] Specify the clarified section name and default editable status filter
- [x] Implement the Outcomes candidate-project filter and responsive presentation
- [x] Update browser coverage and documentation
- [x] Run typecheck, targeted tests, build, OpenSpec validation, and whitespace checks

## Summary of Changes

Renamed the Outcomes candidate section to Projects without outcomes, added an editable status filter defaulting to current and future Linear project states, preserved all candidate statuses as options, updated responsive coverage and documentation, and reconciled the active relocation specification. Verified 142 unit/database tests, 117 Chromium tests, typecheck, production build, strict OpenSpec validation, Beans check, and whitespace checks.
