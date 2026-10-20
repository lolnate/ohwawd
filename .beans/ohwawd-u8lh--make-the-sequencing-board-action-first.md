---
# ohwawd-u8lh
title: Make the sequencing board action-first
status: completed
type: task
priority: high
tags:
    - ux
    - board
created_at: 2026-10-20T11:13:40Z
updated_at: 2026-10-20T12:30:54Z
---

## Context

At 1440x1000, the default Board is approximately 1,776px tall and combines four metrics, three blocked outcomes, five stream-setting forms, cycle tables, dependencies, and assignment tools. The Needs assignment queue contains 72 projects but appears near the bottom.

## Tasks

- [x] Prioritize blocking exceptions, unassigned work, and recommended next actions above configuration details.
- [x] Apply progressive disclosure to stream settings, capacity assumptions, cycle details, and explanatory sections.
- [x] Make forecast blockers actionable by linking each warning to the affected project or planning control.
- [x] Clarify the relationship between target dates, Blocked status, and Cannot assess target.

## Acceptance Criteria

- Users can identify the highest-priority planning action without scrolling through all stream forms.
- Administrative controls do not dominate the default board view.
- Each forecast blocker provides a clear path to resolution.

## Summary of Changes

Added a planning-attention queue and moved Needs assignment to the top of the board. Collapsed per-stream settings, linked setup and package blockers to their resolution controls, and separated forecast status from target assessment so blocked work explains why a target cannot be assessed.
