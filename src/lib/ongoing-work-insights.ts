import type { PoolClient } from "pg";
import { readCompletedWorkHistoryEvidence, type CompletedWorkHistoryEvidence } from "./completed-work-history";
import { projectClassificationState } from "./project-classification";
import { HttpError } from "./security";

type Client = Pick<PoolClient, "query">;
export type WorkBucket = "ready" | "blocked" | "backlog";
export type HistoryRange = "recent" | "all";

export type WorkMetric = { issueCount: number; knownPoints: number; unestimatedCount: number };
export type AvailableWorkRow = {
  rowId: string;
  group: "ongoing" | "needs-classification";
  projectId: string;
  projectName: string;
  projectUrl: string;
  ready: WorkMetric;
  blocked: WorkMetric;
  backlog: WorkMetric;
  startedCount: number;
};

export type CompletedHistoryCycle = {
  id: string;
  number: number;
  name: string | null;
  startsAt: string;
  endsAt: string;
  completedAt: string;
};

export type CompletedHistoryRow = {
  rowId: string;
  kind: "project" | "needs-classification" | "no-project";
  projectId: string | null;
  label: string;
  cells: (WorkMetric & { cycleId: string })[];
};

export type OngoingWorkInsights = {
  available: {
    rows: AvailableWorkRow[];
    needsClassificationRows: AvailableWorkRow[];
    totals: { ready: WorkMetric; blocked: WorkMetric; backlog: WorkMetric };
  };
  completedHistory: {
    range: HistoryRange;
    cycles: CompletedHistoryCycle[];
    rows: CompletedHistoryRow[];
    attentionRows: CompletedHistoryRow[];
    olderCycleCount: number;
    missingCycleCoverageCount: number;
  };
};

type AvailableIssue = {
  linear_id: string;
  project_id: string;
  identifier: string;
  title: string;
  url: string;
  estimate: string | null;
  state_type: string;
  unresolved_blockers: unknown;
};

type BlockerDetail = {
  id: string;
  identifier: string | null;
  title: string | null;
  url: string | null;
  workflow: string | null;
  unavailable: boolean;
};

export type OngoingWorkIssueDetail = {
  identifier: string;
  title: string;
  url: string;
  estimate: number | null;
  workflow: string;
  unresolvedBlockers: BlockerDetail[];
};

export type OngoingWorkDetailSelector =
  | { view: "available"; group: "ongoing" | "needs-classification"; projectId: string; bucket: WorkBucket }
  | { view: "history"; row: { kind: "project"; projectId: string } | { kind: "needs-classification" | "no-project" }; cycleId: string };

const zeroMetric = (): WorkMetric => ({ issueCount: 0, knownPoints: 0, unestimatedCount: 0 });
const emptyTotals = () => ({ ready: zeroMetric(), blocked: zeroMetric(), backlog: zeroMetric() });

export function emptyOngoingWorkInsights(range: HistoryRange = "recent"): OngoingWorkInsights {
  return {
    available: { rows: [], needsClassificationRows: [], totals: emptyTotals() },
    completedHistory: { range, cycles: [], rows: [], attentionRows: [], olderCycleCount: 0, missingCycleCoverageCount: 0 },
  };
}

function addMetric(metric: WorkMetric, estimate: string | number | null): void {
  metric.issueCount += 1;
  if (estimate === null) metric.unestimatedCount += 1;
  else metric.knownPoints += Number(estimate);
}

function addMetrics(target: WorkMetric, source: WorkMetric): void {
  target.issueCount += source.issueCount;
  target.knownPoints += source.knownPoints;
  target.unestimatedCount += source.unestimatedCount;
}

function bucketFor(issue: Pick<AvailableIssue, "state_type" | "unresolved_blockers">): WorkBucket | null {
  if (issue.state_type === "backlog") return "backlog";
  if (issue.state_type !== "unstarted") return null;
  return blockers(issue.unresolved_blockers).length ? "blocked" : "ready";
}

function blockers(value: unknown): BlockerDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string") return [];
    const row = item as Record<string, unknown>;
    return [{
      id: row.id as string,
      identifier: typeof row.identifier === "string" ? row.identifier : null,
      title: typeof row.title === "string" ? row.title : null,
      url: typeof row.url === "string" ? row.url : null,
      workflow: typeof row.workflow === "string" ? row.workflow : null,
      unavailable: row.unavailable === true,
    }];
  });
}

async function readAvailableIssues(client: Client, teamId: string, projectIds?: readonly string[]): Promise<AvailableIssue[]> {
  if (projectIds?.length === 0) return [];
  const result = await client.query<AvailableIssue>(`SELECT i.linear_id,i.project_id,i.identifier,i.title,i.url,i.estimate::text,i.state_type,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',b.blocker_id,'identifier',predecessor.identifier,'title',predecessor.title,'url',predecessor.url,
        'workflow',predecessor.state_type,'unavailable',predecessor.linear_id IS NULL) ORDER BY b.blocker_id)
        FROM linear_issue_blocker_cache b LEFT JOIN linear_issue_cache predecessor ON predecessor.linear_id=b.blocker_id
        WHERE b.blocked_issue_id=i.linear_id AND (predecessor.linear_id IS NULL OR predecessor.state_type NOT IN ('completed','canceled'))), '[]'::jsonb) AS unresolved_blockers
    FROM linear_issue_cache i
    WHERE i.team_id=$1 AND i.project_id IS NOT NULL AND ($2::text[] IS NULL OR i.project_id=ANY($2::text[]))
    ORDER BY i.identifier,i.linear_id`, [teamId, projectIds ? [...projectIds] : null]);
  return result.rows;
}

