---
# ohwawd-870o
title: Test shadow overlap against a different stream primary project
status: completed
type: task
priority: normal
created_at: 2026-10-24T16:59:00Z
updated_at: 2026-10-25T16:38:51Z
---

Review follow-up for completed Bean ohwawd-voku: tests/ui/outcome-sequencing.spec.ts:48–51 compares the shared appearance of linear:a with its own counted appearance in Core (firstBox). Both use the same projection, so these overlap assertions do not exercise overlap with primary work in the displayed Delivery stream despite the comment.

- [x] Seed independent primary work in the stream displaying the shadow so its dates genuinely overlap the foreign-owned project.
- [x] Assert the shadow overlaps that different local counted project, and that local primary dates/capacity remain unaffected by the shadow.
- [x] Retain the non-overlapping owning-stream assertions and run npm run test:ui -- tests/ui/outcome-sequencing.spec.ts.

## Summary of Changes

Seeded independently estimated Discovery work in Delivery after Rollout. The test now compares the API shadow against that different counted Delivery project in both rendered timeline geometry and forecast cycles. Captured the pre-shadow forecast to prove local project dates, Delivery capacity usage and portfolio demand remain unchanged when shared appearances are added. Retained sequential Core owning-stream assertions and ownership-transfer coverage. Verified all six outcome-sequencing browser tests and npm run typecheck.
