# Planning timeline delta

## ADDED Requirements

### Requirement: Timeline reflects accepted planning writes
The active Board SHALL render stream totals, project accounting state and timeline geometry from the complete Board returned by each accepted planning write. A later background refresh SHALL NOT overwrite that accepted state with an older request.

#### Scenario: Allocate capacity to a newly counted stream
- **WHEN** the planner saves a positive allocation for a stream containing an included project
- **THEN** the stream total and project span update from the recalculated response without a page reload

#### Scenario: Increase counted Extra scope
- **WHEN** the planner saves Extra scope for a counted project
- **THEN** its displayed point total and forecast span update from the recalculated response without a page reload

#### Scenario: Older refresh finishes after a write
- **WHEN** a Board read started before an accepted planning write finishes afterward
- **THEN** the older read does not replace the accepted totals or geometry
