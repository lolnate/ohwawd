# stream-sequencing Specification

## Purpose
Make the order users arrange in each project stream persistent, accessible, and authoritative for dependency-aware scheduling and scenario comparisons.

## Requirements

### Requirement: Stream order is visible and persistent
Each stream SHALL present its saved ordered project queue without requiring expansion of project-management details. Queue order SHALL drive project and timeline-row presentation and scheduling preference. Reordering SHALL persist across reloads and SHALL NOT encode a preferred or hard start date.

#### Scenario: Reorder independent projects
- **WHEN** the planner drags project C before project A in a stream containing A, B, and C
- **THEN** the saved queue and timeline rows become C, A, B
- **AND** a reload preserves that order
- **AND** forecast dates are recalculated from that order and other scheduling inputs

#### Scenario: Priority sync preserves deliberate order
- **WHEN** source priority changes after a queue has been arranged
- **THEN** the displayed priority updates but the queue order does not

### Requirement: Moves have accessible equivalent controls
The board SHALL support drag-and-drop within streams, across streams, and between streams and the Needs assignment or Deferred shelves. It SHALL provide keyboard and touch-accessible non-drag controls for the same destination and insertion choices. All interaction paths SHALL enforce identical placement rules and expose success or failure accessibly.

#### Scenario: Move without dragging
- **WHEN** a keyboard or touch user selects a project, destination stream, and before-project insertion target through Move controls
- **THEN** the result matches an equivalent drag-and-drop operation
- **AND** focus remains usable and the resulting position is announced

#### Scenario: Invalid drop
- **WHEN** a drop violates a dependency or has an invalid destination
- **THEN** no saved assignment or order changes
- **AND** the interface explains the failure and retains focus on the project or its move control

### Requirement: Explicit placement is atomic
A successful placement SHALL remove a project from its prior queue and insert it at the requested valid position in the destination, preserving other projects' relative order. It SHALL update assignment and sequence atomically. A stale sequencing request SHALL be rejected rather than overwriting intervening assignment, order, or relevant dependency changes.

#### Scenario: Move between streams
- **WHEN** the planner inserts B between X and Y in another stream
- **THEN** B appears once in that destination as X, B, Y and no longer appears in its former queue
- **AND** both queues and their forecasts reflect one committed mutation

#### Scenario: Another edit occurred during a drag
- **WHEN** a placement request uses sequencing information made stale by another assignment, reorder, or relevant source/dependency change
- **THEN** it fails with a conflict and refreshed sequencing information
- **AND** it does not overwrite the intervening edit

### Requirement: All assignment paths produce a valid sequence
Location-only assignments SHALL insert incoming projects at the last dependency-valid positions while preserving existing members' relative order. Bulk assignment SHALL use a deterministic dependency-valid order for incoming members and succeed or fail as a unit. Reassigning a project already selected in that stream SHALL NOT reposition it.

#### Scenario: Assign a blocker to its successor's stream
- **WHEN** a location-only assignment moves A into a stream containing B and A blocks B
- **THEN** A is inserted at the last position before B allowed by the effective dependency graph
- **AND** the other existing members retain their relative order

#### Scenario: Repeat bulk outcome assignment
- **WHEN** an outcome's projects are assigned again to a stream that already contains some of them
- **THEN** existing members retain their sequence and only incoming members are inserted
- **AND** a repeated fully satisfied assignment is a no-op

#### Scenario: Bulk placement cannot produce a valid order
- **WHEN** any incoming project's constraints make the requested bulk assignment invalid
- **THEN** the entire assignment is rejected with the blocking relationships
- **AND** no subset of the projects moves

### Requirement: Effective dependencies constrain placement
For selected unfinished projects in the same stream, every effective direct or transitive predecessor SHALL precede its successor. Effective dependencies SHALL include unwaived Linear edges and local edges. Cross-stream placement SHALL retain finish-to-start constraints without imposing a global queue rank. Dragging SHALL NOT create or waive dependencies.

#### Scenario: Direct blocker cannot follow blocked work
- **WHEN** A blocks B and the planner attempts to place B before A in the same stream
- **THEN** the move is rejected and the explanation identifies A as B's blocker
- **AND** A is not moved automatically

