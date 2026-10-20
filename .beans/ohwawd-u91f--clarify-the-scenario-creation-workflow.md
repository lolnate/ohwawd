---
# ohwawd-u91f
title: Clarify the scenario creation workflow
status: todo
type: task
priority: normal
tags:
    - ux
    - scenarios
created_at: 2026-10-20T11:13:40Z
updated_at: 2026-10-20T11:13:40Z
---

## Context

The empty Scenarios view shows an unexplained Slice 3 badge, an empty Selected draft selector, a New scenario field with January plan as placeholder text, and an enabled Create from board button. The guidance says to configure the board but gives no direct route or readiness criteria.

## Tasks

- [ ] Explain the meaning of the slice and how scenarios relate to the current board.
- [ ] Provide a direct path to any required board configuration.
- [ ] Show scenario readiness or unmet prerequisites before creation.
- [ ] Require an explicit scenario name and clarify placeholder versus entered value.
- [ ] Simplify duplicated Decision scenarios headings in the empty state.

## Acceptance Criteria

- A first-time user can understand what will be captured before creating a scenario.
- Create from board is enabled only when required inputs and prerequisites are satisfied.
- Empty-state guidance leads directly to the next required action.
