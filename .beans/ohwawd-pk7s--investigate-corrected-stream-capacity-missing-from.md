---
# ohwawd-pk7s
title: Investigate corrected stream capacity missing from timeline
status: completed
type: bug
priority: high
created_at: 2026-10-27T10:57:13Z
updated_at: 2026-10-27T10:58:46Z
---

Investigate why the Case and Response Operations stream still renders 0% capacity and leaves SGDC/SCCF unscheduled after estimates, allocation, and blocking order were corrected.

- [x] Trace persisted stream/project state and timeline refresh path
- [x] Reproduce and identify root cause
- [x] Implement focused fix and regression coverage if code is defective
- [x] Run relevant validation and summarize findings

Root cause reproduced against local persisted data: stream-2 is correctly allocated 20%; SCCF has authoritative Linear remaining_scope=108 and precedes SGDC (80 Extra scope), but forecast.ts still applies the legacy zero-open-issues guard and marks SCCF as having no estimate.

## Summary of Changes

Preserved aggregate-scope provenance in forecast inputs so a project with authoritative Linear remaining scope remains schedulable even when no open issue rows are cached. Added a database regression for 108 points at 20% of a 130-point baseline with no issues. Verified the corrected local plan schedules SCCF in cycles 26-30, then SGDC in cycles 31-35, with provisional outcome delivery on 2027-01-04. Passed typecheck, all 143 unit/database tests, the focused Chromium timeline test, production build, and whitespace checks.
