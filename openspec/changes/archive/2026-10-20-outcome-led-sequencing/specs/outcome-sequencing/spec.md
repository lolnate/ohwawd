# Outcome sequencing

## Purpose
Let planners sequence delivery by outcome while accounting for shared project capacity exactly once and inspecting the underlying project work.

## ADDED Requirements

### Requirement: Outcomes are assigned to streams
An outcome SHALL have zero or one active stream placement. An assigned outcome SHALL be a primary row in that stream, including when it has no projects. Assigning an outcome SHALL preserve existing ownership by other outcomes and the deferred state of linked projects.

#### Scenario: Assign an outcome containing shared work
- **WHEN** a planner assigns an outcome to a stream
- **THEN** its row appears there with every linked project
- **AND** selected ownerless linked projects are assigned to it, existing owned projects follow its stream, and projects owned by other outcomes remain references

### Requirement: Shared projects have one capacity owner
A project SHALL have at most one capacity-owning linked outcome and one capacity-owning stream. Its effort SHALL be charged once through its existing work package, regardless of appearances. Selected projects without an outcome owner SHALL remain charged in their actual stream under Other selected work.

#### Scenario: Same project contributes to three outcomes
- **WHEN** a selected 20-point project is linked to two outcomes in one stream and another outcome in a second stream
- **THEN** it appears in all three outcome rows
- **AND** only its owning outcome and stream count its 20 points; all references show zero points here
- **AND** the selected portfolio total includes 20 points once

### Requirement: Ownership can be changed explicitly
The planner SHALL be able to select any linked outcome with an active stream as the capacity owner of a selected project. Transfer SHALL atomically move its sole queue entry and capacity charge, preserve all links, and recalculate forecasts. Invalid dependency order and stale ownership or sequence edits SHALL be rejected without partial changes.

#### Scenario: Transfer a shared project across streams
- **WHEN** the planner selects a different linked outcome as owner
- **THEN** that outcome's block becomes counted and the previous owner's block becomes shared
- **AND** dependent projects use the recalculated single project forecast

#### Scenario: A stale browser attempts a transfer
- **WHEN** outcome placement, links, ownership or sequence changed since the displayed plan
- **THEN** the mutation is rejected and the current board is reloaded with an explanation

### Requirement: Ownership survives lifecycle changes coherently
Unlinking or deleting the owning outcome SHALL clear its project ownership without dropping the project's stream charge. Moving a project to another stream, Needs assignment, or Deferred SHALL clear incompatible ownership. Retiring a stream SHALL unassign its outcomes and preserve project migration choices. Saved scenarios SHALL retain and compare these planning choices without rewriting published revisions.

#### Scenario: Remove the owning link
- **WHEN** a project is unlinked from its capacity-owning outcome
- **THEN** its original stream retains the single charge in Other selected work and remaining outcome links display references

#### Scenario: Load an older scenario
- **WHEN** a draft lacks outcome stream and capacity-owner fields
- **THEN** deterministic placement inference preserves its original project stream, selection, and sequence
- **AND** published snapshot data remains unchanged

### Requirement: Project blocks reveal accounting and dependencies
Outcome rows SHALL show compact uniquely distinguishable project codes using actual forecast spans. Counted blocks SHALL be solid; shared references SHALL be outlined in a separate band, state zero points here, and identify the counted location. Overlapping projects SHALL remain individually accessible. Deferred, hidden, completed, optional, blocked and beyond-horizon work SHALL retain their explanatory state.

#### Scenario: Shared prerequisite blocks a local project
- **WHEN** a project owned in another stream is a predecessor of a project in this outcome
- **THEN** its reference uses the same forecast dates as its counted block
- **AND** the local project's dependency label and project details identify the prerequisite
- **AND** the outcome's required delivery still waits for the shared project without charging it again

### Requirement: Project details open from every appearance
Selecting a project block or project key SHALL open an accessible sidebar showing the full name, imported description/status/link, estimate basis, unknown scope, linked outcomes, capacity owner, and dependencies. It SHALL support ownership changes, existing scope and placement edits, dependency navigation, keyboard dismissal, and focus restoration.

#### Scenario: Inspect a reference and change its owner
- **WHEN** the planner opens an outlined project block
- **THEN** the sidebar identifies where its points count and offers eligible linked outcome owners
- **AND** saving a new owner updates every appearance and totals immediately
- **AND** closing or pressing Escape returns focus to the originating block or a stable board fallback
