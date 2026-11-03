---
# ohwawd-usqj
title: Make Linear sync resilient to transient network errors
status: completed
type: bug
priority: high
created_at: 2026-10-27T14:57:55Z
updated_at: 2026-10-27T14:59:36Z
---

The Linear projects Sync Linear action fails with 'Linear could not import projects and issues (NetworkError)' when initiated remotely. Identify the server-side failure path and make import resilient without risking partial writes.\n\n- [x] Identify root cause and expected retry boundaries\n- [x] Implement targeted resilience and error reporting\n- [x] Add regression tests\n- [x] Run relevant validation

## Summary of Changes

Added bounded retries for transient Linear network failures around every SDK read, preserved atomic import writes, improved the exhausted-network error message, and added regression coverage. Verified with the test suite, TypeScript checking, and a production build.
