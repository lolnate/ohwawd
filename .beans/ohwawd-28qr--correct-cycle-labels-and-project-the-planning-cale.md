---
# ohwawd-28qr
title: Correct cycle labels and project the planning calendar
status: completed
type: feature
priority: normal
created_at: 2026-10-20T22:08:53Z
updated_at: 2026-10-20T22:31:56Z
---

Fix the timeline week cycle labels against actual Linear-visible numbering and extend planning cycles beyond the imported calendar using Linear team cadence.

- [x] Verify cycle label source and configured duration/start/cooldown against current Linear data
- [x] Specify projected calendar, provenance and historical compatibility in OpenSpec
- [x] Implement consistent labels, timezone-safe projected cycles, forecast and UI integration
- [x] Verify numbering, projections, sync replacement, scenario history and full checks

## Diagnosis

The current cycle has internal number 26 but the visible Linear name Cycle 46. Timeline abbreviations read number directly, bypassing the shared label helper used elsewhere. Current team cadence: enabled, 1 week, Tuesday start (2), cooldown 0, America/New_York, 4 upcoming cycles. Last imported cycle is internal 29 / visible Cycle 49, ending 2026-11-24 local midnight.

OpenSpec source: openspec/changes/archive/2026-10-20-project-linear-cycle-calendar/ (proposal.md, design.md, tasks.md, and specs/cycle-calendar, specs/planning-timeline, specs/weekly-capacity). The user-requested extension explicitly supersedes the earlier imported-only horizon rule; v3 forecasts using projections will be provisional and old published revisions remain frozen.

## Implementation progress

Shared labels now honor visible Cycle names. A pure cadence extension preserves local boundary time, weekday/cooldown gaps, imported source precedence and synthetic/source separation. V3 forecasts and scenarios carry projected provenance; timeline, cards, outcome delivery and calendar explain provisional dates and view-only cycle exceptions. Documentation updated. Current checks: 63 backend tests, 23 browser tests, typecheck and strict change validation passed. Read-only localhost board check confirms C46–C49 imported, C50 onward projected (22 entries through 2027-04-27), and zero synthetic cache rows. Production build and closeout were subsequently completed as recorded below.

## Summary of Changes

Corrected compact labels to prefer visible Linear names (C46 rather than internal 26), including custom labels and numbered-name continuation. Added a pure cadence projection using configured duration, weekday, cooldown and timezone with DST-safe wall-clock boundaries. Resolved planning cycles are separate from actual source rows and get replaced by real imports. V3 forecasts, UI and comparisons identify projected dates as provisional; weekly/holiday capacity applies unchanged and projected cycle exceptions remain view-only. Preserved all old published snapshots and existing uncommitted Board/Outcomes organization work. Verification: 63 backend tests, 23 browser tests, a targeted scenario comparison workflow, typecheck, optimized production build, strict OpenSpec validation and whitespace checks passed. A read-only local check confirms 4 imported / 22 projected cycles, C46–C49 then C50 onward, and zero synthetic cache rows. Design/acceptance evidence: openspec/changes/archive/2026-10-20-project-linear-cycle-calendar/verification.md. No schema migration, dependency or remote write introduced.
