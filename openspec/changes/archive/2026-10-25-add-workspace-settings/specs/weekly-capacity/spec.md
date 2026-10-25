# Spec Delta

## MODIFIED Requirements

### Requirement: Editable holiday availability defaults
New live plans SHALL enable a labeled 50% preset for the Monday-start week containing US Thanksgiving, the week containing Christmas Day, and the following week. Settings SHALL let planners disable the preset or override individual weeks in Weekly availability and holidays. Resolved preset dates SHALL be captured in saved snapshots.

#### Scenario: Default 2026 holiday weeks
- **WHEN** the preset is enabled for 2026
- **THEN** weeks beginning November 23, December 21, and December 28 each have 50% availability
- **AND** Settings and the Board timeline name the holiday assumption rather than presenting it as an imported Linear fact

### Requirement: Persisted weekly availability overrides
Settings SHALL let planners save or remove an availability override from 0% through 100% for a Monday-start local calendar week, with an optional label, in Weekly availability and holidays. Invalid dates, non-Monday dates, and invalid fractions SHALL be rejected. Explicit overrides SHALL take precedence over the holiday preset, including a 100% override that restores a holiday week.

#### Scenario: Restore a holiday week to full capacity
- **WHEN** the planner saves 100% for a holiday week in Settings
- **THEN** that week's saved override replaces the 50% preset and remains after reload
- **WHEN** the override is removed
- **THEN** the enabled holiday preset applies again

#### Scenario: Choose a date within a week
- **WHEN** the planner selects a non-Monday date using the Settings week selector
- **THEN** the editor normalizes the selection to its team-local Monday-start week before submission
- **AND** it identifies the affected date range and current effective availability

#### Scenario: Inspect weekly precedence in Settings
- **WHEN** the planner opens Weekly availability and holidays
- **THEN** Settings exposes the holiday toggle, labeled holiday weeks, weekly editor, and saved override list with removal actions
- **AND** it explains that explicit weekly overrides precede enabled holiday defaults and cycle availability, without multiplying reductions twice
