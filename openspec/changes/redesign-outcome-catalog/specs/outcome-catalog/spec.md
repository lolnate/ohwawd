# Outcome Catalog

## Purpose

Provide a compact inventory of defined outcomes that planners can browse, search and filter while retaining access to full details and existing outcome-management workflows.

## ADDED Requirements

### Requirement: Catalog uses compact outcome rows
The catalog SHALL display one outcome per full-width list row with title, owner, assigned stream, needed-by date and direct required/optional project counts. Default rows SHALL omit full notes, success signals and individual project lists. Every matching outcome SHALL be reachable by normal page scrolling without pagination or a separate vertically scrolling list pane.

#### Scenario: Browse a larger catalog
- **WHEN** a loaded catalog contains at least 50 outcomes
- **THEN** the planner can scroll from the first to the last matching outcome in one list
- **AND** ordinary desktop rows are compact rather than multi-column cards
- **AND** missing metadata is labeled No owner, Needs assignment, No target or No projects as applicable

#### Scenario: Access the catalog below delivery forecasts
- **WHEN** the planner selects Outcome catalog in the Outcomes section navigation
- **THEN** the catalog heading is scrolled into view and focused
- **AND** delivery forecasts remain available in their existing section

### Requirement: Search finds outcome definitions and linked work
The catalog SHALL support trimmed, case-insensitive search across outcome title, notes, success signal, owner and directly linked project names. Every whitespace-separated search term SHALL match some part of this combined text. Empty or whitespace-only search SHALL impose no restriction.

#### Scenario: Search terms match different fields
- **WHEN** one search term matches an outcome title and another matches a linked project's name
- **THEN** that outcome appears only if both terms match its combined searchable text
- **AND** a link to a hidden project remains searchable

### Requirement: Owner and stream filters use saved outcome metadata
The catalog SHALL offer All owners, No owner and individual owner filters, plus All streams, Needs assignment and individual active-stream filters. Owner matching SHALL ignore surrounding whitespace and case without modifying stored values. Stream filtering SHALL use the outcome's own saved assignment, independently of linked project placement or capacity ownership.

#### Scenario: An outcome shares a project owned in another stream
- **WHEN** an outcome assigned to Core links a project whose capacity owner is in Delivery
- **THEN** the outcome matches the Core stream filter and not Delivery
- **AND** the linked project's capacity assignment is unchanged

#### Scenario: Blank and differently cased owners
- **WHEN** owner values include empty text, whitespace-only text, Engineering and engineering
- **THEN** blank values match No owner and the two Engineering values share one filter option

### Requirement: Project coverage filters distinguish link states
The catalog SHALL offer All project coverage, No projects, Optional only and Required linked. No projects means zero direct links; Optional only means at least one link and no minimum-required links; Required linked means at least one minimum-required link. Counts SHALL include hidden and unavailable linked projects and SHALL NOT include transitive dependency counts.

#### Scenario: Optional work exists without required projects
- **WHEN** an outcome links two optional projects and no minimum-required project
- **THEN** it matches Optional only, not No projects or Required linked
- **AND** its row shows zero required and two optional projects without implying delivery readiness

### Requirement: Target date filters use local calendar boundaries
The catalog SHALL offer All dates, Past target date, Next 30 days and No target. Past target date means before today in the saved workspace/team timezone. Next 30 days includes today through the following 29 calendar dates. Missing dates SHALL match only All dates or No target. Date categories SHALL describe saved targets, not delivery-forecast risk.

#### Scenario: Target dates cross today's boundaries
- **WHEN** the local date is October 23
- **THEN** October 22 matches Past target date, October 23 and November 21 match Next 30 days, and November 22 does not
- **AND** the results are independent of the browser's timezone and daylight-saving hour lengths

#### Scenario: The local date changes while the catalog stays open
- **WHEN** team-local midnight passes or the page becomes visible after it passed
- **THEN** date-filter results refresh using the new local date without resetting selected filters

### Requirement: Filtering is composable local view state
Search and the owner, stream, project-coverage and target-date filters SHALL combine with AND. The selected search, facets and sort SHALL survive view switches and successful workspace refreshes during a signed-in page session. Filtering SHALL NOT modify saved outcomes, links, project selection, capacity ownership, forecasts or scenario inputs. Sign-out and full page reload SHALL reset catalog view state.

#### Scenario: Return from the Board
- **WHEN** the planner filters outcomes by owner and stream, visits Board and returns to Outcomes
- **THEN** both filters and the selected sort remain applied
- **AND** the same underlying catalog and forecast inputs remain saved

### Requirement: Sorting is explicit and deterministic
The catalog SHALL offer Name A–Z by default, Needed by with earliest dates first and missing dates last, and Newest created. Equal sort keys SHALL resolve by title and stable outcome ID; equal names in Name A–Z SHALL resolve by ID. Sorting SHALL preserve result membership and counts.

