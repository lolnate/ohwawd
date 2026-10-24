# Design

## Context

See `proposal.md` for motivation. [The theme reference](../../../docs/visual-theme.md) defines the exact palette and component recipes; [the preview](../../../docs/theme-preview.html) illustrates the direction with example data.

`src/app/layout.tsx` imports the base stylesheet and numerous feature stylesheets. Colors are mostly literal light/green values, including highly specific timeline rules and minified base/workspace rules. Changing only the root background or appending overrides would leave unreadable controls and mixed light/dark surfaces.

The Board uses color alongside ownership, forecast provenance, availability and dependency information. Existing owned-projected and shared bars can both have dashed borders, so the migration must preserve a solid ownership fill and add a distinct provenance cue rather than relying on border color alone.

The separate Outcome Catalog and Workspace Settings plans also introduce surfaces and overlays. Their functional work is independent; their final styles must use the same theme tokens rather than a parallel palette. This session supplies design artifacts and a static study, not a runtime restyle.

## Goals / Non-Goals

**Goals:** a recognizable retro-future identity, readable dense planning screens, reusable semantic styling, and durable instructions for future agents.

**Non-goals:** a theme switcher or light-theme variant, manufacturer imagery in working views, continuous animated scenery, a new component framework, renaming planning concepts, or altering data geometry/behavior.

## Decisions

### 1. Dark-first identity with limited high-energy accents

Use the reference's space-black/navy surfaces, porcelain text and layered neutral metadata. Cyan owns interaction; magenta belongs primarily to identity artwork and thin rails. Mint, amber, rose, blue and violet have separate semantic meanings. The vehicle references inform compact proportions, precision, striping and original wedge-shaped/vector artwork rather than literal automotive UI labels.

Keep decorative horizon/grid/space geometry in sparse welcome or identity regions. Do not put a large hero over working boards, wallpaper behind calendar cells, or a glow around every card. Preserve the application's product name and plain operational labels.

Alternatives considered: a bright synthwave gradient everywhere compromises scanning and status clarity; a dark root with the existing green/white components is an inconsistent partial conversion; literal speedometer/fuel metaphors would obscure the actual planning quantities.

### 2. One semantic token foundation, migrated at source

Introduce a shared `src/app/theme-tokens.css` imported before base/component styles. Define the semantic `--color-*` contract from `docs/visual-theme.md`, font stacks, radii and restrained motion values. Set the appropriate dark `color-scheme` for native form controls.

Convert literal colors in the existing stylesheets to those tokens, including pseudo-elements, gradients, legends, hover states, disabled styling and backdrops. Preserve existing selector structure where possible. Avoid a final high-specificity override sheet, global inversion filters, duplicate theme objects in each component, or arbitrary hue-by-stream palettes.

The rollout can be developed in dependency-ordered commits, but ship the complete surface migration together. The theme is not accepted while common workflows alternate between dark and light surfaces. Keep docs' implementation status pending until verification is complete.

### 3. Typography and geometry support the work

Use the documented UI and telemetry system stacks immediately. Space Grotesk is the chosen display direction; bundle a local font file with its license if included, otherwise use the documented fallback explicitly. No external stylesheet, font CDN, build-time network font fetch or new font package is required.

Apply the reference's type sizes, 4px spacing rhythm and restrained panel/control/bar radii. Do not use tiny type to preserve old padding, or enlarge rows/cards for atmosphere. Keep mobile text fields readable and avoid input zoom. Preserve timeline bar positions, widths, week spans and scrolling geometry; decorative movement must not move measured data.

### 4. Interaction and semantic states are designed together

Migrate primary/secondary/quiet/destructive actions, labeled fields, checkboxes/radios, active navigation, selected rows, empty/loading/error/success messages and readonly/published states as a family. Use dark ink on the bright cyan primary fill. Use a real warm focus outline with sufficient separation, not glow alone. Do not dim whole rows or references to create hierarchy.

Continue existing modal/sidebar behavior from `docs/ui-ux-conventions.md`. Style every header, body, footer and native input in create/link/project-detail/Settings/outcome-detail overlays that exist when the change is implemented. Error and pending feedback must remain visible; styling must not change close/save/focus semantics.

