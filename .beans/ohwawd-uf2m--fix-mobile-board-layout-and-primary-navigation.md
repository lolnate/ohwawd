---
# ohwawd-uf2m
title: Fix mobile board layout and primary navigation
status: todo
type: task
priority: high
tags:
    - ux
    - mobile
created_at: 2026-10-20T11:13:40Z
updated_at: 2026-10-20T11:13:40Z
---

## Context

The Playwright UX audit found that the loaded Board expands to an effective 822px layout on a 390px iPhone viewport, while other views remain 390px. Primary navigation also clips: Scenarios extends to x=407 and selecting it shifts Board to x=-17.

## Tasks

- [ ] Keep the Board within the mobile viewport and contain wide cycle content with an explicit responsive pattern.
- [ ] Replace or revise the mobile navigation so all four destinations remain discoverable and reachable.
- [ ] Verify the active destination and horizontal position remain clear after changing sections.
- [ ] Test Board, Outcomes, Linear projects, and Scenarios at desktop and common mobile widths.

## Acceptance Criteria

- No page-level horizontal overflow occurs at 390px.
- No navigation label is clipped or positioned outside the viewport.
- Wide planning tables provide an obvious, contained scrolling or alternate mobile presentation.
