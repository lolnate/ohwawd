# outcome-lifecycle Specification

## Purpose
Record explicit business completion of outcomes using reconciled delivery evidence, independently of forecast dates and scenario scheduling preferences.

## Requirements

### Requirement: Outcome completion is explicit
Outcomes SHALL remain open until the planner explicitly marks them complete. Completion SHALL persist its time and delivery-scope evidence. Forecast finish dates, past targets and project completion SHALL NOT automatically mark an outcome complete. Reopen SHALL explicitly clear the current completion marker without changing projects, links, placement or forecast inputs.

#### Scenario: Required work finishes but the outcome stays open
- **WHEN** every required project and effective prerequisite is actually complete
- **THEN** the outcome shows Ready to mark complete while remaining open
- **AND** only Mark complete records completion

#### Scenario: Reopen a completed outcome
- **WHEN** the planner selects Reopen outcome
- **THEN** the outcome returns to open with feedback and the prior completion remains in its lifecycle history
- **AND** its project execution facts and planning choices are unchanged

### Requirement: Completion requires actual required-work completion
Mark complete SHALL require at least one direct minimum-required link and actual reconciled completion of every project in its effective required closure. Missing work, unresolved dependencies, source discrepancies, open issues or remaining Extra scope SHALL prevent completion. Optional work outside that closure SHALL NOT gate completion. Forecast capacity, dates and placement SHALL NOT substitute for actual evidence.

#### Scenario: Forecast dates are in the past
- **WHEN** required work has a forecast finish in the past but its source execution is unfinished
- **THEN** Mark complete is unavailable and explains the unfinished work
- **AND** submitting the action directly is rejected without changing the marker

#### Scenario: Optional work and off-roadmap completed prerequisites
- **WHEN** a required project and its effective prerequisites are reconciled as actually complete, including an already-complete off-roadmap prerequisite
- **AND** unrelated optional work remains unfinished
- **THEN** completion is allowed without scheduling the complete prerequisite or waiting for the unrelated optional work

#### Scenario: Empty or optional-only outcome
- **WHEN** an outcome has no direct minimum-required links
- **THEN** it shows Unplanned and explains that required delivery scope must be defined before Mark complete is available

#### Scenario: Reconciled execution evidence
- **WHEN** a required project is marked completed in Linear but open issues, Extra scope, missing-source review, cross-team decomposition or unresolved external blockers remain
- **THEN** it is not actual-completion evidence and the outcome explains the reconciliation needed
- **AND** a canceled status alone is not actual completion

### Requirement: Completed markers remain honest after scope changes
Completed outcomes SHALL remain visible in their saved rank with a completion label and time. If required delivery scope changes or its actual-completion evidence ceases to hold, the marker SHALL remain with Review completion needed and reasons until explicitly reopened. No lifecycle marker SHALL exclude work, change priority or satisfy a project dependency.

#### Scenario: Source work reopens
- **WHEN** a completed outcome's required project gains unfinished issues
- **THEN** it shows Completed · Review completion needed
- **AND** the unfinished included project receives normal scheduling treatment and dependent work remains constrained

#### Scenario: Required links change
- **WHEN** required links or their effective dependency closure change after completion
- **THEN** the outcome retains its recorded completion time with a delivery-scope review explanation
- **AND** the planner can reopen and mark complete again once eligible

#### Scenario: Optional metadata changes do not invalidate completion
- **WHEN** notes, owner, target or an optional contribution outside the required closure changes
- **THEN** the completion marker remains valid if actual required evidence and required delivery scope are unchanged

### Requirement: Completion actions use saved outcome Details
Mark complete and Reopen outcome SHALL be explicit scoped actions in the existing outcome sidebar's saved Details. They SHALL be unavailable while either section has unsaved changes or an outcome write is pending. Actions SHALL retain the same dialog, sections, query, selected outcome and focus context. No action SHALL implicitly save metadata or project drafts or open another outcome overlay.

#### Scenario: Completion from Board uses the unified workspace
- **WHEN** the planner opens a Board outcome title
- **THEN** saved Details in the shared sidebar exposes current completion eligibility and its reasons
- **AND** completing updates the marker without replacing the dialog or changing catalog filters

#### Scenario: Unsaved project links exist
- **WHEN** the Projects section has unsubmitted changes and the planner visits Details
- **THEN** completion actions explain that changes must be saved or cancelled first
- **AND** completion uses only persisted required scope

### Requirement: Lifecycle writes use current evidence and survive dismissal
Lifecycle writes SHALL validate current persisted source, scope and lifecycle state atomically and reject stale evidence with a reload explanation. They SHALL share outcome-write serialization, captured submissions, dismissal and newer-opening guards. Rejection SHALL retain context; persistence followed by refresh failure SHALL show saved state and offer refresh-only retry.

#### Scenario: Eligibility changes before submission
- **WHEN** required work or lifecycle state changes after eligibility was displayed
- **THEN** the stale completion request is rejected with refreshed evidence rather than completing against the prior display

#### Scenario: Dismiss a submitted completion
- **WHEN** the planner closes a submitted completion and opens another outcome
- **THEN** the write and workspace refresh finish without resetting or focusing the newer opening
- **AND** its success or failure remains visible in workspace feedback

### Requirement: Scenario activation does not roll back business completion
Outcome lifecycle SHALL be a workspace business record, not a scenario scheduling choice. New published snapshots SHALL freeze displayed lifecycle evidence for historical viewing. Activating an editable scenario SHALL NOT restore or clear live lifecycle markers; current required-scope changes SHALL recompute their review state. Lifecycle-only changes SHALL NOT dirty scheduling inputs.

#### Scenario: Activate an older scenario after completion
- **WHEN** an outcome is completed and a prior draft is activated
- **THEN** its live completion time is retained
- **AND** changed required scope shows review feedback without changing any frozen published marker or result

#### Scenario: Scenario temporarily omits an outcome
- **WHEN** activation removes an outcome from the current planning definitions and a later activation restores its stable ID
- **THEN** its business completion history and marker are retained independently of scenario-managed definitions
- **AND** no absent outcome is added to catalog results solely because it has lifecycle history

#### Scenario: Compare historical and current lifecycle
- **WHEN** a published revision predates completion or lacks lifecycle fields
- **THEN** historical viewing shows its frozen lifecycle or Lifecycle not recorded
- **AND** it does not infer historical completion from today's source facts
