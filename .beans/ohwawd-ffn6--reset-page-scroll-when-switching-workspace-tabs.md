---
# ohwawd-ffn6
title: Reset page scroll when switching workspace tabs
status: completed
type: bug
priority: normal
created_at: 2026-11-06T17:13:31Z
updated_at: 2026-11-06T17:15:38Z
---

Switching Board, Outcomes, Linear projects, or Scenarios should reset document scroll to the top so the destination view is immediately visible. Add Playwright regression coverage.

## Summary of Changes

Reset document scroll immediately whenever the active workspace view changes, covering tab clicks and programmatic navigation. Added a deterministic Playwright regression that scrolls the Board document and verifies switching to Linear projects returns window.scrollY to zero. Typecheck, 15 related Playwright tests, and whitespace validation pass.
