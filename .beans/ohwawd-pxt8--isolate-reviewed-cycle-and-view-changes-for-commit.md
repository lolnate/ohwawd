---
# ohwawd-pxt8
title: Isolate reviewed cycle and view changes for commit
status: completed
type: task
priority: normal
created_at: 2026-10-20T22:34:40Z
updated_at: 2026-10-20T22:45:41Z
---

Prepare a commit for this conversation while another agent edits the same working tree. Include the completed Board/Outcomes organization work (ohwawd-frld) and cycle-label/projection work (ohwawd-28qr), excluding outcome-capacity ownership and outcome-led row/sidebar changes.

- [x] Identify file and hunk ownership against HEAD without changing the other agent working files
- [x] Stage only the reviewed changes and associated tests/specs/Beans
- [x] Verify the isolated staged tree and prepare the reviewed commit

The index was empty at the start; shared-file changes must be staged at hunk/blob level rather than with broad directory adds.

## Isolation approach

The shared index was empty. Reconstructed mixed files using index-only Git blobs, preserving this conversation’s v3 calendar and view changes while excluding ownership/schema/API/sidebar/outcome-row changes. Verified the staged diff and exported tree f7487c91d8183fd3a265c074e0dda76c3f64df03 to a temporary validation checkout. The validation browser server uses a separate port so it cannot exercise the other agent’s live application. No shared working files were restored, stashed or overwritten.

## Summary of Changes

Isolated this conversation’s completed work (ohwawd-frld and ohwawd-28qr) at file/hunk level using index-only Git blobs. Excluded the other agent’s migration 5, ownership services/APIs, outcome-led rows, sidebar, styles, tests, task records and active OpenSpec change, including edits mixed into shared source and documentation. Exported immutable staged tree f7487c91d8183fd3a265c074e0dda76c3f64df03 into an independent temporary checkout with cloned dependencies and a separate browser server port. That isolated snapshot passes 63 backend tests, 23 browser tests, production build, typecheck, strict maintained-spec/archive validation, whitespace checks and credential-pattern checks. Prepared the reviewed commit without changing the shared working files or staging the other agent’s work.
