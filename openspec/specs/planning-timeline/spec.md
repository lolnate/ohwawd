# planning-timeline Specification

## Purpose
Present project sequencing on a compact month-to-month calendar while retaining honest cycle-based forecasts and visible dependency constraints.

## Requirements

### Requirement: Month and week calendar headers
Stream schedules SHALL use month-grouped headers subdivided into Monday-start calendar weeks. Linear cycles SHALL be supporting context rather than the primary column width. Exact week and cycle date ranges SHALL remain available in the team's timezone. Compact cycle context SHALL preserve Linear-visible names and identify projected cycles.

#### Scenario: Cycles cross a month boundary
- **WHEN** an imported cycle spans October and November
- **THEN** weekly columns retain their calendar positions and month grouping
- **AND** cycle context identifies the actual overlapping cycle and its exact boundaries

#### Scenario: Display names have a numbering offset
- **WHEN** internal cycles 26 and 27 have names Cycle 46 and Cycle 47
- **THEN** the shared week displays C46 / C47 rather than C26 / C27

### Requirement: Compact horizontal navigation
The desktop timeline SHALL fit approximately two to three months at a typical board width, retain sticky project labels during horizontal scrolling, and expose further weeks in the same scrollable region. The region SHALL support keyboard scrolling and stay contained on small screens.

#### Scenario: View later months
- **WHEN** the planner scrolls horizontally to later weeks
- **THEN** the project names remain visible and aligned with their schedule rows
- **AND** later month/week headers and capacity bands remain aligned

### Requirement: Honest date and dependency presentation
Timeline rows SHALL follow saved project sequence and identify their effective blockers. Finite bars SHALL use resolved imported or cadence-projected forecast cycle boundaries, identifying projected dates as provisional. A project with a finite start and unresolved finish SHALL display only simulated progress with a continuing indicator; blocked or unknown work SHALL show its reason without an invented delivery bar.

#### Scenario: A successor waits beyond the imported horizon
- **WHEN** Client Self Service depends on unfinished Identity work
- **THEN** its row explains that it follows Identity and does not display an earlier completion date
- **AND** any partial Identity bar indicates continuing work rather than a known finish

#### Scenario: Forecast continues in projected cycles
- **WHEN** work has finite demand and completes in cadence-projected cycles
- **THEN** the timeline shows its provisional date and projected-calendar provenance rather than stopping at the last synced cycle

### Requirement: Visible unsupported calendar coverage
Calendar weeks beyond imported Linear coverage SHALL use visibly identified cadence-projected cycles when valid configuration permits. Dates lacking either imported or projected cycle capacity, including cooldown intervals, SHALL remain distinguishable and receive no invented capacity. The view SHALL explain imported versus projected coverage and any inability to extend it.

#### Scenario: Only four future cycles exist
- **WHEN** the displayed timeline extends several months beyond four imported cycles and the team's cadence is valid
- **THEN** later weeks show projected cycle labels and coverage with an explicit legend
- **AND** finite forecasts using that capacity are provisional

#### Scenario: Calendar extension cannot be resolved
- **WHEN** required cycle settings or the source anchor are missing
- **THEN** later weeks remain visibly unsupported and the view explains the missing information

### Requirement: Capacity bands are actionable
Reduced-capacity weeks SHALL have aligned highlighted headers and body bands with their label and percentage. Planners SHALL be able to select a week from the timeline to edit its availability through keyboard or pointer controls.

#### Scenario: Select Thanksgiving week
- **WHEN** the planner selects the highlighted Thanksgiving week
- **THEN** the availability editor opens for that Monday-start week
- **AND** the current 50% preset or explicit override is visible and editable
