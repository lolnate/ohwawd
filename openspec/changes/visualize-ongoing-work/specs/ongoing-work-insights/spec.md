# Spec Delta

## Purpose

Show which continuing engineering work is available to pull and how recently completed effort is distributed across Ongoing projects and Linear cycles.

## ADDED Requirements

### Requirement: Available work uses actionable source buckets
The Board SHALL summarize current Ongoing project issues in mutually exclusive Ready, Blocked, and Backlog buckets. Ready SHALL contain `unstarted` issues without unresolved blockers, Blocked SHALL contain `unstarted` issues with an unresolved blocker, and Backlog SHALL contain `backlog` issues.

#### Scenario: Unblocked unstarted issue
- **WHEN** an Ongoing project issue has workflow type `unstarted` and no unresolved blocking issue
- **THEN** it contributes once to Ready

#### Scenario: Blocked unstarted issue
- **WHEN** an Ongoing project issue has workflow type `unstarted` and at least one blocking issue that is not completed or canceled
- **THEN** it contributes once to Blocked and not to Ready

#### Scenario: Backlog issue
- **WHEN** an Ongoing project issue has workflow type `backlog`
- **THEN** it contributes once to Backlog and not to Ready or Blocked

#### Scenario: Started and terminal issues
- **WHEN** an issue is started, completed, or canceled
- **THEN** it does not contribute to available-work totals
- **AND** started issue count may appear only as secondary in-progress context

### Requirement: Available work preserves estimation uncertainty
Each available-work bucket SHALL show issue count and estimated points while separately identifying unestimated issues. Bar geometry and default ordering SHALL use issue count so missing estimates do not make work disappear.

#### Scenario: Mixed estimated and unestimated work
- **WHEN** a Ready bucket contains three issues totaling five known points and one issue has no estimate
- **THEN** the view reports three issues, five estimated points, and one unestimated issue
- **AND** all three issues contribute equally to the Ready bar length

#### Scenario: Default project order
- **WHEN** several Ongoing projects contain available work
- **THEN** projects with more Ready issues appear before projects with fewer Ready issues
- **AND** projects with no Ready issues remain visible below pullable work

### Requirement: Available work separates unresolved project classification
Projects with unresolved Roadmap/Ongoing classification SHALL appear in a separate Needs classification group with the same work buckets. Their issues SHALL NOT contribute to Ongoing totals until classification is resolved.

#### Scenario: Ambiguous project with unstarted work
- **WHEN** an unresolved project has unstarted and backlog issues
- **THEN** its row appears under Needs classification with the applicable bucket counts
- **AND** resolving its classification refreshes its placement and totals

#### Scenario: Roadmap project
- **WHEN** a project is effectively classified Roadmap
- **THEN** it does not appear in Ongoing available-work rows or totals

### Requirement: Available-work segments support issue inspection
Each nonempty work segment SHALL let users inspect its contributing issues, including identifier, title, estimate state, source workflow state, and unresolved blocker context. Source-changing actions SHALL direct users to Linear while integration remains read-only.

#### Scenario: Inspect blocked work
- **WHEN** a user opens a project's Blocked segment
- **THEN** the interface lists each blocked issue and its unresolved blockers
- **AND** provides source links without attempting a Linear write

#### Scenario: Keyboard inspection
- **WHEN** a keyboard user focuses and activates a nonempty segment
- **THEN** the same contributing issue evidence is available without relying on bar color or hover

### Requirement: Completed work is grouped by actual Linear cycle
The Board SHALL present a history matrix below roadmap streams with Ongoing project rows and completed imported Linear cycle columns. A completed issue SHALL contribute to the actual cycle whose source date interval contains its completion timestamp.

#### Scenario: Completed issue in a cycle
- **WHEN** an issue completed within an imported completed cycle is attributed to an Ongoing project
- **THEN** it contributes once to that project and cycle intersection

#### Scenario: Projected and incomplete cycles
- **WHEN** the planning calendar contains projected or incomplete cycles
- **THEN** those cycles do not appear as completed-history columns

#### Scenario: Completion outside imported cycle coverage
- **WHEN** a completed issue timestamp does not fall within an imported completed cycle
- **THEN** the matrix does not invent a cycle assignment
- **AND** the view discloses that some completed work lacks cycle coverage when such work exists

