---
# ohwawd-t8we
title: Relocate needs-assignment sections by entity
status: completed
type: feature
priority: normal
created_at: 2026-10-26T11:46:23Z
updated_at: 2026-10-26T13:07:59Z
---

Move candidate projects that need an owning outcome from Board to Outcomes, and make Board Needs Assignment represent outcomes without a stream.\n\n- [x] Define the behavior change in OpenSpec (openspec/changes/relocate-needs-assignment-sections/)\n- [x] Implement Outcomes project assignment section and Board outcome assignment section\n- [x] Update navigation, focus behavior, and supporting documentation\n- [x] Add or update automated tests\n- [x] Run relevant validation

## Summary of Changes

Moved candidate-project Needs Assignment to Outcomes below the catalog and recast Board Needs Assignment around unstreamed outcomes. Removed the separate Outcome delivery section, added one compact forecast Health column to the catalog, routed forecast attention to it, retained legacy assignment behavior, and updated OpenSpec, documentation, and tests. Verified typecheck, 139 unit/database tests, 73 affected browser tests, production build, strict OpenSpec validation, and diff checks.

## Follow-up: compact outcome health\n\n- [x] Move project Needs Assignment below the catalog\n- [x] Remove the Outcome delivery section\n- [x] Add one compact catalog health column using existing forecast status\n- [x] Update specifications, documentation, and tests\n- [x] Run relevant validation
