# outcome-catalog Specification

## Purpose
Provide a compact, searchable outcome inventory and a consistent sidebar workspace for creating, inspecting, editing and managing outcome project links without losing browsing context.

## Requirements

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

### Requirement: All outcome workflows share one persistent sidebar
Creation, inspection, editing and link management SHALL use one sidebar with Details and Projects sections. Internal navigation and successful creation SHALL retain the same open dialog. Saved outcomes SHALL initially show Details inspection. The sidebar SHALL replace inline outcome editors and separate creation/link overlays.

#### Scenario: Navigate from inspection to project management
- **WHEN** the planner opens an outcome title and selects Projects, then Manage projects
- **THEN** the same dialog remains open throughout and displays the project editor
- **AND** no page scroll to an inline editor or replacement overlay occurs

### Requirement: Outcome inspection exposes complete saved information
Details SHALL show full title, notes, owner, success signal, needed-by date and read-only stream assignment. Projects SHALL show every direct saved link with Required/Optional and hidden/unavailable labels. Edit details SHALL focus the title field; Manage projects SHALL focus project search. Background refreshes SHALL NOT overwrite unsaved drafts.

#### Scenario: Inspect and edit long outcome details
- **WHEN** the planner opens an outcome with long notes, a success signal and many project links
- **THEN** full information is accessible across Details and Projects without expanding its list row
- **AND** Edit details focuses the title field
- **AND** stream assignment remains editable on Board rather than in this sidebar

#### Scenario: Refresh while editing
- **WHEN** workspace data refreshes while the planner has unsaved outcome changes
- **THEN** those changes remain intact and are not replaced by refreshed values

### Requirement: Outcome entry points emphasize titles and a single add action
The Outcomes heading SHALL provide the main Add outcome action. Catalog and delivery titles SHALL open the shared sidebar by outcome ID, independently of catalog filters. Repeated Edit, Links and Delete row actions and duplicated section-header Add actions SHALL be removed. Delivery SHALL retain forecast information and Resolve blocker actions. A loaded-empty catalog SHALL offer contextual creation.

#### Scenario: Open from delivery outside the catalog query
- **WHEN** the planner selects a delivery outcome title excluded by catalog filters
- **THEN** that outcome opens in the shared sidebar without changing the query
- **AND** its management actions are available within the sidebar

### Requirement: Section navigation preserves drafts and save scopes
Switching Details and Projects SHALL preserve both drafts, edit modes and project search/status context without saving. Unsaved sections SHALL be identified. Save details and Save links SHALL persist only their named section; Cancel details and Cancel links SHALL reset only that section to saved values. The affected section SHALL return to inspection while the other draft remains intact.

#### Scenario: Save only one of two edited sections
- **WHEN** the planner edits Details and Projects, switches between them, and saves Details
- **THEN** only metadata is persisted and Details shows saved information
- **AND** the Projects draft, edit mode and search/status context remain unchanged
- **AND** the catalog uses saved values rather than the unsubmitted Projects draft

#### Scenario: Cancel only project changes
- **WHEN** both sections contain unsaved changes and the planner selects Cancel links
- **THEN** Projects returns to saved inspection while the Details draft is preserved
- **AND** switching sections itself submits no writes

### Requirement: New outcomes save details and initial links together
Add outcome SHALL open blank Details with title focused and Projects available in the same sidebar. Create outcome SHALL validate both sections and persist metadata and initial links together. Success SHALL transition to saved Details in that dialog. Rejection SHALL retain both drafts with an error. Zero links and optional-only links SHALL remain valid.

#### Scenario: Create an outcome after choosing required and optional work
- **WHEN** the planner enters Details, selects Required and Optional projects, switches sections and creates
- **THEN** both drafts survive navigation and one creation operation saves metadata and links together
- **AND** the same sidebar shows the created outcome's saved Details

#### Scenario: Required input is invalid in the inactive section
- **WHEN** the planner selects Create outcome from Projects with a missing required title
- **THEN** Details is revealed and the invalid title field is focused
- **AND** no outcome or project links are persisted

### Requirement: Project editing preserves complete link state
Project selection SHALL retain search, status filters and Required/Optional controls, defaulting newly selected projects to Minimum required. Link drafts, counts and submissions SHALL include hidden/unavailable links independently of visible project rows. Unavailable links SHALL be identified and explicitly removable. Optional-only links SHALL NOT imply delivery readiness.

#### Scenario: Save with filtered and unavailable linked work
- **WHEN** project search hides some saved links and another linked project is unavailable
- **THEN** hidden and unavailable links remain in the draft until explicitly removed
- **AND** server rejection retains the draft with an error rather than silently dropping links

### Requirement: Dismissal discards only unsubmitted outcome changes
Close, Escape and backdrop dismissal SHALL discard all unsubmitted drafts without autosave or a confirmation flow. Draft-discard behavior SHALL be explained while dirty. Dismissal SHALL remain available during saves and SHALL NOT cancel submitted writes. Reopening SHALL start from saved data. Backdrop dismissal SHALL require pointer start and end on the backdrop.

#### Scenario: Close an outcome with two dirty sections
- **WHEN** the planner dismisses the sidebar after editing both sections without saving
- **THEN** reopening shows saved values in both sections
- **AND** no unsubmitted change has been persisted

#### Scenario: Drag out of the sidebar
- **WHEN** a pointer drag starts inside the sidebar and ends on the backdrop
- **THEN** the sidebar remains open
- **AND** a pointer interaction starting and ending on the backdrop dismisses it without activating underlying controls

