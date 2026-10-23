# Spec Delta

## MODIFIED Requirements

### Requirement: Scoping lead time is configurable
Settings SHALL offer one planning assumption in its Scope readiness section for how many calendar days before project start scope needs tightening. Its default SHALL be 14 days and it SHALL accept whole numbers from 0 through 365. This assumption SHALL be captured with scenarios rather than entered as a per-project review date. Project-level scope editing and readiness reminders SHALL remain on the Board.

#### Scenario: Default and custom window
- **WHEN** no scoping window has been configured
- **THEN** Settings displays 14 calendar days and the board uses that value
- **WHEN** the planner changes it to 21 in Settings and saves
- **THEN** applicable reminder dates recalculate using 21 and the setting persists

#### Scenario: Invalid lead time
- **WHEN** the planner submits a negative, fractional, or greater-than-365 lead time
- **THEN** the setting is rejected without changing the saved window

#### Scenario: Configure scope readiness without relocating project work
- **WHEN** a planner opens Scope readiness in Settings
- **THEN** the lead-time editor explains that Needs scoping is advisory and provisional forecasts remain available
- **AND** project Extra scope editors and Planning attention reminders remain available on the Board
