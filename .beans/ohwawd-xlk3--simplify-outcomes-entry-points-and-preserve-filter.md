---
# ohwawd-xlk3
title: Simplify Outcomes entry points and preserve filtered context
status: completed
type: task
priority: normal
created_at: 2026-10-25T17:05:26Z
updated_at: 2026-10-25T18:25:56Z
parent: ohwawd-2ods
blocked_by:
    - ohwawd-q087
---

OpenSpec: redesign-outcome-catalog
Requirements: openspec/changes/archive/2026-10-25-redesign-outcome-catalog/specs/outcome-catalog/spec.md (entry points, confirmed deletion, filter context, external removal, accessible browsing)
Design: openspec/changes/archive/2026-10-25-redesign-outcome-catalog/design.md (Decisions 1, 6 and 7)
Conventions: docs/ui-ux-conventions.md

Depends on the complete sidebar create/Details/Projects workflows. Consolidate catalog and delivery interactions and retire legacy containers; preserve forecast semantics and all saved-data query behavior.

- [x] Put the primary Add outcome at the Outcomes heading with contextual creation for the loaded-empty catalog; route catalog and delivery title buttons to the shared sidebar by stable ID
- [x] Remove repeated Edit/Links/Delete row actions, duplicate section-header Add controls, inline details/editor and obsolete separate create/link overlay containers; preserve delivery forecasts, Resolve blocker and section navigation
- [x] Place confirmed Delete outcome inside clean saved Details, unavailable while either section is dirty or a write is pending; preserve server ownership cleanup and next/previous/catalog-heading focus recovery
- [x] Preserve search/facets/sort and page position through opening, internal navigation, saves and close; recompute membership/counts from saved values without pinned rows or automatic query resets
- [x] Keep nonmatching outcomes inspectable with Outside current filters and explicit Clear filters; offer View outcome/Clear filters for nonmatching creation after dismissal; preserve unavailable selected facets and heading fallbacks for catalog/delivery openers
- [x] Handle confirmed external removal with feedback and valid focus while distinguishing failed/stale refresh and just-created snapshots from deletion
- [x] Add browser tests for title-only entry points, edit/link/create/delete under combined filters, result counts, page/focus restoration and external removal; update impacted workflow/theme/responsive selectors and product documentation, then run typecheck plus affected tests

Completion: all Outcomes management uses the one sidebar; repeated/legacy surfaces are gone; catalog search/filter/sort semantics, Board/delivery updates, deletion behavior and accessible context preservation meet the revised spec.

## Summary of Changes

Consolidated catalog/delivery title entry points and heading-level creation, removed legacy inline editors and separate creator/link dialog components and container styling. Added confirmed clean-only deletion with next/previous/heading focus recovery, outside-filter inspection and explicit clear controls, accepted snapshots, external-removal handling and delivery refresh even after definition read failure. Preserved query, sort, counts and page position. Updated product/workflow docs and catalog/workspace/responsive/theme selectors. Fixed a focus race exposed by browser coverage by focusing newly mounted title fields synchronously. Verified typecheck and 39 browser tests across the five affected suites, including 13 sidebar acceptance tests.
