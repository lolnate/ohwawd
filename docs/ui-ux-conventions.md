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
