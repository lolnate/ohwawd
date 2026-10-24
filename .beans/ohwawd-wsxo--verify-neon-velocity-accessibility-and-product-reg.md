---
# ohwawd-wsxo
title: Verify Neon Velocity accessibility and product regressions
status: todo
type: task
priority: normal
created_at: 2026-10-23T20:04:32Z
updated_at: 2026-10-23T20:05:28Z
parent: ohwawd-t1qd
blocked_by:
    - ohwawd-lw34
---

OpenSpec: openspec/changes/establish-neon-velocity-theme/design.md (Decision 7 and Migration Plan)
Requirements: openspec/changes/establish-neon-velocity-theme/specs/visual-theme/spec.md
Checklist: openspec/changes/establish-neon-velocity-theme/tasks.md
Reference: docs/visual-theme.md

- [ ] Run configured TypeScript, build, unit/database and affected UI suites after each implementation unit has landed its own tests/documentation
- [ ] Verify rendered contrast and focus on all views/overlays, combined calendar states, native controls and keyboard navigation
- [ ] Inspect 1440px, 768px and 390px views plus enlarged text, reduced motion, forced colors and external-font-unavailable behavior
- [ ] Confirm unchanged scheduling values, geometry, filters, capacity ownership, saved/scenario behavior and no leftover mixed-theme essential surfaces
- [ ] Record verification evidence, synchronize the static preview/reference, update implementation status only after acceptance, and validate/reconcile OpenSpec tasks

Completion: all requirement scenarios and affected existing workflows pass. Parent epic handles the final archive workflow after all implementation work is complete.
