# Stream sequencing delta

## MODIFIED Requirements

### Requirement: Stream order is visible and persistent
Each stream SHALL show its saved ranked outcome rows without expanding project management. Owned projects SHALL retain persistent order within their owner. Display and scheduling SHALL use outcome rank plus scoped project order, rather than a competing cross-outcome project queue. Reordering SHALL survive reload and SHALL NOT encode a preferred or hard start date.

#### Scenario: Reorder independent projects
- **WHEN** the planner moves project C before A within one outcome containing A, B and C
- **THEN** its saved scoped order becomes C, A, B and reload preserves it
- **AND** forecasts use that order within the outcome and required/optional scheduling tier

#### Scenario: Priority sync preserves deliberate order
- **WHEN** source priority changes after outcomes and projects have been arranged
- **THEN** displayed source priority updates without changing outcome rank or scoped project order

### Requirement: Moves have accessible equivalent controls
The Board SHALL provide drag/drop and keyboard/touch controls for equivalent outcome rank/stream moves and project moves within an owner, explicit ownership transfers, Needs assignment and Deferred. Project controls SHALL NOT silently reposition work across outcome priority boundaries. All paths SHALL enforce identical rules and expose success or failure accessibly.

#### Scenario: Move without dragging
- **WHEN** the planner selects an eligible destination owner and project insertion target through Move controls
- **THEN** the result matches the equivalent drag/drop ownership transfer
- **AND** focus remains usable and the resulting owner and position are announced

#### Scenario: Invalid drop
- **WHEN** a drop violates scoped dependency order or lacks a valid destination owner
- **THEN** no assignment, ownership, rank or order changes
- **AND** the explanation identifies the failure and retains focus on the move control

### Requirement: Explicit placement is atomic
A placement SHALL update affected outcome ranks, project ownership, stream and scoped order atomically while preserving other members' relative order. An included project SHALL appear once in its owner's ordered work. Stale sequence, ownership, rank, membership or relevant dependency information SHALL cause a conflict rather than overwrite intervening edits.

#### Scenario: Move between streams
- **WHEN** the planner transfers B into an eligible linked owner in another stream between X and Y
- **THEN** the destination owner contains X, B, Y and B leaves its prior owned queue
- **AND** both streams and all references reflect one committed mutation

#### Scenario: Another edit occurred during a drag
- **WHEN** a placement request became stale after assignment, ownership, rank, membership, order or relevant source/dependency changes
- **THEN** it fails with conflict and current planning information
- **AND** no intervening edit is overwritten

### Requirement: All assignment paths produce a valid sequence
Inclusion and ownership transfers without insertion targets SHALL append at the last dependency-valid position within the destination owner. Bulk inclusion SHALL require valid owners and use deterministic scoped dependency order, succeeding or failing as a unit. Repeating an already satisfied outcome placement or inclusion without an insertion target SHALL NOT reposition existing members.

#### Scenario: Assign a blocker to its successor's stream
- **WHEN** inclusion moves A into an outcome containing B and A blocks B
- **THEN** A is inserted at the last scoped position before B allowed by the effective dependency graph
- **AND** existing members retain relative order

#### Scenario: Repeat bulk outcome assignment
- **WHEN** an outcome is assigned again to its existing stream without an insertion target
- **THEN** its rank and existing project order remain unchanged
- **AND** candidate, deferred and dismissed links are not silently included

#### Scenario: Bulk placement cannot produce a valid order
- **WHEN** any incoming included project's owner or scoped constraints are invalid
- **THEN** the entire assignment is rejected with the blocking relationships or missing owners
- **AND** no subset moves

### Requirement: Effective dependencies constrain placement
Within one owner, included unfinished direct and transitive predecessors SHALL precede successors in scoped project order. Effective edges SHALL remain unwaived Linear edges plus local edges. Across owners, including in the same stream, rank SHALL NOT impose a precedence restriction; finish-to-start eligibility SHALL still apply. Dragging SHALL NOT create or waive dependencies.

#### Scenario: Direct blocker cannot follow blocked work
- **WHEN** A and B have one owner, A blocks B, and the planner places B before A
- **THEN** the move is rejected with A identified as the blocker
- **AND** A is not moved automatically

#### Scenario: Transitive blocker through another stream
- **WHEN** A blocks X, X blocks B, A and B have one owner, and X belongs to another stream
- **AND** the planner attempts to place B before A
- **THEN** the move is rejected with the A to X to B dependency path

#### Scenario: Dependencies across streams remain active
- **WHEN** B is the highest-priority eligible candidate in its stream but waits for A elsewhere
- **THEN** B cannot start until a cycle after A finishes
- **AND** an unfinished external, candidate, dismissed or deferred prerequisite prevents a finite dependent forecast

#### Scenario: Completed or waived relationships
- **WHEN** a predecessor is reconciled as actually complete or its Linear edge is explicitly waived
- **THEN** that relationship imposes no scoped queue-position restriction
- **AND** waivers remain visibly distinct from effective Linear dependencies

#### Scenario: Lower-ranked outcome owns the same-stream blocker
- **WHEN** higher-ranked outcome H owns B and lower-ranked L owns its prerequisite A in the same stream
- **THEN** the rank H before L is valid, B waits and eligible A can run
- **AND** the rank is not treated as a source order conflict

