# Design

## Context

See `proposal.md` for motivation. The current Linear adapter reads issues through each project, so unattached team issues do not enter the cache, and it does not import project labels or issue blocker relations. `linear_issue_cache.project_id` is required, issue history is updated in place, and the Board API returns project-scoped issues directly. Every imported project also receives a `work_package`; outcome-scoped roadmap planning stores membership and ownership there.

The existing Board timeline is deliberately schedule-focused and uses actual calendar geometry. Ongoing insights must therefore be a separate section rather than another stream or another timeline row. Existing persisted roadmap assignments must survive rollout even when projects do not yet carry the new Linear labels.

## Goals / Non-Goals

**Goals:**
- Resolve project classification deterministically with visible source provenance.
- Import enough team-level issue evidence to represent unattached work and unresolved blockers.
- Keep recent completed-work attribution responsive to source cleanup while making older history stable.
- Compute compact Board aggregates server-side and load issue details only when requested.
- Preserve existing roadmap placement during migration and make later classification transitions atomic.

**Non-Goals:**
- Writing project labels, project assignments, issue states, or blocker changes to Linear.
- Treating Ongoing work as forecast demand or deriving a completion date for it.
- Building organization-wide engineering performance metrics or reporting outside the connected team.
- Preserving the historical project assignment that an issue had at completion.
- Adding a charting dependency or changing roadmap timeline geometry.

## Decisions

### 1. Resolve effective classification from source labels plus one local decision

Store imported project labels by Linear label ID and exact source name in a normalized project-label cache. Store a nullable local `roadmap` or `ongoing` decision and its update metadata with the project's planning record. A shared resolver returns:

- `roadmap` with `linear-label` provenance for Roadmap only;
- `ongoing` with `linear-label` provenance for Ongoing only;
- the local decision with `local-decision` provenance for both or neither;
- `unresolved` when labels are ambiguous and no decision exists.

The resolver is the sole source for Board state, mutations, aggregates, and attribution snapshots. Local decisions remain stored while an unambiguous source label controls the effective result, so they become usable again if labels later become ambiguous.

Matching uses the exact `Roadmap` and `Ongoing` labels returned by Linear and retains their IDs; labels with longer or merely similar names do not match. If Linear permits duplicate exact names, all matching IDs represent the same classification signal.

Alternatives considered:
- Store only an effective enum: rejected because every sync would lose provenance and ambiguous local intent.
- Infer from outcomes, dates, or existing membership indefinitely: rejected because unlabeled new work must receive explicit classification.

### 2. Reconcile classification and roadmap state atomically

Classification writes use the existing planning transaction and planning token. Changing a Roadmap project to Ongoing clears active ownership, stream placement, sequence, and roadmap membership in the same transaction while preserving source data and outcome links. Changing Ongoing to Roadmap creates an excluded candidate with no owner or stream. Unresolved projects likewise have no roadmap membership or demand.

Schema constraints are revised so roadmap state can be absent for Ongoing and unresolved projects. Service-level reconciliation validates the cross-table relationship because PostgreSQL check constraints cannot reference the source-label rows used by the effective resolver. Existing ownership and sequence invariants continue to apply whenever effective classification is Roadmap.

Alternatives considered:
- Map Ongoing to `dismissed`: rejected because dismissal is a roadmap decision and would hide the distinct continuing-work model.
- Leave stale roadmap placement attached but ignored: rejected because it creates contradictory ownership and unsafe future reactivation.

### 3. Backfill existing projects as locally Roadmap before enabling classification

The migration writes a local Roadmap decision for every project already represented by a `work_package`, then enables the new constraints. This preserves included, candidate, deferred, and dismissed planning state. Projects first imported after migration do not receive that backfill and follow label resolution normally.

This is a one-time compatibility decision, not continuing inference. Users can reclassify migrated projects as Ongoing, and later unambiguous Linear labels remain authoritative.

Alternative considered: make every unlabeled existing project unresolved. Rejected because it would remove persisted stream demand and ownership during deployment.

### 4. Import a team issue feed independently from project details

Keep project detail reads for aggregate scope, team membership, project relations, and labels. Add a paginated team issue read that returns issue identity, URL, current nullable project, team, workflow state type, estimate, completion/update timestamps, and blocking relations. Normalize issue blocker edges into a dedicated source cache.

The team issue feed replaces per-project issue ownership as the authoritative issue cache input. `linear_issue_cache.project_id` becomes nullable and sync reconciliation occurs by connected team and import generation rather than deleting unseen issues one project at a time. Current aggregates use only issues present in the successful current import; frozen snapshots remain independently retained when source issues later disappear.

An unresolved blocker means a source blocker edge whose predecessor issue is currently neither completed nor canceled. Only `unstarted` successors enter the Blocked bucket. Backlog issues remain Backlog rather than being split again by blocker state.

Alternatives considered:
- Continue project-by-project issue reads and make a second query only for unattached issues: rejected because moves can produce duplicate or stale ownership and blocker joins still need a team-wide view.
- Treat a `blocked` label or custom workflow name as blocked: rejected because explicit unresolved relations are more stable than workspace-specific naming.

### 5. Freeze only attribution, not source cycle definitions

Add an immutable completed-issue attribution table keyed by issue ID. At the end of each successful full Linear sync, after labels and local decisions have been resolved, snapshot every completed issue that is at least 30 times 24 hours old and has no existing snapshot. Store issue inspection evidence, nullable project ID and project-name fallback, and effective classification at the cutoff.

