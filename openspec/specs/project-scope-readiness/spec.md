# project-scope-readiness Specification

## Purpose
Support rough additional project estimates without administrative fields, and surface when generic scope should be tightened as planned work approaches its forecast start.

## Requirements

### Requirement: Extra scope is one remaining estimate
The project editor SHALL provide one Extra scope points value and optional notes. It SHALL NOT require a kind, owner, rationale, or review date. A positive finite value up to 100,000 points, at thousandth-point precision, SHALL represent additional remaining demand beyond estimated open Linear issues. Empty or zero SHALL remove it; negative or non-finite values SHALL be rejected.

#### Scenario: Estimate work before issues exist
- **WHEN** the planner enters 12 Extra scope points on a project with no issues and leaves notes blank
- **THEN** the estimate saves without an owner, review date, category, or explanation
- **AND** it supports a provisional forecast when assignment, capacity, and dependencies permit

#### Scenario: Calculate known and extra demand
- **WHEN** a project has 20 estimated open issue points and 10 Extra scope points
- **THEN** its remaining forecast demand is 30 points
- **AND** the board distinguishes the known 20 from the extra 10 and labels the forecast provisional

#### Scenario: Clear extra scope
- **WHEN** the planner clears the points value or saves zero
- **THEN** the extra budget is removed
- **AND** any remaining unknown issue demand is not silently treated as zero

### Requirement: Positive extra scope covers acknowledged unknown issues
Saving positive Extra scope SHALL acknowledge coverage of all currently open unestimated issues in that project. It SHALL NOT imply per-issue estimates. Newly appearing unestimated issues SHALL remain uncovered until a positive estimate is saved against the updated issue set. Any uncovered unknown demand SHALL prevent a finite completion forecast.

#### Scenario: Cover current missing estimates
- **WHEN** a project has two open issues without estimates and the planner saves a positive Extra scope value
- **THEN** both current issues are covered by that generic budget
- **AND** the forecast remains provisional rather than presenting them as estimated Linear work

#### Scenario: New unknown issue after the estimate
- **WHEN** sync adds another open unestimated issue after Extra scope was saved
- **THEN** that issue is shown as uncovered and the project has no finite completion forecast
- **AND** the planner can revise or re-save the positive Extra scope estimate to acknowledge the updated issue set

### Requirement: Scope reconciliation is manual and advisory
Changes to issue membership, estimates, or open/closed state after Extra scope was saved SHALL retain its points and display Review extra scope with the changes. The system SHALL NOT automatically subtract newly estimated points. Re-saving the remaining estimate SHALL acknowledge the current issue baseline. The reminder alone SHALL NOT prevent saving, publication, or a finite provisional forecast where demand is covered.

#### Scenario: Existing unknown issue receives an estimate
- **WHEN** a project with 20 known points and 10 extra points gains a 4-point estimate on a previously covered unknown issue
- **THEN** it shows 24 known plus 10 extra points and Review extra scope
- **AND** its covered-demand forecast remains provisional and available
- **AND** editing Extra scope to 6 acknowledges a total of 30 remaining points

#### Scenario: New estimates represent genuinely added work
- **WHEN** the planner reviews newly added estimated work and re-saves the existing extra points unchanged
- **THEN** the budget remains unchanged, the current source baseline is acknowledged, and the review reminder clears
- **AND** no rationale is required

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

### Requirement: Needs scoping is derived from planned start
For a selected project with positive Extra scope and a finite forecast start, scoping due SHALL equal its forecast-start local date minus the configured lead days in the team's timezone. The board SHALL mark Needs scoping when the evaluation local date is on or after that date. The reminder SHALL NOT alter demand, scheduling eligibility, provisional dates, or publication eligibility.

#### Scenario: Enter the default scoping window
- **WHEN** a project's forecast start is November 20 in the team's timezone, its Extra scope is positive, and the lead time is 14
- **THEN** its scoping due date is November 6
- **AND** it shows Needs scoping on November 6 and afterward while the generic scope remains
- **AND** its finite forecast stays provisional and visible

