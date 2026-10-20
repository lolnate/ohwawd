---
# ohwawd-r5rk
title: Use full width for needs-assignment shelf
status: completed
type: bug
priority: normal
created_at: 2026-10-20T18:22:34Z
updated_at: 2026-10-20T18:23:28Z
---

The Needs assignment shelf is constrained to one column of a two-column board-shelves grid even though it is the only lane in that row.

- [x] Make the shelf span the available board width
- [x] Add or update a UI regression assertion
- [x] Run relevant verification

## Summary of Changes

Made the Needs assignment priority shelf use a single full-width grid column and added a desktop UI assertion that its lane fills the shelf. Verified with TypeScript and the responsive Playwright suite.
