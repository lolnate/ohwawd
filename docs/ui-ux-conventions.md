# UI/UX design conventions

This document records the shared UI/UX conventions for Oh, WAWD! It is a reference for agents and contributors to understand how interactions should behave throughout this project.

Read it before designing or modifying UI. Follow these conventions alongside the relevant OpenSpec requirements and existing component patterns. Add conventions here as project-wide design decisions are established; keep feature-specific requirements and technical designs in OpenSpec.

## Overlay sidebars and drawers

- **Clicking or tapping outside an overlay sidebar closes it.** The dimmed backdrop is a dismissal target.
- Clicking within the sidebar, including its whitespace and form controls, keeps it open unless an explicit action closes it.
- A drag that starts inside the sidebar and ends outside does not dismiss it. Outside dismissal requires a pointer interaction that starts and ends on the backdrop.
- Keep an explicit, accessible **Close** button and support **Escape** as equivalent dismissal methods.
- All dismissal methods restore focus to the element that opened the sidebar. If that element no longer exists, use a stable, relevant fallback on the page.
- Keep modal focus contained while the sidebar is open. A backdrop click dismisses the sidebar without activating the page control beneath it.
- At narrow widths where the sidebar fills the screen, Close and Escape remain available even when there is no exposed backdrop.

The project details sidebar (`src/app/project-drawer.tsx`) implements this convention.

## Centered settings overlays

- Workspace-level settings can use a centered modal opened from the signed-in header. Opening it preserves the active workspace view and its local context.
- Centered modals follow the same backdrop, drag-out protection, Close, Escape, focus containment, and focus-restoration conventions as overlay sidebars above.
- Contextual actions open the relevant settings section and focus its target field. General entry focuses the modal heading. If the original opener is unavailable on dismissal, restore focus to the stable header entry point.
- On narrow screens, the modal becomes full-screen with internally scrolling content and a reachable header and Close action. Section navigation wraps and fields stack without page-level horizontal overflow.
