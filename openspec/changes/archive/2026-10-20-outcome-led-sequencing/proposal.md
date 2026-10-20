# Outcome-led sequencing

## Why
The board currently makes projects the primary rows, obscuring the outcomes they deliver. Shared projects need to appear in every relevant outcome while retaining one explicit capacity owner.

## What Changes
- Assign outcomes to streams and display an outcome row containing its sequenced project blocks.
- Give each project at most one capacity-owning outcome; keep its single stream queue and forecast authoritative.
- Distinguish counted blocks from shared references and provide an immediate ownership switch.
- Open project details from compact, disambiguated project codes, including scope, estimates, dependencies, and ownership.
- Preserve unlinked, deferred, hidden, and unassigned work, and round-trip ownership through scenarios.

## Capabilities
### New Capabilities
- `outcome-sequencing`: Outcome stream placement, exclusive project capacity ownership, mirrored blocks, and project detail inspection.
### Modified Capabilities
- `planning-timeline`: Sticky outcome labels replace project labels as the primary timeline rows.

## Impact
Database migration, board mutations and payload, sequence moves, outcome link updates, stream retirement, scenario snapshots/comparison, timeline and modal drawer. No new dependencies. Existing cycle forecasting and its calculation version remain unchanged: additional project appearances are presentation references only.
