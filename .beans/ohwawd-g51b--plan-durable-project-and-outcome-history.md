---
# ohwawd-g51b
title: Plan durable project and outcome history
status: completed
type: task
priority: normal
created_at: 2026-10-27T14:20:11Z
updated_at: 2026-10-27T14:35:43Z
---

Define an implementation-ready architecture for retaining historical project/outcome state while completed work leaves the current-cycle Board timeline, without adding new top-level history UI yet. Evaluate current lifecycle history, Linear imports, scenario snapshots, forecast anchoring, retention boundaries, and future query needs.

- [x] Inspect persistence, sync, completion, lifecycle, scenario, and timeline behavior
- [x] Define historical-record semantics, capture triggers, and current-view filtering
- [x] Define schema/API boundaries, migration strategy, acceptance criteria, and test plan
- [x] Identify OpenSpec changes and implementation Beans

Planning only; no application implementation.

## Summary of Changes

Traced current mutable Linear/project/outcome state, strict project completion evidence, explicit outcome lifecycle events, scenario snapshots, timeline anchoring, and overwrite/deletion points. Agreed that completed projects and explicitly completed outcomes remain visible through their completion cycle and leave the default Board when the next cycle becomes current; old completed outcomes return when completion review is needed. Recommended an immutable, schema-versioned operational history checkpoint captured atomically after accepted imports and relevant planning/lifecycle writes, distinct from manual scenario revisions, plus a project lifecycle projection/event log for stable observed completion transitions. The live timeline should begin at the current cycle while retaining conservative future-capacity semantics. An initial deployment baseline starts honest retention without inventing pre-deployment history; no history UI or new top-level tab is in the first phase.
