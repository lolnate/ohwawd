---
# ohwawd-sxdt
title: Eliminate Linear issue relation request burst
status: completed
type: bug
priority: high
created_at: 2026-11-06T11:48:44Z
updated_at: 2026-11-06T11:50:32Z
---

The team issue adapter added in ohwawd-fd4p loads direct and inverse relations per issue, causing Linear rate limits during sync. Replace the N+1 relation reads with bounded paginated source reads while preserving canonical blocker direction, external blockers, retries, and adapter coverage.

## Checklist

- [x] Confirm available Linear relation query/filter shape
- [x] Replace per-issue relation requests with bounded pagination
- [x] Add request-count and pagination regression tests
- [x] Run typecheck and npm test
- [x] Summarize and complete the bug

## Summary of Changes

Replaced two relation requests per team issue with a paginated raw team query that embeds inverse blocker relations, using follow-up relation pages only for issues exceeding the embedded page. A 26-issue regression fixture now verifies two team-page requests plus one exceptional relation-page request while preserving unattached issues, external blockers, canonical direction, and archived-edge filtering. Typecheck and all 156 unit tests pass.