### Requirement: Source conflicts preserve user order
Sync or rebase SHALL preserve ranks and scoped project order. New within-owner precedence violations SHALL be actionable conflicts withholding unfinished dates for that owner until repaired; independent owners SHALL remain usable subject to dependencies. Repair moves SHALL reduce existing violations without introducing new ones. Cross-owner priority inversions SHALL be waits, not order conflicts. Effective dependency cycles SHALL remain invalid for forecasting.

#### Scenario: Sync introduces reverse precedence
- **WHEN** one owner's saved project order is B before A and sync reports A blocks B
- **THEN** saved order is retained with an actionable conflict and that owner's unfinished work has no finite dates until repaired
- **AND** otherwise valid owners remain usable subject to dependencies

#### Scenario: Repair several conflicts incrementally
- **WHEN** an owner has several source-introduced violations and a move reduces them without adding another
- **THEN** the move succeeds even if another violation remains
- **AND** dates return when the owner's order is valid

#### Scenario: Add a locally conflicting constraint
- **WHEN** adding a local edge or restoring a waiver would invalidate a valid within-owner project order
- **THEN** the edit is rejected with required precedence so the planner can reorder and retry
- **AND** a cross-owner dependency alone does not invalidate outcome rank

### Requirement: Scheduling selects eligible work by queue order
The scheduler SHALL carry unfinished work first, otherwise select at most one eligible project per free stream using required-delivery tier, owning outcome rank, scoped project order and stable ID. Required tier SHALL contain the effective closure of all minimum-required links; other included work SHALL be optional tier. Blocked work SHALL be skipped. Capacity conservation, independent stream concurrency and next-cycle unlocking SHALL remain unchanged.

#### Scenario: Stream honors sequence
- **WHEN** independent A and B are eligible in the same tier and owning outcome in that scoped order
- **THEN** A receives the next free cycle regardless of Linear priority
- **AND** B waits until a cycle after A finishes

#### Scenario: Legacy WIP does not allow overlap across outcomes
- **WHEN** a saved stream has WIP two and eligible projects in different outcomes
- **THEN** only the highest-priority eligible project starts
- **AND** the second cannot start until the cycle after the first finishes

#### Scenario: Different streams remain concurrent
- **WHEN** independent projects belong to different streams with available capacity
- **THEN** they can start in the same cycle without borrowing capacity across streams

#### Scenario: Blocked head does not idle independent work
- **WHEN** higher-ranked H waits for a prerequisite and lower-ranked L has eligible work
- **THEN** L can fill the free slot while H waits
- **AND** H is not assigned a start before the prerequisite completes

#### Scenario: Optional work yields to lower-ranked required work
- **WHEN** H has only unstarted optional-tier work and lower-ranked L has eligible required-tier work
- **THEN** L's required work is selected first
- **AND** already-started optional work is carried to completion rather than preempted

#### Scenario: Shared ownership does not inherit rank
- **WHEN** H requires A owned by lower-ranked L and another eligible owner M lies before L
- **THEN** A retains L's priority, and M's eligible same-tier work may run first
- **AND** no hidden priority donation or duplicate scheduling changes the chosen owners or ranks

### Requirement: Scenarios preserve sequencing semantics and history
New drafts and revisions SHALL store membership, outcome ranks and scoped project order with calculation version v5. Dirty detection and comparison SHALL distinguish these from source priority changes. Older editable drafts SHALL adapt with explicit conversion feedback and require saving under v5 before publication. Published legacy inputs, outputs and calculation versions SHALL remain unchanged.

#### Scenario: Round-trip an arranged draft
- **WHEN** the planner saves a v5 plan, changes the live Board and reloads that draft
- **THEN** its ranks, ownership, membership and scoped order are restored with visible source/stream reconciliation
- **AND** comparison identifies each kind of planning change

#### Scenario: Load a legacy editable draft
- **WHEN** a draft lacks ranks or membership, including one with retired rank/start/must-include controls
- **THEN** existing legacy adaptation runs before deterministic v5 conversion
- **AND** the notice explains ownerless candidates, outcome priority and excluded demand, while retired controls remain unapplied
- **AND** the persisted draft stays unchanged until explicitly saved

#### Scenario: Read a published legacy revision
- **WHEN** the planner views or compares a v0 through v4 published revision
- **THEN** its stored inputs, output and version remain intact without recalculation under v5
- **AND** comparison identifies the calculation-version difference

## ADDED Requirements

### Requirement: Outcome waits and priority bypass are explicit
Timeline/project dependency context SHALL identify unfinished effective prerequisites, their location or excluded state, and an inspection path. It SHALL remain outside the sticky outcome label. Accessible context SHALL explain priority bypass without promising completion order and distinguish dependency waits from missing estimates or capacity.

#### Scenario: Cross-stream prerequisite delays the highest outcome
- **WHEN** H's required successor waits for a shared prerequisite in another stream while L runs locally
- **THEN** H's timeline/project context identifies the named prerequisite and that lower-priority work can run while waiting
- **AND** the warning opens the prerequisite details without changing rank or ownership
- **AND** it remains understandable without color or drawn connectors

#### Scenario: Unresolved excluded prerequisite
- **WHEN** the prerequisite is unfinished and dismissed or only a candidate
- **THEN** the warning explains Include on roadmap and choose an owning outcome to obtain a forecast
- **AND** the dependent outcome has no finite completion date until that prerequisite is resolved
