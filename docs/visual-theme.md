# Neon Velocity — visual theme

**Design intent:** accelerate to the future.

**Status:** specified, implementation pending. Runtime adoption is tracked in [establish-neon-velocity-theme](../openspec/changes/establish-neon-velocity-theme/proposal.md). The live application has not yet been restyled. The [visual preview](theme-preview.html) is a standalone design reference with illustrative data, not a working planning screen.

Implementation epic: **ohwawd-t1qd — Adopt Neon Velocity visual theme**. Its linked tasks cover tokens, shared controls, planning graphics, remaining views and accessibility/regression verification.

This is the visual-design reference for agents and contributors. Read it alongside [UI/UX conventions](ui-ux-conventions.md) and the relevant OpenSpec requirements before changing visual design. OpenSpec owns acceptance criteria; this document owns the exact visual vocabulary and token values. Keep both consistent as the theme evolves.

## 1. North star

**A precision roadmap cockpit, lit by a neon horizon.** The product should feel like a disciplined engineering instrument from an optimistic 1980s vision of the future: confident, technical, kinetic and a little outrageous. The roadmap is the team's route toward a better future; the interface makes the next move and its tradeoffs legible.

Think **midnight pit lane × orbital mission control**, expressed through restrained surfaces and decisive highlights.

### Inspiration translated into design

| Reference | Take into the interface |
| --- | --- |
| 1989 Ferrari F40 Competizione | Low, purposeful proportions; exposed engineering; strong silhouettes; thin louver-like divisions and a decisive accent stripe. |
| 1984 Honda Civic CRX Mugen | Compact, practical information density; technical labels; economical two-tone contrast and livery-like grouping. |
| 1981 BMW M1 | Precise geometry, composed spacing and instrument-panel clarity; controlled blue/magenta accents. |
| 1985 Toyota Sprinter | Angular, lightweight utility; crisp edges and dark/light separation rather than ornamental bulk. |
| 1980s future/space imagery | Deep orbital navy, luminous navigation marks, fine vector lines, horizon gradients and small telemetry numerals. |

References guide shape, rhythm and attitude. Original abstract vector geometry is sufficient; production screens do not need car imagery or manufacturer branding.

### Visual hierarchy

1. **The work:** outcome names, project order, dates, capacity and blockers.
2. **The controls:** one clear primary action, readable fields, visible selection and keyboard focus.
3. **The atmosphere:** a narrow accent rail, quiet depth and occasional horizon artwork in non-data regions.

Most of the canvas stays dark and neutral. Reserve highly saturated color for a small part of the screen. Large decorative hero artwork belongs in the reference/identity study or sparse welcome states, not above every working board.

## 2. Color system

Use semantic CSS custom properties. The names below are the target implementation contract. Add component-specific aliases only when they clarify a real role; do not introduce arbitrary new hex colors in component styles.

### Surfaces and typography

| Token | Value | Role |
| --- | --- | --- |
| `--color-page` | `#070A12` | Space-black application canvas. |
| `--color-surface` | `#0D1424` | Primary panels, catalog rows, timeline backing. |
| `--color-surface-raised` | `#111C30` | Drawers, dialogs, input surfaces and elevated groups. |
| `--color-surface-hover` | `#16243B` | Hovered rows and secondary controls. |
| `--color-border` | `#22344D` | Quiet separators and noninteractive panel outlines. |
| `--color-border-strong` | `#637B9D` | Input/control boundaries requiring clear separation. |
| `--color-text` | `#F2F6FF` | Headings, important labels and values; porcelain white. |
| `--color-text-muted` | `#B2C0D8` | Descriptions, secondary values and explanatory copy. |
| `--color-text-subtle` | `#8194B4` | Supporting labels, placeholders and minor telemetry. |
| `--color-on-accent` | `#07101D` | Dark text/icons on bright filled actions. |

### Identity and interaction

| Token | Value | Role |
| --- | --- | --- |
| `--color-action` | `#51E5FF` | Electric cyan: primary action, links and active navigation. |
| `--color-action-hover` | `#92F0FF` | Primary action hover. |
| `--color-action-active` | `#28C6E2` | Pressed primary action. |
| `--color-brand-secondary` | `#FF5CC8` | Laser magenta: identity stripe, restrained display accents, nonsemantic artwork. |
| `--color-focus` | `#FFE18A` | Distinct warm-white/yellow keyboard-focus ring. |
| `--color-selection-bg` | `#182B46` | Selected rows/options, with a cyan rail and an explicit selected marker. |

The identity gradient is `linear-gradient(110deg, #51E5FF 0%, #8CACFF 48%, #FF5CC8 100%)`. Use it for a narrow brand rail or isolated artwork, not normal text, action labels, status encoding or a project-duration fill.