#### Scenario: Transitive blocker through another stream
- **WHEN** A blocks X, X blocks B, A and B share a stream, and X belongs to another stream
- **AND** the planner attempts to place B before A
- **THEN** the move is rejected with the A to X to B dependency path

#### Scenario: Dependencies across streams remain active
- **WHEN** B is first in its stream but depends on A in another stream
- **THEN** B cannot start until a cycle after A finishes
- **AND** an unresolved external or deferred predecessor continues to prevent B's finite completion forecast

#### Scenario: Completed or waived relationships
- **WHEN** a predecessor is reconciled as complete or its Linear dependency has been explicitly waived through the dependency controls
- **THEN** that relationship imposes no queue-position restriction
- **AND** any waiver remains visibly distinguishable from an active Linear dependency

### Requirement: Source conflicts preserve user order
If sync or rebase introduces a dependency that conflicts with saved order, the system SHALL preserve that order, identify affected relationships, and withhold unfinished-project dates for the affected lane until repaired. Repair moves SHALL be accepted when they reduce existing violations without introducing new ones. An effective dependency cycle SHALL remain an invalid-forecast error.

#### Scenario: Sync introduces reverse precedence
- **WHEN** a saved lane contains B before A and sync reports that A blocks B
- **THEN** the lane remains B before A and displays an actionable order conflict
- **AND** its unfinished work has no finite date until the conflict is repaired
- **AND** otherwise valid lanes remain usable subject to their dependencies

#### Scenario: Repair several conflicts incrementally
- **WHEN** a lane has multiple source-introduced order violations and a move resolves one without adding any
- **THEN** the move succeeds even if another existing violation remains
- **AND** dates return only after the lane is valid

#### Scenario: Add a locally conflicting constraint
- **WHEN** adding a local dependency or restoring a waiver would invalidate an otherwise valid lane order
- **THEN** the mutation is rejected with the required precedence
- **AND** the planner can reorder first and retry

### Requirement: Scheduling selects eligible work by queue order
The scheduler SHALL carry unfinished work started in earlier forecast cycles, then fill free WIP slots with eligible projects in saved queue order. Blocked projects SHALL be skipped in favor of later eligible work. Queue adjacency SHALL NOT create a dependency. Existing capacity conservation, equal active-work budget sharing, and next-cycle dependency unlocking SHALL remain in effect.

#### Scenario: WIP one honors sequence
- **WHEN** independent A and B are eligible in that order in a stream with WIP one
- **THEN** A receives the next free WIP slot even if B has higher Linear priority
- **AND** B waits for a later cycle's free slot

#### Scenario: WIP allows overlap
- **WHEN** a stream has WIP two and its first two projects are eligible
- **THEN** both can start in the same cycle and share the stream budget
- **AND** the queue does not force serial completion

#### Scenario: Blocked head does not idle independent work
- **WHEN** A is first but dependency-blocked and later B is independently eligible
- **THEN** B can fill a free slot while A waits
- **AND** no unused capacity is borrowed automatically from another stream

### Requirement: Scenarios preserve sequencing semantics and history
New saved drafts and revisions SHALL retain sequence and use the revised calculation version. Dirty detection and comparisons SHALL identify sequence changes separately from Linear priority changes. Loading legacy editable drafts SHALL adapt retired controls to the new model. Published legacy inputs, output, and calculation version SHALL remain unchanged.

#### Scenario: Round-trip an arranged draft
- **WHEN** the planner saves a sequence, changes the live board, and reloads that draft
- **THEN** its saved sequence is restored subject to visible source/stream reconciliation
- **AND** comparisons show which project positions changed

#### Scenario: Load a legacy editable draft
- **WHEN** a draft has numeric ranks, start constraints, and must-include flags but no sequence
- **THEN** loading it seeds a deterministic dependency-valid queue using rank then immutable ID as the stable preference
- **AND** it explains that start constraints and must-include are retired
- **AND** subsequent save uses the revised model without applying those retired controls

#### Scenario: Read a published legacy revision
- **WHEN** the planner opens a v0 published revision after v1 is introduced
- **THEN** its stored result, inputs, and version remain intact
- **AND** comparison against a v1 plan identifies the calculation-version difference
