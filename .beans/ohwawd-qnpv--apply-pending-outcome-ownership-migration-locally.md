---
# ohwawd-qnpv
title: Apply pending outcome ownership migration locally
status: completed
type: bug
priority: normal
created_at: 2026-10-20T22:49:56Z
updated_at: 2026-10-20T22:50:15Z
---

Main page returns the generic server configuration error after outcome sequencing was committed. Confirmed localhost readiness returns HTTP 500 and the local database ledger contains migrations 1–4 while the application requires migration 5.

- [x] Reproduce the error and identify the missing local migration
- [x] Apply migration 5 through the installed migration command
- [x] Verify HTTP readiness and real board loading against the migrated database

## Summary of Changes

Applied migration 5 (outcome-capacity-ownership) to the confirmed local database using npm run db:migrate. Readiness now returns HTTP 200 with status ready. Real getBoard loading succeeds with 77 projects, 3 outcomes, 5 streams, an ownership token, and a ready forecast. No application code or credential changes were necessary.
