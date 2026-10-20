# planning-timeline Specification

## Purpose
Present project sequencing on a compact month-to-month calendar while retaining honest cycle-based forecasts and visible dependency constraints.

## Requirements

### Requirement: Month and week calendar headers
Stream schedules SHALL use month-grouped headers subdivided into Monday-start calendar weeks. Linear cycles SHALL be supporting context rather than the primary column width. Exact week and cycle date ranges SHALL remain available in the team's timezone.

#### Scenario: Cycles cross a month boundary
- **WHEN** an imported cycle spans October and November
- **THEN** weekly columns retain their calendar positions and month grouping
- **AND** cycle context identifies the actual overlapping cycle and its exact boundaries

### Requirement: Compact horizontal navigation
The desktop timeline SHALL fit approximately two to three months at a typical board width, retain sticky project labels during horizontal scrolling, and expose further weeks in the same scrollable region. The region SHALL support keyboard scrolling and stay contained on small screens.

#### Scenario: View later months
- **WHEN** the planner scrolls horizontally to later weeks
- **THEN** the project names remain visible and aligned with their schedule rows
- **AND** later month/week headers and capacity bands remain aligned

### Requirement: Honest date and dependency presentation
Timeline rows SHALL follow saved project sequence and identify their effective blockers. Finite bars SHALL use actual imported forecast cycle boundaries. A project with a finite start and unresolved finish SHALL display only simulated progress with a continuing indicator; blocked or unknown work SHALL show its reason without an invented delivery bar.

#### Scenario: A successor waits beyond the imported horizon
- **WHEN** Client Self Service depends on unfinished Identity work
- **THEN** its row explains that it follows Identity and does not display an earlier completion date
- **AND** any partial Identity bar indicates continuing work rather than a known finish

### Requirement: Visible unsupported calendar coverage
Calendar weeks beyond imported Linear coverage SHALL remain visible for planning and holiday context but SHALL be distinguished from forecastable weeks. The view SHALL explain the missing coverage and SHALL NOT fabricate forecast cycles or delivery dates.

#### Scenario: Only four future cycles exist
- **WHEN** the displayed timeline extends several months beyond four imported future cycles
- **THEN** later weeks are marked as lacking imported calendar coverage
- **AND** delivery bars do not extend into those weeks as finite forecasts

### Requirement: Capacity bands are actionable
Reduced-capacity weeks SHALL have aligned highlighted headers and body bands with their label and percentage. Planners SHALL be able to select a week from the timeline to edit its availability through keyboard or pointer controls.

#### Scenario: Select Thanksgiving week
- **WHEN** the planner selects the highlighted Thanksgiving week
- **THEN** the availability editor opens for that Monday-start week
- **AND** the current 50% preset or explicit override is visible and editable
