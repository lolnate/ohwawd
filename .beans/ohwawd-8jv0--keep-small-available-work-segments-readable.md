---
# ohwawd-8jv0
title: Keep small available-work segments readable
status: completed
type: bug
priority: normal
created_at: 2026-11-06T16:52:19Z
updated_at: 2026-11-06T16:52:48Z
---

Give nonempty Ready, Blocked, and Backlog segments a readable minimum width so low issue counts do not wrap labels vertically, while retaining proportional growth and responsive containment. Add Playwright regression coverage.

## Summary of Changes

Added a 108px readable floor and single-line labels for nonempty available-work segments while preserving issue-count flex growth above the floor. The segment rail contains overflow on narrow screens rather than widening the page. Added regression coverage for a single-issue segment and reran both available-work and classification UI suites. Typecheck, 8 targeted Playwright tests, and whitespace validation pass.
