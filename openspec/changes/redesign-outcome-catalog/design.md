# Design

## Context

See `proposal.md` for motivation and `docs/outcomes-ux-review.md` for the accepted UX rationale. The compact searchable catalog and saved-data query contract are implemented. The remaining work replaces the current inline inspection/editor, creation modal and link picker with one persistent outcome sidebar.

- The workspace owns saved outcome data, mutation callbacks, selected view, and refresh fan-out. Views stay mounted behind `hidden`, so local catalog state can survive tab changes without storage.
- `GET /api/state` now supplies the catalog's complete saved metadata, direct links, stream assignment, date-only target, creation timestamp and resolved timezone. The completed query/browse Beans remain valid prerequisites.
- `OutcomeDelivery` is a separate panel above the catalog, fed by the Board forecast. It exposes Edit/Links/Delete callbacks that currently target the inline catalog editor. The catalog should not acquire a dependency on that forecast request.
- Creation already saves an outcome and initial links in one transaction and returns its ID. Existing metadata and link updates use separate transactional endpoints. Reuse `OutcomeProjectFields` and outcome fields while replacing their separate overlay containers; preserve validation and ownership behavior.
- `docs/ui-ux-conventions.md` defines modal sidebar dismissal, pointer-origin protection, focus containment/restoration and narrow-screen behavior. The project drawer is an implementation reference, not a component to overload with outcome-specific data.
- The independent `add-workspace-settings` change also touches workspace layout and modal ownership. These changes share integration points but neither functionally blocks the other; reconcile workspace callbacks and overlay mounting when implementing.

## Goals / Non-Goals

**Goals:** scan and locate outcome definitions, use one stable workspace for all outcome actions, preserve drafts across internal navigation, and retain catalog context across inspection and mutations.

**Non-goals:** replace or filter delivery forecasts, change Board stream assignment, infer outcome completion from project status, add outcome lifecycle statuses, saved/shared filters, pagination/virtualization, autosave, unsaved-change confirmations, or a combined transactional update API. Reuse field/selection semantics rather than redesigning them.

## Decisions

### 1. One compact list with details on demand

Use the dedicated `OutcomeCatalog` component with semantic list/article markup and a shared desktop CSS-grid column layout. Each row has an outcome-title button, Owner, Stream, Needed by and Projects. Remove the repeated Edit/Links/Delete actions and their column; the title opens the outcome workspace. Individual metadata groups carry accessible labels; desktop column headings are visual aids, not a falsely labeled ARIA grid. The title's accessible name is always complete.

Default rows do not render notes, success signals or individual project names. They show `No owner`, `Needs assignment`, `No target`, and `No projects` explicitly instead of unexplained blanks. The Projects cell displays direct required/optional counts, including `0 required · 2 optional` for optional-only outcomes. These are link counts, not dependency-expanded forecast scope or capacity totals.

Suggested layout:

```text
Outcomes                                             [+ Add outcome]
Outcome delivery · Outcome catalog
… delivery forecasts and Resolve blocker actions …

Outcome catalog
[Search outcomes or linked projects…             ] [Sort: Name A–Z ▾]
[Owner: All ▾] [Stream: All ▾] [Projects: All ▾] [Target date: All ▾]
12 of 38 outcomes · [Clear filters]
────────────────────────────────────────────────────────────────────
Outcome                     Owner    Stream    Needed by   Projects
Clients manage their users  Eng.     Core      Jan 18, 2027 2 required
Launch the internal preview Brad    Delivery  Nov 2, 2026  2 required
…
```

Name A–Z is the default. On desktop aim for approximately 8–10 ordinary rows within an 800px-high catalog viewport, with 64–88px typical row height and at most two title lines; exceptionally long data can grow the row rather than overlap it. Full titles remain available through the button's name, title tooltip and sidebar. At narrow widths titles wrap fully and metadata stacks, preserving one outcome per list item.

Use normal page scrolling for the entire filtered result set: no capped list scroller, page-size controls, or infinite-scroll sentinel. Keep Outcome delivery above the catalog. Add `Outcome delivery` / `Outcome catalog` section links at the top of the Outcomes view; selecting one scrolls to its section and focuses its heading with the established sticky-header offset. Board blocker navigation continues to target delivery.

Place one primary Add outcome at the Outcomes heading. The loaded-empty catalog may offer a contextual Add outcome as well. Delivery outcome titles open the same sidebar; remove its repeated Edit/Links/Delete actions and duplicated header Add action, retaining Resolve blocker and forecast information.

Alternatives: slimmer cards still repeat long lists; an editable data grid adds unnecessary navigation/editing machinery; replacing delivery with catalog rows would mix definition browsing with forecasting and broaden this request.

