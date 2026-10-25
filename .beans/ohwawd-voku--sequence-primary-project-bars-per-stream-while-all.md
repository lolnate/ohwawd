---
# ohwawd-voku
title: Sequence primary project bars per stream while allowing shadow overlap
status: completed
type: bug
priority: normal
created_at: 2026-10-23T14:19:21Z
updated_at: 2026-10-24T16:32:44Z
---

In the Board timeline, primary project bars within a stream/outcome currently stack at the same time instead of forming a sequential schedule. Render each stream’s own primary projects in sequence across its timeline. A shadow project (displayed in a stream or outcome where its work is not being performed) may overlap a primary project scheduled in that stream. For example, IRAS may appear as a shadow during the same period as ILKM-1 when IRAS work is being performed in a different stream.

Acceptance criteria:
- Primary project bars assigned to a stream are placed sequentially and do not overlap one another in time.
- Each stream has an independent primary-project timeline.
- Shadow project bars do not reserve primary capacity or force primary projects to move; they may overlap projects being executed in the displayed stream.
- Timeline placement clearly distinguishes the primary project schedule from shadow representations.

## Summary of Changes

Confirmed the existing forecast and timeline use one capacity-owning sequence per stream while rendering shared appearances as overlapping zero-point references. Added browser regression coverage for non-overlapping primary spans and allowed shadow overlap. Verified with npm run typecheck, npm test, npm run test:ui -- tests/ui/outcome-sequencing.spec.ts, and npm run build.
