# Tasks

Execution state is tracked in Bean `ohwawd-28qr`; reconcile after verification.

## 1. Calendar and calculation

- [x] 1.1 Implement canonical short labels and a timezone-safe projection helper; test visible-number offsets, custom names, duration/start/cooldown, DST, invalid settings, no-future anchors and imported-date precedence.
- [x] 1.2 Integrate resolved planning cycles with v3 forecast and scenario capture/adaptation; test projected capacity, holiday weighting, provisional package/outcome dates, future-sync replacement and frozen earlier revisions.

## 2. Presentation

- [x] 2.1 Update timeline, card, calendar and capacity-explanation labels/provenance; verify C46 rather than C26, labels beyond four cycles, view-only projected cycle dates, weekly override editing and responsive layouts in browser tests.
- [x] 2.2 Update scheduling/product documentation to describe projection rules and review it against the changed specs.

## 3. Integration

- [x] 3.1 Run `npm test`, `npm run test:ui`, `npm run typecheck`, `npm run build`, strict OpenSpec validation and a read-only local-board check of numbering/projection dates.

## Workflow follow-up

- Complete the Bean and archive only after verification, updating archived artifact references.
