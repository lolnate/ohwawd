# Board design validation — streams, outcomes and projects

Date: 25 October 2026. Review Bean: **ohwawd-jpzr**. Draft specification follow-up: **ohwawd-a5j9**.

## Scope and conclusion

Compared the current OpenSpec requirements, scheduling contract, product design, Board implementation and existing tests with `/Users/nate/Obsidian/Personal/Projects/Oh WAWD/Stream and Outcome Design.md`, plus the author's clarification answers during this review.

The existing single-project/single-capacity-owner foundation supports the intended model. Shared dates, conserved capacity, finish-to-start dependencies, additive estimates, and ownership/stream transfers are implemented. The principal changes are **outcome-priority scheduling and controls, immediate-prerequisite visualization, explicit waiting warnings, mandatory outcome ownership for roadmap work, off-roadmap exclusion, dependency connectors, and manual outcome completion**.

Several differences are changes to previously accepted behavior, rather than implementation failures against the existing specifications. This review records the clarified direction; it does not replace normative OpenSpec requirements or claim that the gaps are implemented.

## Clarifications confirmed by the author

1. **Roadmap ownership:** every project assigned to the primary Board must have one owning outcome. A single-project outcome is valid. Engineering projects outside this planning roadmap do not need an outcome merely because they exist in Linear.
2. **Off-roadmap dismissal:** dismissed projects contribute no individually scheduled demand. Use capacity assumptions/reserve to account for Engineering work outside the roadmap.
3. **Dismissed prerequisites:** an unfinished off-roadmap prerequisite must be brought onto the roadmap and assigned an owning outcome to obtain a dependent forecast. Until then, explain the unresolved dependency; dismissal does not satisfy it.
4. **Outcome priority:** top-to-bottom outcome order should prioritize scheduling. If a higher outcome waits on a shared prerequisite, schedule the next eligible outcome and visibly warn about that prerequisite. Priority therefore does not guarantee that outcomes finish in rank order.
5. **Prerequisite visibility:** automatically show immediate prerequisites, even without explicit outcome links. Do not automatically expand every transitive level into the timeline row. Deeper effective dependencies still constrain delivery.
6. **Required/Optional remains:** required links and their effective prerequisites gate delivery; other optional projects do not. A shared appearance alone does not make an otherwise optional contribution required.
7. **Outcome completion is manual:** users explicitly mark an outcome complete, and may do so only after its required projects and their effective prerequisites are actually complete. Forecast dates alone do not establish completion; optional work does not gate it.

The source note's wording “drawn AFTER the dependent outcome” is interpreted as “drawn after the prerequisite project finishes,” consistent with its finish-to-start rule.

## Behavior comparison

| Clarified behavior | Current documented design | Implemented behavior | Assessment |
| --- | --- | --- | --- |
| A dependent project cannot start before its prerequisite finishes | Finish-to-start, including across streams | Starts in a later cycle after prerequisite completion | Aligned; current precision is whole cycles, not within-cycle dates |
| A project executes in one stream and one owning outcome, with references elsewhere | One nullable outcome owner and one capacity stream; ownerless selected work explicitly allowed | One work package and charge, with ownerless work under Other selected work | Foundation aligned; roadmap ownership must become mandatory |
| Primary solid block; shared dotted reference at the same dates | Solid counted blocks, outlined references, separate shared band | Same forecast span everywhere; references use dashed borders | Semantics and date alignment aligned; literal dotted border differs |
| Projects required by an outcome are visible, including immediate prerequisites of its projects | Explicit linked appearances; dependency-aware delivery | Row builder includes direct outcome links only | Missing automatic immediate-prerequisite appearances |
| Shared prerequisites gate local successors and required outcome delivery | Required work's effective dependency closure gates delivery | Cross-stream dependency checks and closure are implemented | Scheduling aligned; prerequisite boxes can be absent from the row |
| Independent shared work can overlap local work without consuming local capacity | References carry zero local points | One owning-stream simulation; no additional charge from references | Aligned; a same-stream reference still follows that stream's one-project execution rule |
| Duration follows the working stream's capacity and combined estimate | Open estimated Linear issues plus remaining Extra scope | Capacity simulation includes reserve, allocation and calendar availability | Aligned; Extra scope is additive, not a replacement total estimate |
| Thin flexible dependency connectors, including shared prerequisites | Existing design deliberately uses project codes and drawer navigation instead of an arrow overlay | Textual predecessor codes and clickable dependency navigation; no drawn connectors | Design and implementation change required |
| Outcome rows run top-to-bottom in user-defined delivery priority | Project queue, rather than an outcome queue, controls scheduling | Outcomes are fetched newest-created first and rendered in that order; scheduler never receives outcome rank | Missing persistent outcome priority and its scheduling effect |
| Reorder outcomes with drag/drop and before/after controls | Accessible reorder controls apply to projects | Project controls exist inside Manage work; outcome rows have no move controls | Missing at outcome level |
| Higher-priority outcome waiting on shared work yields to the next eligible outcome, with a warning | Scheduler skips blocked project queue heads | Project-level skipping exists; shared references and blocker text exist, but no outcome-priority bypass warning | Partially aligned foundation; new outcome-level selection and warning needed |
| Move an outcome between streams and update every project appearance | Atomic placement and ownership transfer with stale-edit protection | Owned work follows the moved outcome; other outcomes' owners are preserved; forecasts reload | Aligned for current ownership/queue model; future outcome rank needs destination insertion semantics |
| Change the working owner of a shared project and refresh all appearances | Explicit ownership transfer moves the sole charge | Project drawer transfers ownership; all appearances use recalculated package forecast | Aligned; transfers also need to respect future outcome-priority rules |
| Off-roadmap Engineering work can be dismissed and excluded from demand | Hiding is visibility-only; deferring excludes future demand | Hidden selected work remains forecasted and charged; Deferred excludes demand but means a planning pause | Missing the clarified explicit off-roadmap dismissal semantics |
| An unfinished dismissed prerequisite prevents a dependent forecast until included in the roadmap | Current eligibility checks require active stream/selection, not an owning outcome | An ownerless project assigned to a stream can currently finish and unlock successors | Must enforce roadmap membership/ownership without treating excluded dependencies as satisfied |
| User marks an outcome complete after all required work actually finishes | Forecast statuses only; no outcome completion lifecycle | No persisted completion field or completion mutation/UI | New capability required |
| One project can constitute an outcome | No minimum project count | Creation accepts zero, one or multiple links | Already supported |

