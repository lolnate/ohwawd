import type { PoolClient } from "pg";
import { readTransaction } from "./db";
import { forecast, historicalBaseline, type ForecastInput } from "./forecast";
import { placeProjects, sequencingState, sequenceToken } from "./sequence-store";
import { orderConflicts } from "./sequencing";
import { scopeChangeSummary, scopeReadiness, teamLocalDate, type ExtraScope } from "./project-scope";
import { addCalendarDays, holidayWeeksForRange, mondayOf, type WeeklyAvailability } from "./planning-calendar";
import { projectCycleCalendar } from "./cycle-projection";
import type { PlanningCycle } from "./cycles";
import { ownershipToken } from "./outcome-ownership";
import { roadmapConversionFeedback, type StoredRoadmapFields } from "./roadmap-planning";
import { planningToken } from "./planning-token";
import { getOutcomeLifecycles } from "./outcome-lifecycle";

type BoardPackage = StoredRoadmapFields & { id: string; project_id: string; team_id: string; stream_id: string | null; capacity_outcome_id: string | null;
  selected: boolean; sequence_position: number | null; pause_reason: string; name: string; description: string; status: string; linear_priority: number | null;
  url: string; cross_team: boolean; needs_review: boolean; in_scope: boolean; external_blockers: string[];
  priority_rank?: number; must_include?: boolean; earliest_cycle?: number; preferred_cycle?: number; earliest_linear_cycle_id?: string; preferred_linear_cycle_id?: string };

export async function assignPackagesToStream(client: Pick<PoolClient, "query">, streamId: string, packageIds: string[], outcomeId?: string): Promise<void> {
  await placeProjects(client, packageIds.map((packageId) => ({ packageId, streamId, selected: true, outcomeId })));
}

export async function getBoard(client?: Pick<PoolClient, "query">, cycleAnchor?: Date, evaluatedAt = new Date()) {
  if (!client) return readTransaction((database) => loadBoard(database, cycleAnchor, evaluatedAt));
  return loadBoard(client, cycleAnchor, evaluatedAt);
}