### 5. Planning graphics retain truthful, independent cues

| Meaning | Theme treatment |
| --- | --- |
| Capacity-owning project | Solid deep-teal fill, cyan edge, light label and counted wording. |
| Shared/reference project | Dark neutral fill, dashed high-contrast outline and Shared / 0 pts here wording. |
| Provisional/projected date | Violet provenance label/asterisk and a separate pattern/marker; preserve the owned/shared treatment. |
| Reduced availability | Amber band/header and explicit availability percentage. |
| Missing/partial calendar | Distinct neutral pattern and explanation; never imply added capacity. |
| Blocker/error | Rose semantic marker plus explicit blocker/error text. |
| Success or target met | Mint semantic marker plus actual status text; a cyan duration bar alone does not imply success. |

Check combinations: projected + reduced week, projected + shared project, selected + blocked row, provisional scope + counted project, disabled controls + explanatory text. If a necessary distinction cannot be achieved in CSS, add a small textual/icon cue without altering the underlying forecast. Preserve existing dependency arrows, continuation indicators, dates, points and labels.

### 6. Accessibility is part of the theme contract

Check actual rendered foreground/background pairs, not just palette swatches: normal meaningful text 4.5:1, large text and essential graphical/control boundaries 3:1. The muted/subtle reference colors pass on the specified dark surfaces, but alpha blending and patterned backgrounds require fresh checks. Decorative panel borders are not sufficient as control boundaries. The reference documents calculated opaque-pair ratios.

Respect `prefers-reduced-motion` for any newly introduced transitions, translations and smooth scrolling. Limit normal motion to short, nonessential interaction transitions; no automatic pulses, flicker, starfield or scanline loops. In forced colors, use real outlines/system colors and retain labels, shapes and patterns; do not globally disable user adaptation.

Test keyboard focus on bright actions, dark fields, native selects, timeline blocks and overlay controls. At 1440px, 768px and 390px, preserve dense data legibility and existing horizontal-scroll boundaries. Support zoom/reflow; do not clip focus indicators with decorative corners or overflow.

### 7. Durable agent references and focused verification

`docs/visual-theme.md` is the human/agent reference for exact tokens, visual rationale, component recipes and implementation status. `AGENTS.md` and `docs/ui-ux-conventions.md` link it. `docs/theme-preview.html` is self-contained, has no external assets or requests, and is explicitly labeled as a visual study with illustrative values. It may show proposed catalog forms, but it is not an alternate app route.

The theme implementation should add focused token/contrast checks and browser coverage of rendered states rather than snapshotting every CSS declaration. Use existing planning/browser fixtures for real Board/Outcomes/Linear/scenario workflows and overlay behavior. Visually inspect before/after examples, calendar combinations and accessibility modes; run configured type/build/unit and affected browser checks. Do not introduce a testing or styling dependency solely for this migration.

## Risks / Trade-offs

- [A partial dark conversion hides text on leftover light surfaces] → Audit all imported stylesheets and interactive states, migrate at source and verify the whole product before declaring completion.
- [Neon competes with blockers or provenance] → Keep identity accents separate from semantic colors and retain text/shape cues for every state.
- [Owned projected bars resemble shared work] → Preserve solid ownership fill and add independent provenance markers.
- [Pattern/opacity combinations invalidate swatch contrast] → Verify computed/rendered pairs, including combined calendar states and muted text.
- [A font asset becomes a runtime/build dependency] → Bundle locally with license or use the documented system fallback; no network font service.
- [Catalog/Settings work lands before or after this migration] → Integrate the latest components against the same token contract; do not make their functional implementation a prerequisite for the core theme.

## Migration Plan

Implement the linked Beans in order: token foundation, shared shell/controls/overlays, Board/calendar semantics, secondary views and planned-surface integration, then cross-product accessibility/regression verification. Each implementation unit owns its local checks and documentation. Functional catalog/Settings changes remain separate plans and are not silently included here.

No persisted data or API migration is needed. Rollback restores the previous styles/asset import against the same application state. Update the theme reference's status only after all implementation Beans pass; reconcile the OpenSpec task checklist and archive through the normal workflow afterward.
