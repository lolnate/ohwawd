# visual-theme Specification

## Purpose
Give Oh, WAWD! a consistent retro-future visual identity while keeping planning data, controls, semantic states and accessibility clear throughout the application.

## Requirements

### Requirement: Theme has a durable agent reference
The project SHALL maintain an agent-accessible theme reference containing identity principles, exact semantic tokens, typography, component recipes, accessibility rules and implementation status. Agent instructions and UI/UX conventions SHALL link to it. Any standalone visual study SHALL be labeled as illustrative design reference rather than live planning functionality.

#### Scenario: A future agent changes a component
- **WHEN** an agent follows the project's visual-design instructions
- **THEN** it can locate the palette, component treatment and implementation status from the linked theme reference
- **AND** it can distinguish the static visual study from the production interface

### Requirement: The application uses a consistent semantic palette
The application SHALL use shared semantic styling for surfaces, text, actions, focus, selection and status roles according to Neon Velocity. The identity SHALL combine dark neutral surfaces, cyan interaction accents and restrained magenta branding. Semantic state meanings SHALL remain distinct from decorative branding.

#### Scenario: Navigate between workspace views
- **WHEN** a planner moves between Board, Outcomes, Linear projects and scenarios and opens their overlays
- **THEN** their surfaces, labels, controls and feedback follow the same semantic palette
- **AND** essential controls do not retain conflicting light-theme treatments

### Requirement: Contrast and keyboard focus remain readable
Normal meaningful text SHALL meet a 4.5:1 contrast ratio against its rendered background; large text and essential graphical/control boundaries SHALL meet 3:1. Keyboard focus SHALL have a visible outline distinct from hover and selection. Glow or decorative borders alone SHALL NOT be the sole focus or essential-control boundary cue.

#### Scenario: Focus an action or input
- **WHEN** the planner tabs through a bright primary action, dark field, timeline control or overlay action
- **THEN** the label and boundary meet applicable contrast requirements and a visible focus outline identifies the current control
- **AND** the outline remains visible rather than being clipped by decoration

### Requirement: Color is accompanied by meaningful state cues
Selection, success, warnings, errors, unavailable/read-only states and forecast provenance SHALL retain explicit labels, shapes or patterns in addition to color. Secondary and completed/reference content SHALL remain readable. Styling SHALL NOT infer new lifecycle or risk states from decorative hues or dates alone.

#### Scenario: Compare error and selected states
- **WHEN** an outcome or project is selected and also has blocked work
- **THEN** selection and the blocker remain separately identifiable by their existing text and structural cues
- **AND** the theme does not hide explanations by fading the whole row

### Requirement: Planning graphics preserve ownership and provenance
Capacity-owning project bars SHALL retain solid filled treatment and shared references SHALL retain outlined/dashed treatment with explicit zero-count wording. Projected/provisional provenance SHALL be distinguishable independently of ownership. Reduced availability and missing calendar coverage SHALL retain labeled, distinguishable treatments when combined with projected coverage.

#### Scenario: A project is owned and projected
- **WHEN** an owned project's forecast uses projected cycles
- **THEN** its solid capacity-owning treatment remains visible along with a separate provenance cue
- **AND** it is not visually mistaken for a shared zero-count reference

#### Scenario: A reduced week is also projected
- **WHEN** a projected calendar week has reduced availability
- **THEN** both projected provenance and the actual availability percentage remain understandable
- **AND** neither pattern implies additional forecast capacity

### Requirement: Theme changes preserve planning behavior and data geometry
Applying the theme SHALL preserve project durations and positions, timeline/calendar scales, point and capacity calculations, dependency meanings, filters, saved state and scenario behavior. Visual identity SHALL NOT add fabricated progress, speed or capacity indicators unrelated to the planning model.

#### Scenario: Restyle an existing plan
- **WHEN** the same saved plan is rendered before and after the theme migration
- **THEN** its forecast values, project scheduling geometry and ownership remain equivalent
- **AND** the visible differences express styling rather than a new scheduling or funding decision

### Requirement: Controls and overlays keep their existing interaction contracts
Inputs, actions, native controls, drawers and dialogs SHALL remain readable across normal, hover, pressed, selected, disabled, pending, success and error states. Existing labeled-field, explicit-save, backdrop/Close/Escape, focus-containment and focus-restoration behavior SHALL be preserved wherever established by the component's interaction contract.

#### Scenario: Save a form in an overlay
- **WHEN** a planner edits and submits an existing overlay form
- **THEN** pending and successful or failed states remain legible in the new theme
- **AND** the same save, dismissal and focus behavior applies

### Requirement: Typography and density support responsive planning
The theme SHALL use readable working-interface typography, restrained display/telemetry accents and the reference's size hierarchy. Dense screens SHALL retain compact useful rows and complete accessible labels. Mobile fields and controls SHALL remain readable and operable without page-level overflow or clipped content introduced by theme decoration.

#### Scenario: Inspect a dense plan on a narrow screen
- **WHEN** the interface is viewed at 390px width or with enlarged text
- **THEN** meaningful labels, actions and state cues remain reachable and legible
- **AND** existing timeline scrolling stays within its scroll region rather than widening the page

### Requirement: Decorative motion respects user preferences
Decorative effects SHALL remain subordinate to working data and SHALL NOT introduce continuous flicker, pulsing, parallax or scanline/starfield animation in planning views. Any introduced nonessential transitions, translations and smooth scrolling SHALL respect reduced-motion preferences. Forced-color users SHALL retain meaningful labels, state distinctions and visible system-compatible focus cues.

#### Scenario: Use accessibility display preferences
- **WHEN** reduced motion or forced colors is active
- **THEN** the interface remains usable without essential information depending on movement, glow or neon fill
- **AND** keyboard focus and ownership/status distinctions remain perceptible

### Requirement: Theme assets do not require external services
The theme SHALL render using local assets and font fallbacks without runtime or build-time requests to an external font service. Any bundled display font SHALL include its license. The standalone visual reference SHALL be viewable without external scripts, fonts or image requests.

#### Scenario: Render without external network access
- **WHEN** the application or standalone visual study is opened with external asset access unavailable
- **THEN** the interface remains readable and the theme's typography has a working local fallback
- **AND** no external font download is required to build the application
