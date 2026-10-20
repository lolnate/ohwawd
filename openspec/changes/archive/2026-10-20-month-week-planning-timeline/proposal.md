# Month/week planning timeline

## Why

Wide cycle columns obscure the month-to-month delivery picture and cannot show several months compactly. The user wants a month-first, week-subdivided schedule with reduced holiday capacity visible in the same view.

## What Changes

- Replace cycle-width stream tables with compact, horizontally scrollable month/week timelines, with sticky project labels and roughly 2–3 months visible on desktop.
- Keep Linear cycle labels and boundaries as supporting context; use actual imported cycle dates to position forecast bars.
- Show dependency context in timeline rows and preserve the queue's dependency-valid order. Show partial forecasts as continuing, without inventing completion dates.
- Highlight Thanksgiving week, Christmas week and the following week at 50% availability by default, with editable weekly overrides and a switch for the holiday preset.
- Apply weekly availability to cycle capacity using team-local working-day overlap, with explicit precedence over cycle availability on affected days.
- Save/compare these assumptions in v2 scenarios and preserve existing published results.
- Keep calendar weeks beyond Linear coverage visible but visibly unforecastable.

## Capabilities

### New Capabilities

- `planning-timeline`: Month/week schedule presentation, compact scrolling, cycle context, blocker context, partial bars and calendar coverage.
- `weekly-capacity`: Holiday defaults and weekly availability overrides, cycle overlap calculation, persistence and scenario compatibility.

### Modified Capabilities

None. The related Linear dependency import defect is tracked in Bean `ohwawd-d5v8` under the existing stream-sequencing specification.

## Impact

Board UI/styles, pure calendar helpers, forecast availability, board read/mutations, migration 4, scenario capture/activation/comparison, and calendar/forecast/browser tests. No new runtime dependency or Linear write is required. Execution is tracked in Bean `ohwawd-tlaq`.
