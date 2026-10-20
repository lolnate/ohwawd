---
# ohwawd-069h
title: Design simplified project assignment and stream sequencing
status: completed
type: task
priority: normal
created_at: 2026-10-20T18:40:46Z
updated_at: 2026-10-20T19:18:55Z
---

Review the current board assignment UI, scheduling and Linear integration, then prepare an OpenSpec change for the requested assignment simplification.

- [x] Review current behavior and relevant specifications
- [x] Draft proposal, design, and behavioral specifications
- [x] Validate the change and summarize decisions and open questions

Scope: Linear-sourced priority; dependency-aware drag-and-drop stream sequencing; remove manual start constraints and must-include; optional pause rationale; simplify additional scope and derive scoping readiness from a configurable lead time. Implementation follows design review.

## Confirmed design decisions

- Stream order controls scheduling; Linear priority is read-only context and sync must not reorder arranged streams.
- Needs scoping is a reminder and retains provisional forecasts.
- Use one Extra scope estimate with optional notes, replacing the two allowance categories.

OpenSpec change: openspec/changes/archive/2026-10-20-simplify-project-assignment/.

## Scope reconciliation decision

The user confirmed manual Extra scope adjustments when Linear issue scope changes. Retain the budget, show an actionable review reminder, and preserve provisional forecasts when demand is covered. Newly appearing unknown issues require updated coverage.

Artifacts: openspec/changes/archive/2026-10-20-simplify-project-assignment/proposal.md, design.md, specs/project-assignment/spec.md, specs/stream-sequencing/spec.md, specs/project-scope-readiness/spec.md, and tasks.md.

## Summary of Changes

Reviewed board UI/API, Linear import, forecast, schema, scenarios, and legacy design documents. Created the simplify-project-assignment OpenSpec proposal, technical design, three capability specs with acceptance scenarios, and dependency-ordered implementation tasks. Incorporated the four user-confirmed decisions. Specified dependency-safe accessible sequencing, optional pause notes, retired control handling, one manually reconciled extra-scope budget, configurable forecast-relative reminders, and legacy scenario compatibility.

Validation: openspec validate simplify-project-assignment --strict passed; openspec status confirms all four planning artifacts are complete; git diff --check passed for tracked changes. Implementation remains proposed for design review, with task checkboxes unchecked and no application changes made by this task. Existing unrelated working-tree changes were preserved. No unresolved requirements decisions remain in this draft; reviewable defaults and edge-case policies are documented in design.md.
