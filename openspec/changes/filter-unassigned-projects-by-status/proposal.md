# Proposal

## Why

The Outcomes section label "Needs Assignment" is ambiguous because both outcomes and projects can require different kinds of assignment. Candidate projects also mix current work with terminal or paused work, obscuring the projects most likely to need an outcome now.

## What Changes

- Rename the Outcomes candidate-project section to "Projects without outcomes" and update its navigation and supporting copy.
- Add a local, editable project-status filter to that section.
- Default the filter to current and future project statuses, including Backlog, Todo/Planned, and In Progress/Started aliases present in imported Linear data.
- Use the same current/future statuses for the Board's Projects need outcomes attention item, without promoting its candidate count into the attention headline.
- Keep every candidate status available through the filter without changing saved planning data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `outcome-catalog`: Clarify candidate-project navigation, add default editable status filtering for projects without outcomes, and align Board attention with that default status scope.

## Impact

This changes the Outcomes workspace UI, Board attention presentation, responsive styles, browser tests, and workflow documentation. It does not change APIs, persistence, roadmap membership, outcome ownership, or dependencies.
