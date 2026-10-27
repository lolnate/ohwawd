# Tasks

Beans is the live execution tracker. Implementation Bean: **ohwawd-t8we**.

## 1. Relocate assignment surfaces

- [x] 1.1 Add the migrated Projects without outcomes section and navigation to Outcomes, route its actions through existing project planning controls, and verify focused workspace browser coverage passes.
- [x] 1.2 Make Board Needs Assignment render unstreamed outcomes, remove candidates from migrated Board triage while preserving legacy behavior, and verify focused Board browser coverage passes.

## 2. Documentation and integration

- [x] 2.1 Update product and Board-control documentation for the new entity-specific locations and verify links and terminology match the delivered UI.
- [x] 2.2 Run typecheck, relevant unit/browser suites and strict OpenSpec validation; reconcile this checklist and the linked Bean only after all checks pass.

## Workflow follow-up

- Archive this change after review and verified Bean completion.

## 3. Compact outcome health follow-up

- [x] 3.1 Remove Outcome delivery, render the catalog first with one compact Health column, and place Projects without outcomes below it; verify forecast success/loading/failure and narrow layouts in browser tests.
- [x] 3.2 Route Board forecast attention and Outcomes navigation to the catalog, update affected documentation/tests, and verify typecheck, unit tests, affected browser suites, production build and strict OpenSpec validation.
