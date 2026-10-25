# Outcome sequencing delta

## MODIFIED Requirements

### Requirement: Outcomes are assigned to streams
An outcome SHALL have zero or one active stream placement and a unique persistent rank within its stream. Assigned outcomes SHALL be primary rows, including empty outcomes. Moving an outcome SHALL move its owned included projects atomically, preserve other owners and deferred/dismissed states, and append it in the destination unless an explicit insertion position is supplied. Same-stream assignment without an insertion target SHALL preserve rank.

#### Scenario: Assign an outcome containing shared work
- **WHEN** a planner assigns an outcome to a stream
- **THEN** its row appears there with every linked project and immediate-prerequisite reference
- **AND** its owned included projects follow its stream while projects owned by other outcomes remain references
- **AND** candidate, dismissed and deferred projects are not silently included

#### Scenario: Move to a different stream
- **WHEN** an outcome moves from Core to Delivery without an insertion target
- **THEN** it becomes the last ranked outcome in Delivery and remaining ranks are normalized
- **AND** all owned included projects move once while shared references retain their actual owning dates

### Requirement: Shared projects have one capacity owner
Every included roadmap project SHALL have exactly one capacity-owning linked outcome in an active stream, and its sole capacity stream SHALL match that outcome. Effort SHALL be charged once through its existing work package regardless of appearances. Candidate, deferred and dismissed projects SHALL consume no future capacity. Ownerless projects SHALL NOT remain charged under Other selected work.

#### Scenario: Same project contributes to three outcomes
- **WHEN** an included 20-point project is linked to two outcomes in one stream and another outcome in a second stream
- **THEN** it appears in all three outcome rows
- **AND** only its owning outcome and stream count its 20 points; all references show zero points here
- **AND** the included portfolio total includes 20 points once

#### Scenario: Attempt ownerless inclusion
- **WHEN** a request includes a project in an active stream without a linked owning outcome in that stream
- **THEN** it is rejected atomically with a Choose owning outcome explanation

### Requirement: Ownership can be changed explicitly
The planner SHALL be able to select any linked outcome in an active stream as the owner of an included project. Transfer SHALL atomically move its sole charge and insert it at the last dependency-valid position within the new owner's project order unless explicitly positioned. All links SHALL remain. Invalid scoped dependency order and stale placement, ownership, rank or membership edits SHALL be rejected without partial changes.

#### Scenario: Transfer a shared project across streams
- **WHEN** the planner selects a different linked outcome as owner
- **THEN** that outcome's block becomes counted and the previous owner's block becomes shared
- **AND** dependent projects use the recalculated single project forecast and the destination owner's priority

#### Scenario: A stale browser attempts a transfer
- **WHEN** outcome placement, rank, links, ownership, membership or sequence changed since the displayed plan
- **THEN** the mutation is rejected and the current board is reloaded with an explanation

### Requirement: Ownership survives lifecycle changes coherently
Removing an owning link, deleting or unassigning its outcome SHALL move affected included projects to Needs assignment as excluded candidates, retaining other links and scope. No replacement owner SHALL be guessed. Deferred/dismissed work SHALL retain its excluded state. Cross-stream project moves SHALL require a valid destination owner. Stream retirement SHALL atomically migrate outcomes and their owned work together or unassign both coherently.

#### Scenario: Remove the owning link
- **WHEN** a project is unlinked from its capacity-owning outcome
- **THEN** it becomes an excluded candidate with no owner or stream and visible Needs assignment feedback
- **AND** remaining outcome links display unresolved references until the project is included with an owner again or actually complete

#### Scenario: Load an older scenario
- **WHEN** a draft lacks current roadmap membership or outcome rank fields
- **THEN** editable conversion preserves valid existing ownership and derives deterministic ranks
- **AND** an ownerless selected project is claimed only when it has exactly one eligible linked owner in its existing stream; otherwise it becomes an excluded Needs assignment candidate with feedback
- **AND** published snapshot data remains unchanged

