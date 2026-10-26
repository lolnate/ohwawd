# Outcome sequencing delta

## MODIFIED Requirements

### Requirement: Outcomes are assigned to streams
An outcome SHALL have zero or one active stream placement and a unique persistent rank within its stream. Assigned outcomes SHALL be primary rows, including empty outcomes. Unassigned outcomes SHALL appear in the Board Needs Assignment section with controls for choosing an active stream. Moving an outcome SHALL move its owned included projects atomically, preserve other owners and deferred/dismissed states, and append it in the destination unless an explicit insertion position is supplied. Same-stream assignment without an insertion target SHALL preserve rank.

#### Scenario: Assign an outcome containing shared work
- **WHEN** a planner assigns an outcome to a stream
- **THEN** its row appears there with every linked project and immediate-prerequisite reference
- **AND** its owned included projects follow its stream while projects owned by other outcomes remain references
- **AND** candidate, dismissed and deferred projects are not silently included

#### Scenario: Move to a different stream
- **WHEN** an outcome moves from Core to Delivery without an insertion target
- **THEN** it becomes the last ranked outcome in Delivery and remaining ranks are normalized
- **AND** all owned included projects move once while shared references retain their actual owning dates

#### Scenario: Outcome needs a stream
- **WHEN** an outcome has no active stream placement
- **THEN** it appears in the Board Needs Assignment section rather than an active stream timeline
- **AND** the planner can open or use its existing placement controls to choose a stream
