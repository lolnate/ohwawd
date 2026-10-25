---
# ohwawd-px1w
title: Theme Board and calendar state graphics
status: completed
type: task
priority: normal
created_at: 2026-10-23T20:04:32Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-t1qd
blocked_by:
    - ohwawd-somy
---

OpenSpec: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/design.md (Decisions 5–6)
Requirements: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/specs/visual-theme/spec.md
Reference: docs/visual-theme.md (planning tokens and Board recipes)

- [x] Migrate stream lanes, outcome headings, summaries, project controls, time bars, calendar headers and legends to semantic theme tokens
- [x] Distinguish solid counted work from outlined shared/zero-count references; preserve ownership fill when adding projected/provisional provenance cues
- [x] Preserve reduced availability, projected and missing-calendar distinctions including overlapping patterns and explicit percentages
- [x] Verify existing plan values, bar positions/widths, dependencies and scrolling geometry remain equivalent; add focused browser coverage for combined states and readable text
- [x] Check dense labels, mobile containment, keyboard focus and forced-color ownership cues; document any necessary token/marker refinement

Completion: the Board is fully themed and all planning distinctions remain understandable without color alone. Do not change scheduling math, durations, assignments or point allocation.

## Summary of Changes

Migrated Board summaries, attention panels, stream/project controls, calendars, capacity bands and legends at source. Counted projects retain solid teal fill; shared references retain dashed outlines; projected bars use a separate violet inset and visible asterisk. Reduced/projected combinations keep amber availability with independent hatching. Existing scheduling, geometry and ownership suites pass.

Verification: npm run typecheck; npm test (77 passed); npm run test:ui (47 passed before final responsive adjustment); theme/responsive browser suites (13 passed after that adjustment in development and optimized production); npm run build; openspec validate establish-neon-velocity-theme --strict; git diff --check. No dependencies or external font assets added.
