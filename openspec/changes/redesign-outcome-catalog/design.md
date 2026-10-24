# Design

## Context

See `proposal.md` for motivation. The screenshot matches the current `#outcome-catalog` in `src/app/workspace.tsx`: a `.card-list` of `.outcome-card` articles with notes, success signal, every linked project, inline editing, and repeated actions.

- The workspace owns saved outcome data, mutation callbacks, selected view, and refresh fan-out. Views stay mounted behind `hidden`, so local catalog state can survive tab changes without storage.
- `GET /api/state` already returns the complete outcome catalog, project names, all links, active streams and outcome creation timestamps. Its outcome query omits `stream_id`, and the client Outcome type omits `created_at`. Neither omission requires a schema change.
- `OutcomeDelivery` is a separate panel above the catalog, fed by the Board forecast. It exposes Edit/Links/Delete callbacks that currently target the inline catalog editor. The catalog should not acquire a dependency on that forecast request.
- `CreateOutcomeModal` already creates an outcome and project links together. `OutcomeProjectPicker` uses shared `OutcomeProjectFields` for existing links. Preserve these behaviors and their API validation.
- `docs/ui-ux-conventions.md` defines modal sidebar dismissal, pointer-origin protection, focus containment/restoration and narrow-screen behavior. The project drawer is an implementation reference, not a component to overload with outcome-specific data.
- The independent `add-workspace-settings` change also touches workspace layout and modal ownership. These changes share integration points but neither functionally blocks the other; reconcile workspace callbacks and overlay mounting when implementing.

## Goals / Non-Goals

**Goals:** scan many outcome definitions, locate an outcome by meaningful criteria, inspect details without growing list rows, and retain context through normal catalog actions.

**Non-goals:** replace or filter Outcome delivery, change Board stream assignment, infer outcome completion from project status, create custom outcome lifecycle statuses, add saved/shared filter views, add pagination/virtualization, or redesign the outcome creation/project-link selection forms.

## Decisions

### 1. One compact list with details on demand

Use a dedicated `OutcomeCatalog` component with semantic list/article markup and a shared desktop CSS-grid column layout. Each row has an outcome-title button, Owner, Stream, Needed by, Projects, and actions. Individual metadata groups carry accessible labels; desktop column headings are visual aids, not a falsely labeled ARIA grid. The title's accessible name is always complete.

Default rows do not render notes, success signals or individual project names. They show `No owner`, `Needs assignment`, `No target`, and `No projects` explicitly instead of unexplained blanks. The Projects cell displays direct required/optional counts, including `0 required · 2 optional` for optional-only outcomes. These are link counts, not dependency-expanded forecast scope or capacity totals.

Suggested layout:

```text
Outcome catalog                                      [+ Add outcome]
[Search outcomes or linked projects…             ] [Sort: Name A–Z ▾]
[Owner: All ▾] [Stream: All ▾] [Projects: All ▾] [Target date: All ▾]
12 of 38 outcomes · [Clear filters]
────────────────────────────────────────────────────────────────────
Outcome                     Owner    Stream    Needed by   Projects   Actions
Clients manage their users  Eng.     Core      Jan 18, 2027 2 required Edit Links Delete
Launch the internal preview Brad    Delivery  Nov 2, 2026  2 required Edit Links Delete
…
```

Name A–Z is the default. On desktop aim for approximately 8–10 ordinary rows within an 800px-high catalog viewport, with 64–88px typical row height and at most two title lines; exceptionally long data can grow the row rather than overlap it. Full titles remain available through the button's name, title tooltip and sidebar. At narrow widths titles wrap fully and metadata/actions stack, preserving one outcome per list item.

Use normal page scrolling for the entire filtered result set: no capped list scroller, page-size controls, or infinite-scroll sentinel. Keep Outcome delivery above the catalog. Add `Outcome delivery` / `Outcome catalog` section links at the top of the Outcomes view; selecting one scrolls to its section and focuses its heading with the established sticky-header offset. Board blocker navigation continues to target delivery.

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

### 5. Outcome sidebar and existing actions

Add a focused `OutcomeDetailsDrawer` using native dialog and the established sidebar conventions. The title button opens read mode with full title, notes, owner, success signal, needed-by date, assigned stream, and every direct linked project with required/optional and hidden/unavailable labels. Imported project names can link to their cached Linear URLs. Do not add an outcome-row project-key disclosure.

Row actions remain explicit: Edit, Links and Delete, with outcome-specific accessible names. Edit opens the same drawer in edit mode and focuses Outcome title. Move the existing inline outcome form there without changing validation or payloads. Stream is read-only context in this editor; stream assignment continues on Board. Cancel edit returns to read mode using saved values. Close/Escape/backdrop dismiss the drawer and discard unsubmitted edits without autosaving or introducing a confirmation flow. Background refreshes must not overwrite an active draft.

