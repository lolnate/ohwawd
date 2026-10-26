---
# ohwawd-r568
title: Compact Board outcome rows and move placement controls to sidebar
status: completed
type: task
priority: high
created_at: 2026-10-26T00:21:51Z
updated_at: 2026-10-26T00:29:16Z
parent: ohwawd-5q71
blocked_by:
    - ohwawd-0lzq
---

OpenSpec: implement-outcome-first-board. Incorporate manual Board review feedback: remove row-level wait/bypass details, priority labels, arrow buttons and Move outcome forms; retain the separate drag handle on Board; add explicit destination and move-before/move-after controls to clean saved Details in the shared outcome sidebar with stale-write protection, stable dialog/focus and Board refresh. Timeline dependency ordering and connectors remain in ohwawd-npmi.

- [x] Revise the active OpenSpec design/spec/task language to place non-drag controls in the shared sidebar and keep detailed waits out of the sticky label.
- [x] Compact Board outcome labels to drag handle plus title and remove wait/bypass expansion, rank labels, arrow buttons and movement form.
- [x] Add destination plus explicit move-before/move-after placement controls to clean saved outcome Details using current planning tokens and preserving the open dialog.
- [x] Update browser coverage and product workflow documentation for drag/sidebar equivalence, stale errors, focus and responsive density.
- [x] Run typecheck, affected browser tests, full relevant regression, build and strict validation; summarize verified changes.

## Summary of Changes

Reduced each timeline outcome label to a non-shifting drag handle and title, removing inline rank, arrows, movement forms and expandable wait/bypass content. Added Board placement to clean saved outcome Details with destination and explicit end/before/after controls, current sequence/ownership/planning tokens, stale reload/error handling, focus recovery and open-dialog preservation. Placement is disabled while Details or Projects is being edited.

Updated the active OpenSpec contract and product/Board documentation to record the reviewed density decision. Revised the 12-case Board browser suite for drag/sidebar equivalence, dismissed-prerequisite navigation, stale errors, pending-write isolation and compact 1440/768/390px layouts. Visually inspected refreshed responsive captures. All 135 unit/database tests and 101 Chromium tests passed, along with typecheck, production build, strict validation of 11 current and 7 archived OpenSpec items, and git diff --check. The IRAS-to-CSSM finish-to-start geometry and connector remain in ohwawd-npmi.
