# Tasks

## 1. Adaptive Label Policy

- [x] 1.1 Implement a deterministic full-name, ellipsized-name, or project-code selection policy from rendered available/name widths, including threshold tolerance, and verify boundary behavior with focused `npm test` coverage.

## 2. Timeline Integration

- [x] 2.1 Integrate adaptive identity and fixed-context slots into finite Board timeline bars with resize and font remeasurement, preserve tooltip/accessibility and truthful geometry, update the product design description, and verify full, ellipsized, narrow, resized, suffix, accessibility, and 390px cases with targeted `npm run test:ui` coverage.
- [x] 2.2 Prioritize the stable project code over suffix context in code mode and verify a suffix wider than the remaining narrow bar cannot collapse the abbreviation with focused Playwright regression coverage.

## 3. Integrated Validation

- [x] 3.1 Run `npm run typecheck`, `npm test`, the targeted planning-timeline Playwright suite, `npm run build`, and `openspec validate adapt-timeline-project-labels --strict`; resolve regressions and confirm forecast spans, dependency references, and minimum pointer targets remain unchanged.
