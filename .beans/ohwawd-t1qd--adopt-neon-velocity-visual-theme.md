---
# ohwawd-t1qd
title: Adopt Neon Velocity visual theme
status: completed
type: epic
priority: normal
created_at: 2026-10-23T20:03:53Z
updated_at: 2026-10-25T13:07:20Z
---

Implement the accessible neon-1980s motorsport and orbital-future identity without changing planning behavior.

OpenSpec: openspec/changes/establish-neon-velocity-theme/proposal.md
Requirements: openspec/changes/establish-neon-velocity-theme/specs/visual-theme/spec.md
Design: openspec/changes/establish-neon-velocity-theme/design.md
Visual reference: docs/visual-theme.md
Preview: docs/theme-preview.html

Completion: all implementation children are verified; all live surfaces use semantic theme roles; ownership/provenance/availability remain clear; desktop/mobile, contrast, focus, reduced-motion and forced-color checks pass. Keep implementation status accurate and archive OpenSpec only after all associated implementation work is complete.

Catalog and Workspace Settings functional work remains in its own plans; coordinate styles for whichever components are present when implementing.

## Summary of Changes

Completed the source-level Neon Velocity migration across the current workspace and overlays. All implementation children and the reproduced contrast bug are verified and completed. Reconciled openspec/changes/establish-neon-velocity-theme/tasks.md and docs/visual-theme.md. Theme specifications remain in the active change for the normal review/sync/archive workflow.

Evidence: 77 unit/database tests; full 47-case browser suite before the final responsive adjustment; 13 theme/responsive cases passed after that adjustment in both development and the optimized production build; TypeScript, build, strict OpenSpec validation, and whitespace checks passed. Rendered contrast and screenshots cover desktop/tablet/phone, Settings, all workspace views, project/outcome dialogs, forced colors, reduced motion and enlarged text. Core palette values remain identical to the standalone visual reference. Settings editing and catalog redesign remain tracked in their separate feature Beans.
