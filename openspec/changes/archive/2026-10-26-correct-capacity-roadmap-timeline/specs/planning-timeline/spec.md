# planning-timeline Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Honest date and dependency presentation
Rows SHALL follow outcome rank and scoped project order, showing direct links and deduplicated immediate-prerequisite references. Finite bars SHALL use forecast consumption, including a fractional final cycle, with projected dates labeled provisional. Partial work SHALL show only its compact continuation state. Unresolved work SHALL use a compact selectable reference without an invented span or sentence-length explanation. Derived appearances SHALL preserve actual owning geometry and zero local capacity.

#### Scenario: A successor waits beyond the imported horizon
- **WHEN** Client Self Service waits for unfinished Identity work
- **THEN** its compact project reference identifies Identity as the prerequisite through accessible labeling and project inspection
- **AND** partial Identity progress shows a compact continuation state rather than a known finish or warning panel

#### Scenario: Forecast continues in projected cycles
- **WHEN** finite work completes using cadence-projected cycles
- **THEN** its provisional date and projected provenance remain visible independently of counted versus shared styling

#### Scenario: Immediate prerequisites only
- **WHEN** linked A depends on unlinked B and B depends on unlinked C
- **THEN** the row automatically shows B once as a derived prerequisite reference, without automatically expanding C
- **AND** C still constrains delivery and is reachable through B's dependency details

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
