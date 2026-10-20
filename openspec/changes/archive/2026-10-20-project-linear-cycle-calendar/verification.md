# Verification

Execution: Bean `ohwawd-28qr`. The separate uncommitted Board/Outcomes organization work is preserved.

## Requirement evidence

| Capability / requirement | Evidence |
| --- | --- |
| Cycle labels preserve Linear-visible naming | Shared long/short helpers; cycle-projection tests cover ordinal 26 / visible Cycle 46, unnamed/custom cycles and padded suffixes. Browser test deliberately mismatches source ordinals and visible names. |
| Future cycles follow configured cadence | Pure projection tests cover weekly Tuesday recurrence, two-week duration with cooldown, completed-history anchors, and spring/fall DST. Live data resolves C50 after imported C49. |
| Imported source remains authoritative | Projection and database board tests verify actual-date preservation, future import replacement, no duplicate projected/actual entries and zero synthetic source-cache rows. Invalid/disabled cadence returns available actual cycles and a reason. |
| Projected dates have visible provenance | Forecast tests flag projected packages/outcomes provisional. Browser tests verify asterisk labels, projected bands, view-only cycle-calendar dates, editable weekly holiday capacity and outcome provenance. |
| Calendar projection preserves scenario history | Scenario tests save resolved v3 cycles/cadence, keep source snapshots actual-only, compare v2/v3 and assert the old published JSON is unchanged. Prior legacy and weekly round-trips also pass. |
| Month and week calendar headers | Timeline uses shared compact labels and exact-date/projection tooltips. Browser offset regression verifies C46 rather than the internal ordinal and C50 onward after only four imports. |
| Honest date and dependency presentation | Browser test verifies provisional projected delivery, continuing bars bounded by the planning horizon, and successor blocker explanations without premature dates. |
| Visible unsupported calendar coverage | Projected coverage has its own legend/bands; disabled-cadence browser test retains unsupported future weeks and explains the missing enabled cadence. Cooldown unit tests preserve no-capacity intervals. |
| Weekly capacity maps to imported cycles | Existing capacity math now receives resolved cycles; projection forecast test verifies Thanksgiving weighting and reserve on projected C50. Browser holiday override changes actual projected-cycle availability. |
| Weekly assumptions are scenario-safe | v3 snapshot tests preserve weekly settings, pre-weekly holiday-free adaptation, frozen v2 results and resolved projection metadata. |

## Checks

- `npm test`: 63 passed.
- `npm run test:ui`: 23 passed, including touch/responsive and cross-tab organization regressions.
- `npm run typecheck`: passed.
- Strict change validation and `git diff --check`: passed.
- Read-only localhost check: v3; four imported future cycles C46–C49, 22 projected cycles through April 27, 2027; first C50 starts November 24, 2026 at 00:00 America/New_York; no projected rows in `linear_cycle_cache`.
- `npm run build`: passed, including optimized compilation, type checks and static generation. The scenario save/compare/publish browser workflow also passed after comparison provenance labels were added.
- No migration or remote write is required. Final archive validation is recorded with execution closeout.
