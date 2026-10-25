---
# ohwawd-wsxo
title: Verify Neon Velocity accessibility and product regressions
status: completed
type: task
priority: normal
created_at: 2026-10-23T20:04:32Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-t1qd
blocked_by:
    - ohwawd-lw34
---

OpenSpec: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/design.md (Decision 7 and Migration Plan)
Requirements: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/specs/visual-theme/spec.md
Checklist: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/tasks.md
Reference: docs/visual-theme.md

- [x] Run configured TypeScript, build, unit/database and affected UI suites after each implementation unit has landed its own tests/documentation
- [x] Verify rendered contrast and focus on all views/overlays, combined calendar states, native controls and keyboard navigation
- [x] Inspect 1440px, 768px and 390px views plus enlarged text, reduced motion, forced colors and external-font-unavailable behavior
- [x] Confirm unchanged scheduling values, geometry, filters, capacity ownership, saved/scenario behavior and no leftover mixed-theme essential surfaces
- [x] Record verification evidence, synchronize the static preview/reference, update implementation status only after acceptance, and validate/reconcile OpenSpec tasks

Completion: all requirement scenarios and affected existing workflows pass. Parent epic handles the final archive workflow after all implementation work is complete.

## Summary of Changes

Verified the migration with TypeScript, production build, 77 unit/database tests, the full 47-test browser suite, and 13 focused theme/responsive browser cases after the final navigation change. The same 13 cases passed against the optimized production server to verify CSS ordering. Inspected rendered screenshots at 1440px, 768px and 390px. New tests cover rendered contrast, fields/focus, forced colors, reduced motion, 200% text, external-font-free login/error rendering and independent calendar cues. Existing tests preserve plan values, geometry, assignment, ownership and scenario workflows.

Verification: npm run typecheck; npm test (77 passed); npm run test:ui (47 passed before final responsive adjustment); theme/responsive browser suites (13 passed after that adjustment in development and optimized production); npm run build; openspec validate establish-neon-velocity-theme --strict; git diff --check. No dependencies or external font assets added.
