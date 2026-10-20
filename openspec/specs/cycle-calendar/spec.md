# cycle-calendar Specification

## Purpose
Provide consistent Linear-visible cycle labels and an explainable planning calendar that extends known cycles using the team's configured cadence.

## Requirements

### Requirement: Cycle labels preserve Linear-visible naming
All cycle presentations SHALL prefer the source cycle name over its internal ordinal. Compact labels SHALL preserve visible numbered Cycle names, while custom names remain recognizable. Unnamed cycles SHALL fall back to their internal cycle number. Source IDs SHALL NOT be displayed as cycle numbers.

#### Scenario: Visible and internal numbers differ
- **WHEN** a cycle's internal number is 26 and its name is Cycle 46
- **THEN** its full label is Cycle 46 and its compact week label is C46
- **AND** calendars, project forecasts and explanations use the same visible sequence

### Requirement: Future cycles follow configured cadence
When enabled cycles have valid duration, start weekday, cooldown, timezone and a dated source anchor, the planning calendar SHALL extend beyond the last imported boundary. It SHALL preserve local boundary time across DST, continue numbered name suffixes, cover the forecast horizon and at least 26 display weeks, and leave cooldown intervals without cycle capacity.

#### Scenario: Project beyond four weekly cycles
- **WHEN** the imported calendar ends at visible Cycle 49 and the team has weekly Tuesday cycles with no cooldown
- **THEN** the next projected cycle is Cycle 50 beginning at the prior cycle's end
- **AND** subsequent projected cycles continue through the planning horizon

#### Scenario: Cooldown and DST
- **WHEN** a configured cooldown or daylight-saving change occurs between cycles
- **THEN** the cooldown remains an unscheduled interval and cycle boundaries retain their team-local time rather than drifting by an hour

### Requirement: Imported source remains authoritative
Projection SHALL preserve imported dates and gaps, never replace actual cycles, and never be persisted as a Linear source fact. A refresh SHALL recompute the extension after the latest actual cycle. If configuration or an anchor is unavailable, the system SHALL retain available imported cycles and explain why it cannot extend them.

#### Scenario: Linear later creates a projected cycle
- **WHEN** a source refresh imports an actual cycle where a projected one previously appeared
- **THEN** the real cycle's ID, name and dates are used once and any later projections are regenerated from actual source
- **AND** no duplicate synthetic source entry is written

#### Scenario: Cycles are disabled or configuration is incomplete
- **WHEN** the team cannot supply an enabled, valid cadence and dated anchor
- **THEN** no derived capacity is created and the missing prerequisite is explained

### Requirement: Projected dates have visible provenance
Projected cycle labels, calendar coverage and forecasts SHALL be visibly distinguishable from imported facts. A package using projected capacity and its required outcome SHALL be provisional and identify calendar projection as the cause. Projected date-calendar entries SHALL be view-only for ID-bound cycle exceptions; weekly availability SHALL remain editable by date.

#### Scenario: Work completes in projected capacity
- **WHEN** known finite work finishes after the imported calendar but within the projected horizon
- **THEN** it receives a provisional date explicitly based on projected cycles
- **AND** its dependency and holiday/weekly capacity constraints remain active

### Requirement: Calendar projection preserves scenario history
New v3 snapshots SHALL retain resolved planning cycles, cadence, provenance and calculated results. Published earlier snapshots SHALL remain unchanged. Older editable drafts SHALL preserve their planning inputs and explicitly transition to v3 when saved; comparisons SHALL identify calculation versions and projected-date differences.

#### Scenario: Read an earlier published revision after calendar extension
- **WHEN** a v2 revision is compared with a v3 plan
- **THEN** the earlier stored calendar and outputs remain intact and the calculation-version difference is visible
