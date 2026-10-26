# Proposal

## Why

The Board currently treats projects with Linear project-level scope as unsized when their individual issues are unestimated, so project bars extend indefinitely and dependent projects cannot form a readable sequence. The timeline also repeats verbose waiting explanations that obscure the core answer: what runs, when, and what depends on what.

## What Changes

- Use Linear's project scope and completed-scope history to derive remaining project demand when that aggregate evidence is available; retain issue estimates and Extra scope as the fallback.
- Render the consumed fraction of a project's final forecast cycle so bar length reflects points divided by stream capacity instead of rounding every finish to a whole cycle.
- Keep one sequential capacity-owning project schedule per stream and connect visible immediate dependencies between project bars/references.
- **BREAKING:** remove verbose waiting, priority-bypass, and unsized-reason prose from timeline rows. Keep detailed explanations and remediation in project details and other dedicated inspection surfaces.
- Establish a project-wide convention that roadmap timelines remain a sparse schedule visualization rather than an explanatory dashboard.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stream-sequencing`: Define authoritative aggregate remaining-scope demand and issue-level fallback behavior for finite capacity scheduling.
- `planning-timeline`: Require fractional capacity geometry, sequential connector presentation, and compact timeline content without verbose warning rows.

## Impact

Linear project import, cached project schema and migration, import change reporting, Board forecast inputs, timeline geometry, project inspection data, scenarios carrying additive source fields, UI conventions, and unit/database/browser coverage. No new dependency or Linear write is required.
