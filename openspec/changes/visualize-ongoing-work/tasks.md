# Tasks

## 1. Classification Data Foundation

- [x] 1.1 Add project-label storage, local classification decisions, nullable non-roadmap membership constraints, and the one-time existing-project Roadmap backfill; implement the shared effective-classification resolver and verify migration, exact-label, ambiguity, provenance, and legacy-plan preservation cases with PGlite tests in `npm test`.

## 2. Linear Issue Evidence

- [x] 2.1 Extend the Linear adapter with paginated project-label and team-issue reads, including nullable current project, issue URL, workflow type, completion evidence, and blocking relations; verify pagination, exact source mapping, unattached issues, and relation direction with adapter tests in `npm test`.
- [x] 2.2 Reconcile the team issue cache and normalized blocker edges by successful import generation without per-project deletion, preserve prior complete state on stale or failed syncs, and verify issue moves, removals, blockers, labels, and source reports with import tests in `npm test`.
- [x] 2.3 Add immutable 30-day completed-issue attribution snapshots and current-at-migration backfill, keeping cycle placement derived from actual cycle dates; verify live reattribution, cutoff freezing, later source moves, unresolved/no-project attribution, and missing-cycle coverage with focused history tests in `npm test`.

## 3. Classification Behavior

- [x] 3.1 Add token-protected local classification mutations and atomically reconcile Roadmap, Ongoing, and unresolved membership transitions while preserving links; update editable scenario handling as designed and verify stale writes, source-label authority, demand removal, candidate restoration, and published-history compatibility with `npm test`.

## 4. Ongoing Work Read APIs

- [x] 4.1 Build server-side available-work and completed-history aggregates plus the validated lazy issue-detail endpoint; verify mutually exclusive Ready/Blocked/Backlog buckets, points and unestimated counts, default ordering, attention rows, six-cycle defaults, older history, and untrusted-filter rejection with API/domain tests in `npm test`.

## 5. Board Interaction And Visualization

- [x] 5.1 Expose classification, provenance, source-label conflicts, and local classification controls in project planning and Needs classification surfaces, retaining drafts and feedback on failures; verify pointer, keyboard, stale-conflict, focus, and narrow-screen behavior with targeted Playwright tests in `npm run test:ui`.
- [x] 5.2 Add the Ongoing available-work table below roadmap streams with issue-count geometry, Ready/Blocked/Backlog segments, estimates, unestimated and in-progress context, Needs classification grouping, and lazy issue inspection; verify sorting, exact values, Linear links, blocker evidence, empty states, keyboard use, and 390px containment with targeted Playwright tests in `npm run test:ui`.
- [x] 5.3 Add the semantic completed-cycle heatmap with sticky project rows, global intensity, numeric cells, Issues/Points switching, attention rows, six-cycle default, Show older cycles, coverage notice, and lazy issue inspection; verify cycle naming, frozen/recent placement, non-color interpretation, forced colors, reduced motion, focus restoration, and desktop/mobile layouts with targeted Playwright tests in `npm run test:ui`.

## 6. Integrated Validation

- [ ] 6.1 Run `npm run typecheck`, `npm test`, `npm run test:ui`, `npm run build`, and `openspec validate visualize-ongoing-work --strict`; resolve regressions and verify the existing five-stream forecast geometry and scheduling behavior remain unchanged.
