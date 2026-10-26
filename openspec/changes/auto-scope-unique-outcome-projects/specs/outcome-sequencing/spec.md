# Outcome sequencing delta

## MODIFIED Requirements

### Requirement: Outcomes are assigned to streams
An outcome SHALL have zero or one active stream placement and a unique persistent rank within its stream. Assigned outcomes SHALL be primary rows, including empty outcomes. Moving an outcome SHALL move its owned included projects atomically and include candidates that are minimum-required only by that outcome. It SHALL preserve other owners and deferred/dismissed states and append the outcome in the destination unless an explicit insertion position is supplied. Same-stream assignment without an insertion target SHALL preserve rank.

#### Scenario: Assign an outcome containing shared work
- **WHEN** a planner assigns an outcome to a stream
- **THEN** its row appears there with every linked project and immediate-prerequisite reference
- **AND** its owned included projects and uniquely minimum-required candidates follow its stream
- **AND** projects owned by other outcomes remain references
- **AND** optional-only, ambiguous, dismissed and deferred projects are not included

#### Scenario: Move to a different stream
- **WHEN** an outcome moves from Core to Delivery without an insertion target
- **THEN** it becomes the last ranked outcome in Delivery and remaining ranks are normalized
- **AND** all owned included projects move once while shared references retain their actual owning dates

### Requirement: Project blocks reveal accounting and dependencies
Outcome rows SHALL show direct links plus deduplicated immediate prerequisites of those linked projects using the effective graph. Derived references SHALL NOT add saved links or charges or recursively expand deeper levels. Counted blocks SHALL be solid. Other appearances SHALL use the established dashed outline and identify Shared only when included elsewhere, otherwise their excluded membership state. Blocked outcome labels SHALL expose a concise non-dependency-specific cause.

#### Scenario: Shared prerequisite blocks a local project
- **WHEN** a project owned in another stream is an immediate predecessor of a linked project in this outcome
- **THEN** a derived reference appears even without an explicit link, using the counted block's forecast dates
- **AND** labels and project details identify the prerequisite and local dependency
- **AND** required delivery waits for its effective closure without charging the reference again

#### Scenario: Deduplicate direct and implicit appearances
- **WHEN** two linked projects share a prerequisite that is also explicitly linked
- **THEN** that prerequisite appears once in the outcome row with both saved-link and prerequisite context
- **AND** its own unlinked predecessor is not automatically expanded into another box

#### Scenario: Optional-only contribution remains optional
- **WHEN** an optional linked project has a prerequisite but neither lies in the required delivery closure
- **THEN** its reference remains visible as optional context without gating delivery or promoting its demand to required work

#### Scenario: Excluded project is not presented as shared
- **WHEN** a direct linked project is a candidate, deferred or dismissed rather than included under another owner
- **THEN** its outlined appearance identifies Needs assignment, Deferred or Dismissed respectively
- **AND** its accessible explanation states that no capacity is counted

#### Scenario: Outcome is blocked without a dependency
- **WHEN** required delivery is withheld by membership, ownership, estimates, source review or setup rather than a dependency edge
- **THEN** the outcome status exposes the applicable concise cause instead of implying an unexplained dependency blocker