## Implementation evidence and causes

### 1. Scheduling is project-first despite outcome-first rows

- [`src/lib/board.ts:29`](../src/lib/board.ts#L29) fetches outcomes with `ORDER BY created_at DESC,id`.
- [`src/lib/outcome-planning.ts:36–42`](../src/lib/outcome-planning.ts#L36) preserves the input outcome order and sorts projects by their package sequence. There is no saved outcome rank.
- [`src/lib/forecast.ts:5–20`](../src/lib/forecast.ts#L5) defines the scheduling inputs without outcome placement, ownership or rank as scheduling priorities.
- [`src/lib/forecast.ts:112–133`](../src/lib/forecast.ts#L112) chooses one eligible package by project queue sequence per stream, skipping blocked packages.
- [`src/app/board.tsx:221–269`](../src/app/board.tsx#L221) implements project queue manipulation and outcome stream assignment, but no outcome reorder controls.

Simply making outcome rows draggable would not establish delivery priority: the persisted ordering and scheduler must agree. The future specification must also explain project order within an outcome, optional work versus the next outcome's required work, and how shared ownership influences priority. Existing cross-stream dependency and capacity rules should remain authoritative.

### 2. Dependency calculation and dependency visibility differ

- [`src/lib/forecast.ts:146–162`](../src/lib/forecast.ts#L146) expands required outcome links through the effective dependency closure, including unlinked prerequisites.
- [`src/lib/outcome-planning.ts:38–39`](../src/lib/outcome-planning.ts#L38) only includes projects explicitly linked to an outcome in that outcome's visual row.
- [`src/app/stream-timeline.tsx:63–82`](../src/app/stream-timeline.tsx#L63) resolves one package forecast for every appearance and identifies effective immediate predecessors.
- [`src/app/stream-timeline.tsx:97–116`](../src/app/stream-timeline.tsx#L97) renders bars and textual dependency labels without connector paths or an outcome waiting-warning state.

Consequently, an outcome can correctly wait for a prerequisite without displaying that prerequisite as a box. Immediate-prerequisite references should be derived from effective edges, deduplicated against explicit links, and kept distinct from saved outcome links. Their presence must not create duplicate effort or silently broaden optional-only delivery scope. Explicit optional contributions that are not dependencies must remain optional.

### 3. Shared accounting, timing and mutation behavior are established

- [`src/lib/outcome-ownership-schema.ts:1–10`](../src/lib/outcome-ownership-schema.ts#L1) stores scalar ownership and requires an owner to be an existing outcome/project link.
- [`src/lib/outcome-ownership.ts:21–50`](../src/lib/outcome-ownership.ts#L21) implements owner transfer and outcome movement with ownership/sequence validation.
- [`src/lib/sequence-store.ts:35–51`](../src/lib/sequence-store.ts#L35) places projects and clears incompatible ownership.
- [`src/app/board.tsx:117–131`](../src/app/board.tsx#L117) refreshes the Board from mutation results, including recalculated forecasts.
- [`src/app/stream-timeline.tsx:64–81`](../src/app/stream-timeline.tsx#L64) uses the same package forecast dates for primary and shared blocks.
- [`src/app/outcome-sequencing.css:5–6`](../src/app/outcome-sequencing.css#L5) uses solid primary and dashed shared borders, consistent with [`docs/visual-theme.md:82–93`](visual-theme.md#L82).

Moving an outcome currently moves its owned projects and claims selected ownerless linked projects, while preserving other outcomes' owners and deferred states. Independent project moves, unlinking the owner, deleting the owner, or unassigning an outcome can create ownerless active work. The mandatory-roadmap-owner rule therefore affects lifecycle mutations as well as the initial assignment control.

### 4. Estimate and capacity semantics already match

- [`src/lib/board.ts:64–72`](../src/lib/board.ts#L64) sums estimates from open Linear issues and passes Extra scope separately.
- [`src/lib/forecast.ts:79–99`](../src/lib/forecast.ts#L79) combines that known demand with Extra scope and withholds finite forecasts for uncovered unknown estimates.
- [`src/lib/forecast.ts:104–133`](../src/lib/forecast.ts#L104) applies availability, reserve and the owning stream's allocation, with one execution slot per stream.
- [`src/app/project-drawer.tsx:63`](../src/app/project-drawer.tsx#L63) explains the estimate basis.

Dates are cycle-boundary forecasts. A predecessor finishing in one cycle unlocks its successor in a later cycle; unused capacity is not used for a second project in the same cycle. The note does not explicitly request a change to this granularity.

### 5. Roadmap inclusion is not the current visibility flag

- [`src/app/board.tsx:275–276`](../src/app/board.tsx#L275) explicitly explains that hidden selected work remains included in forecast totals.
- [`src/lib/board.ts:64–76`](../src/lib/board.ts#L64) includes packages regardless of the source-view visibility flag.
- [`src/lib/forecast.ts:83–98`](../src/lib/forecast.ts#L83) evaluates eligibility without requiring an owning outcome or a roadmap-membership field.
- [`src/app/project-drawer.tsx:53–59`](../src/app/project-drawer.tsx#L53) permits explicitly selecting Other selected work as the owner destination.

The clarified dismissal needs explicit planning semantics. Reusing visibility-only Hide unchanged would retain demand incorrectly; treating off-roadmap prerequisites as absent or complete would incorrectly unlock work. The specification should distinguish imported candidates, roadmap-included work, deferred roadmap work and dismissed off-roadmap work.

### 6. Manual business completion is separate from forecasting

- [`src/lib/db.ts:145–154`](../src/lib/db.ts#L145) defines outcome metadata; the ownership extension adds stream placement, not lifecycle state.
- [`src/lib/forecast.ts:24`](../src/lib/forecast.ts#L24) defines calculated forecast statuses, not a saved completed outcome status.
- [`src/lib/forecast.ts:83`](../src/lib/forecast.ts#L83) reconciles actual project completion against source status, remaining issues and Extra scope.
- [`src/app/api/outcomes/[id]/route.ts`](../src/app/api/outcomes/[id]/route.ts) supports metadata updates/deletion, without a completion action.

Manual completion must use actual reconciled completion of required work and its effective prerequisites, rather than a forecast finish or the fact that all scheduled dates are in the past. An outcome may be ready to mark complete while still remaining manually open.

## OpenSpec reconciliation needed

The next design change should reconcile these sources before implementation:

- [`outcome-sequencing`](../openspec/specs/outcome-sequencing/spec.md): replace ownerless active roadmap behavior; define persistent outcome priority, outcome reorder/move controls, immediate-prerequisite appearances, waiting warnings, connectors, and ownership lifecycle rules.
- [`stream-sequencing`](../openspec/specs/stream-sequencing/spec.md): reconcile authoritative project queues with outcome-first scheduling; retain finish-to-start constraints, atomic edits, blocked-work skipping, single-stream execution and accessible controls.
- [`project-assignment`](../openspec/specs/project-assignment/spec.md): require an owning outcome for Board assignment and define off-roadmap dismissal separately from visibility and deferral.
- [`planning-timeline`](../openspec/specs/planning-timeline/spec.md): specify outcome rank presentation, automatically derived immediate references and connector behavior.
- A new or extended outcome-lifecycle capability: specify manual completion eligibility and persistence, with forecasts remaining distinct.
- [`docs/scheduling-contract.md`](scheduling-contract.md): describe the changed scheduling preference and migration/version behavior. Outcome priority and changed eligibility affect results, so existing v4 results cannot simply be relabeled as the new behavior.
- [`docs/product-design.md`](product-design.md): update the current Board and ownership workflow after the new requirements are settled.
- The archived [outcome-led sequencing design](../openspec/changes/archive/2026-10-20-outcome-led-sequencing/design.md), Decisions 3, 4 and 6, explicitly chose ownerless accounting and dependency navigation instead of drawn arrows. A new change should supersede those decisions rather than treating their implementation as accidental.
- The now-completed [outcome catalog redesign](../openspec/changes/archive/2026-10-25-redesign-outcome-catalog/design.md), Non-goals, excludes outcome lifecycle statuses and Board assignment changes. Manual completion introduces an integration boundary with the implemented outcome sidebar (`src/app/outcome-workspace.tsx`); its separate save scopes and submitted-write lifecycle must be retained.

### Design details identified for the next change

The main behavior questions above are answered. Before implementation, specify:

- Whether optional work in a higher-ranked outcome runs before required work in the next eligible outcome, and how existing per-project reorder controls coexist with outcome rank.
- How to handle a lower-ranked outcome owning a prerequisite of a higher-ranked outcome: keep dependency-safe scheduling and the chosen warning behavior, without turning visual rank into an impossible strict completion guarantee.
- Where a moved outcome is inserted in its destination stream, and what happens to active projects when their owner/link is removed under the new mandatory-owner rule.
- Whether connectors are confined to each outcome row using local reference boxes or also cross outcome/stream boundaries; whether “dotted” is literal or includes the established dashed reference treatment.
- How completed outcomes are displayed, reopened, and handled when required links or source completion facts subsequently change. A completion marker should not accidentally become a new scheduling gate.

### Resolution recorded by ohwawd-a5j9

The follow-up [implement-outcome-first-board proposal](../openspec/changes/implement-outcome-first-board/proposal.md), [design](../openspec/changes/implement-outcome-first-board/design.md) and five capability deltas turn the confirmed clarifications into the proposed normative behavior. Design Decision 1 resolves the questions above:

- Carry started work first; eligible required-delivery closure precedes optional-only work, then owner outcome rank and within-owner project order. No competing cross-outcome project queue remains.
- A lower-ranked prerequisite retains its owner's rank without hidden priority donation. Blocked higher work yields to eligible work; dependency context carries the named wait/bypass explanation without expanding the sticky outcome label.
- Cross-stream outcome moves append by default with explicit before/after alternatives. Removing an owner/link converts included work to an excluded Needs assignment candidate; no replacement owner is guessed.
- Connectors stay row-local through immediate reference boxes. References retain the established dashed treatment. Deeper dependencies still constrain delivery and remain accessible through details.
- Manual completion/reopen uses clean saved Details in the completed outcome sidebar. Completed rows retain their rank/time; changed required scope or reopened source evidence latches Review completion needed until explicit reopen. Lifecycle markers never become scheduling gates. Workspace-global completion survives scenario activation; published lifecycle evidence stays frozen.

These resolution choices are documented design decisions, not new quotations attributed to the author. The implementation epic and dependency map are recorded in [tasks.md](../openspec/changes/implement-outcome-first-board/tasks.md). The [data foundation](roadmap-migration.md), [atomic writer/activation layer](roadmap-mutations.md), [v5 scheduling core](scheduling-contract.md), [actual-evidence completion service](outcome-lifecycle.md), [scenario adoption/frozen history](scenario-v5-compatibility.md) and [accessible Board controls](board-controls.md) are implemented and verified. Activated plans now save and publish as v5. Immediate-prerequisite timeline/connectors, visible sidebar lifecycle controls and integrated acceptance remain in dependent tasks. The comparison/evidence above records the reviewed pre-v5 Board behavior.

## Verification performed

All existing checks selected for this review passed on 25 October 2026:

```sh
node --import tsx --test tests/forecast.test.ts tests/outcome-ownership.test.ts tests/sequencing.test.ts tests/board.test.ts
# 31 passed

npx playwright test tests/ui/outcome-sequencing.spec.ts tests/ui/planning-timeline.spec.ts --workers=2
# 12 passed (Chromium)
```

The browser suites exercise the real application UI with API requests intercepted by the existing PGlite-backed assignment fixture; they are not live-Linear or production-database checks. They verify shared-bar date/geometry alignment, duration changes from estimates and capacity, shadow overlap without a second charge, ownership transfer, outcome movement, dependency navigation, unresolved timelines, and responsive/focus behavior.

Passing these tests establishes the existing foundation, not acceptance of the missing clarified behavior. No application code was changed during this review.
