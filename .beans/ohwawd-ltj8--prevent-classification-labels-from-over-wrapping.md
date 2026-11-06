---
# ohwawd-ltj8
title: Prevent classification labels from over-wrapping
status: completed
type: bug
priority: normal
created_at: 2026-11-06T16:50:01Z
updated_at: 2026-11-06T16:50:25Z
---

Keep Roadmap and Ongoing radio labels readable in narrow project classification controls. Add a responsive regression assertion and verify classification interaction tests.

## Summary of Changes

Prevented Roadmap and Ongoing radio labels from shrinking and wrapping inside words by restoring intrinsic option widths and normal wrapping. Added a 390px Playwright regression assertion for single-line option labels. Typecheck, all four classification Playwright tests, and git diff whitespace validation pass.
