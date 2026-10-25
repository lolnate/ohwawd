---
# ohwawd-0t83
title: Establish semantic theme tokens and typography
status: completed
type: task
priority: normal
created_at: 2026-10-23T20:04:32Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-t1qd
---

OpenSpec: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/design.md (Decisions 1–3)
Requirements: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/specs/visual-theme/spec.md
Reference: docs/visual-theme.md

- [x] Add shared semantic color, font, radius and restrained-motion tokens before base/component CSS; set the native dark color scheme
- [x] Establish documented UI/telemetry stacks and local display-font asset/license or explicit fallback, with no network font dependency
- [x] Begin base-style migration at source; document any component aliases instead of adding an override wall
- [x] Verify representative token-pair contrast, font fallback/offline behavior, readable native controls, and TypeScript/build compatibility

Completion: one reusable foundation matches the reference and all defined essential text/control token pairs meet their contrast targets. This is a development stage of a complete product migration, not acceptance of a partially themed app.

## Summary of Changes

Added the global Neon Velocity semantic token foundation, system display/UI/telemetry fallbacks, dark native-control scheme, reduced-motion and forced-colors behavior, and initial base-control/panel migration. Added contrast/offline-token checks. Verified with npm run typecheck, npm test, npm run build, strict OpenSpec validation, and responsive/settings UI suites.
