# UI/UX design conventions

This document records the shared UI/UX conventions for Oh, WAWD! It is a reference for agents and contributors to understand how interactions should behave throughout this project.

Read it before designing or modifying UI. Follow these conventions alongside the relevant OpenSpec requirements and existing component patterns. Add conventions here as project-wide design decisions are established; keep feature-specific requirements and technical designs in OpenSpec.

## Visual identity and theme

[Neon Velocity](visual-theme.md) is the project's visual-design reference: a neon-1980s motorsport and orbital-future direction with precise tokens, typography, component recipes and accessibility requirements. Read its implementation status before applying it. Use its semantic roles rather than inventing component-specific palettes; interaction conventions in this document continue to apply. A standalone [theme preview](theme-preview.html) illustrates the direction with example data.

## Overlay sidebars and drawers

- **Clicking or tapping outside an overlay sidebar closes it.** The dimmed backdrop is a dismissal target.
- Clicking within the sidebar, including its whitespace and form controls, keeps it open unless an explicit action closes it.
- A drag that starts inside the sidebar and ends outside does not dismiss it. Outside dismissal requires a pointer interaction that starts and ends on the backdrop.
- Keep an explicit, accessible **Close** button and support **Escape** as equivalent dismissal methods.
- All dismissal methods restore focus to the element that opened the sidebar. If that element no longer exists, use a stable, relevant fallback on the page.
- Keep modal focus contained while the sidebar is open. A backdrop click dismisses the sidebar without activating the page control beneath it.
- At narrow widths where the sidebar fills the screen, Close and Escape remain available even when there is no exposed backdrop.

The project details sidebar (`src/app/project-drawer.tsx`) implements this convention.

## Multi-section editing overlays

The Settings overlay and approved outcome-sidebar design share this interaction model:

- Keep one overlay open while switching its internal sections. Section navigation preserves each draft and its editing context; it does not save or discard changes.
- Use explicit section-scoped save and cancel labels when sections persist independently. Saving or cancelling one section leaves other sections' unsubmitted changes intact. Identify sections containing unsaved changes.
- Closing through Close, Escape or backdrop discards unsubmitted drafts without autosave or a new discard-confirmation step. Explain this behavior while changes are unsaved. Reopening starts from saved data.
- Keep dismissal available during submitted writes. Dismissal does not cancel persistence; an earlier request must not close, reset or steal focus from a newer opening.
- Distinguish rejected writes from successful persistence followed by a refresh failure. Retain drafts on rejection, and offer refresh-only retry after persistence succeeds.
- Keep section controls, Close, relevant save actions, and dirty/pending/saved/error feedback accessible at narrow widths. Preserve the surrounding page's browsing context.

Outcome-specific sections, creation behavior, validation and save boundaries are defined in the active [Outcome Catalog design](../openspec/changes/redesign-outcome-catalog/design.md), Decisions 5–7. That sidebar is planned, not yet implemented.

## Centered settings overlays

- Workspace-level settings can use a centered modal opened from the signed-in header. Opening it preserves the active workspace view and its local context.
- Centered modals follow the same backdrop, drag-out protection, Close, Escape, focus containment, and focus-restoration conventions as overlay sidebars above.
- Contextual actions open the relevant settings section and focus its target field. General entry focuses the modal heading. If the original opener is unavailable on dismissal, restore focus to the stable header entry point.
- On narrow screens, the modal becomes full-screen with internally scrolling content and a reachable header and Close action. Section navigation wraps and fields stack without page-level horizontal overflow.
- Settings drafts survive section switches within one opening. Explicit save actions apply to their section; closing discards unsubmitted edits. A submitted save can finish after dismissal and still refresh planning views.
- Report successful persistence separately from a failed follow-up refresh. Offer a refresh retry without submitting the saved edit again.