### Semantic states

| Role | Foreground token/value | Background token/value | Companion cue |
| --- | --- | --- | --- |
| Success / target met | `--color-success: #62F6B5` | `--color-success-bg: #0E2D2A` | Check + explicit status text. |
| Warning / setup / horizon | `--color-warning: #FFC56D` | `--color-warning-bg: #332817` | Warning mark, percentage or explanation. |
| Error / blocked / destructive | `--color-danger: #FF7389` | `--color-danger-bg: #351E2C` | Error/blocker wording or explicit destructive action. |
| Information / source context | `--color-info: #8CACFF` | `--color-info-bg: #172742` | Source/information label. |
| Provisional / projected | `--color-provisional: #BCA4FF` | `--color-provisional-bg: #241D39` | Asterisk, hatch or Provisional text. |
| Neutral / unknown / unplanned | `--color-text-muted` | `--color-surface-raised` | Explicit Unknown, Unplanned or equivalent current label. |

Magenta is an identity accent, not an error or an invented planning status. Success mint is not the default action color. A past target date alone is not proof of a missed forecast; preserve the product's actual status meanings.

### Planning-specific tokens

| Token | Value | Use |
| --- | --- | --- |
| `--color-project-owned-bg` | `#155568` | Solid capacity-owning project bar; white label, cyan edge. |
| `--color-project-owned-border` | `#51E5FF` | Owned bar boundary. |
| `--color-project-shared-bg` | `#141C2D` | Outlined shared/reference bar. |
| `--color-project-shared-border` | `#8A9CBA` | Dashed reference boundary, with Shared / 0 pts here. |
| `--color-capacity-reduced-bg` | `#332817` | Reduced-availability week band, with amber header and explicit percentage. |
| `--color-calendar-projected-bg` | `#241D39` | Projected calendar zone, with violet context and a labeled hatch. |

Colors do not encode capacity ownership by themselves. Solid fill plus wording means counted; outlined/dashed plus wording means shared. Projected owned bars retain their solid ownership fill and use a separate provenance mark/hatch. Do not make an owned projected bar indistinguishable from a shared reference by giving both the same outline treatment. Missing-calendar gaps retain their own neutral pattern and explanation.

### Contrast reference

Calculated with WCAG relative luminance on the listed **opaque** sRGB pairs, rounded to two decimals:

| Pair | Ratio |
| --- | --- |
| Main text on hover surface | 14.38:1 |
| Muted text on hover surface | 8.46:1 |
| Subtle text on hover surface | 5.06:1 |
| Cyan link on panel | 12.25:1 |
| Magenta text accent on panel | 6.67:1 |
| On-accent ink on cyan primary action | 12.72:1 |
| Strong border against hover surface | 3.59:1 |
| Focus ring against hover surface | 12.14:1 |
| Main text on solid owned project fill | 7.67:1 |
| Success / warning / danger / info text on matching semantic background | 10.77 / 9.24 / 5.87 / 6.73:1 |

Normal meaningful text must reach 4.5:1; large text and essential control/graphical boundaries must reach 3:1. Recheck rendered combinations after changes, including alpha blending, hover, focus, errors and projected/reduced calendar overlaps. `--color-border` is decorative and is not sufficient as the only input/focus/state boundary. Do not fade an entire card, reference bar or completed row to make it secondary: use the designated text/surface tokens instead.

## 3. Typography, geometry and density

- **Display:** target self-hosted **Space Grotesk**, weights 600–700, for the wordmark and major view headings. Use a system sans fallback until the optional local font asset and its license are included. Never require a font network request during build or page load.
- **Working UI:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, typically 14–15px with 1.45–1.6 line height. Keep long outcome names and explanations in normal sentence case.
- **Telemetry:** `ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`, with tabular numerals for dates, points, percentages and compact project codes. This is an accent, not the font for all prose.
- Supporting text is normally at least 12px; exceptionally dense cycle-context labels can be 11px. Touchscreen text-entry fields use at least 16px to avoid automatic input zoom. Do not shrink labels to fit additional columns.
- Eyebrows and short section markers can be uppercase at 12px with approximately `.1em` tracking. Do not uppercase paragraphs, outcome names or every button.
- Use a 4px spacing base, with 8/12/16/24/32px steps. Dense data rows remain compact; do not add large card padding to make the theme feel expensive.
- Panels: 12px radius; controls: 6px; project bars: 4px; badges: 4px. These are default visual tokens, not a reason to alter timeline dimensions or existing touch targets. Avoid making everything pill-shaped.
- A small clipped-corner or three-stripe motif can distinguish the wordmark/identity artwork. Keep real focusable controls rectangular and unclipped so outlines remain visible.

