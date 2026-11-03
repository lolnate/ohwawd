---
# ohwawd-rny8
title: Keep project code visible on narrow timeline bars
status: completed
type: bug
priority: high
created_at: 2026-11-03T14:07:28Z
updated_at: 2026-11-03T14:09:38Z
parent: ohwawd-234m
---

The adaptive label selects code mode for narrow bars, but the non-shrinking points/state suffix can collapse the code span to zero, leaving only points visible. This violates the narrow-bar scenario in openspec/changes/adapt-timeline-project-labels/specs/planning-timeline/spec.md.

- [x] Reserve visible space for the stable project code before optional suffix context in code mode.
- [x] Add regression coverage reproducing a suffix wider than the remaining narrow bar.
- [x] Run focused typecheck and planning-timeline Playwright validation.

## Summary of Changes

Changed code-mode flex sizing so the stable abbreviation retains its natural width and points/state context truncates in the remaining space. Label fitting now measures intrinsic context text independently of flex growth. Added a regression that forces context wider than the narrow bar; the full planning-timeline suite, typecheck, build, and strict OpenSpec validation pass.
