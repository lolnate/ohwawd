# Implementation tasks

Execution state is tracked in Bean `ohwawd-tlaq`; reconcile this checklist from verified completion.

## 1. Calendar and capacity

- [x] 1.1 Implement Monday-week helpers, holiday generation and working-day cycle weighting; verify Thanksgiving/Christmas/year boundaries, timezone/DST and overlapping 50% exceptions in unit/forecast tests.
- [x] 1.2 Add migration, persisted weekly settings and board mutations; verify idempotent migration and override validation/removal in database tests; document precedence in the scheduling contract.

## 2. Scenario compatibility

- [x] 2.1 Capture/restore/compare v2 weekly assumptions and adapt older drafts without altering published output; verify round-trips, dirty detection, old-version comparison and frozen holiday dates in scenario tests.

## 3. Timeline interaction

- [x] 3.1 Replace cycle table with compact month/week headers, sticky labels, cycle context, missing-calendar shading and partial bars; verify date mapping, dependency explanations, scrolling and responsive containment in calendar/browser tests.
- [x] 3.2 Add editable holiday/weekly availability controls and matching highlighted columns; verify changes affect forecast capacity and survive scenario save/load; update product documentation.

## 4. Integrated validation

- [x] 4.1 Run `npm test`, `npm run typecheck`, `npm run test:ui`, `npm run build`, strict OpenSpec validation, and verify the local migrated board and the user's named project order.

## Workflow follow-up

- Archive only after the implementation Bean is verified complete, and update its artifact references.
