# Spec Delta

## MODIFIED Requirements

### Requirement: Capacity bands are actionable
Reduced-capacity weeks SHALL have aligned highlighted headers and body bands with their label and percentage. Planners SHALL be able to select a week from the timeline through keyboard or pointer controls to open Settings at Weekly availability and holidays with that Monday-start week selected. The editor SHALL show current effective availability, including any cycle fallback, and any preset or explicit override.

#### Scenario: Select Thanksgiving week
- **WHEN** the planner selects the highlighted Thanksgiving week
- **THEN** Settings opens to Weekly availability and holidays for that Monday-start week with the week selector focused
- **AND** the current 50% preset or explicit override is visible and editable

#### Scenario: Return to the edited week
- **WHEN** the planner saves a weekly override and closes Settings
- **THEN** the timeline's percentage, capacity bands, and forecast reflect the saved change
- **AND** focus returns to the originating week control if it remains available, otherwise to the header Settings button

#### Scenario: Reopen the same week
- **WHEN** the planner closes Settings and activates the same timeline week again
- **THEN** Settings opens again with that week's latest saved effective availability
- **AND** repeated activation does not reuse a stale or cleared selection
