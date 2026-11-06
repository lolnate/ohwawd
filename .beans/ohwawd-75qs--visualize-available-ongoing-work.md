---
# ohwawd-75qs
title: Visualize available Ongoing work
status: completed
type: task
priority: normal
created_at: 2026-11-03T12:26:35Z
updated_at: 2026-11-06T13:36:13Z
parent: ohwawd-t8lm
blocked_by:
    - ohwawd-mu1i
    - ohwawd-ouyc
---

OpenSpec task 5.2. Add the Ready, Blocked, and Backlog issue-count visualization with estimates, uncertainty, in-progress context, Needs classification, and lazy inspection. References: openspec/changes/visualize-ongoing-work/specs/ongoing-work-insights/spec.md and design.md Decision 7. Complete when targeted Playwright tests pass for sorting, values, blockers, links, empty states, keyboard use, and 390px containment and task 5.2 is checked.

## Summary of Changes

Added the compact Ongoing available-work section after roadmap streams with count-based Ready, Blocked, and Backlog geometry, exact estimate/uncertainty and in-progress context, a distinct Needs classification group with local controls, and read-only lazy issue inspection with accessible modal behavior. Added targeted Playwright coverage for ordering, values, geometry, grouping, empty state, keyboard/source/blocker evidence, focus restoration, API retry, and 390px containment. Validated with typecheck, 169 unit/domain tests, targeted UI tests, the full 127-test UI suite, strict OpenSpec validation, and git diff checks.
