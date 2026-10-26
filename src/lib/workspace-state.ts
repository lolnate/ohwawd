import type { PoolClient } from "pg";
import { roadmapConversionFeedback, type StoredRoadmapFields } from "./roadmap-planning";
import { planningToken } from "./planning-token";
import { getOutcomeLifecycles } from "./outcome-lifecycle";

type Project = StoredRoadmapFields & {
  id: string; name: string; description: string; status: string; url: string; cross_team: boolean; needs_review: boolean; in_scope: boolean;
  source_updated_at: Date; package_id: string; stream_id: string | null; capacity_outcome_id: string | null; selected: boolean;
  issue_count: number; unestimated_open_issues: number; estimated_open_points: number;
};
type Outcome = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null; stream_id: string | null; stream_position: number | null; created_at: Date };

/** Saved definitions, independent of forecast availability. Caller supplies its
 * repeatable-read transaction so fields and conversion status share a snapshot. */
export async function getWorkspaceState(client: Pick<PoolClient, "query">) {
  const [connection, projects, outcomes, links, streams, workspace] = await Promise.all([
    client.query<{ viewer_name: string; team_id: string; team_name: string; last_imported_at: Date }>("SELECT viewer_name,team_id,team_name,last_imported_at FROM linear_connection WHERE workspace_id=1"),
    client.query<Project>(`SELECT p.linear_id AS id,p.name,p.description,p.status,p.url,p.cross_team,p.needs_review,p.in_scope,
      p.source_updated_at,w.id AS package_id,w.stream_id,w.capacity_outcome_id,w.selected,w.roadmap_state,w.roadmap_conversion,
      COUNT(i.linear_id)::integer AS issue_count,
      COUNT(i.linear_id) FILTER (WHERE i.estimate IS NULL AND i.state_type NOT IN ('completed','canceled'))::integer AS unestimated_open_issues,
      COALESCE(p.remaining_scope,SUM(i.estimate) FILTER (WHERE i.state_type NOT IN ('completed','canceled')),0)::float AS estimated_open_points
      FROM linear_project_cache p JOIN work_package w ON w.project_id=p.linear_id
      LEFT JOIN linear_issue_cache i ON i.project_id=p.linear_id GROUP BY p.linear_id,w.id ORDER BY p.name`),
    client.query<Outcome>("SELECT id,title,description,owner,success_signal,needed_by::text,stream_id,stream_position,created_at FROM outcome ORDER BY created_at DESC,id"),
    client.query<{ outcome_id: string; project_id: string; requirement: "minimum" | "optional" }>("SELECT outcome_id,project_id,requirement FROM outcome_project_link"),
    client.query<{ id: string; name: string; position: number; wip_limit: number }>("SELECT id,name,position,wip_limit FROM stream WHERE active=true ORDER BY position"),
    client.query<{ timezone: string; roadmap_planning_migrated: boolean }>(`SELECT
      COALESCE((SELECT team_timezone FROM linear_connection WHERE workspace_id=1),timezone) AS timezone,roadmap_planning_migrated FROM workspace WHERE id=1`),
  ]);
  const lifecycles = await getOutcomeLifecycles(client);
  return { connection: connection.rows[0] ?? null, projects: projects.rows, outcomes: outcomes.rows.map((item) => ({ ...item, lifecycle: lifecycles.get(item.id)! })), links: links.rows, streams: streams.rows,
    timezone: workspace.rows[0]?.timezone ?? "America/New_York", roadmapPlanningMigrated: workspace.rows[0]?.roadmap_planning_migrated ?? false,
    roadmapConversionFeedback: roadmapConversionFeedback(projects.rows.map((item) => ({ id: item.package_id, roadmap_conversion: item.roadmap_conversion }))), planningToken: await planningToken(client) };
}
