# Spec Delta

## MODIFIED Requirements

### Requirement: Roadmap membership is distinct from source visibility
Imported Roadmap work SHALL be classified as candidate, included, deferred or dismissed. Newly imported Roadmap projects SHALL start as excluded candidates without an automatic outcome. Ongoing projects SHALL have no roadmap membership, owning outcome, stream sequence, target-date expectation, or forecast demand and SHALL NOT be represented as dismissed roadmap work. Unresolved projects SHALL remain outside roadmap demand until classified. Dismiss from roadmap SHALL clear active ownership and stream while retaining links and scope. Restore SHALL return a dismissed project to candidate, not auto-include it. Hide/Restore source visibility SHALL remain visibility-only and SHALL NOT change project classification, roadmap membership, or capacity.

#### Scenario: Engineering work remains outside the roadmap
- **WHEN** imported Roadmap-classified Engineering work is dismissed
- **THEN** it has no individually scheduled demand and need not receive an outcome
- **AND** source execution remains unchanged and capacity reserve can represent outside-roadmap work

#### Scenario: Hidden included work
- **WHEN** an included Roadmap project is hidden from source lists
- **THEN** it remains scheduled and linked with a Hidden label
- **AND** dismissing it explicitly, rather than hiding it, excludes its demand

#### Scenario: Restored candidate
- **WHEN** a dismissed Roadmap project is restored
- **THEN** it appears in Needs assignment as a candidate until the planner chooses an eligible owning outcome
- **AND** merely restoring visibility does not create roadmap demand

#### Scenario: Ongoing project remains visible outside roadmap membership
- **WHEN** a project is effectively classified Ongoing
- **THEN** it appears in Ongoing work views without candidate, included, deferred, or dismissed membership
- **AND** its issue scope contributes no stream forecast demand

#### Scenario: Included project becomes Ongoing
- **WHEN** an included Roadmap project is reclassified Ongoing
- **THEN** its roadmap ownership, stream placement, and future forecast demand are removed atomically
- **AND** its source project, issues, links, and Ongoing evidence remain available

#### Scenario: Ongoing project becomes Roadmap
- **WHEN** an Ongoing project is reclassified Roadmap
- **THEN** it becomes an excluded roadmap candidate requiring explicit outcome ownership and inclusion
- **AND** it is not automatically charged to a stream

#### Scenario: Project classification is unresolved
- **WHEN** a project has no effective Roadmap or Ongoing classification
- **THEN** it has no roadmap membership or forecast demand
- **AND** its current work remains visible under Needs classification
