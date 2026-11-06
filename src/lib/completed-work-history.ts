import type { PoolClient } from "pg";
import { resolveProjectClassification, type EffectiveProjectClassification, type ProjectClassification } from "./project-classification";

const attributionCutoffMs = 30 * 24 * 60 * 60 * 1000;
type Client = Pick<PoolClient, "query">;

export const completedWorkHistoryMigrationSql = `
  ALTER TABLE workspace ADD COLUMN completed_attribution_backfilled boolean NOT NULL DEFAULT false;
  CREATE TABLE completed_issue_attribution (
    issue_id text PRIMARY KEY,
    team_id text NOT NULL,
    identifier text NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    estimate numeric,
    state_type text NOT NULL,
    completed_at timestamptz NOT NULL,
    source_updated_at timestamptz NOT NULL,
    project_id text,
    project_name text,
    classification text NOT NULL CHECK (classification IN ('roadmap','ongoing','unresolved')),
    frozen_at timestamptz NOT NULL,
    freeze_reason text NOT NULL CHECK (freeze_reason IN ('current-at-migration','cutoff'))
  );
  CREATE INDEX completed_issue_attribution_team_idx ON completed_issue_attribution(team_id,completed_at);
  CREATE OR REPLACE FUNCTION reject_completed_issue_attribution_change() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'Completed issue attribution is immutable'; END;
  $$ LANGUAGE plpgsql;
  CREATE TRIGGER immutable_completed_issue_attribution BEFORE UPDATE OR DELETE ON completed_issue_attribution
    FOR EACH ROW EXECUTE FUNCTION reject_completed_issue_attribution_change();
`;

type AttributionSourceRow = {
  issue_id: string;
  identifier: string;
  title: string;
  url: string;
  estimate: string | null;
  state_type: string;
  completed_at: Date;
  source_updated_at: Date;
  project_id: string | null;
  project_name: string | null;
  project_available: boolean;
  local_classification: ProjectClassification | null;
};

type FrozenAttributionRow = Omit<AttributionSourceRow, "local_classification" | "project_available"> & {
  classification: EffectiveProjectClassification;
  frozen_at: Date;
  freeze_reason: "current-at-migration" | "cutoff";
};

type CycleRow = { linear_id: string; starts_at: Date; ends_at: Date };

export type CompletedWorkHistoryEvidence = {
  issueId: string;
  identifier: string;
  title: string;
  url: string;
  estimate: number | null;
  completedAt: Date;
  projectId: string | null;
  projectName: string | null;
  classification: "ongoing" | "unresolved";
  attribution: "ongoing" | "needs-classification" | "no-project";
  cycleId: string | null;
  frozenAt: Date | null;
  freezeReason: "current-at-migration" | "cutoff" | null;
};

async function labelsByProject(client: Client, projectIds: string[]): Promise<Map<string, { id: string; name: string }[]>> {
  if (!projectIds.length) return new Map();
  const result = await client.query<{ project_id: string; label_id: string; name: string }>(
    "SELECT project_id,label_id,name FROM linear_project_label_cache WHERE project_id=ANY($1::text[])", [projectIds],
  );
  const labels = new Map<string, { id: string; name: string }[]>();
  for (const row of result.rows) labels.set(row.project_id, [...(labels.get(row.project_id) ?? []), { id: row.label_id, name: row.name }]);
  return labels;
}

function resolveRowClassification(row: AttributionSourceRow, labels: Map<string, { id: string; name: string }[]>): EffectiveProjectClassification {
  if (!row.project_id || !row.project_available) return "unresolved";
  return resolveProjectClassification(labels.get(row.project_id) ?? [], row.local_classification).classification;
}

