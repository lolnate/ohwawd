---
# ohwawd-yqm1
title: Keep timeline bars behind sticky outcome labels
status: completed
type: bug
priority: normal
created_at: 2026-10-26T11:21:37Z
updated_at: 2026-10-26T11:23:39Z
---

Horizontally scrolled timeline bars currently paint and receive pointer events over the sticky outcome-label column because both layers share the same stacking level.

- [x] Keep timeline bars, references, and connectors behind the sticky outcome column while scrolling.
- [x] Add browser coverage for visual and hit-test containment after horizontal scroll.
- [x] Run focused and regression validation.

## Summary of Changes

Raised the opaque sticky outcome-label cells above bars, focused bars, references, unscheduled controls, and connectors. Extended the horizontal-scroll browser test to force a bar beneath the sticky column and verify the label retains both paint and pointer ownership. Passed 139 unit/database tests, 112 Chromium tests, production build, typecheck, Beans integrity, and whitespace validation.
