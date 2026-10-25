---
# ohwawd-xlk3
title: Simplify Outcomes entry points and preserve filtered context
status: todo
type: task
created_at: 2026-10-25T17:05:26Z
updated_at: 2026-10-25T17:05:26Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-q087
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md (entry points, confirmed deletion, filter context, external removal, accessible browsing)
Design: openspec/changes/redesign-outcome-catalog/design.md (Decisions 1, 6 and 7)
Conventions: docs/ui-ux-conventions.md

Depends on the complete sidebar create/Details/Projects workflows. Consolidate catalog and delivery interactions and retire legacy containers; preserve forecast semantics and all saved-data query behavior.

- [ ] Put the primary Add outcome at the Outcomes heading with contextual creation for the loaded-empty catalog; route catalog and delivery title buttons to the shared sidebar by stable ID
- [ ] Remove repeated Edit/Links/Delete row actions, duplicate section-header Add controls, inline details/editor and obsolete separate create/link overlay containers; preserve delivery forecasts, Resolve blocker and section navigation
- [ ] Place confirmed Delete outcome inside clean saved Details, unavailable while either section is dirty or a write is pending; preserve server ownership cleanup and next/previous/catalog-heading focus recovery
- [ ] Preserve search/facets/sort and page position through opening, internal navigation, saves and close; recompute membership/counts from saved values without pinned rows or automatic query resets
- [ ] Keep nonmatching outcomes inspectable with Outside current filters and explicit Clear filters; offer View outcome/Clear filters for nonmatching creation after dismissal; preserve unavailable selected facets and heading fallbacks for catalog/delivery openers
- [ ] Handle confirmed external removal with feedback and valid focus while distinguishing failed/stale refresh and just-created snapshots from deletion
- [ ] Add browser tests for title-only entry points, edit/link/create/delete under combined filters, result counts, page/focus restoration and external removal; update impacted workflow/theme/responsive selectors and product documentation, then run typecheck plus affected tests

Completion: all Outcomes management uses the one sidebar; repeated/legacy surfaces are gone; catalog search/filter/sort semantics, Board/delivery updates, deletion behavior and accessible context preservation meet the revised spec.
