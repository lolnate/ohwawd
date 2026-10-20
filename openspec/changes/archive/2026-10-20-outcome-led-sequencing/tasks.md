# Tasks

Beans is the live execution tracker; reconcile these checkboxes after verification.

## 1. Ownership and persistence
- [x] 1.1 Add outcome stream placement, exclusive project ownership, safe mutation/link/move/retirement behavior, and legacy migration; verify capacity conservation, stale rejection, deletion, and dependency rollback with database tests.
- [x] 1.2 Include placement and ownership in scenario activation, dirty detection and comparison; verify round-trip and frozen legacy revision tests.

## 2. Outcome board and project inspection
- [x] 2.1 Render outcome rows, mnemonic project blocks, shared reference bands, unowned-work fallback and assignment controls; verify shared same/cross-stream appearances and conserved totals in browser tests.
- [x] 2.2 Implement accessible project sidebar with ownership switching, estimate/scope/placement controls and dependency navigation; verify pointer/keyboard dismissal, focus restoration and immediate recalculation in browser tests.

## 3. Integration
- [x] 3.1 Run typecheck, unit/database tests, relevant desktop/mobile browser suites and build; review the implementation against all scenarios and document the delivered workflow.

## Verification results
- `npm test`: 70 tests passed, including migration, exclusive ownership, lifecycle and scenario coverage.
- Relevant Playwright suites: 21 tests passed (outcome sequencing, project assignment, planning timeline, cycle projection, workspace organization).
- `npm run build`, `npm run typecheck`, and `git diff --check`: passed.
- Strict OpenSpec validation passed; visually inspected condensed board and project sidebar screenshots.
- Final lifecycle review includes retired-stream outcome previews and projects introduced after a saved draft.

## Workflow follow-up
- Archive after all associated Beans are completed and the change validates.
