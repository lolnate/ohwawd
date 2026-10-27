---
# ohwawd-7mvq
title: Filter Board project outcome attention
status: completed
type: bug
priority: normal
created_at: 2026-10-27T14:23:40Z
updated_at: 2026-10-27T14:38:13Z
---

Align Board Planning Attention with the approved current/future project status semantics in openspec/changes/filter-unassigned-projects-by-status/. Remove the candidate-project count from the attention headline and count only backlog/todo/planned/in-progress/started/active candidate projects in the Projects need outcomes action.

- [x] Update OpenSpec behavior and implementation tasks\n- [x] Share current/future project status matching between Outcomes and Board\n- [x] Remove the candidate count headline and filter the Board action/count\n- [x] Add focused browser coverage\n- [x] Run typecheck and targeted UI tests

## Summary of Changes

Shared the current/future project-status matcher between Outcomes and Board, limited Projects need outcomes and the Planning Attention open count to active candidate statuses, replaced the duplicate candidate-count headline with a generic attention heading, updated the active OpenSpec change, and added terminal/current status browser coverage. Verified type checking, all 17 outcome-board browser tests, strict OpenSpec validation, and whitespace.
