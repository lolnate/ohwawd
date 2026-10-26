# stream-sequencing Delta

## ADDED Requirements

### Requirement: Remaining project scope drives capacity demand
When Linear supplies aggregate project scope history, the scheduler SHALL use total scope minus completed scope as remaining source demand. Individual unestimated issues SHALL NOT withhold a finite forecast in that case. Extra scope SHALL remain additive. When aggregate scope is unavailable, issue estimates and existing unknown-scope coverage rules SHALL remain the fallback.

#### Scenario: Aggregate scope sizes an otherwise unestimated project
- **WHEN** a project has 106 remaining aggregate points and unestimated individual issues
- **THEN** its forecast demand is 106 points plus any saved Extra scope
- **AND** the unestimated issues remain visible in project inspection without forcing an infinite timeline bar

#### Scenario: Aggregate scope is unavailable
- **WHEN** Linear does not supply usable aggregate scope for a project
- **THEN** open issue estimates and Extra scope determine demand
- **AND** uncovered unestimated issues continue to withhold a finite forecast

#### Scenario: Completed scope reduces source demand
- **WHEN** Linear reports 150 total scope points and 44 completed scope points
- **THEN** the project contributes 106 remaining source points
- **AND** completed points are not charged again

## MODIFIED Requirements

### Requirement: Outcome waits and priority bypass are explicit
Project dependency details SHALL identify unfinished effective prerequisites, their location or excluded state, and any remediation. The timeline SHALL communicate visible immediate dependencies through ordered bars/references, connectors and accessible project labels rather than separate waiting or priority-bypass warning rows. Missing estimates and capacity SHALL remain inspectable without expanding the timeline.

#### Scenario: Cross-stream prerequisite delays the highest outcome
- **WHEN** H's required successor waits for a shared prerequisite in another stream while L runs locally
- **THEN** H's timeline shows the prerequisite reference and finish-to-start connector when both endpoints are finite
- **AND** opening either project exposes the named prerequisite and relevant planning details without a separate timeline warning
- **AND** rank and ownership remain unchanged

#### Scenario: Unresolved excluded prerequisite
- **WHEN** the prerequisite is unfinished and dismissed or only a candidate
- **THEN** the dependent outcome has no finite completion date until that prerequisite is resolved
- **AND** project inspection explains Include on roadmap and owning-outcome requirements without a verbose timeline warning row
