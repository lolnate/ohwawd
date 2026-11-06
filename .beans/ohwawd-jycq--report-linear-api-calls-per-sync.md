---
# ohwawd-jycq
title: Report Linear API calls per sync
status: completed
type: task
priority: normal
created_at: 2026-11-06T12:17:51Z
updated_at: 2026-11-06T12:43:12Z
---

Count actual Linear API request attempts during a synchronization, including pagination and retries, return the count from the import endpoint, and show it in the user-facing sync report. Add focused adapter and UI/domain coverage.

## Checklist

- [x] Instrument Linear request attempts centrally
- [x] Return API call count from sync endpoint
- [x] Display count in sync reporting message
- [x] Add request-count and reporting tests
- [x] Run typecheck and relevant tests
- [x] Summarize and complete the task

## Summary of Changes

Counted every Linear SDK and raw GraphQL request attempt within a source instance, including pagination and network retries. Returned the successful sync count from the import endpoint and displayed it in the existing sync report with singular/plural wording. Added retry, pagination, and browser-visible reporting coverage. Verified with typecheck, all 159 unit tests, the focused Playwright test, and git diff whitespace checks.

## Follow-up

- [x] Include the API-call count in the top sync success message
- [x] Verify the top-message behavior and complete the task

## Follow-up Summary

Corrected the placement by adding the API-call summary to the dismissible top success notice for both initial imports and subsequent syncs. The focused browser test now verifies both the top notice and detailed report. Typecheck, Playwright, and whitespace validation pass.
