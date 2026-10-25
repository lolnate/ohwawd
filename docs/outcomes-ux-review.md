# Outcomes tab: unified workspace UX review

**Status:** Approach A accepted on October 25, 2026 and incorporated into the active [OpenSpec design](../openspec/changes/redesign-outcome-catalog/design.md) and [requirements](../openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md). This review records the rationale; OpenSpec is the source of truth. Implementation remains pending.

**Tracking:** design review `ohwawd-wihl`; planning update `ohwawd-mw2q`; implementation `ohwawd-5eqp` → `ohwawd-q087` → `ohwawd-xlk3` → `ohwawd-vart`, under `ohwawd-2ods`.

**Method:** source-based review using the configured UX-designer role instructions through an available general agent. No browser evaluation or user research was performed.

## Overall assessment

Use **one persistent outcome sidebar with Details and Projects sections** for adding, viewing, editing, and managing an outcome's project links. Keep the catalog focused on finding outcomes through search, filters, sorting, and compact rows.

The principal issue is fragmented interaction rather than visual styling. The current implementation and pending catalog design use different containers for the same outcome. Standardize the workspace around the outcome, while reusing existing fields and Neon Velocity treatments.

## Findings and priorities

| Priority / relative effort | Source evidence and user impact | Recommendation |
| --- | --- | --- |
| P0 / large | `src/app/workspace.tsx:168–183, 298–310`: inspect/edit scroll to an inline detail area below the catalog; creation and links use separate dialogs. The user's working location changes by action. | Route all entry points into one sidebar. Change its section/mode without replacing the dialog or scrolling the page to an editor. |
| P0 / medium–large | `workspace.tsx:143–154, 310` and `create-outcome-modal.tsx:18`: starting links clears a metadata draft; creation metadata lives in the workspace while selected links live in the modal. Closing can retain one and discard the other. | Give one opening ownership of both drafts. Preserve drafts across internal navigation; make section Cancel and overall Close predictable. |
| P0 / medium | `workspace.tsx:117–124, 143–149, 189–203, 218–223`: saves clear/close state before refresh, and the shared helper catches errors without an explicit success result. Creation ignores the returned ID. | Distinguish failed writes from saved-but-not-refreshed state. Show feedback inside the sidebar and retain the new outcome ID for inspection. |
| P1 / medium | `outcome-catalog.tsx:67`, `outcome-delivery.tsx:25–27`, `workspace.tsx:305–306`: Edit/Links/Delete repeat across surfaces. | Make the outcome title the main entry. Move ordinary management actions into the sidebar; keep Resolve blocker because it serves a separate planning task. |
| P1 / medium | `create-outcome-modal.tsx:37–40` and `outcome-project-picker.tsx:26–29`: dialogs lack backdrop-dismissal handlers and disable Close while busy. | Apply the existing sidebar dismissal/focus convention consistently, using `project-drawer.tsx` as a reference. |

These are source-supported interaction findings, not measured usability or accessibility failures.

## Rethink the experience

Give the planner one reliable place to work on an outcome, regardless of how they entered it.

### Approach A: one sidebar, section-specific saves — accepted

The same sidebar contains Details and Projects. Existing outcomes support saved inspection and explicit editing within each section. New outcomes use those sections with one Create outcome action that saves their initial details and links together.

This preserves current persistence boundaries and reuses the current project-selection fields. The tradeoff is two save scopes for existing outcomes; labels and section-local status must make those scopes clear.

### Approach B: one combined editor and global Save outcome

Details and links form one draft and save together. This has a simpler apparent transaction model, but existing updates use separate endpoints. A reliable all-or-nothing save requires a combined transactional update API, revised requirements, and broader verification. Sequential writes could partially succeed and make the global action misleading.

Approach A provides the shared interaction location with less architectural change.

## Accepted interaction direction

The detailed contract is maintained in OpenSpec. Catalog and delivery titles are the final entry points; the edit/link shortcut rows below describe contextual targeting if needed during integration, rather than requiring repeated page actions.

### Entry points and transitions

| Entry/action | Behavior |
| --- | --- |
| Add outcome | Open the shared sidebar in new mode, Details selected, title focused. |
| Outcome title | Open saved Details, heading focused. |
| Edit shortcut, if retained | Open Details editing, title focused. |
| Links shortcut, if retained | Open Projects editing, project search focused. |
| Delivery entry | Open the same sidebar by stable ID, even when catalog filters exclude the outcome. |
| Switch Details / Projects | Preserve both drafts and section-local project search/filter context. Mark sections containing unsaved changes. Do not persist anything. |
| Create outcome | Validate all required inputs, including those in the inactive section. Submit details and initial links together; on success show saved Details in the same sidebar. |
| Save details / Save links | Persist only the named section. Preserve an unsaved draft in the other section. Return the saved section to inspection with explicit success feedback. |
| Cancel details / Cancel links | Restore the named section from saved values; leave the sidebar and other draft intact. |
| Failed write | Retain draft and context; explain the error inside the sidebar. |
| Close / Escape / valid backdrop click | Dismiss and discard all unsubmitted drafts. Reopening uses saved values. |

While dirty, show concise guidance: **“Changes stay while switching sections. Closing discards unsaved changes.”** Use the same discard-and-dismiss meaning for any new-outcome Cancel button. No autosave or new unsaved-change confirmation flow is proposed.

### Persistence and feedback

