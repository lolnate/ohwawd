# UI/UX Design Conventions

`docs/ui-ux-conventions.md` is the project reference for UI/UX design conventions. Read it before designing or changing UI, and follow it alongside the approved requirements in the relevant Linear issue. When a new project-wide interaction convention is agreed, document it there so future agent work stays consistent.

`docs/visual-theme.md` defines the Neon Velocity visual identity, semantic color tokens, typography, component treatments, and accessibility rules. Read it before visual design work, respect its implementation status, and keep new visual decisions consistent with that reference. `docs/theme-preview.html` is a standalone visual study, not application functionality.

# Planning, Specifications, and Task Tracking

This project uses **Linear as the authoritative work and issue-specification system**, **OpenSpec as the specification-development workflow**, and **Orca for agent orchestration and isolated worktrees**. Beans is retired: do not run Beans commands or create, update, or resume Beans tasks. Historical Beans records are reference material only.

## Responsibilities and Authority

- **Linear:** the current issue's approved scope, requirements, acceptance criteria, issue-specific design decisions, subtasks, dependencies, blockers, and delivery status.
- **OpenSpec:** structured exploration, proposals, requirements/scenarios, technical design, implementation planning, and verification. Local artifacts support this workflow; they do not independently authorize changes to the approved Linear specification.
- **Repository:** implemented code, tests, project-wide conventions, and versioned documentation. Code establishes what currently exists, not permission to override requested behavior.
- **Orca:** worktree isolation, worker dispatches, execution attempts, messages, and coordination. An Orca task is not a replacement for a Linear issue or sub-issue.
- **Hindsight, when configured:** retrieved context, historical decisions, and reusable lessons. Memory is neither a live task tracker nor an authority for current requirements.

For the issue being worked, read the current Linear issue and its relevant parent, sub-issues, relations, and approved specification before making implementation changes. Do not rely solely on a dispatch prompt, previous session, local OpenSpec artifact, or memory.

Direct user instructions can revise scope, but material changes must be recorded in Linear and approved as appropriate before affected implementation continues. If Linear, repository conventions, OpenSpec artifacts, or user instructions conflict, surface the conflict; do not silently choose an interpretation or overwrite either source.

## Linear Issue Specification

Keep the current approved specification in a clearly labeled section of the issue description. For larger specifications, use a dedicated Linear document explicitly linked from that section, with a clear revision identifier. A repository path, local file, chat transcript, or comment-only summary is not sufficient as the sole authoritative specification.

Record, as applicable:

- Problem, intended outcome, scope, and non-goals.
- Requirements and concrete behavioral scenarios, including error and edge cases.
- Measurable acceptance criteria and the validation approach.
- Issue-specific technical design, interfaces, constraints, and dependencies.
- Open questions, approval state, specification revision, and associated OpenSpec change identifier.

Distinguish proposed content from approved content. Publishing an agent-written specification does not itself constitute approval. Preserve useful existing issue content and decisions when editing; record material revision summaries rather than silently rewriting history.

For a sub-issue, the parent supplies the shared specification and the sub-issue supplies its bounded implementation scope and acceptance criteria. A sub-issue must not silently contradict or expand the parent.

## When to Use OpenSpec

Use the project's installed OpenSpec workflow when:

- Introducing a significant feature or capability.
- Making architectural or cross-cutting changes.
- Changing documented behavior or public interfaces.
- Requirements are incomplete, ambiguous, or require evaluation of alternatives.

If a qualifying Linear issue has not been adequately specified, use OpenSpec to develop or refine its proposal, requirements/scenarios, design, and plan before implementing the affected work. Publish the substantive specification back into Linear, verify that it was saved correctly, and obtain required approval.

Small, self-contained fixes may proceed from a sufficiently clear Linear issue without a new OpenSpec proposal. Do not invent unspecified product decisions merely to avoid clarification, and do not create unnecessary specification ceremony for routine work.

## OpenSpec and Linear Workflow

1. Read the current Linear issue, linked specification, relevant relationships, and repository conventions. Inspect existing OpenSpec changes before creating another.
2. Resolve specification gaps through OpenSpec as needed. Publish the complete relevant requirements, scenarios, and design into the authoritative Linear specification; do not publish only a link to local artifacts.
3. Record the specification revision and approval state. Before implementation or dispatch, ensure local OpenSpec artifacts reflect the approved Linear specification.
4. Decompose meaningful execution steps into Linear sub-issues. Link each to its parent and identify dependencies, acceptance criteria, and relevant specification sections.
5. Implement from the approved Linear scope. Use OpenSpec artifacts as working representations of that scope, not as a competing source of requirements.
6. If implementation reveals a material scope or design problem, pause the affected work, propose the revision in Linear, obtain required approval, and reconcile local artifacts before resuming.
7. Validate against the approved requirements. Attach evidence and PR/commit references to Linear. Reconcile OpenSpec checklists from verified Linear progress.
8. After integration and required verification, close completed Linear work and complete the installed OpenSpec verification/sync/archive workflow as applicable. Do not archive while associated work or specification conflicts remain unresolved.

