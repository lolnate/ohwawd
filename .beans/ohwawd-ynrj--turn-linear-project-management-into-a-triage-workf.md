---
# ohwawd-ynrj
title: Turn Linear project management into a triage workflow
status: completed
type: task
priority: normal
tags:
    - ux
    - linear
created_at: 2026-10-20T11:13:40Z
updated_at: 2026-10-20T12:30:54Z
---

## Context

The default Linear projects view mixes all 74 backlog, started, completed, canceled, and planned projects. Only about 11 rows fit in the desktop list viewport, and every row repeats a Hide action. Search is effective: entering Identity reduced the result set from 74 to one.

## Tasks

- [x] Add planning-oriented presets or grouping such as Needs planning, Active, Completed, and Hidden.
- [x] Add useful sorting and bulk selection or bulk hide controls.
- [x] De-emphasize completed and canceled work in the default planning view.
- [x] Preserve the effective search and status-filter behavior.

## Acceptance Criteria

- The default view emphasizes projects that require planning decisions.
- Users can curate multiple irrelevant projects without invoking Hide one row at a time.
- Current result count and active filters remain obvious.

## Summary of Changes

Made Needs planning the default triage preset and added Active, Completed, Hidden, and All visible views with sorting and explicit filter summaries. Added row and result-set selection plus an atomic bulk hide/restore endpoint while preserving search and status filtering.
