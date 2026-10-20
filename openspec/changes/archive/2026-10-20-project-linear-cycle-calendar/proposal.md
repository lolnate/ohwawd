# Consistent cycle labels and a projected planning calendar

## Why

Week headers display Linear's internal ordinal even when its visible cycle name uses a different numbering sequence (26 versus “Cycle 46”). The four-cycle import window also prevents longer-range planning despite a known repeating team cadence.

## What Changes

- Use one label policy throughout the UI: preserve the Linear-visible name, abbreviating numbered Cycle names consistently and falling back to the internal ordinal only when no name exists.
- Extend the planning calendar beyond the last imported cycle using Linear's enabled state, duration, start weekday, cooldown and timezone. Preserve local boundary times across DST and increment numbered names.
- Distinguish synced and projected cycles. Real imports always supersede derived future entries; projections are never persisted as Linear source facts.
- **Behavior change:** v3 forecasts may use projected cycle capacity through the configured horizon. Dates depending on projected cycles are provisional and visibly identified.
- Keep weekly/holiday availability applicable to projected dates; keep ID-bound cycle overrides restricted to actual imported cycles.
- Preserve published earlier results and expose the calculation-version change in editable drafts/comparisons.

## Capabilities

### New Capabilities

- `cycle-calendar`: Visible labels, cadence-derived future cycles, source precedence, projected-date provenance and version compatibility.

### Modified Capabilities

- `planning-timeline`: Correct cycle context and distinguish projected coverage from truly unsupported gaps while allowing projected-date forecasts.
- `weekly-capacity`: Apply existing capacity rules to projected cycles and retain versioned scenario assumptions.

## Impact

Shared cycle helpers, pure projection logic, board/forecast/calendar UI, scenario version/adaptation, documentation and unit/database/browser tests. No new dependency, Linear write, schema migration or source-cache rewrite is needed. Execution: Bean `ohwawd-28qr`.
