---
# ohwawd-83dp
title: Build accessible project sequencing and scope UI
status: completed
type: task
priority: normal
created_at: 2026-10-20T18:49:58Z
updated_at: 2026-10-20T19:18:55Z
blocked_by:
    - ohwawd-uora
---

Approved OpenSpec: openspec/changes/archive/2026-10-20-simplify-project-assignment/design.md decisions 2, 5–6; all specs; tasks.md group 5.

- [x] Build visible queues with drag and equivalent move controls
- [x] Simplify planning fields, priority and extra scope
- [x] Add configurable scoping reminders and live refresh
- [x] Verify desktop/mobile/keyboard UI and update product design

## Summary of Changes

Added visible ordered queues, native drag/drop targets and accessible keyboard/touch moves, dependency previews and stale-drop recovery with retained focus. Simplified project fields and optional pause notes; added source priority, unified Extra scope, configurable scoping windows and actionable attention reminders refreshed at local midnight. No runtime dependencies added. Product design updated. All 11 browser tests, 45 backend tests and typecheck pass, including an in-memory PostgreSQL-backed UI scenario workflow.
