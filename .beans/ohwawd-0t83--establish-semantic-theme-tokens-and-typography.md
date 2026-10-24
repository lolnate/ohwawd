---
# ohwawd-0t83
title: Establish semantic theme tokens and typography
status: todo
type: task
created_at: 2026-10-23T20:04:32Z
updated_at: 2026-10-23T20:04:32Z
parent: ohwawd-t1qd
---

OpenSpec: openspec/changes/establish-neon-velocity-theme/design.md (Decisions 1–3)
Requirements: openspec/changes/establish-neon-velocity-theme/specs/visual-theme/spec.md
Reference: docs/visual-theme.md

- [ ] Add shared semantic color, font, radius and restrained-motion tokens before base/component CSS; set the native dark color scheme
- [ ] Establish documented UI/telemetry stacks and local display-font asset/license or explicit fallback, with no network font dependency
- [ ] Begin base-style migration at source; document any component aliases instead of adding an override wall
- [ ] Verify representative token-pair contrast, font fallback/offline behavior, readable native controls, and TypeScript/build compatibility

Completion: one reusable foundation matches the reference and all defined essential text/control token pairs meet their contrast targets. This is a development stage of a complete product migration, not acceptance of a partially themed app.
