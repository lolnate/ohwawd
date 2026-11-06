---
# ohwawd-6r3k
title: Refine project drawer classification placement and warnings
status: completed
type: bug
priority: normal
created_at: 2026-11-06T19:44:09Z
updated_at: 2026-11-06T19:45:48Z
---

Move Project classification to the bottom of the project drawer and reserve warning styling for a saved local decision that genuinely differs from the authoritative Linear classification. Add UI regression coverage.

## Summary of Changes

Moved Project classification to the final section of the project drawer after Project planning. Warning styling now appears only when an authoritative Linear classification genuinely overrides a different saved local decision; matching or absent local decisions show no warning. Added Playwright coverage for matching Roadmap decisions and drawer ordering while retaining true mismatch coverage. Typecheck, all five classification Playwright tests, and whitespace validation pass.
