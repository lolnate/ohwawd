# Design

## Context

The cached first future cycle has internal ordinal 26 and name “Cycle 46”. Long labels already prefer the name; timeline abbreviations bypass that helper. Linear documents that numeric name suffixes continue into later cycles. The team is configured for weekly Tuesday cycles, no cooldown, in America/New_York. The installed SDK specifies duration and cooldown in weeks.

This changes the previous imported-calendar-only policy in `planning-timeline`; the user now explicitly requests projecting cycles beyond Linear's upcoming window.

## Goals / Non-Goals

Goals: consistent visible numbering, useful longer-range forecasts, DST-safe recurrence, explicit assumptions and immutable historical results.

Non-goals: creating Linear cycles, renumbering source data, projecting through known imported gaps, or enabling ID-based overrides on synthetic IDs.

## Decisions

1. **Labels:** keep `linearCycleLabel` as the canonical long label. Add a short helper that turns a visible `Cycle 46` into `C46`; custom names stay recognizable. Increment a trailing numeric name suffix for future names, preserving its prefix and padding. Internal ordinals still increment independently and remain identity/source metadata, never a substitute for an available visible name.
2. **Calendar extension:** a pure helper returns imported entries plus derived projected entries. Append only after the latest known boundary. Apply cooldown weeks, align the next start to the configured weekday, and use configured duration weeks. Keep the preceding known boundary's local time-of-day. Convert wall-clock dates through the team timezone rather than adding fixed elapsed milliseconds, so DST does not shift starts by an hour. Do not fill gaps between imported entries or override individually edited future cycles.
3. **Bounds and prerequisites:** generate enough future entries for the configured 1–104-cycle forecast horizon and at least the 26-week visible calendar. Require cycles enabled, a valid 1–8-week duration, a 0–6 weekday, nonnegative whole-week cooldown and a dated source anchor. If prerequisites are unavailable, retain the imported calendar and explain why extension is unavailable. Completed history can anchor recurrence when no future imported cycle exists.
4. **Identity and source precedence:** synthetic IDs use a projected namespace plus team/date identity. Never write them into `linear_cycle_cache`. Recompute from the current imported source on each board read; newly imported actual cycles replace any previous projection at that point. Keep `linearCycles`, current-cycle ID and `futureCycleIds` as actual source facts, with a separate resolved `planningCycles` collection and projection metadata.
5. **Calculation:** use the resolved planning calendar for v3 scheduling. Existing allocation, WIP, reserve, weekly availability and dependency rules apply equally. A package that uses a projected cycle is flagged calendar-projected and provisional; required outcomes inherit that provenance. Genuine missing cadence, dependency or unknown-scope blockers still prevent dates.
6. **UI:** use visible names consistently in week headers, cards, cycle explanations and date calendars. Mark projected cycle labels with an asterisk and explicit tooltip/legend, projected calendar bands and projected-date bar context. Date-calendar projections are view-only; use weekly controls for date-based availability. Replace the old imported-horizon stop messages with imported/projected counts and cadence explanation. Uncovered dates, including cooldowns, remain visibly distinct.
7. **History:** save resolved cycles, cadence/provenance and calculated output with v3 snapshots. Preserve all prior published JSON and versions. Loading an older editable draft retains its capacity/weekly inputs but explicitly upgrades calculation semantics on the next save; do not erase its weekly settings or silently rewrite its stored output. Rebase and comparison continue to show source and calendar/version differences.

## Risks / Trade-offs

- Future Linear configuration or individual dates may differ → mark derived dates provisional, prefer actual source on refresh and preserve old revisions.
- Custom names may not contain a sequence → retain custom actual names and use ordinary internal-number fallback for unnamed projections rather than inventing a custom naming convention.
- DST changes elapsed cycle hours → use local calendar arithmetic and test both spring/fall transitions.
- Source edits can create gaps → preserve those facts; do not claim capacity in cooldown or unsupported dates.

## Migration Plan

No SQL migration is required. Introduce v3 reads/calculations and adapt older editable snapshot shapes without touching published revisions. Verify the real C46–C49 sequence and projected C50 onward, test future-import replacement, run project checks, then reconcile the Bean/checklist and archive normally.

Reference: https://linear.app/docs/use-cycles (repeating cadence, cooldowns and numeric name continuation).
