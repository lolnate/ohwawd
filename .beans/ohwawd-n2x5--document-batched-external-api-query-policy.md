---
# ohwawd-n2x5
title: Document batched external API query policy
status: completed
type: task
priority: normal
created_at: 2026-11-06T11:57:31Z
updated_at: 2026-11-06T11:57:49Z
---

Add project-wide agent guidance preferring bounded batch and paginated external API reads over avoidable per-record requests. Cover rate limits, latency, concurrency bounds, fallback pagination, and request-count tests.

## Checklist

- [x] Add concise policy to AGENTS.md
- [x] Verify formatting and summarize completion

## Summary of Changes

Added a project-wide external API query policy requiring bounded batching and pagination, avoidance of N+1 reads, scoped overflow requests, explicit concurrency bounds, and tests proving request counts scale with pages rather than records.