### 2. Explicit, composable filters

All controls are labeled, initially unrestricted and visible in a wrapping toolbar. Use ordinary native single-selects for the first version instead of a filter-builder or custom multi-select. Different filters combine with AND.

| Control | Values and semantics |
| --- | --- |
| Search | Case-insensitive, trimmed, whitespace-separated terms. Every term must occur somewhere in the outcome's combined title, description, success signal, owner or directly linked project names. Terms can match different fields. |
| Owner | All owners; No owner; a normalized owner value. Normalize surrounding whitespace and case for matching/facet deduplication, without rewriting stored names. |
| Stream | All streams; Needs assignment; one active stream by stable ID. Use `outcome.stream_id`, never the streams of linked projects or the project's capacity owner. |
| Projects | All; No projects (zero links); Optional only (one or more links, zero minimum links); Required linked (one or more minimum links, optional links allowed). These three states partition the catalog. |
| Target date | All dates; Past target date (`needed_by < today`); Next 30 days (`today <= needed_by < today + 30 calendar days`); No target. These classify saved target dates, not target fit or missed delivery. |

Search and counts include existing links to hidden projects. A missing project cache entry contributes an `Unavailable project` detail label and its link still counts; do not silently remove the link or fabricate a searchable name. Shared projects can contribute one link to several outcome rows; this does not imply a repeated capacity charge.

Build facet options from the full saved catalog/stream registry, not the filtered subset, so composing filters does not remove available choices. If a selected owner/stream disappears after a refresh, retain the selected value as a zero-result/unavailable option until explicitly cleared. Empty or whitespace-only owners match No owner. Optional-only is never labeled as delivery-ready.

Alternatives: a forecast-status filter would couple catalog availability to a second API and conflate definition completeness with delivery; arbitrary date ranges and multi-select facets are unnecessary for the first useful browse surface.

### 3. Saved data and pure query logic

Add `stream_id` to the outcome query in `GET /api/state`, return `needed_by::text` for the date-only contract, and add a top-level `timezone` resolved from the connected team's saved timezone or workspace timezone when no team is connected. Type `created_at` as its existing serialized timestamp. Additive API metadata needs no database migration or calculation-version change. Existing mutation endpoints remain authoritative.

Implement a small pure `src/lib/outcome-catalog.ts` module for indexed catalog rows, facet normalization, filtering and sorting. Pre-index projects and outcome links so search does not repeatedly scan all projects for every row. Feed explicit `today` into date classification; use the existing team-local date helpers in the UI and refresh date-sensitive results at the next team-local midnight and when the page becomes visible again. No forecast fetch is needed to evaluate catalog filters.

Do not copy catalog data into a second persistent store. Derive it from the latest successful workspace state. All catalog filters and sort are presentation state: they do not send writes or change links, selection, stream placement, funding, forecast inputs or scenario dirty state.

### 4. Deterministic sorting and local browsing state

Offer Name A–Z (default), Needed by (earliest first, missing dates last), and Newest created (descending timestamp). Ties use title then stable outcome ID; Name A–Z uses ID for equal titles. Use only saved values and normalized date-only strings for comparisons.

Own filter/sort state in the continuously mounted catalog/workspace controller, separate from modal-local drafts. Preserve it across workspace view switches, source reloads, scenario activation and successful create/edit/link/delete actions. Reset it on sign-out or a full page reload; there is no URL/localStorage or cross-user persistence in this change.

Show `N of M outcomes`, where M is the entire loaded catalog and N is the matching result set. Show active criteria and a Clear filters action when search/facets are restricted. Clear filters clears search/facets but retains the selected sort. Sorting must not change membership or result counts.

An empty loaded workspace offers Add outcome. A nonempty catalog with zero matches explains that filters found no outcomes and offers Clear filters. A failed initial load shows a retryable error rather than `No outcomes yet`; a failed refresh retains last-good results with visible stale-data feedback. A delivery-forecast failure does not empty or disable catalog browsing.

### 5. One persistent outcome workspace

Use one focused outcome-sidebar component backed by native dialog, following `docs/ui-ux-conventions.md`. Keep its dialog instance, header and Close control mounted across Details/Projects switches and the new-to-saved transition. Mount the controller outside filtered rows and hidden workspace sections. Do not stack or hand off outcome dialogs.

Details inspection shows full title, notes, owner, success signal, needed-by date and assigned stream. Projects inspection shows every direct linked project with Required/Optional and hidden/unavailable labels and cached Linear links where available. Stream assignment remains read-only; Board owns that edit. Details has Edit details; Projects has Manage projects. Both enter explicit editing in the same section.