### Requirement: Save outcomes distinguish persistence from refresh
Rejected writes SHALL retain inputs with section-local errors. Successful writes SHALL show saved status independently of follow-up refresh. A failed refresh SHALL offer retry that reloads data without repeating the write and retains saved inspection, including a just-created outcome. Successful refreshes SHALL update catalog, Board and delivery.

#### Scenario: Persistence succeeds but refresh fails
- **WHEN** an outcome creation, detail update or link update persists and the follow-up refresh fails
- **THEN** the sidebar reports saved-but-not-refreshed state rather than an unsaved write
- **AND** the saved outcome remains inspectable and retry does not repeat the mutation

#### Scenario: Save request is rejected
- **WHEN** the server rejects a submitted section update
- **THEN** the selected section retains its draft with an error and no success indication
- **AND** unsaved changes in the other section remain intact

### Requirement: Submitted writes survive dismissal without affecting newer openings
Submitted outcome writes SHALL finish and refresh workspace data after dismissal. Conflicting submissions SHALL be serialized. The submitted section SHALL be noneditable while pending, including both sections during creation. Navigation and Close SHALL remain available. Older completion SHALL NOT reset, populate, close or steal focus from a newer opening. Failures after dismissal SHALL remain visible in the workspace.

#### Scenario: Open another outcome while an earlier save finishes
- **WHEN** the planner dismisses a pending save and opens another outcome
- **THEN** the earlier request completes without changing the newer opening's drafts, section or focus
- **AND** its persistence and refresh results remain accurately reported

#### Scenario: Creation completes after dismissal
- **WHEN** the planner dismisses a submitted creation and it later succeeds
- **THEN** a success notice offers View outcome using the created outcome's identity
- **AND** the old sidebar does not reopen automatically

### Requirement: Confirmed deletion lives inside saved outcome Details
Delete outcome SHALL be a secondary destructive action within saved Details, separate from save controls. It SHALL be available only when neither section has unsubmitted changes and no write is pending. Deletion SHALL retain confirmation and remove only the selected outcome with existing ownership cleanup. Success SHALL close its sidebar and restore focus to the next visible result, previous result or catalog heading.

#### Scenario: Delete an outcome under active filters
- **WHEN** the planner confirms deletion from a clean outcome sidebar
- **THEN** only that outcome is deleted, the sidebar closes and filtered counts update
- **AND** focus moves to the next visible outcome at its former position, then the previous outcome, then the catalog heading if necessary

### Requirement: Mutations preserve filters and outcome context
Successful writes SHALL recompute results from saved data without resetting search, facets or sort. A nonmatching saved outcome SHALL remain open with Outside current filters and explicit Clear filters. Ordinary dismissal SHALL restore its visible opener without resetting page position; missing openers SHALL use catalog or delivery heading fallbacks. No extra result SHALL be pinned to the catalog.

#### Scenario: Save changes that remove the row from the result set
- **WHEN** an edited outcome no longer matches the selected filters
- **THEN** matching counts/list update and the saved section returns to inspection while the other draft is preserved
- **AND** the sidebar shows Outside current filters and closing uses its opener or relevant heading fallback

#### Scenario: Create an outcome outside the current filters
- **WHEN** a new outcome does not match the active query
- **THEN** the same sidebar shows its saved Details with Outside current filters and Clear filters
- **AND** the query is preserved and the new outcome remains in the total count

#### Scenario: Dismissed creation does not match the query
- **WHEN** a submitted creation finishes after dismissal and is excluded by the active filters
- **THEN** its notice offers View outcome and Clear filters without changing the query automatically

### Requirement: Confirmed external removal ends stale inspection
A successful refresh that confirms removal of the selected outcome SHALL close its sidebar with feedback and a relevant focus fallback. A failed refresh or a created outcome missing from stale results SHALL NOT be treated as external deletion.

#### Scenario: Selected outcome disappears externally
- **WHEN** a successful refresh confirms another action removed the selected outcome
- **THEN** the sidebar closes with removal feedback and focus returns to a visible opener or relevant heading

### Requirement: Browsing is accessible on desktop and narrow screens
Search and filters SHALL have visible labels and logical keyboard order. Outcome titles SHALL be real controls with complete accessible names. Result changes SHALL be announced without moving typing focus. Narrow layouts SHALL preserve all row metadata, allow complete titles to wrap and avoid page-level horizontal overflow.

#### Scenario: Browse using keyboard or a narrow viewport
- **WHEN** the catalog is used by keyboard or at a 390px viewport
- **THEN** every filter and outcome title remains reachable, with management actions accessible in the sidebar
- **AND** all metadata remains available, full titles remain accessible, and the page does not overflow horizontally

### Requirement: Outcome sidebar supports accessible responsive operation
The sidebar SHALL provide a labeled modal, contained focus, inert background, reachable Close and save actions, and keyboard-operable section navigation with selected state. Narrow layouts SHALL become full-screen with a clear scrolling body. Dirty, pending, saved and error feedback SHALL remain visible and programmatically available without relying on color or moving focus unexpectedly.

#### Scenario: Operate the sidebar on a narrow screen by keyboard
- **WHEN** the planner edits an outcome at 390px or using keyboard-only navigation
- **THEN** both sections, fields, feedback, Close and save controls remain reachable without horizontal overflow
- **AND** background controls are inert and internal navigation preserves focus containment