async function loadBoard(database: Pick<PoolClient, "query">, cycleAnchor: Date | undefined, evaluationTime: Date) {
  const [workspace, connection, packages, streams, links, outcomes, capacity, adjustments, dependencies, extraScopes, issues, observations, linearCycles, legacyAdjustments, weeklyAdjustments] = await Promise.all([
    database.query<{ created_at: Date; roadmap_planning_migrated: boolean }>("SELECT created_at,roadmap_planning_migrated FROM workspace WHERE id=1"),
    database.query("SELECT last_imported_at,cycles_refreshed_at,GREATEST(last_imported_at,cycles_refreshed_at) AS source_at,team_id,team_name,team_timezone,cycles_enabled,cycle_duration,cycle_start_day,cycle_cooldown_time,upcoming_cycle_count FROM linear_connection WHERE workspace_id=1"),
    database.query<BoardPackage>(`SELECT w.id,w.project_id,w.team_id,w.stream_id,w.capacity_outcome_id,w.selected,w.sequence_position,w.pause_reason,w.roadmap_state,w.roadmap_conversion,
      p.name,p.description,p.status,p.priority AS linear_priority,p.url,p.cross_team,p.needs_review,p.in_scope,p.external_blockers FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id ORDER BY w.sequence_position NULLS LAST,p.name,w.id`),
    database.query("SELECT id,name,position,wip_limit,allocation::float FROM stream WHERE active=true ORDER BY position"),
    database.query("SELECT outcome_id,project_id,requirement FROM outcome_project_link"),
    database.query<{ id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null; stream_id: string | null; stream_position: number | null; created_at: Date }>("SELECT id,title,description,owner,success_signal,needed_by::text,stream_id,stream_position,created_at FROM outcome ORDER BY created_at DESC,id"),
    database.query("SELECT cycle_anchor::text,cycle_days,baseline::float,baseline_reason,reserve::float,horizon,scoping_lead_days,holidays_enabled FROM capacity_profile WHERE workspace_id=1"),
    database.query("SELECT a.linear_cycle_id,c.number,c.name,c.starts_at,c.ends_at,a.availability::float,a.reserve::float FROM linear_cycle_adjustment a JOIN linear_cycle_cache c ON c.linear_id=a.linear_cycle_id ORDER BY c.starts_at"),
    database.query("SELECT predecessor_id,successor_id,source,waived,waiver_reason FROM package_dependency"),
    database.query<ExtraScope>("SELECT package_id,points::float,notes,issue_ids,issue_baseline,legacy_review FROM package_extra_scope ORDER BY package_id"),
    database.query("SELECT linear_id,project_id,identifier,estimate::float,state_type FROM linear_issue_cache"),
    database.query("SELECT linear_id,starts_at,ends_at,completed_at,cycle_days,completed_points::float FROM cycle_observation ORDER BY completed_at DESC"),
    database.query("SELECT linear_id,number,name,starts_at,ends_at,completed_at FROM linear_cycle_cache WHERE active=true ORDER BY starts_at"),
    database.query("SELECT cycle_number,availability::float,reserve::float FROM cycle_adjustment ORDER BY cycle_number"),
    database.query<WeeklyAvailability>('SELECT week_start::text AS "weekStart",availability::float,label FROM weekly_capacity_adjustment ORDER BY week_start'),
  ]);
  const sourceAt = (connection.rows[0]?.source_at ?? workspace.rows[0].created_at).toISOString();
  const cycleAnchorAt = cycleAnchor?.toISOString() ?? sourceAt;
  const cycleAnchorTime = Date.parse(cycleAnchorAt);
  const currentCycle = linearCycles.rows.find((item) => item.starts_at.getTime() <= cycleAnchorTime && item.ends_at.getTime() > cycleAnchorTime && !item.completed_at);
  const future = linearCycles.rows.filter((item) => item.starts_at.getTime() > cycleAnchorTime && !item.completed_at);
  const comparableDays = connection.rows[0]?.cycle_duration ? connection.rows[0].cycle_duration * 7 : null;
  const comparable = comparableDays ? observations.rows.filter((item) => item.cycle_days === comparableDays).slice(0, 6) : [];
  const observedBaseline = historicalBaseline(comparable.map((item) => item.completed_points));
  const reconciliationWarnings: { packageId: string; message: string }[] = [];
  const sequencing = await sequencingState(database);
  const sequenceConflicts = orderConflicts(sequencing);
  const timezone = connection.rows[0]?.team_timezone ?? "America/New_York";
  const importedCycles: PlanningCycle[] = linearCycles.rows.map((row) => ({ id: row.linear_id, number: row.number, name: row.name,
    startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null }));
  const settings = connection.rows[0];
  const calendar = projectCycleCalendar({ cycles: importedCycles, anchorAt: cycleAnchorAt, horizon: capacity.rows[0]?.horizon ?? 26,
    cadence: { teamId: settings?.team_id ?? "workspace", enabled: settings?.cycles_enabled ?? false, durationWeeks: settings?.cycle_duration ?? null,
      startDay: settings?.cycle_start_day ?? null, cooldownWeeks: settings?.cycle_cooldown_time ?? null, timezone } });
  const planningFuture = calendar.cycles.filter((cycle) => !cycle.completedAt && Date.parse(cycle.startsAt) > cycleAnchorTime);
  const calendarStart = mondayOf(teamLocalDate(planningFuture[0]?.startsAt ?? evaluationTime, timezone));
  const calendarEnd = [addCalendarDays(calendarStart, 26 * 7), teamLocalDate(planningFuture.at(-1)?.endsAt ?? evaluationTime, timezone)].sort().at(-1)!;
  const holidaysEnabled = capacity.rows[0]?.holidays_enabled ?? true;
  const holidayWeeks = holidaysEnabled ? holidayWeeksForRange(calendarStart, calendarEnd) : [];
  const input: ForecastInput = {
    schedulingMode: workspace.rows[0].roadmap_planning_migrated ? "outcome" : "project",
    packages: packages.rows.map((row) => {
      const open = issues.rows.filter((issue) => issue.project_id === row.project_id && !["completed", "canceled"].includes(issue.state_type));
      const extra = extraScopes.rows.find((item) => item.package_id === row.id);
      return { id: row.id, projectId: row.project_id, name: row.name, status: row.status, streamId: row.stream_id,
         selected: row.selected, sequence: row.sequence_position, ownerOutcomeId: row.capacity_outcome_id, roadmapState: row.roadmap_state,
        known: open.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0), openIssueCount: open.length,
        unknownIssueIds: open.filter((issue) => issue.estimate === null).map((issue) => issue.linear_id),
          crossTeam: row.cross_team, needsReview: row.needs_review, orderReview: sequenceConflicts.find((conflict) => workspace.rows[0].roadmap_planning_migrated ? conflict.ownerId === row.capacity_outcome_id : conflict.streamId === row.stream_id)?.message, externalBlockers: row.external_blockers,
         extraScope: extra ? { points: extra.points, issueIds: extra.issue_ids } : undefined };
    }),
    streams: streams.rows.map((row) => ({ id: row.id, name: row.name, allocation: row.allocation, wip: row.wip_limit })),
    dependencies: dependencies.rows.map((row) => ({ predecessorId: row.predecessor_id, successorId: row.successor_id, source: row.source, waived: row.waived })),
    outcomes: outcomes.rows.map((row) => ({ id: row.id, title: row.title, neededBy: row.needed_by, streamId: row.stream_id, rank: row.stream_position, links: links.rows.filter((link) => link.outcome_id === row.id).map((link) => ({ projectId: link.project_id, requirement: link.requirement })) })),
    baseline: capacity.rows[0]?.baseline ?? observedBaseline, reserve: capacity.rows[0]?.reserve ?? 0,
    linearCycles: calendar.cycles,
    horizon: capacity.rows[0]?.horizon ?? 26, sourceAt, cycleAnchorAt,
    timezone,
    adjustments: adjustments.rows.map((row) => ({ cycleId: row.linear_cycle_id, availability: row.availability, reserve: row.reserve })),
    weeklyAdjustments: weeklyAdjustments.rows, holidaysEnabled, holidayWeeks,
  };
  const result = forecast(input);
  const evaluatedAt = evaluationTime.toISOString();
  const leadDays = capacity.rows[0]?.scoping_lead_days ?? 14;
  const scoping = packages.rows.map((row) => {
    const extra = extraScopes.rows.find((item) => item.package_id === row.id);
    const projection = result.packages.find((item) => item.id === row.id)!;
    const startDate = projection.start ? result.cycles[projection.start - 1]?.start ?? null : null;
    return scopeReadiness({ packageId: row.id, selected: row.selected, complete: projection.finish === 0, status: row.status,
      extra: !!extra, startDate, leadDays, evaluatedAt, timezone: input.timezone,
      review: extra ? scopeChangeSummary(extra, issues.rows.filter((issue) => issue.project_id === row.project_id)) : null });
  });
  const lifecycles = await getOutcomeLifecycles(database);
  return { calculationVersion: workspace.rows[0].roadmap_planning_migrated ? "v5" : "v4", evaluatedAt, scoping, extraScopes: extraScopes.rows, weeklyAdjustments: weeklyAdjustments.rows, holidayWeeks,
    roadmapPlanningMigrated: workspace.rows[0].roadmap_planning_migrated, roadmapConversionFeedback: roadmapConversionFeedback(packages.rows),
    connection: connection.rows[0] ?? null, packages: packages.rows, streams: streams.rows, links: links.rows, outcomes: outcomes.rows.map((item) => ({ ...item, lifecycle: lifecycles.get(item.id)! })),
    capacity: capacity.rows[0] ?? { cycle_anchor: null, cycle_days: 14, baseline: null, baseline_reason: "", reserve: 0, horizon: 26, scoping_lead_days: 14, holidays_enabled: true },
    observations: comparable, observedBaseline, effectiveBaseline: input.baseline,
    linearCycles: importedCycles, planningCycles: calendar.cycles, calendarProjection: calendar.projection,
    currentCycleId: currentCycle?.linear_id ?? null, cycleAnchorAt, futureCycleIds: future.map((row) => row.linear_id),
    adjustments: adjustments.rows, legacyAdjustments: legacyAdjustments.rows,
    dependencies: dependencies.rows, issues: issues.rows, reconciliationWarnings, timezone: input.timezone,
      sequencing, sequenceToken: sequenceToken(sequencing), ownershipToken: await ownershipToken(database), planningToken: await planningToken(database), sequenceConflicts, forecast: result };
}
