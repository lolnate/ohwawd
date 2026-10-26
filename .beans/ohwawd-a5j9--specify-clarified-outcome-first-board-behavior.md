---
# ohwawd-a5j9
title: Specify clarified outcome-first Board behavior
status: completed
type: task
priority: normal
created_at: 2026-10-25T17:39:03Z
updated_at: 2026-10-26T01:20:24Z
---

Follow up on the completed validation in docs/board-design-validation.md (review Bean ohwawd-jpzr). Use that report and its recorded author clarifications to prepare an OpenSpec change before implementation; the report is review input, not a replacement for normative requirements.

Relevant current sources: openspec/specs/outcome-sequencing/spec.md, openspec/specs/stream-sequencing/spec.md, openspec/specs/project-assignment/spec.md, openspec/specs/planning-timeline/spec.md, docs/scheduling-contract.md. Coordinate the outcome lifecycle integration boundary with openspec/changes/archive/2026-10-25-redesign-outcome-catalog/design.md and epic ohwawd-2ods.

Completion criteria:
- [x] Resolve the remaining design details recorded in docs/board-design-validation.md
- [x] Prepare and validate OpenSpec proposal/specifications/design for the reviewed gaps and compatibility behavior
- [x] Translate the sufficiently defined design into bounded implementation Beans with artifact references and dependencies

## Summary of Changes

Resolved all five remaining design topics in docs/board-design-validation.md and design Decision 1: required-tier before optional work with carried work first; no hidden rank donation; destination tail insertion and candidate conversion after owner removal; row-local connectors with established dashed references; explicit completion/reopen with sticky scope/evidence review and no scheduling gate. Created and later archived openspec/changes/archive/2026-10-25-implement-outcome-first-board/{proposal.md,design.md,tasks.md,specs/} with five capability deltas, version-v5 conversion/history rules, atomic stale-token contracts, workspace-global lifecycle history and explicit reuse of the completed outcome sidebar/controller. Strict validation passed; all four planning artifacts are complete.

Decomposed into nine todo implementation Beans under epic ohwawd-5q71: ohwawd-rc2m → ohwawd-sug7 → ohwawd-d92k → ohwawd-gqh7 → ohwawd-mg25 → ohwawd-0lzq, then ohwawd-npmi and ohwawd-4oo7, both blocking ohwawd-r2nj. Each references repository-relative artifacts, owns measurable tests/docs and has explicit prerequisite links. Updated the Board review and planned-successor references while keeping runtime v4 status accurate. No Board implementation has started; the change remains active for implementation.
