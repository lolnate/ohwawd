# Scenario v5 compatibility and frozen history

Task: **ohwawd-mg25** under **ohwawd-5q71**. Requirements/design: `openspec/changes/archive/2026-10-25-implement-outcome-first-board/specs/stream-sequencing/spec.md`, `specs/outcome-lifecycle/spec.md` and design Decisions 6 and 8.

## Current version and publication

Activated roadmap Board reads and new scenario captures use **v5**. Publication accepts a saved v5 draft after the existing edit-version, forecast-setup, source/retired-stream and unsaved-planning checks pass. The temporary `v5-pending` label/publication pause is retired. Pre-activation compatibility fixtures retain v4 behavior; the normal migration 7 activation selects the v5 path.

Published revisions freeze the **saved draft**: inputs, source snapshot, forecast output, calculation version and displayed lifecycle evidence. A business completion after saving does not dirty scheduling inputs or get injected into publication. Explicit Save board captures the latest lifecycle display if desired. Viewing/comparing a published revision never recalculates its dates or fills historical lifecycle fields from current business records.

## Planning fields and dirty detection

V5 capture, activation, scheduling fingerprints and comparisons retain:

- Per-stream outcome rank and placement.
- Project candidate/included/deferred/dismissed membership, exclusive linked owner and scoped sequence.
- Required/optional links, scope budgets, dependencies/waivers and existing capacity/calendar settings.
- Managed outcome roster and deliberate definition omissions.

These changes are distinct from read-only Linear priority. Lifecycle marker/readiness/review fields and evaluation-clock changes are not scheduling-dirty inputs. New imported candidates alone are source changes, not local planning edits; explicit dismissal/inclusion/deferral or scope edits to later-imported work are detected. A changed source still requires the normal reviewed rebase or explicit older-source publication choice.

## Editable legacy conversion

V0–v4 and interim pending editable drafts receive explicit v5 conversion guidance. Loading uses prior scope/weekly adapters and then conservative roadmap conversion, without the old arbitrary earliest-owner inference:

- Valid existing ownership stays intact. Selected ownerless work is inferred only when exactly one eligible linked outcome matches its existing stream; otherwise it becomes an excluded Needs assignment candidate with prior-stream/eligible-owner feedback.
- Outcome ranks seed the previous displayed preference; scoped sequence, valid deferred context, Extra scope and optional pause notes survive. V0 allowance conversion retains its established remaining-budget math and seeds legacy queue preference once; retired controls are not current scheduling inputs.
- Current source remains current. Missing/retired stream references reject with reconciliation guidance rather than producing ownerless included work. Current source-introduced scoped conflicts are reported without silently reordering work.

Loading leaves stored draft JSON/edit version untouched. Explicit Save board or acceptance of a reviewed rebase persists the v5 snapshot before publication. Stream configuration edits can update the working Board, but cannot silently convert an old saved draft through autosave. Loaded-plan feedback names inferred/excluded work and reports scoped dependency conflicts and managed omissions.

## Managed outcome definitions and omission alternatives

Each v5 snapshot records `outcomeCatalogIds`: the definitions the working draft has captured or managed. Capture merges that prior active roster with current definitions so deliberate deletion can be saved as an omission alternative.

On activation:

1. Restore saved definitions and planning inputs, preserving current source and independent business history.
2. Remove only managed IDs absent from the draft's definitions, first converting included owned work to excluded candidates and clearing invalid deferred return context.
3. Preserve newer unrelated outcomes outside that roster. Legacy snapshots without a roster infer no historical deletion.

Comparisons show managed scope explicitly, including a roster-only change: saved definition, managed omission/history retained, or outside draft scope. This makes omission behavior visible even when forecasts otherwise match.

Completion records/events survive definition removal. Removing a completed definition—manually or via a managed omission—latches review for the removed scope while retaining its completion time. Restoring the stable ID retains that review until explicit reopen and uses its saved creation timestamp, keeping identity and catalog date sorting honest. Absent definitions never reappear in the catalog solely because history exists. The same transaction covers owner cleanup, definition removal and review audit; audit failure rolls the whole action back.

## Frozen lifecycle comparison

Scenario comparison displays saved lifecycle evidence separately from planning/forecast deltas:

- Saved open/ready/not-ready state or completion time.
- Saved completion-review state/reasons and expandable saved readiness reasons.
- **Lifecycle not recorded** when older snapshot fields are absent; absent definitions remain distinguishable from recorded open outcomes.

The display comes from each snapshot, including v0–v4 history, rather than today's source/status/clock or manual marker. Loading a draft never restores historical lifecycle fields into live business storage. Final restored required scope re-evaluates live review state through the completion service.

## Verification evidence

`tests/scenarios-v5.test.ts` covers v5 round-trips and publication; v0–v4 conversion and byte-equivalent frozen history; planning versus lifecycle cleanliness; omission/removal/return with newer unrelated definitions; source rebase and later-imported candidate semantics; retired-stream rejection/restore; and legacy stream-autosave preservation. Completion audit rollback also covers definition deletion.

`tests/ui/scenarios-v5.spec.ts` exercises v5 save/publish/compare, named legacy conversion feedback and explicit-save gating, and frozen lifecycle display after live reopening. The 390px comparison screenshot is generated under the test's Playwright `test-results/` directory. The phone view was inspected: long conversion/forecast explanations wrap within the existing panels, outcome ranks and membership transitions are readable, and historical lifecycle labels remain distinct with no page-level horizontal overflow. This is an agent-operated review, not a planner usability study.

Verified results: typecheck, **135 unit/database tests** (including eight new scenario-adoption cases), production build, the full **89-case browser suite** (`npm run test:ui -- --workers=4`), strict current-spec/change and seven-archive validation, and whitespace checks passed. Follow-up targeted scenario/completion browser checks passed after removal-review reconciliation was finalized. Existing local/remote databases were not migrated during this task.
