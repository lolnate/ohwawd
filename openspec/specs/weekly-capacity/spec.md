# weekly-capacity Specification

## Purpose
Make holiday and week-specific availability explicit planning assumptions that consistently affect cycle forecasts, calendar presentation, and saved scenarios.

## Requirements

### Requirement: Editable holiday availability defaults
New live plans SHALL enable a labeled 50% preset for the Monday-start week containing US Thanksgiving, the week containing Christmas Day, and the following week. Planners SHALL be able to disable the preset or override individual weeks. Resolved preset dates SHALL be captured in saved snapshots.

#### Scenario: Default 2026 holiday weeks
- **WHEN** the preset is enabled for 2026
- **THEN** weeks beginning November 23, December 21, and December 28 each have 50% availability
- **AND** the board names the holiday assumption rather than presenting it as an imported Linear fact

### Requirement: Persisted weekly availability overrides
Planners SHALL be able to save or remove an availability override from 0% through 100% for a Monday-start local calendar week, with an optional label. Invalid dates, non-Monday dates, and invalid fractions SHALL be rejected. Explicit overrides SHALL take precedence over the holiday preset, including a 100% override that restores a holiday week.

#### Scenario: Restore a holiday week to full capacity
- **WHEN** the planner saves 100% for a holiday week
- **THEN** that week's saved override replaces the 50% preset and remains after reload
- **WHEN** the override is removed
- **THEN** the enabled holiday preset applies again

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
