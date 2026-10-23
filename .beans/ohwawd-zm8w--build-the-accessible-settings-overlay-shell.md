---
# ohwawd-zm8w
title: Build the accessible Settings overlay shell
status: todo
type: task
priority: normal
tags:
    - settings
    - ux
created_at: 2026-10-23T14:35:40Z
updated_at: 2026-10-23T14:35:40Z
parent: ohwawd-0nj1
---

Deliver the workspace-owned modal shell and global entry point for OpenSpec task 1.1.

## References
- openspec/changes/add-workspace-settings/proposal.md
- openspec/changes/add-workspace-settings/design.md (decisions 1–2)
- openspec/changes/add-workspace-settings/specs/workspace-settings/spec.md (entry point, navigation, dismissal, responsive requirements)
- openspec/changes/add-workspace-settings/tasks.md (1.1)
- docs/ui-ux-conventions.md

## Scope
Add the header gear in src/app/workspace.tsx and a native dialog outside hidden workspace views. Provide the three named sections and scoped styling using current typography, surfaces, and green accents. Read relevant installed Next.js guides before coding. No dependency is required.

## Acceptance / verification
- [ ] Gear opens Settings from all four signed-in views without losing filters, scroll position, or active view; it remains available before Linear is connected.
- [ ] General entry focuses the heading; keyboard focus is contained and the background is inert.
- [ ] Close, Escape, and backdrop dismissal restore the opener or header gear; inside clicks and inside-to-backdrop drags do not dismiss.
- [ ] Desktop has centered bounded layout with side navigation; narrow screens have wrapping navigation, stacked content, internal scrolling, and reachable Close with no page overflow at 390px, 768px, and 1440px.
- [ ] Add shell-focused cases in tests/ui/workspace-settings.spec.ts and relevant responsive assertions; run those cases and npm run typecheck. Check design against docs/ui-ux-conventions.md and adjust documentation if implementation clarifies a shared convention.

No blockers. This is the first implementation task; actual planning editors and API lifecycle follow in the dependent task.