## 4. Component recipes

### Workspace and navigation

Space-black canvas, solid dark header and panel surfaces. The active workspace view has cyan text, an underline and its existing programmatic current state. A narrow cyan-to-magenta brand rail can run along the header. Keep the product name **Oh, WAWD!** and established navigation labels.

### Buttons, inputs and focus

- Primary: cyan fill, on-accent ink, 6px radius, readable label; no glowing white text on a bright background.
- Secondary: raised/hover surface, main text and strong border. Quiet/text actions use cyan text; destructive actions use danger color with clear wording.
- Fields: opaque raised surface, main text, subtle placeholder and strong boundary; visible labels remain above the field. Native controls use a dark color scheme and cyan check/radio accents.
- Focus: a real 3px `--color-focus` outline with 3px offset, with space-black separation if adjacent colors require it. Do not rely on a shadow alone or remove the outline to achieve a neon look.
- Disabled: visibly noninteractive without fading surrounding instructions or important state text. Hover/pressed styling is scoped to enabled controls.

### Lists, catalog and data tables

Use quiet separators, clear alignment and a subtly elevated hover/selection surface. Titles are white; secondary metadata is muted; values can use tabular numerals. The planned Outcome Catalog stays a compact list; the theme does not reintroduce large cards or extra project-key disclosures. Filters and counts remain readable, not decorative dashboard ornaments.

### Board and forecasting

Treat timeline geometry as data. Bar positions, widths, week widths, stream allocation and point counts retain their real meanings. Use the planning-specific tokens and explicit ownership/provenance/availability labels above. A cyan project bar is not necessarily a success state. Status pills, warnings and dependency explanations keep their own semantic colors and text. Reduced and projected week patterns remain distinguishable when overlapping.

### Drawers, pickers and Settings

Raised opaque surfaces, a quiet strong edge, a solid persistent header and readable form groups. Backdrop: space black at approximately 72% opacity; subtle blur can enhance separation but must not be required for legibility. Preserve existing backdrop/Close/Escape/focus and mobile full-screen conventions. Retain visible pending, saved and failed states.

### Scenarios, comparison and source views

Use the same surfaces and tokens. Differences use their actual Added/Removed/Changed labels plus semantic markers; no red/green-only diff. Published/read-only status and source provenance remain explicit. The login view can carry a small horizon-grid illustration, while operational views prioritize the work.

## 5. Atmosphere and motion

- Neon belongs on edges, active indicators and identity artwork. Permit a small ambient glow on the brand rail or isolated illustration, never a blurred text halo or a glow around every panel.
- A quiet vector horizon/grid or orbital arc can decorate empty/welcome areas. Keep it out of table cells and timeline tracks so it cannot be mistaken for capacity bands, dates or dependencies.
- Interaction transitions: 120–160ms ease-out, primarily color, border and opacity. An overlay may enter with a small 8–12px translation. No continuous pulsing, starfields, animated scan lines, flicker or parallax while planning.
- Respect `prefers-reduced-motion`: remove nonessential animation/translation and smooth scrolling introduced by the theme. Preserve focus and completion cues without motion.
- Support forced colors with system colors and real outlines; ensure ownership, selection and status remain understandable when neon fills disappear. Do not globally disable the user's color adaptation.

## 6. Language and restraint

The identity line is **“Accelerate to the future.”** Suitable supporting copy: “Make the next move clear.” / “A route from ambition to delivery.” Use it sparingly in identity or onboarding contexts.

Operational labels stay plain and precise: Outcome, Project, Capacity, Forecast, Shared, Required, Optional. Do not rename dates as warp coordinates, work as fuel or a blocker as a boss fight. Do not introduce fake speedometers or decorative progress values disconnected from the planning model.

## 7. Agent implementation rules

1. Read this reference, the conventions and the active feature/theme specs. Respect this document's implementation status; do not silently restyle the whole application while implementing an unrelated feature.
2. Establish shared tokens first, then replace existing hard-coded light/green palette values in the affected stylesheets. Do not invert the entire page with a CSS filter or add a high-specificity override wall.
3. Keep atmosphere in non-data regions and state semantics in labeled components. Extend tokens when a real missing role is discovered and record the rationale here.
4. Check normal, hover, selected, focus, disabled, loading, empty, success, warning, error and provisional states; also drawers/pickers, native inputs and all four workspace views.
5. Verify desktop, tablet, 390px mobile, keyboard operation, reduced motion and forced colors. Color changes must not alter scheduling, filtering, ownership or data persistence.
6. Keep the preview synchronized with material palette/recipe changes. It is a visual aid; production CSS and behavior must still satisfy the OpenSpec requirements.
