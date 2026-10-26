---
# ohwawd-m65h
title: Move outcome planning counts from Board rows to sidebar
status: completed
type: task
priority: high
created_at: 2026-10-26T00:33:38Z
updated_at: 2026-10-26T00:36:03Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-r568
---

Manual Board review follow-up. Remove the counted-points/direct-project summary from every outcome timeline label and show those planning facts in saved outcome Details instead. Preserve delivery state on the Board and all existing accounting semantics.

- [x] Remove row-level outcome points/project-count copy in migrated and legacy rendering.
- [x] Add equivalent counted points and direct project count to outcome Details using current Board data.
- [x] Update browser coverage/docs and run typecheck plus affected tests.

## Summary of Changes

Removed counted-points/direct-project copy from migrated and legacy timeline outcome labels while retaining title, drag handle and delivery state. Saved outcome Details now shows separate Points counted and Direct projects fields derived from the same current forecast, ownership and direct-link data. Updated Board/product documentation and browser assertions. Typecheck, 36 affected Chromium tests, strict validation of all 11 current OpenSpec items and git diff --check passed; refreshed responsive screenshots confirm the shorter labels.
