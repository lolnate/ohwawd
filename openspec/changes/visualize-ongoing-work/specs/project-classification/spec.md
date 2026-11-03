# Spec Delta

## Purpose

Classify imported Linear projects as finite Roadmap work or continuing Ongoing work while making ambiguous source labels visible and correctable.

## ADDED Requirements

### Requirement: Unambiguous Linear labels determine classification
The system SHALL classify a project as Roadmap when it has the `Roadmap` Linear project label and not `Ongoing`, and as Ongoing when it has `Ongoing` and not `Roadmap`. Matching SHALL use label identity without treating similarly named labels as equivalent.

#### Scenario: Roadmap label only
- **WHEN** a synchronized project has the Roadmap label and not the Ongoing label
- **THEN** its effective classification is Roadmap with Linear-label provenance

#### Scenario: Ongoing label only
- **WHEN** a synchronized project has the Ongoing label and not the Roadmap label
- **THEN** its effective classification is Ongoing with Linear-label provenance

#### Scenario: Similar label name
- **WHEN** a project has a label such as `Roadmap candidate` but neither configured classification label
- **THEN** the system treats its source labels as ambiguous rather than inferring Roadmap

### Requirement: Ambiguous labels use a saved local decision
When a project has both classification labels or neither label, the system SHALL use its saved Oh WAWD classification decision. Without a saved decision, its effective classification SHALL be unresolved and SHALL NOT be inferred from roadmap membership, status, dates, outcomes, or issue activity.

#### Scenario: Both labels with a saved decision
- **WHEN** a project has both labels and a saved Ongoing decision
- **THEN** its effective classification is Ongoing with local-decision provenance
- **AND** the interface identifies the conflicting Linear labels

#### Scenario: Neither label without a decision
- **WHEN** a project has neither label and no saved decision
- **THEN** its effective classification is unresolved
- **AND** the interface presents it under Needs classification

#### Scenario: User resolves an ambiguous project
- **WHEN** a user selects Roadmap or Ongoing for an unresolved project
- **THEN** the decision persists across refreshes while the source labels remain ambiguous
- **AND** affected Board views refresh from the new effective classification

### Requirement: Source labels regain authority when unambiguous
An unambiguous synchronized classification label SHALL determine effective classification even when an earlier local decision exists. The system SHALL retain enough provenance to explain that the source label currently controls the result.

#### Scenario: Linear resolves a prior conflict
- **WHEN** a project with a saved Ongoing decision later synchronizes with only the Roadmap label
- **THEN** its effective classification becomes Roadmap from Linear
- **AND** the stale local decision does not override the source

#### Scenario: Source becomes ambiguous again
- **WHEN** the same project later has both labels or neither label
- **THEN** its previously saved local decision becomes effective again

### Requirement: Classification decisions remain local and explicit
Until Linear writes are enabled, saving a classification SHALL NOT change Linear labels. The interface SHALL distinguish Linear-derived, locally decided, and unresolved classifications and SHALL explain label conflicts where users can resolve them.

#### Scenario: Save a local classification
- **WHEN** a user classifies an ambiguous project as Ongoing
- **THEN** Oh WAWD saves the local decision and reports it as local
- **AND** no Linear mutation is attempted

#### Scenario: Inspect conflicting labels
- **WHEN** a user inspects a project carrying both labels
- **THEN** the project view identifies both source labels and the effective local decision or unresolved state

### Requirement: Classification is available wherever projects are planned
Project lists, project inspection, and Board attention states SHALL expose effective classification and allow an authorized user to resolve ambiguous projects without hiding their current work evidence.

#### Scenario: Unresolved project has available work
- **WHEN** an unresolved project contains backlog or unstarted issues
- **THEN** its classification control and available-work evidence are reachable together
- **AND** the project is not silently placed in either classified total

#### Scenario: Classification save fails
- **WHEN** persistence rejects a classification decision
- **THEN** the prior effective classification remains active
- **AND** the interface retains the user's choice for retry and reports the failure

### Requirement: Existing roadmap planning is preserved during migration
When project classification is first enabled, projects already represented in the persisted roadmap model SHALL receive a saved local Roadmap decision before classification rules take effect. Projects imported after that migration SHALL follow normal label resolution and SHALL remain unresolved when ambiguous and undecided.

#### Scenario: Existing included project has no labels
- **WHEN** classification is enabled for an existing included project with neither classification label
- **THEN** it retains its roadmap placement through a migrated local Roadmap decision
- **AND** no stream demand or ownership is silently removed

#### Scenario: New unlabeled project arrives after migration
- **WHEN** a new project with neither label is imported after classification is enabled
- **THEN** it starts unresolved without roadmap membership or demand
