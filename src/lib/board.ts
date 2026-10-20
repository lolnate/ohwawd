import type { PoolClient } from "pg";
import { readTransaction } from "./db";
import { forecast, historicalBaseline, type ForecastInput } from "./forecast";

export async function assignPackagesToStream(client: Pick<PoolClient, "query">, streamId: string, packageIds: string[]): Promise<void> {
  await client.query("UPDATE work_package SET stream_id=$1,selected=true WHERE id=ANY($2::text[])", [streamId, packageIds]);
}

export async function getBoard(client?: Pick<PoolClient, "query">, cycleAnchor?: Date) {
  if (!client) return readTransaction((database) => loadBoard(database, cycleAnchor));
  return loadBoard(client, cycleAnchor);
}

async function loadBoard(database: Pick<PoolClient, "query">, cycleAnchor?: Date) {
  const [workspace, connection, packages, streams, links, outcomes, capacity, adjustments, dependencies, allowances, issues, observations, linearCycles, legacyAdjustments] = await Promise.all([
    database.query("SELECT created_at FROM workspace WHERE id=1"),
    database.query("SELECT last_imported_at,cycles_refreshed_at,GREATEST(last_imported_at,cycles_refreshed_at) AS source_at,team_id,team_name,team_timezone,cycles_enabled,cycle_duration,cycle_start_day,cycle_cooldown_time,upcoming_cycle_count FROM linear_connection WHERE workspace_id=1"),
    database.query(`SELECT w.id,w.project_id,w.team_id,w.stream_id,w.selected,w.must_include,w.priority_rank,w.earliest_cycle,w.preferred_cycle,
      w.earliest_linear_cycle_id,w.preferred_linear_cycle_id,w.pause_reason,
      p.name,p.status,p.url,p.cross_team,p.needs_review,p.in_scope,p.external_blockers FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id ORDER BY p.name`),
    database.query("SELECT id,name,position,wip_limit,allocation::float FROM stream WHERE active=true ORDER BY position"),
    database.query("SELECT outcome_id,project_id,requirement FROM outcome_project_link"),
    database.query("SELECT id,title,description,owner,success_signal,needed_by::text FROM outcome ORDER BY created_at DESC"),
    database.query("SELECT cycle_anchor::text,cycle_days,baseline::float,baseline_reason,reserve::float,horizon FROM capacity_profile WHERE workspace_id=1"),
    database.query("SELECT a.linear_cycle_id,c.number,c.name,c.starts_at,c.ends_at,a.availability::float,a.reserve::float FROM linear_cycle_adjustment a JOIN linear_cycle_cache c ON c.linear_id=a.linear_cycle_id ORDER BY c.starts_at"),
    database.query("SELECT predecessor_id,successor_id,source,waived,waiver_reason FROM package_dependency"),
    database.query("SELECT package_id,kind,points::float,issue_ids,owner,review_date::text,rationale FROM package_allowance"),
    database.query("SELECT linear_id,project_id,identifier,estimate::float,state_type FROM linear_issue_cache"),
    database.query("SELECT linear_id,starts_at,ends_at,completed_at,cycle_days,completed_points::float FROM cycle_observation ORDER BY completed_at DESC"),
    database.query("SELECT linear_id,number,name,starts_at,ends_at,completed_at FROM linear_cycle_cache WHERE active=true ORDER BY starts_at"),
    database.query("SELECT cycle_number,availability::float,reserve::float FROM cycle_adjustment ORDER BY cycle_number"),
  ]);
  const sourceAt = (connection.rows[0]?.source_at ?? workspace.rows[0].created_at).toISOString();
  const cycleAnchorAt = cycleAnchor?.toISOString() ?? sourceAt;
  const cycleAnchorTime = Date.parse(cycleAnchorAt);
  const currentCycle = linearCycles.rows.find((item) => item.starts_at.getTime() <= cycleAnchorTime && item.ends_at.getTime() > cycleAnchorTime && !item.completed_at);
  const future = linearCycles.rows.filter((item) => item.starts_at.getTime() > cycleAnchorTime && !item.completed_at);
  const cycleIndex = (id: string | null, legacy: number | null) => {
    if (legacy && !id) return { index: null, review: "A previous relative start cycle needs a Linear cycle selection." };
    if (!id) return { index: null, review: null };
    const index = future.findIndex((item) => item.linear_id === id);
    if (index >= 0) return { index: index + 1, review: null };
    const old = linearCycles.rows.find((item) => item.linear_id === id);
    if (old && old.starts_at.getTime() <= cycleAnchorTime) return { index: 1, review: null };
    return { index: null, review: "Selected start cycle is no longer available in Linear; choose another." };
  };
  const comparableDays = connection.rows[0]?.cycle_duration ? connection.rows[0].cycle_duration * 7 : null;
  const comparable = comparableDays ? observations.rows.filter((item) => item.cycle_days === comparableDays).slice(0, 6) : [];
  const observedBaseline = historicalBaseline(comparable.map((item) => item.completed_points));
  const reconciliationWarnings: { packageId: string; message: string }[] = [];
  const input: ForecastInput = {
    packages: packages.rows.map((row) => {
      const open = issues.rows.filter((issue) => issue.project_id === row.project_id && !["completed", "canceled"].includes(issue.state_type));
      const unestimated = allowances.rows.find((item) => item.package_id === row.id && item.kind === "unestimated");
      const discovery = allowances.rows.find((item) => item.package_id === row.id && item.kind === "discovery");
      const claimed = unestimated?.issue_ids as string[] | undefined;
      const claimedIssues = claimed?.map((id) => issues.rows.find((issue) => issue.linear_id === id && issue.project_id === row.project_id));
      const unestimatedReview = claimedIssues?.some((issue) => !issue || (["completed", "canceled"].includes(issue.state_type) && issue.estimate === null))
        ? "Allowance issue set changed or closed without an estimate; reconcile it." : null;
      const discoveryBaseline = new Set(discovery?.issue_ids as string[] | undefined);
      const newDiscoveryIssues = discovery ? open.filter((issue) => !discoveryBaseline.has(issue.linear_id)) : [];
      const discoveryReview = newDiscoveryIssues.length
        ? `${newDiscoveryIssues.length} Linear issue${newDiscoveryIssues.length === 1 ? " was" : "s were"} added after the discovery allowance; reconcile possible double counting.` : null;
      const allowanceReview = unestimatedReview ?? discoveryReview;
      if (allowanceReview) reconciliationWarnings.push({ packageId: row.id, message: allowanceReview });
      const residual = unestimated ? Math.max(0, unestimated.points - (claimedIssues || []).reduce((sum, issue) => sum + (issue?.estimate ?? 0), 0)) : 0;
      const earliest = cycleIndex(row.earliest_linear_cycle_id, row.earliest_cycle);
      const preferred = cycleIndex(row.preferred_linear_cycle_id, row.preferred_cycle);
      return { id: row.id, projectId: row.project_id, name: row.name, status: row.status, streamId: row.stream_id,
        selected: row.selected, priority: row.priority_rank, earliest: earliest.index, preferred: preferred.index,
        known: open.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0), openIssueCount: open.length,
        unknownIssueIds: open.filter((issue) => issue.estimate === null).map((issue) => issue.linear_id),
        crossTeam: row.cross_team, needsReview: row.needs_review, allowanceReview, calendarReview: earliest.review || preferred.review, externalBlockers: row.external_blockers,
        unestimatedAllowance: unestimated ? { points: residual, issueIds: unestimated.issue_ids } : undefined,
        discoveryAllowance: discovery ? { points: discovery.points } : undefined };
    }),
    streams: streams.rows.map((row) => ({ id: row.id, name: row.name, allocation: row.allocation, wip: row.wip_limit })),
    dependencies: dependencies.rows.map((row) => ({ predecessorId: row.predecessor_id, successorId: row.successor_id, source: row.source, waived: row.waived })),
    outcomes: outcomes.rows.map((row) => ({ id: row.id, title: row.title, neededBy: row.needed_by, links: links.rows.filter((link) => link.outcome_id === row.id).map((link) => ({ projectId: link.project_id, requirement: link.requirement })) })),
    baseline: capacity.rows[0]?.baseline ?? observedBaseline, reserve: capacity.rows[0]?.reserve ?? 0,
    linearCycles: linearCycles.rows.map((row) => ({ id: row.linear_id, number: row.number, name: row.name,
      startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString() })),
    horizon: capacity.rows[0]?.horizon ?? 26, sourceAt, cycleAnchorAt,
    timezone: connection.rows[0]?.team_timezone ?? "America/New_York",
    adjustments: adjustments.rows.map((row) => ({ cycleId: row.linear_cycle_id, availability: row.availability, reserve: row.reserve })),
  };
  return { connection: connection.rows[0] ?? null, packages: packages.rows, streams: streams.rows, links: links.rows, outcomes: outcomes.rows,
    capacity: capacity.rows[0] ?? { cycle_anchor: null, cycle_days: 14, baseline: null, baseline_reason: "", reserve: 0, horizon: 26 },
    observations: comparable, observedBaseline, effectiveBaseline: input.baseline,
    linearCycles: input.linearCycles, currentCycleId: currentCycle?.linear_id ?? null, cycleAnchorAt, futureCycleIds: future.map((row) => row.linear_id),
    adjustments: adjustments.rows, legacyAdjustments: legacyAdjustments.rows,
    dependencies: dependencies.rows, allowances: allowances.rows, issues: issues.rows, reconciliationWarnings, timezone: input.timezone,
    forecast: forecast(input) };
}