#### Scenario: Outcomes share dates or names
- **WHEN** matching outcomes have identical needed-by dates or titles
- **THEN** repeated renders and refreshes with unchanged data preserve their relative order
- **AND** changing sort changes order without adding or removing results

### Requirement: Result counts and empty states explain the current view
The catalog SHALL show the matching count and total saved outcome count, indicate active search/facets and offer Clear filters for a restricted view. Clear filters SHALL reset search and facets while retaining sort. Filter options SHALL come from the full catalog and stream registry; selected values that disappear after refresh SHALL remain explicit zero-result choices until cleared.

#### Scenario: No outcomes match the selected criteria
- **WHEN** saved outcomes exist but combined filters match none
- **THEN** the catalog shows zero of the total outcomes and a filter-specific empty message with Clear filters
- **AND** it does not claim that no outcomes have been defined

#### Scenario: An owner is no longer present after editing
- **WHEN** a saved edit removes the last outcome with the selected owner
- **THEN** the owner filter stays selected as a zero-result choice
- **AND** Clear filters restores the unfiltered catalog

### Requirement: Catalog availability is independent of forecasting
Catalog browsing SHALL use saved outcome definitions and links without requiring a successful forecast. An initial catalog load failure SHALL offer retry rather than an empty-workspace message. A refresh failure SHALL retain last-successful results and visibly explain that they could not be refreshed.

#### Scenario: Initial definitions are still loading
- **WHEN** the initial outcome-definition request has not completed
- **THEN** the catalog shows a loading state rather than claiming the loaded catalog is empty

#### Scenario: Forecast loading fails
- **WHEN** outcome definitions load successfully but delivery forecasting fails
- **THEN** the catalog still displays, searches and filters all defined outcomes
- **AND** the delivery failure remains identified in the delivery section

### Requirement: Outcome inspection and editing preserve compact browsing
Selecting an outcome title SHALL open a sidebar with complete saved metadata and linked-project details. Edit SHALL open that sidebar's existing outcome fields for explicit saving. The sidebar SHALL follow the project's backdrop, drag-out protection, Close, Escape, modal-focus and focus-restoration conventions. Background refreshes SHALL NOT overwrite an active edit draft.

#### Scenario: Inspect and edit long outcome details
- **WHEN** the planner opens an outcome with long notes, a success signal and many project links
- **THEN** full information is accessible in the sidebar without expanding its list row
- **AND** Edit focuses the title field and failed saves retain entered values with an error
- **AND** dismissal discards unsubmitted edits without autosaving

### Requirement: Existing creation linking and deletion remain available
The catalog SHALL retain creation of outcomes and initial links together, editing existing project requirements, and confirmed deletion. Each row SHALL expose outcome-specific Edit, Links and Delete actions. Only one outcome overlay SHALL be active at a time. Link management launched from a read-only sidebar SHALL return to that outcome's saved details on Save or Cancel.

#### Scenario: Inspect linked projects and change their requirements
- **WHEN** the planner opens Links from a read-only outcome sidebar
- **THEN** the existing project picker replaces the sidebar rather than stacking dialogs
- **AND** Save or Cancel returns to the same outcome's read-only details
- **AND** a successful save refreshes catalog counts, Board and delivery data

#### Scenario: Edit from delivery when the catalog excludes the outcome
- **WHEN** the planner selects Edit in Outcome delivery for an outcome hidden by catalog filters
- **THEN** the outcome editor opens directly without clearing those filters

### Requirement: Mutations preserve filters and outcome context
Successful outcome and link changes SHALL recompute filtered results without resetting the query. A saved outcome that stops matching SHALL remain inspectable in its open sidebar with an outside-current-filters explanation. Creation of a nonmatching outcome SHALL offer inspection from its success notice. Deletion SHALL close its overlays and restore focus to a remaining result or catalog heading.

#### Scenario: Save changes that remove the row from the result set
- **WHEN** an edited outcome no longer matches the selected filters
- **THEN** the matching count and list update, and the sidebar displays its saved details
- **AND** closing restores focus to its opener if still visible or the catalog heading otherwise

#### Scenario: Create an outcome outside the current filters
- **WHEN** a new outcome does not match the active query
- **THEN** the success notice offers View outcome and Clear filters
- **AND** the query is preserved and the new outcome remains in the total count

### Requirement: Browsing is accessible on desktop and narrow screens
Search and filters SHALL have visible labels and logical keyboard order. Outcome titles and actions SHALL be real controls with unambiguous accessible names. Result changes SHALL be announced without moving typing focus. Narrow layouts SHALL preserve all row metadata and actions, allow complete titles to wrap, and avoid page-level horizontal overflow.

#### Scenario: Browse using keyboard or a narrow viewport
- **WHEN** the catalog is used by keyboard or at a 390px viewport
- **THEN** every filter, outcome inspection and row action remains reachable
- **AND** all metadata remains available, full titles remain accessible, and the page does not overflow horizontally
