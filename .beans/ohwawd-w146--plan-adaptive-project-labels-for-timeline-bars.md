---
# ohwawd-w146
title: Plan adaptive project labels for timeline bars
status: completed
type: task
priority: normal
created_at: 2026-10-27T13:18:28Z
updated_at: 2026-10-27T14:35:43Z
---

Define the requirements, fitting policy, implementation approach, accessibility behavior, acceptance criteria, and test plan for dynamically selecting full, truncated, or abbreviated project labels inside Board timeline bars.

- [x] Inspect current timeline rendering, naming data, specifications, and tests
- [x] Resolve or explicitly identify product decisions and edge cases
- [x] Produce an implementation-ready feature plan and acceptance criteria

Planning only; no application code changes.

## Summary of Changes

Reviewed the Board timeline component, generated project codes, responsive bar geometry, accessibility requirements, CSS, Playwright coverage, and the planning-timeline specification. Defined an implementation-ready adaptive-label policy: preserve single-line bars and truthful geometry; measure the name slot after fixed planning context; use the full name when it fits, an ellipsized name when a useful majority fits, and the stable generated project code for narrow bars; recompute on bar/font/viewport changes; preserve the complete name, code, and context in accessible labeling. The implementation should update the planning-timeline OpenSpec requirement and add focused unit/UI coverage across resizing, narrow fractional bars, suffix context, and accessibility.
