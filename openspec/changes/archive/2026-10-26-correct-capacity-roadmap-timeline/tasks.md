# Tasks

## 1. Aggregate remaining scope

- [x] 1.1 Add migration 8 and initial-schema support for nullable project remaining scope; verify fresh and upgraded schemas plus migration idempotency in database tests.
- [x] 1.2 Import validated Linear project scope/completed-scope history, persist remaining scope, and report source changes; verify pagination/import/update/fallback behavior in Linear and import tests.
- [x] 1.3 Feed aggregate remaining scope into Board demand ahead of issue-level fallback while keeping Extra scope additive and completion evidence unchanged; verify 106-point demand, unestimated-issue fallback, lifecycle and scenario regressions in unit/database tests.

## 2. Compact fractional timeline

- [x] 2.1 Derive finite final-cycle bar boundaries from consumed stream-capacity fraction and reuse the geometry for counted/shared/derived appearances; verify 106 points at 30 points per one-week cycle spans approximately 3.53 weeks and responds to capacity changes.
- [x] 2.2 Remove standalone wait/priority-bypass and verbose unsized-reason panels from timeline rows while preserving compact project controls, accessible dependency names, project inspection and truthful row-local connectors; verify sequential geometry, connector endpoints, keyboard, forced colors and narrow containment in browser tests.
- [x] 2.3 Record the no-bloat roadmap convention and delivered scope/geometry behavior in project documentation; verify docs agree with current OpenSpec requirements.

## 3. Integrated verification

- [x] 3.1 Run typecheck, all unit/database and browser tests, production build, strict change/global OpenSpec validation, Beans integrity and whitespace checks; inspect 1440px/768px/390px timeline captures before completing the Bean.

## Workflow follow-up

- Apply migration 8 and refresh Linear source in each deployed workspace before expecting aggregate remaining scope on existing cached projects.
- Archive the OpenSpec change only after implementation and acceptance are complete.