async function availableWork(client: Client, teamId: string) {
  const classifications = await projectClassificationState(client);
  const projects = await client.query<{ linear_id: string; name: string; url: string }>(`SELECT linear_id,name,url FROM linear_project_cache
    WHERE team_id=$1 AND NOT needs_review ORDER BY name,linear_id`, [teamId]);
  const relevant = projects.rows.filter((project) => {
    const classification = classifications.get(project.linear_id)?.classification;
    return classification === "ongoing" || classification === "unresolved";
  });
  const issues = await readAvailableIssues(client, teamId, relevant.map((project) => project.linear_id));
  const byProject = new Map<string, AvailableIssue[]>();
  for (const issue of issues) byProject.set(issue.project_id, [...(byProject.get(issue.project_id) ?? []), issue]);
  const rows = relevant.map((project): AvailableWorkRow => {
    const classification = classifications.get(project.linear_id)!.classification;
    const group = classification === "ongoing" ? "ongoing" as const : "needs-classification" as const;
    const row: AvailableWorkRow = {
      rowId: `${group}:${project.linear_id}`, group, projectId: project.linear_id, projectName: project.name, projectUrl: project.url,
      ready: zeroMetric(), blocked: zeroMetric(), backlog: zeroMetric(), startedCount: 0,
    };
    for (const issue of byProject.get(project.linear_id) ?? []) {
      if (issue.state_type === "started") row.startedCount += 1;
      const bucket = bucketFor(issue);
      if (bucket) addMetric(row[bucket], issue.estimate);
    }
    return row;
  });
  const stableOrder = (left: AvailableWorkRow, right: AvailableWorkRow) =>
    right.ready.issueCount - left.ready.issueCount || left.projectName.localeCompare(right.projectName) || left.projectId.localeCompare(right.projectId);
  const ongoingRows = rows.filter((row) => row.group === "ongoing").sort(stableOrder);
  const needsClassificationRows = rows.filter((row) => row.group === "needs-classification").sort(stableOrder);
  const totals = emptyTotals();
  for (const row of ongoingRows) for (const bucket of ["ready", "blocked", "backlog"] as const) addMetrics(totals[bucket], row[bucket]);
  return { rows: ongoingRows, needsClassificationRows, totals };
}

async function readCompletedCycles(client: Client, teamId: string): Promise<CompletedHistoryCycle[]> {
  const result = await client.query<{ linear_id: string; number: number; name: string | null; starts_at: Date; ends_at: Date; completed_at: Date }>(`SELECT linear_id,number,name,starts_at,ends_at,completed_at
    FROM linear_cycle_cache WHERE team_id=$1 AND active=true AND completed_at IS NOT NULL ORDER BY starts_at,linear_id`, [teamId]);
  return result.rows.map((row) => ({ id: row.linear_id, number: row.number, name: row.name, startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(), completedAt: row.completed_at.toISOString() }));
}

function historyRow(evidence: CompletedWorkHistoryEvidence): Omit<CompletedHistoryRow, "cells"> {
  if (evidence.attribution === "no-project") return { rowId: "no-project", kind: "no-project", projectId: null, label: "No project" };
  if (evidence.attribution === "needs-classification") return { rowId: "needs-classification", kind: "needs-classification", projectId: null, label: "Needs classification" };
  return { rowId: `project:${evidence.projectId}`, kind: "project", projectId: evidence.projectId, label: evidence.projectName ?? "Unavailable project" };
}

function aggregateHistory(evidence: CompletedWorkHistoryEvidence[], cycles: CompletedHistoryCycle[], range: HistoryRange) {
  const selectedCycles = range === "recent" ? cycles.slice(-6) : cycles;
  const selectedIds = new Set(selectedCycles.map((cycle) => cycle.id));
  const rows = new Map<string, CompletedHistoryRow>();
  for (const item of evidence) {
    if (!item.cycleId || !selectedIds.has(item.cycleId)) continue;
    const identity = historyRow(item);
    let row = rows.get(identity.rowId);
    if (!row) {
      row = { ...identity, cells: [] };
      rows.set(identity.rowId, row);
    }
    let cell = row.cells.find((candidate) => candidate.cycleId === item.cycleId);
    if (!cell) {
      cell = { cycleId: item.cycleId, ...zeroMetric() };
      row.cells.push(cell);
    }
    addMetric(cell, item.estimate);
  }
  const cycleOrder = new Map(selectedCycles.map((cycle, index) => [cycle.id, index]));
  for (const row of rows.values()) row.cells.sort((left, right) => cycleOrder.get(left.cycleId)! - cycleOrder.get(right.cycleId)!);
  const projectRows = [...rows.values()].filter((row) => row.kind === "project")
    .sort((left, right) => left.label.localeCompare(right.label) || left.rowId.localeCompare(right.rowId));
  const attentionRows = [rows.get("needs-classification"), rows.get("no-project")].filter((row): row is CompletedHistoryRow => !!row);
  return {
    range, cycles: selectedCycles, rows: projectRows, attentionRows,
    olderCycleCount: Math.max(0, cycles.length - 6),
    missingCycleCoverageCount: evidence.filter((item) => item.cycleId === null).length,
  };
}