#### Scenario: Retire a stream
- **WHEN** a stream is retired with outcomes assigned to it
- **THEN** a destination moves those outcomes in source rank order to the destination tail with their owned included work
- **AND** retirement without a destination unassigns the outcomes and makes their included projects excluded candidates
- **AND** the whole mutation succeeds or fails together

### Requirement: Project blocks reveal accounting and dependencies
Outcome rows SHALL show direct links plus deduplicated immediate prerequisites of those linked projects using the effective graph. Derived references SHALL NOT add saved links or charges or recursively expand deeper levels. Counted blocks SHALL be solid; references SHALL use the established dashed outline and identify their counted location or excluded state. All appearances SHALL use the same package forecast and retain explanatory work states.

#### Scenario: Shared prerequisite blocks a local project
- **WHEN** a project owned in another stream is an immediate predecessor of a linked project in this outcome
- **THEN** a derived reference appears even without an explicit link, using the counted block's forecast dates
- **AND** labels and project details identify the prerequisite and local dependency
- **AND** required delivery waits for its effective closure without charging the reference again

#### Scenario: Deduplicate direct and implicit appearances
- **WHEN** two linked projects share a prerequisite that is also explicitly linked
- **THEN** that prerequisite appears once in the outcome row with both saved-link and prerequisite context
- **AND** its own unlinked predecessor is not automatically expanded into another box

#### Scenario: Optional-only contribution remains optional
- **WHEN** an optional linked project has a prerequisite but neither lies in the required delivery closure
- **THEN** its reference remains visible as optional context without gating delivery or promoting its demand to required work

### Requirement: Project details open from every appearance
Selecting a project block SHALL open the project sidebar with imported facts, estimate basis, linked outcomes, capacity owner, roadmap membership and effective dependencies. It SHALL support ownership, scope, membership and scoped placement edits, dependency navigation, keyboard dismissal and focus restoration. Derived references SHALL offer the same inspection and explicit Include on roadmap action when needed.

#### Scenario: Inspect a reference and change its owner
- **WHEN** the planner opens an outlined included project block
- **THEN** the sidebar identifies where its points count and offers eligible linked outcome owners
- **AND** saving a new owner updates every appearance and totals immediately
- **AND** closing or pressing Escape returns focus to the originating block or a stable board fallback

#### Scenario: Inspect an off-roadmap prerequisite
- **WHEN** a derived reference represents an unfinished dismissed project
- **THEN** inspection explains that it must be included with an owning outcome to obtain a dependent forecast
- **AND** inspection alone creates no link, owner or demand

## ADDED Requirements

### Requirement: Outcome priority has accessible reorder controls
Outcome rows SHALL support drag/drop, up/down keyboard controls and explicit before/after insertion controls for equivalent rank and stream moves. Every path SHALL apply identical atomic validation and stale-write protection, retain usable focus and announce the result. Outcome rank SHALL represent priority among eligible work, not a dependency or a guaranteed finish order.

#### Scenario: Reorder without dragging
- **WHEN** the planner moves an outcome before another using touch or keyboard controls
- **THEN** its persisted rank, visible row order and scheduling preference match the equivalent drop
- **AND** reload preserves the order without changing project links or source priority

#### Scenario: Lower-ranked owner supplies a higher-ranked prerequisite
- **WHEN** a higher-ranked outcome waits for a project owned by a lower-ranked outcome
- **THEN** the saved ranks remain unchanged and dependency-safe scheduling can select eligible lower-ranked work
- **AND** the higher-ranked row explains the prerequisite and that priority does not guarantee finish order

### Requirement: Outcome titles open the shared outcome workspace
Board outcome titles SHALL open saved Details in the same outcome sidebar used by catalog and delivery titles. Reorder handles SHALL be separate from title controls. Opening SHALL retain Board scroll and rank context; dismissal SHALL restore the title or a stable stream heading. Project and outcome sidebars SHALL NOT be stacked.

#### Scenario: Inspect lifecycle from Board
- **WHEN** the planner activates an outcome title on Board
- **THEN** the unified outcome sidebar opens by stable ID with Details selected and its heading focused
- **AND** closing returns to the Board title without changing outcome rank or active workspace view