- Creation already saves the outcome and initial links in one transaction and returns its ID: `src/app/api/outcomes/route.ts:32–41`.
- Existing metadata and links update separately: `src/app/api/outcomes/[id]/route.ts` and `src/app/api/outcomes/[id]/links/route.ts`. Label their actions **Save details** and **Save links**.
- Keep Close available during submitted writes. Closing discards unsubmitted work; it does not cancel or roll back a submitted request.
- Own submitted requests outside the sidebar and serialize conflicting writes. Completion from an older opening must not reset or close a newer draft.
- Announce persistence separately from refresh. A refresh-only retry must not repeat a successful mutation.
- If creation finishes after dismissal, show a success notice with View outcome using the returned ID.
- Background refreshes must not overwrite active drafts.

### Projects and deletion

Reuse the existing project search, status filters, selection, and Required/Optional controls. Selection defaults to Minimum required. Zero-project and optional-only outcomes remain valid without implying delivery readiness.

Show all direct saved links, including hidden or unavailable project labels. Maintain the complete link draft independently of currently visible/search-matching project rows; never silently drop a link because its display metadata is missing. Preserve API validation and show any rejected update without clearing the draft.

Keep stream assignment read-only here; Board remains the editing location under the current design.

Move Delete outcome to a quiet action at the bottom of saved Details, away from Save. Offer it when neither section has unsaved changes or a pending write. Retain existing confirmation and deletion semantics. After deletion, close the sidebar and focus the next visible result, previous result, or catalog heading.

## Page hierarchy and browsing context

```text
Outcomes                                             [Add outcome]
Outcome delivery · Outcome catalog

Outcome delivery
Forecast / target fit / blockers
Outcome title → same sidebar               [Resolve blocker]

Outcome catalog
[Search outcomes or linked projects…]      [Sort]
[Owner] [Stream] [Projects] [Target date]
12 of 38 outcomes · Clear filters
Outcome | Owner | Stream | Needed by | Required / optional counts

                         ┌ Outcome / New outcome ─────── [Close] ┐
                         │ [Details · unsaved] [Projects]       │
                         │ Saved information or section editor │
                         │ Local error / saved / refresh status│
                         │ Cancel details         Save details │
                         │ New: Create outcome saves both      │
                         └─────────────────────────────────────┘
```

Use one main Add outcome action at the Outcomes heading, with a contextual empty-state entry if helpful. Preserve delivery above the catalog, section links, and compact rows. Remove the inline details/editor and repeated row management actions under this proposal.

**Preserve search and filtering:**

- Retain search, Owner, Stream, Projects, Target date, sort, counts, and Clear filters, with existing saved-data semantics.
- Keep query, facets, sort, and page position through sidebar use, view switches, and successful refreshes.
- Derive membership from saved data, never drafts.
- If an edited, linked, or created outcome is outside the current query, keep its sidebar open with **“Outside current filters.”** Offer Clear filters explicitly; never clear them automatically or pin an extra result row.
- Retain unavailable selected facets and distinguish no matches from no saved outcomes.
- Track selection by stable ID. External removal closes the sidebar with feedback and a valid focus fallback.

## Accessibility and narrow layouts

Follow [UI/UX conventions](ui-ux-conventions.md) and [Neon Velocity](visual-theme.md): one labeled modal with contained focus, inert background, accessible Close, Escape, and backdrop dismissal only when the pointer interaction starts and ends on the backdrop.

Restore focus to the original visible opener, with catalog/delivery fallbacks. Make the sidebar full-screen on narrow layouts with a reachable header, Close, and save actions, one clear scrolling body, wrapping content, and no page-level horizontal overflow. Preserve draft and save status on mobile. Announce feedback without stealing focus and retain visible focus, reduced motion, and non-color state cues.

## Alignment recorded after acceptance

The active proposal, design and acceptance scenarios now specify the persistent sidebar, internal section navigation with both drafts preserved, title-first rows, scoped saves, direct creation-to-inspection transition and post-dismissal creation notices. They supersede the earlier separate-modal/picker-handoff plan.

`ohwawd-5eqp` now owns sidebar/Details foundations. New dependent Beans `ohwawd-q087` and `ohwawd-xlk3` cover creation/Projects and page/context integration; `ohwawd-vart` verifies the completed experience. Shared multi-section draft/save conventions are documented in [UI/UX conventions](ui-ux-conventions.md). These planning changes do not imply implementation has shipped.

## Validation plan

Evaluate these tasks with representative planners and focused integration checks:

1. Find with combined filters, inspect, and edit an owner so the outcome leaves the results. Filters remain; inspection remains available; dismissal restores meaningful focus.
2. Create with Required and Optional projects, switching sections first. Drafts survive navigation and one creation request persists details and links, then opens saved Details.
3. Edit both sections, save only one, Close, and reopen. The persisted result matches the user's understanding of each action.
4. Reject a write, then separately fail refresh after persistence. Failed writes retain drafts; refresh retry never repeats a successful write.
5. Dismiss during a save and open another outcome. The original request completes without modifying the newer opening.
6. Verify keyboard operation and layouts at 1440px, 768px, and 390px, including backdrop/drag-out behavior, long text, hidden/unavailable links, zero results, and deletion focus recovery.

Observe task completion, wrong-container detours, draft loss, and whether users can predict Save, Cancel, and Close. Establish timing baselines during evaluation rather than asserting unmeasured improvements.
