# Spec Delta

## Purpose

Give shared planning assumptions a discoverable, accessible Settings surface that preserves planning context and keeps forecasts synchronized with saved changes.

## ADDED Requirements

### Requirement: Settings is accessible throughout the workspace
The signed-in workspace SHALL expose a gear button with the accessible name Settings in its header. It SHALL open a centered Settings overlay above the current view without changing the active workspace view or clearing its local state. Opening from the gear SHALL initially select Capacity assumptions.

#### Scenario: Open Settings from another view
- **WHEN** a planner opens Settings while viewing filtered Linear projects
- **THEN** the Settings overlay appears with Capacity assumptions selected
- **AND** closing it returns to the same view with its filters and scroll position retained

#### Scenario: Settings is available before Linear setup
- **WHEN** a signed-in planner has not connected Linear
- **THEN** Settings remains available and explains missing capacity evidence without fabricating observations
- **AND** authentication and existing planning validation still apply

### Requirement: Settings has three clear sections
Settings SHALL provide labeled section navigation for Capacity assumptions, Scope readiness, and Weekly availability and holidays. It SHALL show one section's editor at a time, identify the active section, and preserve unsaved field values when moving between sections during the same opening. The three editors SHALL no longer appear in the Board content.

#### Scenario: Switch between editors
- **WHEN** a planner edits capacity fields, opens Scope readiness, and returns to Capacity assumptions without saving
- **THEN** the unsaved capacity values remain available
- **AND** the section's save action applies only that section's changes

### Requirement: Capacity settings preserve evidence and controls
Capacity assumptions SHALL expose the optional manual baseline, required override reason when manual, reserve points per cycle, and 1–104-cycle forecast horizon. It SHALL retain existing validation, comparable-cycle observations, observed and effective baselines, source distinction, imported/projected coverage context, and insufficient-calendar warnings. Blank baseline SHALL use the observed median only when at least three comparable completed cycles exist.

#### Scenario: Configure a provisional baseline
- **WHEN** fewer than three comparable completed cycles exist
- **THEN** Settings explains that a provisional manual baseline is required
- **AND** saving a manual baseline without a reason fails without changing saved capacity

#### Scenario: Return to observed capacity
- **WHEN** at least three comparable completed cycles exist and the planner clears the manual baseline and saves
- **THEN** the effective baseline uses the observed median and persists after reopening
- **AND** observation evidence and projected-calendar warnings remain available

### Requirement: Settings provides reliable section-local saving
Settings SHALL show loading, retryable load errors, and section-local saving, success, and failure feedback. Existing explicit save actions SHALL remain explicit; the holiday toggle and override removal SHALL retain immediate persistence. Pending mutations SHALL prevent duplicate or conflicting Settings writes. Failed saves SHALL retain entered values for correction or retry and SHALL NOT report success.

#### Scenario: Save fails and is retried
- **WHEN** a capacity save fails due to validation or a network error
- **THEN** the overlay stays open with the error and entered values intact
- **AND** correcting or retrying the submission can save without re-entering unrelated fields

#### Scenario: Settings cannot load
- **WHEN** the settings data request fails
- **THEN** the overlay presents an error and Retry action instead of editable fabricated defaults
- **AND** Close and Escape remain available

### Requirement: Saved assumptions refresh planning consumers
A successful Settings mutation SHALL refresh the live Board forecast, timeline availability, scope reminders, Outcomes delivery, and scenario readiness and dirty state through the existing planning lifecycle. It SHALL preserve unrelated unsaved Settings fields and remain open on the current section. Loading a scenario later SHALL make its restored settings visible on the next opening; published history SHALL retain its stored values.

#### Scenario: Save capacity while reviewing Outcomes
- **WHEN** the planner saves a capacity change from Settings over Outcomes
- **THEN** delivery forecasts and scenario readiness and dirty state reflect the saved assumption without a page reload
- **AND** the overlay remains open on Capacity assumptions with success feedback

#### Scenario: Save one section with another draft present
- **WHEN** capacity fields have unsaved edits and the planner saves a scoping-window change
- **THEN** only the scoping-window change is persisted
- **AND** returning to Capacity assumptions retains its unsaved edits

#### Scenario: Reopen after scenario activation
- **WHEN** a different scenario is activated and Settings is subsequently opened
- **THEN** it displays that scenario's restored planning assumptions rather than a previous opening's drafts

### Requirement: Board actions target the moved settings
Board baseline setup and capacity-resolution actions SHALL open Capacity assumptions in Settings. The cycle-calendar weekly-availability link SHALL open Weekly availability and holidays. Each action SHALL reveal and focus its target without depending on removed Board editors. Other Board controls SHALL retain their existing destinations.

#### Scenario: Resolve missing baseline
- **WHEN** a planner selects Set capacity baseline in Planning attention
- **THEN** Settings opens to Capacity assumptions with the baseline input focused

#### Scenario: Open weekly settings from cycle-wide controls
- **WHEN** a planner follows Weekly availability and holidays in the Board's cycle calendar
- **THEN** Settings opens to that section with its week selector focused
- **AND** the distinction and precedence between weekly and cycle-wide availability are explained

### Requirement: Settings follows accessible overlay dismissal conventions
Settings SHALL have a labeled modal, contained keyboard focus, an accessible Close button, and Escape dismissal. A backdrop interaction SHALL dismiss only when it starts and ends outside the overlay, without activating controls beneath it. Dismissal SHALL restore focus to the opener or the header Settings button if the opener is unavailable. Unsaved edits SHALL be discarded on dismissal; saved changes SHALL remain applied.

#### Scenario: Dismiss and reopen an unsaved edit
- **WHEN** a planner changes a capacity field without saving, closes Settings, and reopens it
- **THEN** the last saved value is shown
- **AND** closing did not submit the unsaved value

#### Scenario: Drag outward from a form
- **WHEN** a pointer interaction starts inside Settings and ends on the backdrop
- **THEN** Settings remains open
- **AND** clicking whitespace or fields inside it also keeps it open

#### Scenario: Close during an in-flight save
- **WHEN** a planner dismisses Settings while a submitted save is pending
- **THEN** dismissal does not cancel or duplicate that submitted mutation
- **AND** a successful completion still refreshes the workspace and appears on reopening

### Requirement: Settings fits desktop and narrow screens
Settings SHALL use the application's typography, green accents, light surfaces, borders, spacing, and form styling. At desktop widths it SHALL be a bounded centered overlay with section navigation beside its content. At narrow widths it SHALL become a full-screen surface with wrapping section navigation, stacked fields, internal vertical scrolling, and a reachable header and Close action. It SHALL NOT create page-level horizontal overflow.

#### Scenario: Use Settings on a phone
- **WHEN** Settings is used at a 390-pixel-wide viewport
- **THEN** all three sections, fields, save actions, and Close are reachable without horizontal page scrolling
- **AND** long observations and override lists scroll within Settings
