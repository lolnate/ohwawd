# project-assignment Specification

## Purpose
Let planners assign or defer projects with minimal local administration while keeping Linear execution facts and project priority authoritative.

## Requirements

### Requirement: Project priority comes from Linear
The system SHALL import and display Linear project priority as read-only source data. Priority SHALL NOT override saved outcome rank, required/optional scheduling tier or scoped project order. Missing legacy source priority SHALL be shown as Unknown rather than inferred from a local numeric rank.

#### Scenario: Priority changes on sync
- **WHEN** a successful Linear sync changes project priority
- **THEN** the source view and sync report identify the new priority
- **AND** outcome ranks, assignments, membership and scoped project order remain unchanged

#### Scenario: No priority is assigned in Linear
- **WHEN** Linear explicitly reports no project priority
- **THEN** the Board displays No priority, distinct from an unavailable legacy value

#### Scenario: User order differs from Linear priority
- **WHEN** a lower-source-priority project precedes independent higher-source-priority work in the same owner and scheduling tier
- **THEN** saved scoped order governs selection for the next free cycle
- **AND** source priorities remain uneditable locally

### Requirement: Assignment controls are lightweight
Planning controls SHALL expose roadmap membership, eligible owning outcome, derived active stream, optional pause rationale and Extra scope. They SHALL NOT apply retired numeric rank, preferred start, hard not-before or must-include properties; requests containing those fields SHALL be rejected. Inclusion SHALL require an explicitly selected owning outcome with an active stream and a saved project link.

#### Scenario: Open a project editor
- **WHEN** the planner opens project planning controls
- **THEN** it offers Include on roadmap with a linked outcome/stream, Needs assignment, Defer and Dismiss from roadmap
- **AND** no active-stream-only or Other selected work owner choice bypasses ownership
- **AND** scope input retains project-scope-readiness behavior

#### Scenario: Retired controls cannot silently affect scheduling
- **WHEN** a current client sends a retired start, must-include or numeric priority-rank property
- **THEN** the mutation rejects the unsupported control without changing the plan

#### Scenario: Single-project outcome inclusion
- **WHEN** an imported candidate is the only linked project in an outcome assigned to an active stream
- **THEN** the planner can include it with that outcome as owner
- **AND** one project and one capacity charge are scheduled

### Requirement: Pause rationale is optional
The system SHALL allow included work to be deferred without a rationale, including in-progress projects. Deferral SHALL preserve valid owner/stream context and saved links while excluding future demand and active execution-queue membership. Resume SHALL require a still-valid owner or explicit replacement. Deferral SHALL NOT change Linear execution or satisfy an unfinished prerequisite.

#### Scenario: Defer in-progress work without a note
- **WHEN** the planner defers in-progress work with a blank pause rationale
- **THEN** it leaves active scheduling and future demand is excluded
- **AND** the Board explains that execution must be paused separately in Linear

#### Scenario: Preserve an optional pause note
- **WHEN** the planner saves a deferred project with a pause note and reloads it
- **THEN** the note remains editable and clearing it does not prevent saving
- **AND** its valid owner context is retained for an explicit resume

#### Scenario: Deferred owner was removed
- **WHEN** a deferred project's old owner is no longer valid and the planner resumes it
- **THEN** an eligible owner must be chosen before inclusion succeeds
- **AND** the project is not silently scheduled ownerless

### Requirement: Assignment preserves project identity
A project SHALL retain one work package and at most one capacity-owning outcome/stream. Inclusion SHALL charge its remaining demand once in its owner's stream. Needs assignment SHALL make it an excluded candidate with no active owner or stream; Deferred and Dismissed SHALL exclude future demand. Changing membership or ownership SHALL preserve identity, estimates and nonremoved links and refresh all appearances atomically.

#### Scenario: Move a shared project between streams
- **WHEN** a project linked to several outcomes transfers to an eligible owner in another stream
- **THEN** its single assignment and charge move while all links remain
- **AND** no duplicate project or demand is created

#### Scenario: Remove the stream assignment without deferring
- **WHEN** included work moves to Needs assignment
- **THEN** it becomes a candidate with no active stream/owner and excluded future demand
- **AND** required outcomes depending on its unfinished work explain the missing roadmap inclusion and owner

### Requirement: Roadmap membership is distinct from source visibility
Imported work SHALL be classified as candidate, included, deferred or dismissed. Newly imported projects SHALL start as excluded candidates without an automatic outcome. Dismiss from roadmap SHALL clear active ownership and stream while retaining links and scope. Restore SHALL return a dismissed project to candidate, not auto-include it. Hide/Restore source visibility SHALL remain visibility-only and SHALL NOT change membership or capacity.

#### Scenario: Engineering work remains outside the roadmap
- **WHEN** imported Engineering work is dismissed
- **THEN** it has no individually scheduled demand and need not receive an outcome
- **AND** source execution remains unchanged and capacity reserve can represent outside-roadmap work

#### Scenario: Hidden included work
- **WHEN** an included project is hidden from source lists
- **THEN** it remains scheduled and linked with a Hidden label
- **AND** dismissing it explicitly, rather than hiding it, excludes its demand

#### Scenario: Restored candidate
- **WHEN** a dismissed project is restored
- **THEN** it appears in Needs assignment as a candidate until the planner chooses an eligible owning outcome
- **AND** merely restoring visibility does not create roadmap demand

### Requirement: Excluded prerequisites remain unresolved until complete or included
An unfinished candidate, dismissed or deferred predecessor SHALL prevent a dependent finite forecast through the effective dependency closure. Missing imports SHALL remain unresolved too. Exclusion SHALL NOT delete or satisfy an edge. Actually reconciled-complete prerequisites SHALL satisfy it regardless of membership. Explicit inclusion SHALL require an owner and refresh the sole shared forecast.

#### Scenario: Dismiss an unfinished prerequisite
- **WHEN** an included project's prerequisite is dismissed while unfinished
- **THEN** the dependent forecast becomes unresolved with an actionable prerequisite explanation
- **AND** the prerequisite contributes no scheduled capacity or selected-demand total

#### Scenario: Include an off-roadmap prerequisite
- **WHEN** the planner explicitly links an unfinished prerequisite to an assigned outcome and includes it with that owner
- **THEN** it can be scheduled once in that owner's stream
- **AND** every dependent appearance uses the recalculated forecast without gaining an implicit saved link

### Requirement: Legacy roadmap conversion is conservative and visible
Live migration and editable-draft conversion SHALL preserve valid owners and scoped order. Ownerless selected work SHALL acquire an owner only when exactly one eligible linked outcome exists in its current stream; otherwise it SHALL become an excluded candidate with visible review feedback. No outcome or link SHALL be invented. Previously deferred work SHALL stay deferred. Published snapshots SHALL remain untouched.

#### Scenario: Ambiguous legacy owner
- **WHEN** selected ownerless work has zero or several eligible linked outcomes in its existing stream
- **THEN** conversion places it in Needs assignment without an active charge and explains the previous stream and need for an owner
- **AND** scope and existing links remain available for explicit inclusion

#### Scenario: Unambiguous legacy owner
- **WHEN** selected ownerless work has exactly one eligible linked outcome in its existing stream
- **THEN** conversion selects that owner without changing stream or relative project preference
- **AND** conversion feedback identifies the inferred ownership
