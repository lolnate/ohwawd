# Project assignment

## Purpose

Let planners assign or defer projects with minimal local administration while keeping Linear execution facts and project priority authoritative.

## ADDED Requirements

### Requirement: Project priority comes from Linear
The system SHALL import and display Linear project priority as read-only source data. Priority SHALL NOT override a user-defined stream sequence. Missing legacy source priority SHALL be shown as Unknown rather than inferred from a local numeric rank.

#### Scenario: Priority changes on sync
- **WHEN** a successful Linear sync changes a project's priority
- **THEN** the current source view displays the new priority and the sync report identifies the change
- **AND** existing stream assignments and sequence remain unchanged

#### Scenario: No priority is assigned in Linear
- **WHEN** Linear explicitly reports no priority for a project
- **THEN** the board displays No priority, distinct from an unavailable legacy value

#### Scenario: User order differs from Linear priority
- **WHEN** a lower-priority project precedes a higher-priority independent project in a stream
- **THEN** their saved stream order governs selection for available WIP slots
- **AND** neither priority can be edited locally

### Requirement: Assignment controls are lightweight
Current planning controls SHALL expose location, optional pause rationale, and the unified Extra scope editor. They SHALL NOT expose or apply numeric priority rank, preferred start, hard not-before, or must-include. Current mutation requests containing those retired planning properties SHALL be rejected with an unsupported-field explanation.

#### Scenario: Open a project editor
- **WHEN** the planner opens a project's planning controls
- **THEN** the editor offers Needs assignment, active streams, and Deferred as locations
- **AND** it has no editable priority rank, start constraints, or must-include checkbox
- **AND** scope input follows the project-scope-readiness requirements

#### Scenario: Retired controls cannot silently affect scheduling
- **WHEN** a current client attempts to save a retired start, must-include, or priority-rank property
- **THEN** the mutation is rejected without changing the plan
- **AND** the response identifies the unsupported control

### Requirement: Pause rationale is optional
The system SHALL allow any project to be deferred with an empty pause rationale, including in-progress projects and projects formerly marked must-include. Nonempty notes SHALL remain optional planning context. Deferral SHALL exclude future demand without changing Linear execution state.

#### Scenario: Defer in-progress work without a note
- **WHEN** the planner moves an in-progress project to Deferred and leaves the pause rationale blank
- **THEN** the move succeeds and removes the project from its active stream queue
- **AND** future demand is excluded
- **AND** the board explains that execution must be paused separately in Linear

#### Scenario: Preserve an optional pause note
- **WHEN** the planner saves a deferred project with a pause note and later reloads it
- **THEN** the note is retained and editable
- **AND** clearing it does not prevent saving

### Requirement: Assignment preserves project identity
A project SHALL have at most one active stream assignment and one copy of its remaining demand. Moving it to Needs assignment SHALL keep it selected without a stream; moving it to Deferred SHALL exclude future demand. Stream placement SHALL follow the stream-sequencing requirements regardless of the editing control used.

#### Scenario: Move a shared project between streams
- **WHEN** a project linked to multiple outcomes is assigned to another stream
- **THEN** its single assignment moves and all outcome links remain intact
- **AND** no duplicate project or demand is created

#### Scenario: Remove the stream assignment without deferring
- **WHEN** a selected project moves to Needs assignment
- **THEN** its demand remains visible as selected and it has no finite assignment-based delivery forecast
- **AND** minimum-required outcomes depending on it explain the missing assignment
