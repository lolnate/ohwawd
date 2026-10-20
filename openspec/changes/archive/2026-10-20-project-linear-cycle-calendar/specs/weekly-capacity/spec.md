# Weekly capacity changes

## MODIFIED Requirements

### Requirement: Weekly capacity maps to imported cycles
Imported and cadence-projected cycle availability SHALL be the mean availability of its team-local Monday–Friday dates, using explicit week overrides, then enabled holiday defaults, then cycle availability. If no weekdays exist, its calendar dates SHALL be used. Baseline SHALL be multiplied by that mean; reserve SHALL be deducted once, followed by existing stream allocations and WIP rules.

#### Scenario: Two-week cycle contains one holiday week
- **WHEN** a two-week cycle has five normal working days and five days in a 50% holiday week
- **THEN** its effective availability is 75%
- **AND** its configured reserve is subtracted once after the availability adjustment

#### Scenario: Weekly and cycle reductions overlap
- **WHEN** a cycle's availability is 50% and all its working dates are in a 50% overridden week
- **THEN** effective availability is 50%, not 25%

#### Scenario: Cycle boundaries do not align with weeks
- **WHEN** an imported cycle starts midweek or crosses a daylight-saving change
- **THEN** only its actual team-local working dates contribute to weekly weighting
- **AND** cycle start/end dates remain unchanged

#### Scenario: Holiday falls beyond the synced cycle window
- **WHEN** a projected cycle overlaps a configured 50% Christmas week
- **THEN** its capacity is reduced using the same weekday overlap calculation as imported cycles

### Requirement: Weekly assumptions are scenario-safe
New v3 scenarios SHALL capture, restore and compare weekly overrides, holiday enabled state and resolved holiday dates alongside the planning calendar. Dirty detection SHALL include these assumptions. Published earlier versions SHALL remain unchanged; loading pre-weekly editable drafts SHALL preserve their former capacity assumptions by defaulting to no weekly overrides and disabled holiday defaults.

#### Scenario: Load a pre-weekly draft
- **WHEN** a v1 draft without weekly assumptions is loaded
- **THEN** it uses no weekly overrides and disabled holiday defaults until deliberately edited
- **AND** its next save uses v3 while its old published revisions remain intact

#### Scenario: Save and restore an adjusted holiday
- **WHEN** a planner saves a 75% Christmas-week override in a scenario and later reloads that scenario
- **THEN** the override, holiday setting and resolved preset dates are restored
- **AND** comparison identifies the change separately from Linear source changes

#### Scenario: Load a pre-projection weekly draft
- **WHEN** a v2 editable draft is loaded into the v3 planning calendar
- **THEN** its saved weekly overrides and holiday setting are preserved
- **AND** projected dates are identified without altering any published v2 output
