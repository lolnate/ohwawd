# Proposal

## Why

Oh WAWD currently models imported projects primarily as finite roadmap demand, leaving broad, continuing engineering work without a truthful home or a useful view of what can be pulled next and where recent effort went. Distinguishing Roadmap from Ongoing projects and exposing current and historical Ongoing work will make off-roadmap investment visible while encouraging planners to correct missing project assignments and classifications.

## What Changes

- Classify every imported project as Roadmap, Ongoing, or unresolved, using unambiguous Linear `Roadmap` and `Ongoing` project labels automatically and a saved Oh WAWD choice when both or neither label is present.
- Keep Ongoing projects outside stream scheduling, target-date expectations, and roadmap demand without treating them as dismissed work.
- Add an Ongoing work history matrix below the roadmap streams, showing completed issues by Ongoing project and completed Linear cycle, with issue-count and point views plus explicit Needs classification and No project rows.
- Reattribute completed work from its current Linear project during a 30-day correction window, then freeze its project and classification attribution for stable older history.
- Show the six most recent completed cycles initially while retaining older frozen history behind a Show older cycles control.
- Add an available-work view for Ongoing projects that separates ready unstarted work, blocked unstarted work, and backlog work, with issue counts, estimated points, unestimated counts, issue inspection, and a separate Needs classification group.
- Expand Linear synchronization to import project labels, team issues without projects, and issue blocker relationships, and to retain frozen historical attribution.
- Preserve read-only Linear integration for this change; writing corrected labels or issue assignments back to Linear remains future work.

## Capabilities

### New Capabilities
- `project-classification`: Resolve and persist Roadmap, Ongoing, and unresolved project classification from Linear labels and local decisions, including source provenance and ambiguous cases.
- `ongoing-work-insights`: Present current available Ongoing work and cycle-based completed-work history with correction-window attribution, frozen history, attention groups, and issue-level inspection.

### Modified Capabilities
- `project-assignment`: Keep Ongoing projects outside roadmap membership, ownership, sequencing, and forecast demand without representing them as dismissed roadmap projects.

## Impact

- Linear GraphQL reads and import reconciliation must cover project labels, team-level attached and unattached issues, and issue blocking relations.
- PostgreSQL source caches and planning schema must store classification decisions and provenance, blocker edges, and frozen historical attribution.
- Board API state and Board UI gain Ongoing history and available-work data beneath the existing stream timelines.
- Project inspection and classification controls gain unresolved-state feedback and local read-only decisions.
- Import, migration, Board, classification, attribution, accessibility, and responsive UI tests require new coverage. No new external dependency is expected.
