---
# ohwawd-lw34
title: Theme catalog source scenarios and Settings surfaces
status: completed
type: task
priority: normal
created_at: 2026-10-23T20:04:32Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-t1qd
blocked_by:
    - ohwawd-px1w
---

OpenSpec: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/design.md (Decisions 2, 4 and 7)
Requirements: openspec/changes/archive/2026-10-25-establish-neon-velocity-theme/specs/visual-theme/spec.md
Reference: docs/visual-theme.md

- [x] Migrate Outcomes/catalog/delivery, Linear project filters/lists/sync reports, scenarios/comparisons and remaining configuration surfaces to the shared palette
- [x] Apply theme roles to catalog-list/outcome-detail and Settings components if their separate functional changes are present; do not implement those unrelated features here
- [x] Preserve compact scanning, selected/hidden/read-only/published/source labels, actual diff meanings and all existing actions
- [x] Verify each view and its empty/loading/error/success states at desktop/mobile widths; keep Added/Removed/Changed and forecast status understandable beyond hue
- [x] Audit imported stylesheets for unconverted essential light/green literals and update delivered-theme documentation

Completion: every current workspace view and settings surface shares the same visual system. Future planned components remain guided by tokens and agent documentation rather than new one-off palettes.

## Summary of Changes

Migrated Outcomes delivery/catalog, Linear project filters/lists/sync reports, scenarios/comparisons and Settings to the same semantic palette. Audited application CSS: raw color values exist only in theme-tokens.css. Preserved labels, links, selected/read-only/source states and action behavior; visually checked desktop, tablet and phone outputs. Updated runtime implementation guidance.

Verification: npm run typecheck; npm test (77 passed); npm run test:ui (47 passed before final responsive adjustment); theme/responsive browser suites (13 passed after that adjustment in development and optimized production); npm run build; openspec validate establish-neon-velocity-theme --strict; git diff --check. No dependencies or external font assets added.
