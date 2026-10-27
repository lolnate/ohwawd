---
# ohwawd-wthp
title: Make Planning Attention collapsible
status: completed
type: feature
priority: normal
created_at: 2026-10-27T14:17:55Z
updated_at: 2026-10-27T14:38:13Z
---

Allow users to minimize and reopen the Planning Attention section on the Board tab. Keep its heading and open count visible while collapsed, preserve existing remediation behavior, and add focused UI coverage.

- [x] Implement an accessible default-open disclosure\n- [x] Add styles consistent with the Board and Neon Velocity theme\n- [x] Add and run targeted UI tests\n- [x] Run type checking

## Summary of Changes

Converted Planning Attention to a default-open native disclosure with visible minimize/expand affordances, preserved its title and count while collapsed, added responsive theme-aligned styling, and covered collapse/reopen behavior with Playwright. Verified the workspace organization suite, mobile scope-remediation flow, and TypeScript type checking.
