# Outcome catalog delta

## ADDED Requirements

### Requirement: Projects without outcomes prioritize current and future work
The Outcomes view SHALL identify candidate projects as Projects without outcomes and SHALL provide a local status filter. The initial filter SHALL include Backlog, Todo or Planned, and In Progress or Started statuses while excluding other statuses. Every available candidate-project status SHALL remain selectable, and filtering SHALL NOT change saved planning data.

#### Scenario: Review current candidate projects by default
- **WHEN** candidate projects include current or future work and terminal or paused work
- **THEN** Projects without outcomes initially shows only Backlog, Todo or Planned, and In Progress or Started projects
- **AND** the result count identifies the filtered number and total candidate-project number

#### Scenario: Include another project status
- **WHEN** the planner selects another available status in the Projects without outcomes filter
- **THEN** matching candidate projects appear in the section
- **AND** their roadmap state, ownership and outcome links remain unchanged

#### Scenario: Navigate to projects without outcomes
- **WHEN** the planner selects Projects without outcomes in the Outcomes section navigation
- **THEN** that section heading is scrolled into view and focused
- **AND** the existing Outcome catalog query state is preserved
