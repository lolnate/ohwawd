---
# ohwawd-y6a8
title: Enforce non-overlapping project timing within each stream
status: completed
type: bug
priority: normal
created_at: 2026-10-22T18:56:04Z
updated_at: 2026-10-22T19:33:39Z
---

Projects assigned to the same stream must execute sequentially, even when assigned to different outcomes. Enforce stream-level exclusivity so a stream represents one project at a time across all outcomes in that stream.

Acceptance criteria:
- Projects in the same stream cannot have overlapping execution periods, regardless of outcome assignment.
- Scheduling or moving a project into a conflicting time period is prevented or surfaced through the established conflict handling.
- Projects in different streams can still run concurrently when otherwise valid.

## References

- openspec/specs/stream-sequencing/spec.md
- openspec/specs/project-assignment/spec.md
- openspec/specs/weekly-capacity/spec.md

## Summary of Changes

- Scheduled at most one active project per stream per cycle, across all outcomes, while keeping independent streams concurrent and dependency ordering intact.
- Removed editable WIP-overlap controls, rejected new WIP limits above one, and documented legacy limits and v4 scenario conversion without altering published revisions.
- Verified with 72 unit/integration tests, 28 browser tests against this worktree, strict OpenSpec validation, typecheck, and production build.
