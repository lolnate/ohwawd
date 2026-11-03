# Spec Delta

## ADDED Requirements

### Requirement: Finite project bars adapt their visible identity
Each finite project bar SHALL show the full project name when it fits beside fixed planning context. When the available name slot fits at least half of the rendered full name, the name SHALL remain visible and ellipsize; otherwise the bar SHALL use the stable project code. Label selection SHALL update with rendered geometry and SHALL NOT alter schedule width, hit target, tooltip, or accessible detail.

#### Scenario: Full project name fits
- **WHEN** a finite project bar has enough name-slot width for its complete project name after fixed planning context
- **THEN** the bar shows the complete project name
- **AND** its existing points, accounting, dependency, optionality, projection, and continuation context remains concise and unchanged

#### Scenario: Most of a project name fits
- **WHEN** the complete project name does not fit but at least half of its rendered width fits in the available name slot
- **THEN** the bar shows the project name in that slot with a visible ellipsis
- **AND** it does not replace the name with the project code solely because the complete name overflows

#### Scenario: A narrow bar cannot identify the name usefully
- **WHEN** less than half of the rendered project name fits in the available name slot
- **THEN** the bar uses the stable generated project code as its visible identity
- **AND** the truthful schedule width and minimum pointer target remain unchanged

#### Scenario: Geometry or typography changes
- **WHEN** forecast consumption, viewport width, fixed context, or loaded fonts change the rendered space or text measurements
- **THEN** the visible identity is recalculated from the current rendered values
- **AND** it can move between full name, ellipsized name, and project code without requiring a page reload

#### Scenario: Visible text is abbreviated
- **WHEN** a bar shows an ellipsized name or generated project code
- **THEN** its tooltip and accessible name still expose the complete project name, code, accounting state, dependency context, and schedule detail
- **AND** keyboard, forced-colors, reduced-motion, and narrow-screen operation remain available
