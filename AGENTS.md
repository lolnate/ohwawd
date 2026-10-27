## UI/UX Design Conventions

[docs/ui-ux-conventions.md](docs/ui-ux-conventions.md) is the project reference for agents to understand and apply our UI/UX design conventions. Read it before designing or changing UI, and follow it alongside the relevant OpenSpec requirements. When a new project-wide interaction convention is agreed, document it there so future agent work stays consistent.

[docs/visual-theme.md](docs/visual-theme.md) defines the **Neon Velocity** visual identity, semantic color tokens, typography, component treatments and accessibility rules. Read it before visual design work, respect its implementation status, and keep new visual decisions consistent with that reference. [docs/theme-preview.html](docs/theme-preview.html) is a standalone visual study, not application functionality.

## Planning and Task Tracking

This project uses **OpenSpec** for specification-driven development and **Beans** for task tracking.

### Responsibilities

**OpenSpec** defines *what* should be built and *why*:
- Requirements, expected behavior, and acceptance criteria
- Architecture and technical design decisions
- Proposed changes to existing system behavior
- Long-lived specifications of implemented functionality

**Beans** defines *what work needs to be done*:
- Actionable implementation tasks and bugs
- Task dependencies, priorities, and blockers
- Implementation progress and completion status
- Follow-up work discovered during development

Do NOT use a Bean to track tasks for some situational work like:
- Quick infrastructure changes (like restarting or tweaking the launch of npm or the server)

OpenSpec is the source of truth for requirements and design. Beans is the source of truth for execution state.

### When to Use Each System

Use **OpenSpec** when:
- Introducing a significant new feature or capability
- Making architectural or cross-cutting changes
- Changing existing system behavior or public interfaces
- Requirements are ambiguous or multiple approaches need evaluation

Use **Beans** when:
- Implementing or decomposing approved work
- Tracking bugs, refactors, tests, or maintenance
- Recording dependencies and implementation progress
- Capturing newly discovered work that needs to persist across sessions

Small, self-contained changes generally require only a Bean. Not every task requires an OpenSpec proposal.

Do not create an OpenSpec change for routine fixes unless the fix changes documented behavior or has architectural implications.

### OpenSpec to Beans Workflow

For significant features or changes:

1. **Plan with OpenSpec.** Create the appropriate proposal, specifications, and design artifacts. Review and refine the plan before implementation.
2. **Decompose into Beans.** When the design is sufficiently defined, translate the implementation plan into actionable Beans tasks.
3. **Link the artifacts.** Every Bean derived from OpenSpec must reference the corresponding OpenSpec change and relevant specification or design files using repository-relative paths.
4. **Track dependencies.** Identify prerequisite tasks and represent their dependencies in Beans. Avoid creating tasks that cannot be completed independently without documenting their blockers.
5. **Implement from Beans.** Agents should select actionable, unblocked tasks, read the referenced OpenSpec artifacts, and implement according to the approved design.
6. **Validate completion.** Verify code and tests against the relevant requirements and acceptance criteria before closing a Bean.
7. **Complete the OpenSpec change.** Once all associated Beans are complete, reconcile the OpenSpec task checklist, validate the overall implementation, and archive the OpenSpec change through its normal workflow.

Do not duplicate full OpenSpec specifications inside Beans. Reference the source documents and include only the context needed to execute the task.

### Task Definition Guidelines

Each implementation Bean should:
- Describe a clear, bounded unit of work
- Include measurable completion criteria
- Reference relevant OpenSpec files when applicable
- Identify dependencies and blockers
- Be independently testable where practical

Prefer tasks that can be completed and validated in a focused development session.

Avoid overly granular tasks that introduce tracking overhead without improving coordination.

### Agent Workflow

At the beginning of a session:
- Run `beans prime` and follow its instructions.
- Inspect relevant existing Beans before creating new ones.
- If a task references OpenSpec, read its associated artifacts before making changes.

During implementation:
- Follow the design established in OpenSpec.
- Update Beans task status as work progresses.
- Create new Beans for significant follow-up work or discovered bugs.
- Avoid duplicating existing tasks.
- If implementation reveals a material design or requirements issue, update or propose a change to the OpenSpec artifacts before proceeding with the affected work.
- Do not silently deviate from an established design.

At completion:
- Run relevant tests and validation.
- Update and close completed Beans.
- Include relevant Bean IDs in commit messages.
- Reconcile OpenSpec checklists with completed work when appropriate.
- Do not archive an OpenSpec change while associated implementation work remains incomplete or unresolved.

### Keeping Systems Consistent

- **OpenSpec owns requirements and design.** Do not use Beans to introduce conflicting requirements.
- **Beans owns execution state.** Do not use OpenSpec checkboxes as a competing live task tracker.
- Changes to requirements should be reflected in OpenSpec.
- Changes to task scope, status, or dependencies should be reflected in Beans.
- When an OpenSpec change is archived, ensure its associated Beans are complete and maintain valid references to the archived artifacts.
- Never mark work complete solely because code has been written; verify it against the requirements.

### Tooling

Use the installed CLI tools and their documented workflows rather than manually modifying generated metadata.

- `beans prime` — Load Beans instructions and task-management guidance.
- `beans help` — Discover supported Beans commands.
- `openspec list` — Inspect active OpenSpec changes.
- `openspec status --change <change-name>` — Inspect an OpenSpec change's artifact status.

Follow the project's installed OpenSpec workflow instructions when creating, modifying, verifying, or archiving changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
