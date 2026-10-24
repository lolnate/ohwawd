---
# ohwawd-m5tr
title: Size Board project bars from scoped points and stream capacity
status: completed
type: bug
priority: normal
created_at: 2026-10-23T14:19:21Z
updated_at: 2026-10-24T16:20:34Z
---

In the main Board timeline, project bars can extend indefinitely instead of reflecting their project scope. Derive each project bar duration from its total capacity need (issue estimates plus manually assigned effort) and the estimated points available per cycle in the project’s primary stream. Keep the bar aligned to the timeline as capacity or scope changes. Apply the same duration to shadow project bars shown for other streams or outcomes.

Acceptance criteria:
- Project bar duration represents total scoped points divided by estimated points per cycle in the primary stream.
- Issue estimate and manual effort changes update the project bar extent and its timeline alignment.
- Capacity changes in the primary stream update the duration and alignment.
- Shadow project bars use the same primary-stream-derived duration.

## Summary of Changes

Accepted and promoted to main in 75c171f8c64972bb5bbe343abe715c329dac35ee. Implemented primary-stream progress bounds and scope/capacity/shadow regression coverage. Independent combined validation passed: 72 unit tests, production build, typecheck, and 35 UI tests.
