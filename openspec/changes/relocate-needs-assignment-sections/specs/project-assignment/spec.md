# Project assignment delta

## MODIFIED Requirements

### Requirement: Roadmap membership is distinct from source visibility
Imported work SHALL be classified as candidate, included, deferred or dismissed. Newly imported projects SHALL start as excluded candidates without an automatic outcome. Candidate projects SHALL appear in the Outcomes Projects without outcomes section rather than Board project triage. Dismiss from roadmap SHALL clear active ownership and stream while retaining links and scope. Restore SHALL return a dismissed project to candidate, not auto-include it. Hide/Restore source visibility SHALL remain visibility-only and SHALL NOT change membership or capacity.

#### Scenario: Engineering work remains outside the roadmap
- **WHEN** imported Engineering work is dismissed
- **THEN** it has no individually scheduled demand and need not receive an outcome
- **AND** source execution remains unchanged and capacity reserve can represent outside-roadmap work

#### Scenario: Hidden included work
- **WHEN** an included project is hidden from source lists
- **THEN** it remains scheduled and linked with a Hidden label
- **AND** dismissing it explicitly, rather than hiding it, excludes its demand

#### Scenario: Restored candidate
- **WHEN** a dismissed project is restored
- **THEN** it appears in Outcomes Projects without outcomes as a candidate until the planner chooses an eligible owning outcome
- **AND** merely restoring visibility does not create roadmap demand
