---
# ohwawd-no2d
title: Remove classification box from project drawer
status: completed
type: bug
priority: normal
created_at: 2026-11-06T19:50:54Z
updated_at: 2026-11-06T19:51:32Z
---

Render Project classification as a normal project-drawer section without its component card outline or rounded box, preserving its text layout and the drawer's aligned section divider. Add UI regression coverage.

## Summary of Changes

Removed the Project classification card outline, side borders, rounded corners, and raised background inside the project drawer while retaining the normal aligned drawer-section divider and existing text layout. Classification cards in other surfaces remain unchanged. Added computed-style regression coverage. Typecheck, all five classification Playwright tests, and whitespace validation pass.
