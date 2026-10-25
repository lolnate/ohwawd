# Tasks

Beans is the live execution tracker. Reconcile this checklist from verified Bean completion.

Parent epic: **ohwawd-2ods — Outcome catalog and unified outcome workspace**.

## 1. Saved data and query behavior — ohwawd-t9oa

- [x] 1.1 Add outcome stream/date/creation metadata and resolved timezone to the typed workspace-state contract, plus the pure indexed catalog filter/sort model; verify state-contract and query tests for shared/hidden/missing projects, blank owners, optional-only links, combined filters, date boundaries and stable sorting, and run TypeScript.

## 2. Compact catalog browsing — ohwawd-sk0r

- [x] 2.1 Build full-width accessible rows, search/facets/sort, counts/reset, section navigation and robust loading/error/empty behavior with session-local state; verify many-outcome browsing, filters and desktop/mobile layout in browser tests, and document delivered controls in `docs/product-design.md`.

## 3. Persistent sidebar and Details — ohwawd-5eqp

- [ ] 3.1 Build the persistent Details/Projects shell, catalog-title inspection and metadata editing with opening-scoped drafts, Save details/Cancel details, explicit mutation outcomes, refresh-only retry and late-request guards; verify section navigation, metadata saves/rejections, dismissal/backdrop/drag-out, pending-write closure, focus and narrow layout in browser tests, run typecheck and affected tests, and document the delivered foundation.

## 4. Unified creation and Projects — ohwawd-q087

- [ ] 4.1 Reuse field controls inside the sidebar for atomic creation-to-saved-Details and saved Projects management, preserving both drafts, separate save/cancel scopes, complete hidden/unavailable link state and project-search context; verify same-dialog transitions, inactive-section validation, zero/optional links, cross-section drafts, write/refresh failures and dismissed creation in browser tests, run typecheck and affected tests, and document the delivered workflows.

## 5. Page entry points and filtered context — ohwawd-xlk3

- [ ] 5.1 Consolidate heading Add and catalog/delivery title entry points, retire repeated actions and legacy inline/overlay containers, place confirmed deletion inside clean Details, and preserve query/page/focus context and nonmatching/external-removal behavior; verify combined-filter create/edit/link/delete, counts, outside-filters actions, removal and focus fallbacks in browser tests, update impacted workspace/responsive/theme selectors and documentation, and run typecheck and affected tests.

## 6. Cross-feature verification — ohwawd-vart

- [ ] 6.1 Verify all requirement scenarios across the integrated catalog, shared sidebar, Board and delivery using `npm run typecheck`, `npm test`, and `npm run test:ui -- tests/ui/outcome-catalog.spec.ts tests/ui/workspace-organization.spec.ts tests/ui/outcome-sequencing.spec.ts tests/ui/responsive-workspace.spec.ts tests/ui/visual-theme.spec.ts`; inspect 1440px/768px/390px views plus keyboard/reduced-motion/forced-color behavior, record evidence and run strict OpenSpec validation after prior Beans are complete.

## Dependencies

`ohwawd-t9oa` → `ohwawd-sk0r` → `ohwawd-5eqp` → `ohwawd-q087` → `ohwawd-xlk3` → `ohwawd-vart`.

The first two tasks remain verified complete. The approved October 25 shared-sidebar design revises the remaining scope; no new implementation is marked complete by this planning update. Intermediate foundations may temporarily coexist with legacy entry points during development; ship only after integration routes all outcome actions to the shared sidebar.

The separately planned Workspace Settings change has no functional prerequisite relationship with this change; coordinate shared `workspace.tsx` and overlay integration during implementation.

## Workflow follow-up

- Complete the parent epic only after its implementation children satisfy the requirements and integration checks.
- Reconcile this checklist, validate the overall change, then archive through the normal OpenSpec workflow.
- Keep Bean references valid when moving the completed artifacts to their archive path.