Keep the existing create-with-projects modal and project-link picker. Put overlay controllers outside filtered rows and outside hidden workspace sections. Allow one outcome overlay at a time. Links from a row or delivery opens the picker directly. Links from the read-only sidebar hands off to the picker; Save or Cancel returns to the read-only outcome sidebar with current saved links. Do not expose that handoff while an outcome edit draft is active. Preserve the original outside opener across the handoff for final focus restoration; do not stack dialogs.

Delivery's Edit callback opens this editor directly even when its outcome is excluded by catalog filters. Links and Delete retain their existing behavior. Preserve existing deletion confirmation and ensure only the selected outcome is removed. Successful writes use the current workspace reload fan-out to update catalog, Board and delivery. Inline modal errors retain inputs and the current context; successful persistence followed by failed refresh is reported as saved-but-not-refreshed, not as an unsaved write.

Keep mutation ownership at workspace/controller level so dismissing a sidebar does not abort a submitted write or skip refresh. Serialize conflicting writes and guard opening/request generations: completion from an older outcome must not close or reset a newer outcome's draft. The current `run()` helper catches errors and resolves normally, so modal callbacks must expose an explicit success/failure result rather than interpreting a resolved promise as a successful save.

### 6. Mutations do not silently change the user's filters

- **Edited outcome no longer matches:** update the underlying result set and counts, keep the sidebar open in read mode for the saved outcome, and show `This outcome is outside the current filters`. Do not pin an extra result row or reset the query.
- **Created outcome does not match:** keep filters/sort intact; the creation notice offers View outcome and Clear filters. Capture the existing POST response's outcome ID to target inspection without requiring the new row to be visible.
- **Links change search or project coverage:** recompute membership and counts from refreshed saved links. Preserve inspection context across the picker handoff.
- **Deletion:** close overlays for the deleted ID. Restore focus to the next visible outcome's title at its former result index, then the previous row, then the catalog heading if no result remains. Removing the owning outcome retains existing server-side capacity-ownership cleanup.
- **Ordinary dismissal:** restore the original opener when still visible; otherwise focus the catalog heading. Actions launched from delivery restore their delivery opener where possible. Dismissal must not activate controls beneath the backdrop.

The selected outcome is tracked by stable ID, independently of its result index or whether its row still matches. External disappearance of that ID closes its overlay with feedback and a valid focus fallback rather than rendering stale fields.

### 7. Accessibility, responsive behavior and verification

Use labeled search/select controls, accessible result announcements without moving focus while typing, logical document order and outcome-specific action names. Rows themselves are not click-only containers; the title and actions are actual buttons. Retain full underlying accessible titles when visual wrapping is limited. Do not hide owner, stream, target or project coverage solely because the viewport narrows.

Add focused `tests/outcome-catalog.test.ts` for matching, owner normalization, direct-link partitions, stable tie-breaks, date boundaries, missing data and immutable inputs. Extend the existing real-database assignment fixture with multiple owners/streams, no-project/optional-only/required outcomes, hidden/shared projects, long text, null dates and many catalog rows. Use browser tests in `tests/ui/outcome-catalog.spec.ts` for combined filters, counts/reset/sort, reaching the last row, details/edit/create/link/delete context and failures. Update existing workspace organization and responsive cases to use the new catalog/editor paths instead of `.outcome-card` selectors.

Each implementation Bean owns its relevant tests and documentation. Final integration runs typecheck, unit/database tests and the affected catalog/workspace/outcome/creation/responsive browser suites, with visual inspection at 1440px, 768px and 390px. Use existing tooling; no lint configuration or new dependency is required. Read installed Next.js guides before writing application code.

## Risks / Trade-offs

- [Too many controls overwhelm a small list] → Keep four simple facets, clear labels/defaults, one search box and one sort. Wrap the toolbar on small screens; no advanced filter builder.
- [Stream incorrectly inferred from shared projects] → Extend state metadata and filter by the outcome's persisted stream ID only.
- [Past-target date mistaken for forecast risk] → Label it Past target date and leave target fit/status in Outcome delivery.
- [Editing removes the opener from the result set] → Independent overlay state, unchanged filters and explicit heading/neighbor focus fallbacks.
- [Growing delivery panel makes catalog hard to reach] → Direct section navigation above both panels without changing blocker destinations.
- [Overlay handoffs discard a draft or trap focus] → One overlay at a time, links handoff only from read mode, saved outside-opener reference, and keyboard/backdrop tests.
- [Settings and catalog both touch workspace] → Coordinate local integration against the latest workspace controller; share conventions, not mutable draft state. No dependency on Settings implementation is required.

## Migration Plan

Implement linked Beans in order: query/data contract, compact browse UI, outcome detail/action integration, and final cross-view verification. Ship the UI replacement and editor callback changes together. Existing persisted outcome data and published scenarios require no migration. Rollback restores catalog rendering against the same APIs and stored values. Keep the OpenSpec change active until all implementation Beans are complete, then reconcile `tasks.md`, validate and archive normally.
