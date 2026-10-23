---
# ohwawd-7amk
title: Implement planning Settings editors and save lifecycle
status: todo
type: task
priority: normal
tags:
    - settings
created_at: 2026-10-23T14:36:00Z
updated_at: 2026-10-23T14:36:00Z
parent: ohwawd-0nj1
blocked_by:
    - ohwawd-zm8w
---

Populate the Settings shell with the three real planning-assumption editors and reliable persistence for OpenSpec task 2.1.

## References
- openspec/changes/add-workspace-settings/proposal.md
- openspec/changes/add-workspace-settings/design.md (decisions 3–4 and verification)
- openspec/changes/add-workspace-settings/specs/workspace-settings/spec.md
- openspec/changes/add-workspace-settings/specs/project-scope-readiness/spec.md
- openspec/changes/add-workspace-settings/specs/weekly-capacity/spec.md
- openspec/changes/add-workspace-settings/tasks.md (2.1)

## Scope
Extract/adapt the current capacity, scope-window, and CalendarAvailability form content for Settings. Reuse GET/PUT /api/board and workspace reload fan-out. Keep saved evidence separate from per-opening drafts and keep mutation ownership alive outside the visible dialog. The following integration Bean removes the inline Board copies and redirects contextual actions; ship both together.

## Acceptance / verification
- [ ] Capacity retains every current field, observed/effective baseline and source evidence, comparable observations, imported/projected context, missing-calendar warnings, and existing validation.
- [ ] Scope readiness retains the default 14-day integer window, 0–365 validation, advisory explanation, reminder recalculation, and persistence.
- [ ] Weekly section retains the holiday toggle/preset labels, Monday normalization and date range, optional label, 0–100% override, saved list/removal, and existing precedence rules.
- [ ] Add meaningful fixture-backed tests for explicit section saves, immediate holiday/removal writes, success/error feedback, load retry, draft preservation across section changes and unrelated saves, and dismiss/reopen discard. Failed writes retain inputs and do not claim success.
- [ ] Serialize writes and guard stale loads; test dismiss/reopen during pending save, duplicate prevention, and a completion refreshing the workspace after dismissal.
- [ ] Verify Settings saves update Board forecasts, Outcomes delivery, scoping reminders, scenario readiness/dirty state without page reload; distinguish save success from refresh failure. Verify reopening after scenario activation uses restored settings and published history stays unchanged.
- [ ] Run focused workspace-settings Playwright cases and npm run typecheck; keep existing calculation/persistence tests passing.

Blocked by the overlay shell. No API contract or database migration is needed.
