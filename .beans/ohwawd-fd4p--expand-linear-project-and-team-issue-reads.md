---
# ohwawd-fd4p
title: Expand Linear project and team issue reads
status: completed
type: task
priority: high
created_at: 2026-11-03T12:26:35Z
updated_at: 2026-11-06T00:25:50Z
parent: ohwawd-t8lm
---

OpenSpec task 2.1. Add paginated project-label and team-issue reads with nullable project, URL, workflow, completion, estimates, and blocker relations. References: openspec/changes/visualize-ongoing-work/design.md Decision 4 and specs/ongoing-work-insights/spec.md. Complete when adapter tests cover pagination, unattached issues, exact labels, and relation direction in npm test and task 2.1 is checked.

## Checklist

- [x] Define project-label and team-issue source contracts
- [x] Implement paginated Linear reads and exact relation mapping
- [x] Add adapter tests for pagination, unattached issues, labels, and relation direction
- [x] Run typecheck and npm test
- [x] Reconcile OpenSpec task 2.1 and summarize completion

## Summary of Changes

Added paginated project-label and team-wide issue reads to the Linear adapter, including nullable project assignments, URLs, workflow and completion evidence, and deduplicated canonical blocker edges. Added adapter coverage for pagination, exact labels, unattached issues, and relation direction; typecheck, all 154 unit tests, and strict OpenSpec validation pass.
