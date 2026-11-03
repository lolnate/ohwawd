---
# ohwawd-234m
title: Adapt project labels to timeline bar width
status: completed
type: feature
priority: normal
created_at: 2026-11-03T14:01:41Z
updated_at: 2026-11-03T14:09:42Z
---

Implement openspec/changes/adapt-timeline-project-labels/. Prefer full project names when they fit finite Board bars, ellipsize useful names, and fall back to stable project codes without changing timeline geometry or accessibility. Complete when all child Beans and OpenSpec tasks are verified.

## Summary of Changes

Delivered openspec/changes/adapt-timeline-project-labels/: finite Board bars now show full names when they fit, ellipsized names when at least half fits, and stable codes for narrow spans. Added rendered resize/font remeasurement, preserved fixed planning context and accessibility, documented behavior, and completed all validation.

## Regression Follow-up

A narrow bar can let the points suffix collapse the selected project code. Reopened for a code-priority sizing fix.

## Regression Resolution

Code mode now prioritizes the stable project abbreviation; points and other suffix context truncate instead of collapsing that identity. Added and passed focused regression coverage.
