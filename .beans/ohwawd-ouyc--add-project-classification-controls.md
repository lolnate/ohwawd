---
# ohwawd-ouyc
title: Add project classification controls
status: completed
type: task
priority: normal
created_at: 2026-11-03T12:26:35Z
updated_at: 2026-11-06T13:24:09Z
parent: ohwawd-t8lm
blocked_by:
    - ohwawd-qi52
---

OpenSpec task 5.1. Expose effective classification, provenance, conflicts, and durable local controls in project planning and Needs classification surfaces. References: openspec/changes/visualize-ongoing-work/specs/project-classification/spec.md and design.md Decision 7. Complete when targeted Playwright tests cover feedback, stale conflicts, keyboard, focus, and narrow screens and task 5.1 is checked.

## Summary of Changes

Added effective Roadmap/Ongoing/Unresolved classification and provenance to Linear project rows, project inspection, and a compact Board Needs classification surface with current available-work evidence. Added durable local controls using the token-protected Board mutation, explicit exact-label conflict/source-authority context, retained retry drafts, refreshed Board/workspace state, conflict feedback, focus recovery, keyboard support, and 390px containment. Added targeted Playwright coverage for source authority, successful and rejected saves, stale conflicts, keyboard/focus behavior, and narrow-screen containment. Validated with typecheck, 169 domain tests, 123 Playwright tests, strict OpenSpec validation, and git diff checks.
