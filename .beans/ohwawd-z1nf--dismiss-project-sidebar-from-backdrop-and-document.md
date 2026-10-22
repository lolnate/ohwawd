---
# ohwawd-z1nf
title: Dismiss project sidebar from backdrop and document UX conventions
status: completed
type: task
priority: normal
created_at: 2026-10-20T22:54:23Z
updated_at: 2026-10-20T22:55:42Z
---

Make the project sidebar dismiss when clicking its backdrop and establish a UI/UX conventions document for project agents. This is a small completion of the existing sidebar interaction, with no scheduling changes.

- [x] Implement backdrop dismissal while preserving inside interaction, Escape/Close and focus restoration
- [x] Add docs/ui-ux-conventions.md and link it from AGENTS.md as required agent guidance
- [x] Verify sidebar interactions and TypeScript checks

## Summary of Changes

Project sidebar closes on a backdrop click/tap while preserving inside clicks, drag-out interactions, native modal focus containment, Close/Escape dismissal and focus restoration. Added docs/ui-ux-conventions.md with the shared overlay-sidebar convention and agent guidance in AGENTS.md. Verified all five outcome/sidebar browser tests, npm run typecheck, and git diff --check.
