# Project assignment delta

## MODIFIED Requirements

### Requirement: Assignment controls are lightweight
Planning controls SHALL expose roadmap membership, eligible owning outcome, derived active stream, optional pause rationale and Extra scope. They SHALL NOT apply retired numeric rank, preferred start, hard not-before or must-include properties; requests containing those fields SHALL be rejected. A candidate SHALL be included when the planner saves it as minimum-required in exactly one outcome assigned to an active stream, or assigns that sole minimum-required outcome to a stream. Other inclusion SHALL require an explicitly selected owning outcome with an active stream and a saved project link.

#### Scenario: Open a project editor
- **WHEN** the planner opens project planning controls
- **THEN** it offers Include on roadmap with a linked outcome/stream, Needs assignment, Defer and Dismiss from roadmap
- **AND** no active-stream-only or Other selected work owner choice bypasses ownership
- **AND** scope input retains project-scope-readiness behavior

#### Scenario: Retired controls cannot silently affect scheduling
- **WHEN** a current client sends a retired start, must-include or numeric priority-rank property
- **THEN** the mutation rejects the unsupported control without changing the plan

#### Scenario: Single-project outcome inclusion
- **WHEN** an imported candidate is minimum-required by exactly one outcome and that outcome becomes assigned to an active stream
- **THEN** the project is included with that outcome as owner without a second assignment step
- **AND** one project and one capacity charge are scheduled

#### Scenario: Unique link added after placement
- **WHEN** a planner adds a candidate as minimum-required to exactly one outcome already assigned to an active stream
- **THEN** the saved link, included membership, owner, stream and scoped order update atomically

#### Scenario: Ambiguous or noncommittal links remain excluded
- **WHEN** a candidate is optional-only or linked to more than one outcome
- **THEN** it remains excluded until the planner explicitly chooses an eligible owning outcome
- **AND** deferred and dismissed work is never automatically included

### Requirement: Assignment preserves project identity
A project SHALL retain one work package and at most one capacity-owning outcome/stream. Inclusion SHALL charge its remaining demand once in its owner's stream. Needs assignment SHALL make it an excluded candidate with no active owner or stream; Deferred and Dismissed SHALL exclude future demand. Changing links, placement, membership, ownership, allocation or Extra scope SHALL preserve identity and refresh all affected totals, forecasts and appearances atomically.

#### Scenario: Move a shared project between streams
- **WHEN** a project linked to several outcomes transfers to an eligible owner in another stream
- **THEN** its single assignment and charge move while all links remain
- **AND** no duplicate project or demand is created

#### Scenario: Remove the stream assignment without deferring
- **WHEN** included work moves to Needs assignment
- **THEN** it becomes a candidate with no active stream/owner and excluded future demand
- **AND** required outcomes depending on its unfinished work explain the missing roadmap inclusion and owner

#### Scenario: Update a counted project's planning inputs
- **WHEN** the planner saves its stream allocation or Extra scope
- **THEN** the stream point total and project timeline geometry use the accepted values immediately
- **AND** a separate page reload is not required
