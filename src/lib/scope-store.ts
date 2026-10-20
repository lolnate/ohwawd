import type { PoolClient } from "pg";
import { HttpError } from "./security";
import { issueBaseline, isOpenIssue, type ScopeIssue } from "./project-scope";

export async function saveExtraScope(client: Pick<PoolClient, "query">, input: { packageId: unknown; points: unknown; notes?: unknown }): Promise<void> {
  if (typeof input.packageId !== "string") throw new HttpError(400, "Choose a project.");
  const points = input.points;
  const notes = input.notes ?? "";
  if (typeof points !== "number" || !Number.isFinite(points) || points < 0 || points > 100000 || Math.abs(points * 1000 - Math.round(points * 1000)) > 1e-7) {
    throw new HttpError(400, "Extra scope must be 0–100,000 points with at most three decimal places.");
  }
  if (typeof notes !== "string" || notes.length > 4000) throw new HttpError(400, "Notes must be at most 4,000 characters.");
  const project = await client.query("SELECT project_id FROM work_package WHERE id=$1", [input.packageId]);
  if (!project.rowCount) throw new HttpError(404, "Project not found.");
  if (points === 0) { await client.query("DELETE FROM package_extra_scope WHERE package_id=$1", [input.packageId]); return; }
  const issues = (await client.query<ScopeIssue>("SELECT linear_id,project_id,estimate::float,state_type FROM linear_issue_cache WHERE project_id=$1", [project.rows[0].project_id])).rows;
  await client.query(`INSERT INTO package_extra_scope(package_id,points,notes,issue_ids,issue_baseline) VALUES($1,$2,$3,$4,$5::jsonb)
    ON CONFLICT(package_id) DO UPDATE SET points=$2,notes=$3,issue_ids=$4,issue_baseline=$5::jsonb,legacy_review=NULL`,
  [input.packageId, points, notes.trim(), issues.filter((issue) => isOpenIssue(issue) && issue.estimate === null).map((issue) => issue.linear_id), JSON.stringify(issueBaseline(issues))]);
}

export async function saveScopingWindow(client: Pick<PoolClient, "query">, leadDays: unknown): Promise<void> {
  if (!Number.isInteger(leadDays) || (leadDays as number) < 0 || (leadDays as number) > 365) throw new HttpError(400, "Scoping lead time must be a whole number from 0 through 365 days.");
  await client.query(`INSERT INTO capacity_profile(workspace_id,scoping_lead_days) VALUES(1,$1)
    ON CONFLICT(workspace_id) DO UPDATE SET scoping_lead_days=$1`, [leadDays]);
}