### Requirement: Recent history follows current project classification
Until 30 days after completion, synchronized completed work SHALL be attributed from the issue's current Linear project and that project's current effective classification. A later sync or local classification correction SHALL immediately refresh recent matrix placement.

#### Scenario: Recent issue is moved to another Ongoing project
- **WHEN** an issue completed fewer than 30 days ago synchronizes with a different current Ongoing project
- **THEN** its contribution moves from the prior project row to the current project row

#### Scenario: Recent issue loses its project
- **WHEN** a recently completed issue synchronizes without a project
- **THEN** its contribution appears in the No project attention row

#### Scenario: Recent project is unresolved
- **WHEN** a recently completed issue belongs to a project with unresolved classification
- **THEN** its contribution appears in the Needs classification attention row

#### Scenario: Recent project becomes Roadmap
- **WHEN** the current project for a recent completed issue becomes effectively Roadmap
- **THEN** the issue no longer contributes to Ongoing history or its attention rows

### Requirement: Older history has frozen attribution
At the first successful synchronization on or after 30 days from completion, the system SHALL freeze the issue's current project identity and effective classification for historical reporting. Later project moves or classification changes SHALL NOT rewrite that frozen attribution.

#### Scenario: Issue crosses the correction boundary
- **WHEN** a completed issue is at least 30 days old during a successful synchronization
- **THEN** its current project and classification attribution are frozen

#### Scenario: Frozen issue later moves
- **WHEN** a frozen issue later synchronizes under another project
- **THEN** its historical matrix contribution remains under the frozen project attribution

#### Scenario: Existing old history is first migrated
- **WHEN** the capability is enabled with issues already at least 30 days old
- **THEN** their currently imported project and effective classification become the initial frozen attribution
- **AND** the migration does not claim an unavailable past assignment

### Requirement: History highlights correctable attribution gaps
The matrix SHALL include distinct Needs classification and No project rows for applicable recent or frozen attribution. These rows SHALL be visually and textually identifiable as attention states rather than ordinary Ongoing projects.

#### Scenario: Inspect no-project history
- **WHEN** a user activates a No project cell
- **THEN** the interface lists its completed issues and provides links for assigning them in Linear

#### Scenario: Inspect unresolved classification history
- **WHEN** a user activates a Needs classification cell
- **THEN** the interface lists contributing projects and issues
- **AND** provides access to the Oh WAWD classification control

### Requirement: History supports comparable counts and points
Every history cell SHALL show its numeric issue count and use a global intensity scale as a secondary cue. Users SHALL be able to switch to estimated points without losing issue and unestimated-work context.

#### Scenario: Default history metric
- **WHEN** the history matrix first loads
- **THEN** issue count is the active metric and each populated cell exposes its exact count

#### Scenario: Switch to points
- **WHEN** a user selects Points
- **THEN** cell values and intensity use summed known estimates
- **AND** cell inspection retains total issue and unestimated issue counts

#### Scenario: Nonvisual interpretation
- **WHEN** color is unavailable or a screen reader is used
- **THEN** project, cycle, metric value, issue count, and estimation uncertainty remain available as text

### Requirement: Recent history is concise without discarding older evidence
The matrix SHALL initially show the six most recent completed cycles and SHALL retain older frozen history. A Show older cycles control SHALL reveal earlier columns in the same history view without changing attribution or totals.

#### Scenario: More than six completed cycles exist
- **WHEN** the Board first renders with more than six completed cycles
- **THEN** only the six most recent are shown
- **AND** Show older cycles is available

#### Scenario: Reveal older cycles
- **WHEN** a user activates Show older cycles
- **THEN** earlier retained cycles become available in chronological alignment
- **AND** the existing recent columns and values remain unchanged

### Requirement: Ongoing insights remain distinct from roadmap scheduling
The available-work summary and history matrix SHALL appear as a separate Ongoing work section below active roadmap stream timelines. Their geometry, counts, and colors SHALL NOT imply stream capacity, forecast dates, targets, or roadmap ownership.

#### Scenario: Board contains both project classes
- **WHEN** Roadmap and Ongoing projects are present
- **THEN** roadmap timelines continue to show finite scheduled work
- **AND** Ongoing work appears below them in the separate insight views

#### Scenario: Narrow viewport
- **WHEN** the Board is viewed at a narrow width
- **THEN** project labels, exact values, metric controls, attention rows, and issue inspection remain reachable without page-level horizontal overflow
