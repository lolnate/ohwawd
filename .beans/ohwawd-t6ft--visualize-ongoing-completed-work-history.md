---
# ohwawd-t6ft
title: Visualize Ongoing completed-work history
status: completed
type: task
priority: normal
created_at: 2026-11-03T12:26:35Z
updated_at: 2026-11-06T13:43:38Z
parent: ohwawd-t8lm
blocked_by:
    - ohwawd-mu1i
    - ohwawd-ouyc
---

OpenSpec task 5.3. Add the semantic completed-cycle heatmap with global scale, numeric cells, Issues/Points, attention rows, recent/older controls, coverage, and lazy inspection. References: openspec/changes/visualize-ongoing-work/specs/ongoing-work-insights/spec.md and design.md Decision 7. Complete when targeted Playwright tests pass for cycles, attribution, accessibility, forced colors, reduced motion, focus, and responsive layouts and task 5.3 is checked.

## Summary of Changes

Added a semantic completed-cycle history matrix within Ongoing work using actual imported completed cycles, six-cycle default and lazy older-cycle expansion, sticky project/attention labels, exact numeric controls, global Issues/Points intensity, coverage disclosure, and lazy issue inspection with focus restoration. Added responsive, forced-colors, reduced-motion, loading/error/empty behavior and targeted Playwright coverage for recent/frozen attribution, attention rows, values, expansion, keyboard inspection, and 390px containment. Validated with npm run typecheck, npm test (169 passing), targeted Playwright tests (10 passing), full npm run test:ui (133 passing), strict OpenSpec validation, and git diff --check.
