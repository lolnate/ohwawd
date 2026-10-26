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
The desktop timeline SHALL fit approximately two to three months at typical Board width, retain sticky outcome labels during horizontal scrolling and expose later weeks in the same region. Its primary label SHALL be Outcome and rows SHALL follow saved per-stream rank. Ownerless candidates SHALL use Needs assignment outside active stream timelines rather than a charged Other selected work row. Keyboard scrolling and small-screen containment SHALL remain.

#### Scenario: View later months
- **WHEN** the planner scrolls horizontally to later weeks
- **THEN** outcome labels stay aligned with their ranked project rows
- **AND** week/month headers, capacity bands and local dependency connectors remain aligned

#### Scenario: Converted ownerless work
- **WHEN** legacy conversion leaves ownerless candidates
- **THEN** Needs assignment presents them with review context outside active stream timelines
- **AND** no Other selected work timeline row charges their demand

### Requirement: Honest date and dependency presentation
Finite bars SHALL use forecast consumption, including a fractional final cycle, with projected dates labeled provisional. Partial work SHALL show only its compact continuation state. Unresolved work SHALL use a compact selectable reference without an invented span or sentence-length explanation. Derived appearances SHALL preserve actual owning geometry and zero local capacity.

#### Scenario: A successor waits beyond the imported horizon
- **WHEN** Client Self Service waits for unfinished Identity work
- **THEN** its compact project reference identifies Identity as the prerequisite through accessible labeling and project inspection
- **AND** partial Identity progress shows a compact continuation state rather than a known finish or warning panel

#### Scenario: Forecast continues in projected cycles
- **WHEN** finite work completes using cadence-projected cycles
- **THEN** its provisional date and projected provenance remain visible independently of counted versus shared styling

### Requirement: Ranked rows show immediate planning context
Rows SHALL follow outcome rank and scoped project order. Each row SHALL show its direct links and deduplicated immediate-prerequisite references without recursively expanding deeper prerequisites.

#### Scenario: Immediate prerequisites only
- **WHEN** linked A depends on unlinked B and B depends on unlinked C
- **THEN** the row automatically shows B once as a derived prerequisite reference, without automatically expanding C
- **AND** C still constrains delivery and is reachable through B's dependency details

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
Reduced-capacity weeks SHALL have aligned highlighted headers and body bands with their label and percentage. Planners SHALL be able to select a week from the timeline through keyboard or pointer controls to open Settings at Weekly availability and holidays with that Monday-start week selected. The editor SHALL show current effective availability, including any cycle fallback, and any preset or explicit override.

#### Scenario: Select Thanksgiving week
- **WHEN** the planner selects the highlighted Thanksgiving week
- **THEN** Settings opens to Weekly availability and holidays for that Monday-start week with the week selector focused
- **AND** the current 50% preset or explicit override is visible and editable

#### Scenario: Return to the edited week
- **WHEN** the planner saves a weekly override and closes Settings
- **THEN** the timeline's percentage, capacity bands, and forecast reflect the saved change
- **AND** focus returns to the originating week control if it remains available, otherwise to the header Settings button

#### Scenario: Reopen the same week
- **WHEN** the planner closes Settings and activates the same timeline week again
- **THEN** Settings opens again with that week's latest saved effective availability
- **AND** repeated activation does not reuse a stale or cleared selection

### Requirement: Dependency connectors are local and truthful
Each outcome row SHALL draw thin directional connectors for effective immediate edges whose endpoints appear with finite geometry in that row. Connectors SHALL stay within the row, avoid controls and align during scrolling/resizing. Cross-stream prerequisites SHALL use local reference bars with owning geometry. Unresolved endpoints SHALL remain compact and SHALL NOT create invented paths or explanatory panels.

#### Scenario: Trace a shared prerequisite
- **WHEN** linked successor B has an immediate prerequisite A owned elsewhere
- **THEN** the row-local A reference connects to B in finish-to-start direction
- **AND** A uses its sole forecast geometry, dashed outline, counted-location accessible label and zero local charge

#### Scenario: Resize and scroll
- **WHEN** the planner resizes the viewport or scrolls the timeline to later months
- **THEN** connectors remain anchored to their row's endpoints and do not cross adjacent outcome rows
- **AND** project controls remain pointer and keyboard accessible

#### Scenario: No finite endpoint
- **WHEN** a prerequisite has no finite finish or the successor has no start
- **THEN** no connector implies a fabricated date or completion
- **AND** compact project inspection remains available without a timeline explanation panel

### Requirement: Dependency tracing is accessible without connector graphics
Project codes, full accessible names, immediate-predecessor text and project-sidebar navigation SHALL remain available on project controls alongside connectors. Derived references SHALL identify prerequisite and optional context in their accessible labels. Forced colors, reduced motion and narrow layouts SHALL preserve project controls and focus without relying on hue, hover, drawn lines or separate warning rows.

#### Scenario: Keyboard-only shared dependency tracing
- **WHEN** the planner tabs to a derived prerequisite reference or dependent project
- **THEN** its full name, owning location, dependency context and excluded/required state are available in the control's accessible name
- **AND** opening details and following deeper dependencies works without interacting with an SVG path

#### Scenario: Optional appearance does not imply required scope
- **WHEN** an optional contribution and its derived prerequisite lie outside the required closure
- **THEN** their accessible labels retain optional context and connectors do not imply that they gate first delivery

### Requirement: Timeline content stays schedule-focused
The roadmap timeline SHALL remain a sparse view of outcomes, compact project bars/references, dates and dependency connectors. It SHALL NOT render sentence-length waiting, priority-bypass, missing-estimate or remediation panels inside timeline rows. Detailed evidence and actions SHALL live in project or outcome inspection surfaces.

#### Scenario: A project cannot receive a finite forecast
- **WHEN** a project lacks usable scope or has an unresolved prerequisite
- **THEN** the timeline uses only a compact project reference or status
- **AND** selecting the project reveals the detailed reason and remediation outside the timeline

#### Scenario: A dependency is visually sufficient
- **WHEN** a predecessor and successor both have finite geometry
- **THEN** their bars/references and directional connector communicate the ordering
- **AND** no duplicate Waiting for panel is rendered

### Requirement: Final-cycle geometry reflects consumed capacity
A finite project bar SHALL end at the proportion of its final forecast cycle actually consumed by that project. The same geometry SHALL be reused for every shared or derived appearance. Geometry SHALL remain aligned to calendar time and stream capacity changes.

#### Scenario: 106 points in a 30-point weekly stream
- **WHEN** a project has 106 remaining points and its stream receives 30 points per one-week cycle
- **THEN** its bar spans approximately 3.53 weeks rather than four full weeks or the remaining horizon

#### Scenario: Capacity changes
- **WHEN** the stream's effective capacity changes
- **THEN** the project's fractional extent and every reference extent update from the same forecast consumption
- **AND** the project remains sequential with other capacity-owning work
