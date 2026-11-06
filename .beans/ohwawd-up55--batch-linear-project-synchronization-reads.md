---
# ohwawd-up55
title: Batch Linear project synchronization reads
status: completed
type: task
priority: high
created_at: 2026-11-06T12:08:35Z
updated_at: 2026-11-06T12:14:45Z
---

Replace per-project detail, label, and relation reads with bounded paginated team-project queries that embed required evidence. Preserve aggregate remaining-scope fallback using the authoritative team issue feed, cross-team detection, dependency direction, overflow completeness, and retry behavior.

## Checklist

- [x] Implement paginated batched project evidence query
- [x] Preserve scope, labels, cross-team, and dependency mapping
- [x] Remove duplicate per-project issue reads from sync
- [x] Add request-count, pagination, overflow, and mapping tests
- [x] Run typecheck and npm test
- [x] Summarize and complete the optimization

## Summary of Changes

Replaced per-project detail, label, relation, and duplicate issue reads with 25-project GraphQL pages embedding required evidence. Nested overflow is requested selectively with a four-project concurrency bound; cross-team projects alone retain complete project-issue pagination for aggregate scope fallback. Request-count tests verify 84 ordinary projects use four project calls, cursor progression is complete, and exhausted connections are omitted. The current workspace is expected to use about 104 requests per sync instead of about 469; typecheck and all 159 unit tests pass.
