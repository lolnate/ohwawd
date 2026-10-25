---
# ohwawd-lvnd
title: Preserve rendered contrast during theme foundation rollout
status: completed
type: bug
priority: high
created_at: 2026-10-24T16:59:00Z
updated_at: 2026-10-25T13:05:46Z
parent: ohwawd-t1qd
---

Review finding from completed Bean ohwawd-0t83: src/app/theme-base.css:17–19 globally changes heading/paragraph foregrounds while existing component CSS retains light backgrounds. In rendered Settings, h2/h3 are #F2F6FF on #F8FBF9 (1.04:1); descriptive text is #B2C0D8 on #F8FBF9 (1.76:1). The imported base rules make current overlays nearly unreadable before the remaining migration lands.

References: openspec/changes/establish-neon-velocity-theme/design.md (decisions 2, 6); openspec/changes/establish-neon-velocity-theme/specs/visual-theme/spec.md; docs/visual-theme.md. Coordinate with ohwawd-somy; this is the reproduced integration regression, not another full theme migration.

- [x] Keep global dark foreground activation paired with converted surfaces, or complete the relevant source-level surface migration before enabling it.
- [x] Verify rendered Settings and create/link/project dialogs meet text contrast targets; add an actual rendered foreground/background regression check rather than token-only checks.
- [x] Run relevant Settings/overlay browser coverage and retain existing focus/dismissal behavior.

User supplied screenshots confirming mixed legacy/new colors throughout Outcomes, Board, calendar, and Settings. Resolve through source-level semantic-token migration with rendered contrast regression coverage.

## Summary of Changes

Resolved the reproduced Settings/overlay contrast regression by replacing legacy component surfaces and text colors with semantic tokens at source. Added rendered ancestor-composited contrast tests for all Settings sections, creation/link dialogs, and project details. Consolidated the temporary base override sheet into styles.css.

Verification: npm run typecheck; npm test (77 passed); npm run test:ui (47 passed before final responsive adjustment); theme/responsive browser suites (13 passed after that adjustment in development and optimized production); npm run build; openspec validate establish-neon-velocity-theme --strict; git diff --check. No dependencies or external font assets added.