#### Scenario: Date arithmetic crosses a daylight-saving transition
- **WHEN** the configured window spans a daylight-saving boundary
- **THEN** the due date is calculated by local calendar dates rather than a fixed number of elapsed hours

#### Scenario: Scope is tightened
- **WHEN** generic scope is replaced with estimated Linear work, the extra budget is removed, and no unknown issue demand remains
- **THEN** Needs scoping clears and the project's forecast no longer depends on generic scope

### Requirement: Scoping reminders explain lifecycle and missing dates
In-progress selected projects with Extra scope SHALL need scoping immediately. Deferred or reconciled-complete projects SHALL have no active scoping reminder. Other selected generic projects without a finite forecast start SHALL show Scoping date unavailable and their forecast blocker. Readiness SHALL be derived after scheduling without inventing a start date.

#### Scenario: Work is already in progress
- **WHEN** a selected project is in progress in Linear and retains Extra scope
- **THEN** the board shows Needs scoping immediately, even if forecast capacity begins in a later full cycle

#### Scenario: Project is deferred
- **WHEN** the planner defers a project that needs scoping
- **THEN** its active Needs scoping reminder disappears and its extra estimate remains available for later planning

#### Scenario: No start can be forecast
- **WHEN** a selected project with Extra scope is unassigned or dependency-blocked and has no finite start
- **THEN** the board shows Scoping date unavailable with the existing blocker instead of a fabricated review date

### Requirement: Reminder calculation responds to time and planning changes
The live board SHALL evaluate scoping reminders against the current date independently of Linear's last sync time, including across a local date boundary while open. Queue, capacity, calendar, scope, or lead-time changes SHALL recalculate reminders. Needs scoping SHALL clear when a project moves outside its window; source-change review reminders SHALL remain independent.

#### Scenario: Reorder work farther out
- **WHEN** a move changes a project's forecast start to a date beyond its current scoping window
- **THEN** Needs scoping clears and its due date moves with its new forecast start
- **AND** an outstanding Review extra scope reminder does not clear merely because the start changed

#### Scenario: Window opens without another Linear sync
- **WHEN** the team's local date reaches a project's due date while the board remains open
- **THEN** its readiness refreshes to Needs scoping without requiring a Linear import

### Requirement: Scope reminders are actionable on the board
Needs scoping and Review extra scope SHALL be visible on project cards and in Planning attention. Each SHALL offer an action to open the affected project's Extra scope editor. These reminders SHALL be presented separately from errors that prevent calculating dates.

#### Scenario: Resolve a reminder from Planning attention
- **WHEN** the planner chooses a project's Needs scoping action in Planning attention
- **THEN** the board reveals that project's scope editor and the relevant demand context
- **AND** it does not require an owner, review date, rationale, or approval

### Requirement: Scenario scope assumptions and historical output are preserved
New scenario snapshots SHALL capture Extra scope, notes, coverage baseline, lead days, evaluation time, and derived reminders. Comparisons SHALL expose scope-budget and lead-time changes. Published reminders SHALL remain frozen. Legacy editable allowances SHALL convert using effective residual unestimated budget plus discovery budget without granting previously absent unknown coverage.

#### Scenario: Convert both legacy allowance kinds
- **WHEN** a legacy draft has an unestimated allowance of 10 whose captured issues now contribute 4 estimated points, and discovery of 3
- **THEN** conversion produces 9 Extra scope points, preserving the effective additional demand
- **AND** it carries forward optional rationale text and existing unknown coverage without requiring former owner or review date

#### Scenario: Convert a fully consumed allowance
- **WHEN** a legacy unestimated allowance has zero effective residual and there is no discovery budget
- **THEN** conversion creates no extra budget and does not manufacture coverage for remaining unknown issues

#### Scenario: Read a published snapshot later
- **WHEN** a published revision is opened after its scoping due date passes in real time
- **THEN** its frozen reminders and evaluation date remain unchanged
- **AND** it is not recomputed using today's date or the live board's current scoping window
