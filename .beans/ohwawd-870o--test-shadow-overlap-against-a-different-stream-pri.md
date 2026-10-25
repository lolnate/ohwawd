---
# ohwawd-870o
title: Test shadow overlap against a different stream primary project
status: todo
type: task
priority: normal
created_at: 2026-10-24T16:59:00Z
updated_at: 2026-10-24T16:59:00Z
---

Review follow-up for completed Bean ohwawd-voku: tests/ui/outcome-sequencing.spec.ts:48–51 compares the shared appearance of linear:a with its own counted appearance in Core (firstBox). Both use the same projection, so these overlap assertions do not exercise overlap with primary work in the displayed Delivery stream despite the comment.

- [ ] Seed independent primary work in the stream displaying the shadow so its dates genuinely overlap the foreign-owned project.
- [ ] Assert the shadow overlaps that different local counted project, and that local primary dates/capacity remain unaffected by the shadow.
- [ ] Retain the non-overlapping owning-stream assertions and run npm run test:ui -- tests/ui/outcome-sequencing.spec.ts.
