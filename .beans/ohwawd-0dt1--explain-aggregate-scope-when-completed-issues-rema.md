---
# ohwawd-0dt1
title: Explain aggregate scope when completed issues remain
status: completed
type: bug
priority: high
created_at: 2026-10-27T11:03:06Z
updated_at: 2026-10-27T11:05:07Z
---

Investigate why Slack Client Communication Foundation forecasts 108 points despite its visible issues being Done and no Extra scope.

- [x] Compare imported aggregate scope with cached issue completion
- [x] Identify whether calculation or presentation is misleading
- [x] Implement and verify a focused correction if needed

## Summary of Changes

Confirmed Linear reports scope=108 and progress=1 while omitting all aggregate scope histories; all 23 imported issues are completed and total 108 points, with no Extra scope. Updated import calculation to use completed/canceled issue estimates as a fallback and floor against any aggregate completion history, and exposed aggregate versus issue-level estimate provenance in project details. Refreshed the connected source: SCCF now has 0 remaining demand, occupies one conservative cycle while its Linear project status remains started, and SGDC starts in the following cycle. Passed typecheck, all 143 unit/database tests, focused Chromium coverage, production build, and whitespace checks.