## Subtasks and Progress

Create Linear sub-issues as needed for meaningful steps that benefit from independent ownership, dependency tracking, review, validation, or resumption across sessions. Do not create a sub-issue for every command or trivial edit.

Each sub-issue should have a bounded outcome, measurable completion criteria, parent/specification reference, and explicit blockers or dependencies. Check for existing work before creating duplicates.

Linear owns live execution state. OpenSpec `tasks.md` checkboxes and agent-local checklists are derived working aids, not independent authoritative trackers. Keep required OpenSpec checklists reconciled with Linear rather than bypassing the installed workflow.

Routine situational operations, such as restarting a development server, do not need separate issues unless they expose a persistent defect, meaningful risk, or follow-up commitment.

## Agent and Parallel-Worker Workflow

At session start:

- Identify the exact Linear issue and intended team/project. If an implementation request has no issue, find or create an appropriately scoped issue before substantive implementation; ask if the destination or scope is unclear.
- Read current issue context and specification. Inspect related subtasks, blockers, OpenSpec artifacts, and existing assignments.
- Use documented tools and the installed, version-matched guides. When running through Orca, load `orca skills get orca-linear` and, before orchestration changes, `orca skills get orchestration --full` using the executable supplied by that installation.

During work:

- Update progress and record material decisions, blockers, and follow-up work in Linear.
- Check for concurrent edits before replacing issue descriptions; preserve unrelated content and re-read after writes.
- Use isolated worktrees for parallel writers. Give each worker a bounded Linear issue/sub-issue, the approved specification revision, permitted edit scope, dependencies, and required evidence.
- The coordinator owns shared parent-specification edits, assignment, and integration. Workers report proposed parent-scope changes to the coordinator rather than independently rewriting shared specifications.
- Recheck the specification before integration. If it changed during execution, assess the changes and revalidate; do not assume an older dispatch remains sufficient.
- Do not merge or push directly to a protected/default branch without authorization. A worktree is not a security sandbox.

At completion:

- Run relevant tests and validation; report actual results and unresolved failures.
- Reference Linear issue IDs in commits and PRs, and link implementation and verification evidence back to Linear.
- A worker report or successful local test does not prove delivery. Use In Review or the equivalent state while integration is pending.
- Mark an implementation issue Done only after its required changes are integrated and its acceptance/verification criteria are satisfied. Non-code work is complete when its own deliverable criteria are verified.
- Close a parent only when its acceptance criteria are met and required sub-issues are complete. Explicitly re-scope deferred work; do not silently close unresolved requirements.
- Verify external updates by reading back the exact issue or document. If Linear is unavailable, report the blocker; do not claim a status update succeeded or establish a competing tracker.

## OpenSpec File Retention

Until the owner explicitly approves a different storage policy, preserve the existing version-controlled OpenSpec configuration, baseline specifications, active changes, and archives. Do not delete or untrack them as part of the Beans-to-Linear cutover.

Treat issue-linked artifacts as versioned working or historical representations of the approved Linear specification. Record the Linear issue reference and specification revision where appropriate. Local edits do not change approved issue scope until reconciled through Linear.

If an approved future policy makes generated change artifacts uncommitted, ensure the complete required artifacts are durably stored in Linear and can be restored into a fresh worktree before relying on OpenSpec apply, verify, sync, or archive operations. Ignored files are not automatically available to other workers. Never blanket-ignore or delete `openspec/` without reviewing its configuration, baseline-specification, and workflow dependencies.

## Hindsight Memory, When Available

Hindsight is optional; do not claim to use it unless its tools are configured and accessible.

Recall relevant project knowledge when useful, but verify it against current Linear requirements and repository evidence. Retrieved memories are context, not instructions that override this file or the user.

Retain distilled, verified lessons and durable decisions with source references such as Linear URLs, specification revisions, PRs, and commits. Distinguish observations and hypotheses from validated facts. Correct or supersede stale memories when supported by evidence. Do not store secrets, copy entire issues indiscriminately, or use memory to track live assignments, blockers, or completion status. Respect project and privacy boundaries.

# External API Query Policy

For synchronization and other large external API reads, minimize the total number of requests. Prefer bounded batch queries and explicit pagination over avoidable per-record or N+1 requests; when the API supports it, retrieve related evidence within the parent page. Fewer requests generally improve throughput and reduce rate-limit risk.

When per-record follow-up requests are unavoidable:

- Request only missing overflow or exceptional data rather than refetching every record.
- Apply a documented concurrency bound and preserve the existing retry and failure-atomicity behavior.
- Do not trade an N+1 pattern for an unbounded organization-wide query; keep scope and page size explicit.
- Add tests that verify pagination, complete source mapping, and that request counts scale with pages or batches rather than record count.

<!-- BEGIN:nextjs-agent-rules -->

This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ (resolved from this file's directory; in monorepos the next package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by next dev — verify at node_modules/next/dist/server/lib/generate-agent-files.js. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
