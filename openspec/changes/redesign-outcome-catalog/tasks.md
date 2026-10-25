# Tasks

Beans is the live execution tracker. Reconcile this checklist from verified Bean completion; all implementation work is currently to do.

Parent epic: **ohwawd-2ods — Outcome Catalog list redesign**.

## 1. Saved data and query behavior — ohwawd-t9oa

- [x] 1.1 Add outcome stream/date/creation metadata and resolved timezone to the typed workspace-state contract, plus the pure indexed catalog filter/sort model; verify state-contract and query tests for shared/hidden/missing projects, blank owners, optional-only links, combined filters, date boundaries and stable sorting, and run TypeScript.

## 2. Compact catalog browsing — ohwawd-sk0r

- [ ] 2.1 Build full-width accessible rows, search/facets/sort, counts/reset, section navigation and robust loading/error/empty behavior with session-local state; verify many-outcome browsing, filters and desktop/mobile layout in browser tests, and document delivered controls in `docs/product-design.md`.

## 3. Outcome details and action integration — ohwawd-5eqp

- [ ] 3.1 Add the convention-compliant outcome read/edit sidebar and integrate row/delivery create/link/delete workflows, filtered-result transitions, explicit mutation outcomes and focus restoration; verify successful/failed saves, overlay handoffs, pending-write dismissal and existing creation/linking behavior in browser tests, update affected selectors, and document the delivered detail workflow.

## 4. Cross-feature verification — ohwawd-vart

- [ ] 4.1 Verify all requirement scenarios across the integrated catalog, Board and delivery using `npm run typecheck`, `npm test`, and `npm run test:ui -- tests/ui/outcome-catalog.spec.ts tests/ui/workspace-organization.spec.ts tests/ui/outcome-sequencing.spec.ts tests/ui/responsive-workspace.spec.ts`; inspect 1440px/768px/390px views, record evidence and run strict OpenSpec validation after prior Beans are complete.

## Dependencies

`ohwawd-t9oa` → `ohwawd-sk0r` → `ohwawd-5eqp` → `ohwawd-vart`.

The separately planned Workspace Settings change has no functional prerequisite relationship with this change; coordinate shared `workspace.tsx` and overlay integration during implementation.

## Workflow follow-up

- Complete the parent epic only after its implementation children satisfy the requirements and integration checks.
- Reconcile this checklist, validate the overall change, then archive through the normal OpenSpec workflow.
- Keep Bean references valid when moving the completed artifacts to their archive path.
