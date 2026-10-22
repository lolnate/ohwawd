---
# ohwawd-y6a8
title: Enforce non-overlapping project timing within each stream
status: todo
type: bug
created_at: 2026-10-22T18:56:04Z
updated_at: 2026-10-22T18:56:04Z
---

Projects assigned to the same stream must execute sequentially, even when assigned to different outcomes. Enforce stream-level exclusivity so a stream represents one project at a time across all outcomes in that stream.

Acceptance criteria:
- Projects in the same stream cannot have overlapping execution periods, regardless of outcome assignment.
- Scheduling or moving a project into a conflicting time period is prevented or surfaced through the established conflict handling.
- Projects in different streams can still run concurrently when otherwise valid.
