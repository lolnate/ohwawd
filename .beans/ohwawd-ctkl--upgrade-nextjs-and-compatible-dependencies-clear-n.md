---
# ohwawd-ctkl
title: Upgrade Next.js and compatible dependencies; clear npm advisories
status: completed
type: task
priority: normal
created_at: 2026-11-19T19:43:09Z
updated_at: 2026-11-19T19:49:42Z
---

Update Next.js to the latest stable patch and upgrade compatible application and test dependencies, evaluating major upgrades independently. Preserve supported Node runtime alignment and verify security and behavior.

- [x] Upgrade Next.js and compatible dependencies with lockfile
- [x] Evaluate major-version upgrades and apply those compatible with this project
- [x] Run npm audit, tests, typecheck, and production build
- [x] Document any deferred upgrades and verification limitations

## Summary of Changes

Upgraded Next.js 16.4.1 → 16.4.6 (resolving two cache-disclosure advisories), Linear SDK 62 → 103, TypeScript 5.9 → 7.0, PGlite 0.5.10 → 0.5.17, Playwright 1.64.1 → 1.65.1, and pinned Docker/CI Node 22.20.0 → 22.23.5. Aligned the supported Node engine range with the Linear SDK, refreshed the lockfile, and added a regression test for rejecting partial Linear GraphQL responses. npm audit reports 0 vulnerabilities; 171 unit/database tests, 135 browser tests, Node 22 clean-install typecheck, and production build passed.

@types/node remains on the latest 22.x because CI and the image run Node 22; upgrading to 26.x would misrepresent the runtime API. Docker image builds could not be run locally because the Docker daemon is unavailable; the new multi-platform tag/digest was verified against Docker Hub. Live Linear synchronization was not exercised without a real API key.
