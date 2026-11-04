# Proposal

## Why

Board timeline bars always show generated project codes even when their truthful forecast width has ample room for a recognizable project name. This makes the primary planning surface harder to scan and forces unnecessary tooltip or drawer use for projects that could identify themselves directly.

## What Changes

- Prefer the full imported project name inside a finite timeline bar when the available name slot can display it.
- Let a useful-width name slot ellipsize the project name while preserving the existing concise planning suffixes.
- Fall back to the stable generated project code when the bar is too narrow to show a useful project name.
- Re-evaluate the visible label when bar geometry, fixed suffix content, fonts, or viewport size changes without altering forecast geometry or pointer-target behavior.
- Preserve the full project name, code, accounting state, dependency context, and schedule details in the control's accessible name and tooltip regardless of its visible label.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `planning-timeline`: Require adaptive full-name, ellipsized-name, and mnemonic-code labels for finite project bars while preserving compact context, accessibility, and truthful schedule geometry.

## Impact

- `src/app/stream-timeline.tsx` gains adaptive visible-label behavior for finite timeline bars.
- Timeline styles must expose separately measurable name and fixed-context slots without changing bar dimensions.
- Focused unit and Playwright coverage will exercise fitting thresholds, resize updates, narrow bars, fixed suffixes, accessible names, and existing geometry.
- No persistence, API, forecast, or external dependency changes are expected.
