# Planning timeline delta

## MODIFIED Requirements

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
Rows SHALL follow outcome rank and scoped project order, showing direct links and deduplicated immediate-prerequisite references. Finite bars SHALL use resolved forecast cycle boundaries, with projected dates labeled provisional. Partial work SHALL show simulated progress plus continuation; unresolved work SHALL explain its reason without an invented bar. Derived appearances SHALL preserve actual owning dates and zero local capacity.

#### Scenario: A successor waits beyond the imported horizon
- **WHEN** Client Self Service waits for unfinished Identity work
- **THEN** its row identifies Identity as the prerequisite without an earlier asserted completion
- **AND** partial Identity progress shows continuation rather than a known finish

#### Scenario: Forecast continues in projected cycles
- **WHEN** finite work completes using cadence-projected cycles
- **THEN** its provisional date and projected provenance remain visible independently of counted versus shared styling

#### Scenario: Immediate prerequisites only
- **WHEN** linked A depends on unlinked B and B depends on unlinked C
- **THEN** the row automatically shows B once as a derived prerequisite reference, without automatically expanding C
- **AND** C still constrains delivery and is reachable through B's dependency details

## ADDED Requirements

### Requirement: Dependency connectors are local and truthful
Each outcome row SHALL draw thin directional connectors for effective immediate edges whose endpoints appear in that row. Connectors SHALL stay within the row, avoid covering controls and align with their bars during scrolling/resizing. Cross-stream prerequisites SHALL connect through local reference boxes rather than spanning stream panels. Unresolved endpoints SHALL use labeled chips and textual dependency explanations without invented dates.

#### Scenario: Trace a shared prerequisite
- **WHEN** linked successor B has an immediate prerequisite A owned elsewhere
- **THEN** the row-local A reference connects to B in finish-to-start direction
- **AND** A uses its sole forecast dates, dashed outline, counted-location label and zero local charge

#### Scenario: Resize and scroll
- **WHEN** the planner resizes the viewport or scrolls the timeline to later months
- **THEN** connectors remain anchored to their row's endpoints and do not cross adjacent outcome rows
- **AND** project controls remain pointer and keyboard accessible

#### Scenario: No finite endpoint
- **WHEN** a prerequisite has no finite finish or the successor has no start
- **THEN** chips and dependency text explain the unresolved relationship
- **AND** the connector does not imply a fabricated date or completion

### Requirement: Dependency tracing is accessible without connector graphics
Project codes, full accessible names, immediate-predecessor text and project-sidebar navigation SHALL remain available alongside connectors. Derived references SHALL be labeled Prerequisite and identify optional context when outside required delivery scope. Selected paths and waiting warnings SHALL remain understandable in forced colors, reduced motion and narrow layouts without relying on hue, hover or drawn lines alone.

#### Scenario: Keyboard-only shared dependency tracing
- **WHEN** the planner tabs to a derived prerequisite reference or the waiting-warning inspection action
- **THEN** its full name, owning location, dependency context and excluded/required state are available
- **AND** opening details and following deeper dependencies works without interacting with an SVG path

#### Scenario: Optional appearance does not imply required scope
- **WHEN** an optional contribution and its derived prerequisite lie outside the required closure
- **THEN** their labels retain optional context and connectors do not imply that they gate first delivery