```text
Outcome / New outcome                             [Close]
────────────────────────────────────────────────────────
[Details · unsaved] [Projects]
Saved information or selected section's editor
Inline pending / saved / rejected / refresh-failed status
[Cancel details]                           [Save details]
New mode instead uses:                   [Create outcome]
```

| Entry/action | State and focus |
| --- | --- |
| Add outcome | New outcome; Details editing; title focused; empty metadata and link drafts. |
| Catalog or delivery title | Saved outcome; Details inspection; heading focused. Resolve by stable ID regardless of catalog membership. |
| Edit details / Manage projects | Edit the selected section; focus title / project search respectively. |
| Details ↔ Projects | Stay in the same dialog; retain both drafts, edit modes and project search/status context. Section buttons remain keyboard operable with programmatic selected state and an associated section heading. |
| Save details / Save links | Save only that section; return it to inspection with success feedback. Preserve the other section's unsaved draft and mode. |
| Cancel details / Cancel links | Reset only that section to current saved values and return it to inspection. Keep the other draft intact. |
| Create outcome | Validate both sections, reveal and focus any invalid field in its section, then POST metadata and initial links once. On persistence success, transition to saved Details in the same dialog using the returned ID. |
| Close / Escape / valid backdrop click | Discard all unsubmitted drafts and dismiss. Reopening starts from saved values. A new-mode Cancel, if rendered, has the same dismissal meaning. |

Store metadata and a complete link map at opening scope, not inside section components that unmount on navigation. Derive dirty indicators per section; while dirty explain `Changes stay while switching sections. Closing discards unsaved changes.` Background refreshes update saved snapshots but never overwrite dirty drafts. No autosave or discard confirmation is introduced. While a submission is pending, freeze the submitted section (both sections for creation) to avoid ambiguous in-flight edits; navigation and Close remain available.

Reuse existing project selection/search/status/requirement controls within Projects. A newly selected project defaults to Minimum required. Preserve zero-link and optional-only creation, and explain that Optional work does not determine first delivery. The complete link map, counts and submission include hidden/unavailable links independently of displayed/search-matching rows. Show unavailable links explicitly with an unlink control during editing; never remove them implicitly or invent missing names. If server validation rejects a remaining unavailable link, keep the draft and show the error.

Place Delete outcome at the bottom of saved Details away from Save, available only when both sections have no unsubmitted changes and no write is pending. Preserve existing confirmation, selected-ID targeting and capacity-ownership cleanup. Remove creation/link overlay containers and obsolete inline editors once the integrated sidebar serves all entry points.

**Persistence ownership:** retain the transactional POST for creation and separate existing metadata/link PUTs. Do not present a global Save for existing outcomes or issue a sequential pair disguised as an atomic edit. Keep mutation ownership at workspace/controller level and serialize conflicting writes. Use explicit rejected, saved, and saved-but-refresh-failed outcomes; the current `run()` helper catches errors and resolves normally, so a resolved callback alone is not proof of persistence.

Close does not abort a submitted write or skip refresh. Capture the submitted payload and opening/request generation so an older completion cannot close, reset, populate or steal focus from a newer opening. A dismissed successful creation offers View outcome from a notice. Surface failures after dismissal in the workspace without reopening the old sidebar. On successful persistence, update the saved section from the accepted payload or authoritative reload and clear its dirty state; a failed follow-up reload offers refresh-only retry without repeating the mutation. Retain a just-created outcome snapshot keyed by the returned ID if reload fails, rather than treating absence from stale data as external deletion. Catalog, Board and delivery refresh through the existing fan-out; last-good results remain explicitly stale on refresh failure.

Alternatives: keeping three containers with matching styles preserves the original navigation/draft problem. A single combined Save outcome is simpler superficially but requires a combined transactional update endpoint or partial-success recovery; separate, accurately labeled save scopes fit existing APIs and limit this change's architecture.

### 6. Mutations do not silently change the user's filters

- **Edited outcome no longer matches:** update results/counts from saved data, keep the sidebar open and show `Outside current filters` with an explicit Clear filters action. Return only the saved section to inspection; preserve the other draft. Do not pin an extra result or reset the query.
- **Created outcome does not match:** transition directly to its saved Details in the same sidebar, retaining query/sort. Show the outside-filters explanation and Clear filters. If creation finishes after dismissal, offer View outcome and Clear filters in the notice using the returned ID.
- **Links change search or project coverage:** recompute membership/counts from saved links without leaving Projects or resetting its search/status context. Never filter catalog results using drafts.
- **Deletion:** close overlays for the deleted ID. Restore focus to the next visible outcome's title at its former result index, then the previous row, then the catalog heading if no result remains. Removing the owning outcome retains existing server-side capacity-ownership cleanup.
- **Ordinary dismissal:** restore the original opener without scrolling the underlying page when still visible; otherwise focus the catalog heading. Actions launched from delivery restore their title opener, then delivery heading as fallback. Preserve page position except when necessary to reveal a fallback. Dismissal must not activate controls beneath the backdrop.

