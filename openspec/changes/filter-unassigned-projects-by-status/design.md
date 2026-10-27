# Design

## Context

The Outcomes view already derives candidate projects from `roadmap_state === "candidate"`, and the application has a reusable checkbox-based status filter. Imported Linear project states are stored as raw strings; current fixtures and the Linear SDK use `planned` and `started`, while visible labels or older data can use Todo and In Progress equivalents.

## Goals / Non-Goals

**Goals:**
- Apply filtering only after deriving candidate projects, preserving the ownership boundary.
- Keep the filter as page-session view state and preserve it across workspace refreshes.
- Reuse the existing status-filter interaction and responsive visual language.

**Non-Goals:**
- Persist filter preferences or normalize imported Linear states in storage.
- Change roadmap membership, outcome links, or Board assignment behavior.
- Rename Board's outcome-specific Needs Assignment section.

## Decisions

### Match semantic status aliases at the view boundary

Normalize case, whitespace, hyphens, and underscores before matching `backlog`, `todo`, `to do`, `planned`, `in progress`, `started`, and `active`. This supports Linear's raw project-state values and equivalent visible labels without changing imported data. Exact stored values remain the filter options and row labels.

### Keep explicit selection semantics for this filter

Extend the shared status filter with an opt-in explicit-selection mode. Existing consumers continue treating an empty selection as all statuses; Projects without outcomes treats an empty selection as no statuses so a workspace containing only terminal candidates does not accidentally display all work by default. Select all remains available.

### Derive defaults until the planner edits

Represent untouched filter state separately from an explicit selection. Until the first filter edit, defaults are re-derived from available candidate statuses after refresh. After editing, retain the planner's selection for the signed-in page session while removing values no longer available.

## Risks / Trade-offs

- [Unrecognized custom current-state label is initially excluded] → Every candidate status remains available in the filter, and recognized aliases cover Linear's standard states.
- [Shared filter behavior regresses] → Make explicit selection opt-in and retain current defaults for existing callers.
- [Filtered count is mistaken for total candidate work] → Show matching and total counts together near the control.