export async function getOngoingWorkInsights(client: Client, teamId: string, range: HistoryRange = "recent"): Promise<OngoingWorkInsights> {
  const available = await availableWork(client, teamId);
  const cycles = await readCompletedCycles(client, teamId);
  const historyEvidence = await readCompletedWorkHistoryEvidence(client, teamId);
  return { available, completedHistory: aggregateHistory(historyEvidence, cycles, range) };
}

const trustedId = /^[A-Za-z0-9_-]{1,200}$/;
function one(params: URLSearchParams, name: string): string {
  const values = params.getAll(name);
  if (values.length !== 1 || !values[0]) throw new HttpError(400, `Provide one ${name} selector.`);
  return values[0];
}

export function parseOngoingWorkDetailSelector(params: URLSearchParams): OngoingWorkDetailSelector {
  const view = one(params, "view");
  const allowed = view === "available" ? new Set(["view", "row", "bucket"]) : view === "history" ? new Set(["view", "row", "cycle"]) : null;
  if (!allowed || [...params.keys()].some((key) => !allowed.has(key))) throw new HttpError(400, "Use a recognized Ongoing work detail selector.");
  const row = one(params, "row");
  if (view === "available") {
    const bucket = one(params, "bucket");
    const match = /^(ongoing|needs-classification):([A-Za-z0-9_-]{1,200})$/.exec(row);
    if (!match || !["ready", "blocked", "backlog"].includes(bucket)) throw new HttpError(400, "Use a recognized available-work row and bucket.");
    return { view: "available", group: match[1] as "ongoing" | "needs-classification", projectId: match[2], bucket: bucket as WorkBucket };
  }
  const cycleId = one(params, "cycle");
  if (!trustedId.test(cycleId)) throw new HttpError(400, "Use a recognized completed cycle.");
  if (row === "needs-classification" || row === "no-project") return { view: "history", row: { kind: row }, cycleId };
  const match = /^project:([A-Za-z0-9_-]{1,200})$/.exec(row);
  if (!match) throw new HttpError(400, "Use a recognized completed-history row and cycle.");
  return { view: "history", row: { kind: "project", projectId: match[1] }, cycleId };
}

export function parseHistoryRange(params: URLSearchParams): HistoryRange {
  if ([...params.keys()].some((key) => key !== "history") || params.getAll("history").length > 1) throw new HttpError(400, "Use a recognized history range.");
  const range = params.get("history") ?? "recent";
  if (range !== "recent" && range !== "all") throw new HttpError(400, "Use recent or all history.");
  return range;
}

function detail(issue: AvailableIssue): OngoingWorkIssueDetail {
  return { identifier: issue.identifier, title: issue.title, url: issue.url, estimate: issue.estimate === null ? null : Number(issue.estimate),
    workflow: issue.state_type, unresolvedBlockers: blockers(issue.unresolved_blockers) };
}

export async function readOngoingWorkIssueDetails(client: Client, teamId: string, selector: OngoingWorkDetailSelector): Promise<OngoingWorkIssueDetail[]> {
  if (selector.view === "available") {
    const classification = (await projectClassificationState(client, [selector.projectId])).get(selector.projectId)?.classification;
    const expected = selector.group === "ongoing" ? "ongoing" : "unresolved";
    if (classification !== expected) throw new HttpError(404, "Available-work row not found.");
    const project = await client.query("SELECT linear_id FROM linear_project_cache WHERE linear_id=$1 AND team_id=$2 AND NOT needs_review", [selector.projectId, teamId]);
    if (!project.rowCount) throw new HttpError(404, "Available-work row not found.");
    const issues = await readAvailableIssues(client, teamId, [selector.projectId]);
    return issues.filter((issue) => bucketFor(issue) === selector.bucket).map(detail);
  }

  const cycles = await readCompletedCycles(client, teamId);
  if (!cycles.some((cycle) => cycle.id === selector.cycleId)) throw new HttpError(404, "Completed cycle not found.");
  const evidence = await readCompletedWorkHistoryEvidence(client, teamId);
  const matching = evidence.filter((item) => item.cycleId === selector.cycleId && (
    selector.row.kind === "project" ? item.attribution === "ongoing" && item.projectId === selector.row.projectId
      : item.attribution === selector.row.kind
  ));
  if (!matching.length) throw new HttpError(404, "Completed-history row not found.");
  return matching.map((item) => ({ identifier: item.identifier, title: item.title, url: item.url, estimate: item.estimate,
    workflow: "completed", unresolvedBlockers: [] }));
}
