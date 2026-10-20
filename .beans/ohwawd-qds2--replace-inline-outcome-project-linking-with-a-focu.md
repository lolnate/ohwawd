---
# ohwawd-qds2
title: Replace inline outcome project linking with a focused picker
status: completed
type: task
priority: high
tags:
    - ux
    - outcomes
created_at: 2026-10-20T11:13:40Z
updated_at: 2026-10-20T12:15:57Z
---

## Context

Opening Manage project links expanded one outcome card from roughly 1,096px to 3,162px and inserted all 74 imported projects as checkboxes. The two neighboring outcome cards remained in the grid, producing large empty columns and a difficult scanning experience.

## Tasks

- [x] Move project linking into a focused modal, drawer, or dedicated full-width panel.
- [x] Provide search, status filtering, and a concise selected-project summary.
- [x] Keep Minimum required versus Optional clear for selected projects.
- [x] Keep Save and Cancel actions visible while browsing a long result set.

## Acceptance Criteria

- Managing links does not expand a single outcome card into a multi-thousand-pixel page.
- Users can find and classify a project without scanning all 74 entries.
- Existing links and unsaved changes are clearly distinguishable.

## Summary of Changes

Replaced the inline link editor with a viewport-contained native dialog. Added search, status filtering, selected and changed summaries, saved/new/changed/removed indicators, clear requirement classification, and a fixed action footer for long lists.