Issues younger than the cutoff are aggregated from their current cache project and current effective classification. Frozen issues are aggregated only from their snapshot, even if later syncs move the source issue or reclassify its project. A project rename may update the displayed current name for the same frozen project ID; the stored name remains a fallback if that project is unavailable.

Cycle placement remains derived from `completed_at` against actual imported completed-cycle boundaries. It is not frozen, allowing authoritative cycle corrections or newly imported historical cycle coverage to classify an existing completion without changing its project attribution. Issues without actual cycle coverage are counted for a concise coverage notice but are not assigned to an invented column.

The first sync after migration snapshots all cached completions already beyond the cutoff from their currently known project and classification. The UI describes this as current-at-migration attribution rather than original historical assignment.

Alternatives considered:
- Always recompute all history: rejected because old metrics would drift indefinitely.
- Snapshot at completion: rejected because it removes the correction behavior the feature is intended to encourage.
- Store periodic aggregate totals only: rejected because users need issue-level inspection and corrections during the live window.

### 6. Aggregate Board summaries server-side and inspect details lazily

Extend Board state with:

- effective classification and provenance for projects;
- available-work rows containing Ready, Blocked, Backlog, unestimated, point, and optional in-progress counts;
- completed-history rows and actual cycle columns for the selected recent/expanded range;
- coverage and attention counts.

Do not add every team issue and blocker edge to the initial Board payload. Add a read-only Ongoing-work issue endpoint that accepts a validated project/attention row plus bucket or cycle ID and returns the contributing issue evidence. The endpoint recomputes membership from authoritative cached data rather than trusting issue IDs supplied by the browser.

Classification mutation responses return refreshed Board state and use the existing stale-planning conflict pattern. Source-changing links open the Linear issue or project URL.

Alternative considered: return all issue details with `/api/board`. Rejected because a team-wide issue import can make the primary planning payload unnecessarily large.

### 7. Render two compact, accessible views in a separate Board section

Insert an Ongoing work section after all active roadmap stream timelines and before roadmap triage/configuration. It contains:

1. An available-work table with project labels and Ready, Blocked, and Backlog stacked segments. Issue count controls segment geometry and default sorting; known points and unestimated counts remain text. Needs classification uses the same columns in a distinct attention group.
2. A semantic history table with sticky project labels, completed cycle headers, numeric cells, a global intensity scale, Issues/Points controls, and separate Needs classification and No project rows. Six recent completed cycles render initially; Show older cycles expands retained columns within the same horizontally contained region.

Cell and segment controls expose exact values in accessible names and open an issue-inspection overlay following the existing dismissal, focus containment, focus restoration, narrow-screen, and feedback conventions. Color is never the only value or attention cue. The implementation uses CSS and semantic tables rather than a charting library.

Alternatives considered:
- Use a second heatmap for available work: rejected because a single current snapshot has no useful second dimension.
- Place Ongoing work in a sixth stream: rejected because heat intensity and backlog size are not schedule capacity or dates.

### 8. Preserve frozen attribution in snapshots and scenarios only where required

Frozen issue attribution is source-history evidence and remains workspace-level, not scenario-editable planning state. Scenario snapshots need effective project classification only when classification changes alter saved roadmap membership; they do not duplicate the completed-work attribution table. Published scenario history remains unchanged.

Classification and roadmap membership are restored together for editable scenario activation so an Ongoing project cannot be restored with included roadmap demand. Ongoing metrics always reflect the latest successful Linear source sync plus immutable attribution snapshots, not a scenario's historical source cache.

## Risks / Trade-offs

- [Team-wide issue history can be large or rate-limited] -> Use pagination, the existing bounded retry behavior, import-generation rejection, normalized bulk reconciliation, server aggregates, and lazy detail reads.
- [Linear blocker GraphQL fields may differ across SDK/API versions] -> Validate the raw query against the installed SDK schema during implementation and add adapter contract tests before changing persistence.
- [A blocker outside the imported team may lack state] -> Treat an explicitly related unavailable predecessor as unresolved and identify its unavailable source context in inspection.
- [The 30-day boundary can be crossed between syncs] -> Freeze on the first successful full sync at or after the cutoff and expose the frozen timestamp in inspection evidence.
- [Initial historical attribution is not historical truth] -> Label migration provenance and state clearly that old records use current-at-migration assignment.
- [Global heat scaling can make low-volume rows visually quiet] -> Always print exact values and retain cell focus/inspection independent of intensity.
- [Existing projects are initially all Roadmap] -> Make the migrated local provenance visible and put reclassification beside the new Ongoing evidence rather than silently changing planning state.
- [Project deletion or rename can damage historical labels] -> Snapshot a project-name fallback and group by immutable Linear project ID when available.

## Migration Plan

1. Add project-label, local classification, issue blocker, nullable issue-project, issue URL/current-import, and frozen-attribution schema support without changing current reads.
2. Backfill a local Roadmap decision for every existing work package and update roadmap-state constraints transactionally.
3. Deploy the expanded read-only Linear adapter and team-level issue reconciliation. A failed or stale import leaves the previous complete cache and attribution state active.
4. On the first successful expanded sync, resolve classifications, snapshot already-old completed issues from current imported evidence, and populate Board aggregates.
5. Enable classification controls and Ongoing Board views after the expanded source generation is complete, avoiding a partially populated No project view.
6. Roll back presentation and new reads independently if needed; retain additive source and attribution tables. Do not reverse the one-time Roadmap backfill or delete frozen evidence during rollback.