The selected outcome is tracked by stable ID, independently of its result index or whether its row still matches. Confirmed external disappearance on a successful refresh closes its overlay with feedback and a valid focus fallback. A failed refresh or a just-created ID missing from stale results is not evidence of deletion.

### 7. Accessibility, responsive behavior and verification

Use labeled search/select controls, accessible result announcements without moving focus while typing, logical document order and full outcome-title button names. Rows themselves are not click-only containers. Do not hide owner, stream, target or project coverage solely because the viewport narrows. The sidebar is modal with inert background and contained focus; all dismissal methods remain available during saves. Backdrop dismissal requires pointer start and end outside, protecting drag-out interactions.

Use a readable right-hand sidebar on desktop and full-screen presentation on narrow layouts. Keep header, Close and relevant save actions reachable around one clear scrolling body; avoid nested small scrolling panes. Preserve section selection, dirty indicators and all save/error status on mobile. Maintain semantic tokens, real focus outlines, reduced-motion behavior and non-color state cues from `docs/visual-theme.md`.

Add focused `tests/outcome-catalog.test.ts` for matching, owner normalization, direct-link partitions, stable tie-breaks, date boundaries, missing data and immutable inputs. Extend the existing real-database assignment fixture with multiple owners/streams, no-project/optional-only/required outcomes, hidden/shared projects, long text, null dates and many catalog rows. Use browser tests in `tests/ui/outcome-catalog.spec.ts` for combined filters, counts/reset/sort, reaching the last row, details/edit/create/link/delete context and failures. Update existing workspace organization and responsive cases to use the new catalog/editor paths instead of `.outcome-card` selectors.

Each implementation Bean owns its relevant tests and documentation. Cover same-dialog section/create transitions, cross-section draft preservation and section Cancel/save scopes, hidden-section validation, rejected writes versus refresh failures, late completion after dismissal/new opening, filtered membership/focus, deletion/external removal, and backdrop/Escape/drag-out behavior. Final integration runs typecheck, unit/database tests and affected catalog/workspace/outcome/creation/responsive/theme browser suites, with visual inspection at 1440px, 768px and 390px. Use existing tooling; no lint configuration or new dependency is required. Read installed Next.js guides before writing application code. A lightweight planner walkthrough should check whether Save, Cancel and Close consequences are understood; record actual observations without asserting unmeasured usability improvements.

## Risks / Trade-offs

- [Too many controls overwhelm a small list] → Keep four simple facets, clear labels/defaults, one search box and one sort. Wrap the toolbar on small screens; no advanced filter builder.
- [Stream incorrectly inferred from shared projects] → Extend state metadata and filter by the outcome's persisted stream ID only.
- [Past-target date mistaken for forecast risk] → Label it Past target date and leave target fit/status in Outcome delivery.
- [Editing removes the opener from the result set] → Independent overlay state, unchanged filters and explicit heading/neighbor focus fallbacks.
- [Growing delivery panel makes catalog hard to reach] → Direct section navigation above both panels without changing blocker destinations.
- [Internal section switches discard drafts] → Own both drafts and project-search state at opening scope; test navigation, isolated Save/Cancel and Close/reopen.
- [Two save scopes are misunderstood] → Explicit Save details/Save links labels, per-section dirty/saved/error status and one atomic Create outcome action for new records.
- [Refresh failure encourages duplicate writes] → Distinguish persistence from refresh, retain accepted/created snapshots and offer refresh-only retry.
- [Old requests reset newer openings] → Captured payloads and generation checks with controller-owned submissions and late-completion tests.
- [Settings and catalog both touch workspace] → Coordinate local integration against the latest workspace controller; share conventions, not mutable draft state. No dependency on Settings implementation is required.

## Migration Plan

The query/data contract and compact browse UI are verified complete. Implement the remaining linked Beans in order: persistent sidebar/Details foundation, unified creation and Projects, catalog/delivery entry-point and context integration, then cross-feature verification. Intermediate foundations may coexist with legacy entry points during development, but ship the completed replacement with all entry points routed to the shared sidebar and obsolete containers removed. Existing persisted data and published scenarios require no migration. Rollback restores the prior UI against unchanged APIs and stored values. Keep this change active until all associated work is complete, then reconcile `tasks.md`, validate and archive through the normal workflow.