export async function snapshotEligibleCompletedIssues(client: PoolClient, teamId: string, frozenAt: Date): Promise<number> {
  const migration = await client.query<{ completed_attribution_backfilled: boolean }>(
    "SELECT completed_attribution_backfilled FROM workspace WHERE id=1 FOR UPDATE",
  );
  const freezeReason = migration.rows[0]?.completed_attribution_backfilled ? "cutoff" : "current-at-migration";
  const cutoff = new Date(frozenAt.getTime() - attributionCutoffMs);
  const candidates = await client.query<AttributionSourceRow>(`SELECT i.linear_id AS issue_id,i.identifier,i.title,i.url,i.estimate::text,
      i.state_type,i.completed_at,i.source_updated_at,i.project_id,p.name AS project_name,
      (p.linear_id IS NOT NULL AND NOT p.needs_review) AS project_available,w.local_classification
    FROM linear_issue_cache i
    LEFT JOIN linear_project_cache p ON p.linear_id=i.project_id
    LEFT JOIN work_package w ON w.project_id=p.linear_id
    LEFT JOIN completed_issue_attribution frozen ON frozen.issue_id=i.linear_id
    WHERE i.team_id=$1 AND i.state_type='completed' AND i.completed_at IS NOT NULL AND i.completed_at<=$2 AND frozen.issue_id IS NULL
    ORDER BY i.linear_id`, [teamId, cutoff]);
  const projectIds = [...new Set(candidates.rows.flatMap((row) => row.project_id && row.project_name ? [row.project_id] : []))];
  const labels = await labelsByProject(client, projectIds);
  const snapshots = candidates.rows.map((row) => ({ row, classification: resolveRowClassification(row, labels) }));
  let inserted = 0;
  for (let start = 0; start < snapshots.length; start += 100) {
    const batch = snapshots.slice(start, start + 100);
    const values: unknown[] = [];
    const placeholders = batch.map(({ row, classification }) => {
      const offset = values.length;
      values.push(row.issue_id, teamId, row.identifier, row.title, row.url, row.estimate, row.state_type, row.completed_at,
        row.source_updated_at, row.project_id, row.project_name, classification, frozenAt, freezeReason);
      return `(${Array.from({ length: 14 }, (_, index) => `$${offset + index + 1}`).join(",")})`;
    });
    const result = await client.query(`INSERT INTO completed_issue_attribution(
        issue_id,team_id,identifier,title,url,estimate,state_type,completed_at,source_updated_at,project_id,project_name,classification,frozen_at,freeze_reason)
      VALUES ${placeholders.join(",")} ON CONFLICT(issue_id) DO NOTHING RETURNING issue_id`, values);
    inserted += result.rowCount ?? 0;
  }
  if (freezeReason === "current-at-migration") await client.query("UPDATE workspace SET completed_attribution_backfilled=true WHERE id=1");
  return inserted;
}

export async function readCompletedWorkHistoryEvidence(client: Client, teamId: string): Promise<CompletedWorkHistoryEvidence[]> {
  const frozen = await client.query<FrozenAttributionRow>(`SELECT a.issue_id,a.identifier,a.title,a.url,a.estimate::text,a.state_type,a.completed_at,
      a.source_updated_at,a.project_id,COALESCE(CASE WHEN NOT p.needs_review THEN p.name END,a.project_name) AS project_name,
      a.classification,a.frozen_at,a.freeze_reason
    FROM completed_issue_attribution a LEFT JOIN linear_project_cache p ON p.linear_id=a.project_id WHERE a.team_id=$1`, [teamId]);
  const current = await client.query<AttributionSourceRow>(`SELECT i.linear_id AS issue_id,i.identifier,i.title,i.url,i.estimate::text,i.state_type,
      i.completed_at,i.source_updated_at,i.project_id,p.name AS project_name,
      (p.linear_id IS NOT NULL AND NOT p.needs_review) AS project_available,w.local_classification
    FROM linear_issue_cache i
    LEFT JOIN linear_project_cache p ON p.linear_id=i.project_id
    LEFT JOIN work_package w ON w.project_id=p.linear_id
    LEFT JOIN completed_issue_attribution a ON a.issue_id=i.linear_id
    WHERE i.team_id=$1 AND i.state_type='completed' AND i.completed_at IS NOT NULL AND a.issue_id IS NULL`, [teamId]);
  const cycles = await client.query<CycleRow>(`SELECT linear_id,starts_at,ends_at FROM linear_cycle_cache
    WHERE team_id=$1 AND active=true AND completed_at IS NOT NULL ORDER BY starts_at DESC,linear_id`, [teamId]);
  const projectIds = [...new Set(current.rows.flatMap((row) => row.project_id && row.project_name ? [row.project_id] : []))];
  const labels = await labelsByProject(client, projectIds);
  const evidence: CompletedWorkHistoryEvidence[] = [];
  const append = (row: Omit<AttributionSourceRow, "local_classification" | "project_available">, classification: EffectiveProjectClassification,
    frozenAt: Date | null, freezeReason: "current-at-migration" | "cutoff" | null) => {
    if (classification === "roadmap") return;
    const completedAt = new Date(row.completed_at);
    const cycle = cycles.rows.find((candidate) => completedAt.getTime() >= new Date(candidate.starts_at).getTime() && completedAt.getTime() < new Date(candidate.ends_at).getTime());
    evidence.push({
      issueId: row.issue_id, identifier: row.identifier, title: row.title, url: row.url,
      estimate: row.estimate === null ? null : Number(row.estimate), completedAt,
      projectId: row.project_id, projectName: row.project_name, classification,
      attribution: row.project_id === null ? "no-project" : classification === "unresolved" ? "needs-classification" : "ongoing",
      cycleId: cycle?.linear_id ?? null, frozenAt, freezeReason,
    });
  };
  for (const row of frozen.rows) append(row, row.classification, new Date(row.frozen_at), row.freeze_reason);
  for (const row of current.rows) append(row, resolveRowClassification(row, labels), null, null);
  return evidence.sort((left, right) => left.completedAt.getTime() - right.completedAt.getTime() || left.issueId.localeCompare(right.issueId));
}
