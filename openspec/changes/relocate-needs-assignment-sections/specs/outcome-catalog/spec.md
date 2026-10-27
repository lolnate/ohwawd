# Outcome catalog delta

## ADDED Requirements

### Requirement: Outcomes surfaces projects needing an owner
The Outcomes view SHALL provide a Projects without outcomes section containing candidate projects without an active owning outcome. Each project SHALL identify its excluded state and provide an entry point to existing project planning controls without changing assignment merely by opening them.

#### Scenario: Review an ownerless candidate
- **WHEN** a migrated workspace contains a candidate project without an active owning outcome
- **THEN** the project appears in Outcomes under Projects without outcomes
- **AND** it does not appear in the Board's project triage area
- **AND** opening its planning controls creates no owner, stream assignment or capacity demand

#### Scenario: No projects need an owner
- **WHEN** a migrated workspace contains no candidate projects
- **THEN** the Outcomes Projects without outcomes section shows an explicit empty state

### Requirement: Outcomes section navigation reaches project assignment
The Outcomes section navigation SHALL include Outcome catalog and Projects without outcomes. Selecting either section SHALL scroll its heading into view and focus it without changing catalog filters or saved planning data.

#### Scenario: Navigate directly to candidate projects
- **WHEN** the planner selects Projects without outcomes in the Outcomes section navigation
- **THEN** its heading is scrolled into view and focused
- **AND** the existing Outcome catalog query state is preserved

### Requirement: Catalog summarizes forecast health
The catalog SHALL add no more than one forecast-health column. Each row SHALL use concise text to distinguish on-target, at-risk, blocked, setup-needed, beyond-horizon, unplanned, no-target, provisional and unavailable forecast states without relying on color alone.

#### Scenario: Compare healthy and problematic outcomes
- **WHEN** loaded forecasts contain an on-target outcome and an outcome with blocked work
- **THEN** their Health cells identify On target and Blocked respectively
- **AND** no separate Outcome delivery section is rendered

#### Scenario: Forecast is unavailable
- **WHEN** saved outcome definitions load but the Board forecast does not
- **THEN** catalog browsing remains available and each Health cell identifies the forecast as unavailable or loading

## MODIFIED Requirements

### Requirement: Catalog uses compact outcome rows
The catalog SHALL display one outcome per full-width list row with title, owner, assigned stream, needed-by date, direct required/optional project counts and one compact Health cell. Default rows SHALL omit full notes, success signals, individual project lists and verbose forecast reasons. Every matching outcome SHALL be reachable by normal page scrolling without pagination or a separate vertically scrolling list pane.

#### Scenario: Browse a larger catalog
- **WHEN** a loaded catalog contains at least 50 outcomes
- **THEN** the planner can scroll from the first to the last matching outcome in one list
- **AND** ordinary desktop rows are compact rather than multi-column cards
- **AND** missing metadata is labeled No owner, Needs assignment, No target or No projects as applicable

#### Scenario: Access the catalog below delivery forecasts
- **WHEN** the planner selects Outcome catalog in the Outcomes section navigation
- **THEN** the catalog heading is scrolled into view and focused
- **AND** the separate Outcome delivery section is absent

### Requirement: Catalog availability is independent of forecasting
Catalog browsing SHALL use saved outcome definitions and links without requiring a successful forecast. Forecast loading or failure SHALL be shown compactly in the Health column. An initial catalog load failure SHALL offer retry rather than an empty-workspace message. A refresh failure SHALL retain last-successful results and visibly explain that they could not be refreshed.

#### Scenario: Initial definitions are still loading
- **WHEN** the initial outcome-definition request has not completed
- **THEN** the catalog shows a loading state rather than claiming the loaded catalog is empty

#### Scenario: Forecast loading fails
- **WHEN** outcome definitions load successfully but delivery forecasting fails
- **THEN** the catalog still displays, searches and filters all defined outcomes
- **AND** its Health cells identify forecast unavailability without rendering a separate delivery section

### Requirement: Outcome entry points emphasize titles and a single add action
The Outcomes heading SHALL provide the main Add outcome action. Catalog titles SHALL open the shared sidebar by outcome ID, independently of catalog filters. Repeated Edit, Links and Delete row actions SHALL remain absent. A loaded-empty catalog SHALL offer contextual creation. Board forecast-attention actions SHALL focus the catalog rather than a separate delivery section.

#### Scenario: Open from delivery outside the catalog query
- **WHEN** the planner clears or changes filters after a Board forecast-attention action focuses the catalog
- **THEN** the relevant outcome title can open the shared sidebar without introducing another summary surface
- **AND** its management actions are available within the sidebar
