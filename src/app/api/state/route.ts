import { db, ensureSchema } from "@/lib/db";
import { requireOwner, responseError } from "@/lib/security";

export async function GET(): Promise<Response> {
  try {
    await requireOwner();
    await ensureSchema();
    const [connection, projects, outcomes, links, streams] = await Promise.all([
      db().query("SELECT viewer_name, team_id, team_name, last_imported_at FROM linear_connection WHERE workspace_id=1"),
      db().query(`SELECT p.linear_id AS id, p.name, p.description, p.status, p.url, p.cross_team, p.needs_review, p.in_scope,
        p.source_updated_at, w.id AS package_id, w.stream_id,
        COUNT(i.linear_id)::integer AS issue_count,
        COUNT(i.linear_id) FILTER (WHERE i.estimate IS NULL AND i.state_type NOT IN ('completed','canceled'))::integer AS unestimated_open_issues,
        COALESCE(SUM(i.estimate) FILTER (WHERE i.state_type NOT IN ('completed','canceled')),0)::float AS estimated_open_points
        FROM linear_project_cache p JOIN work_package w ON w.project_id=p.linear_id
        LEFT JOIN linear_issue_cache i ON i.project_id=p.linear_id
        GROUP BY p.linear_id, w.id ORDER BY p.name`),
      db().query("SELECT id, title, description, owner, success_signal, needed_by, created_at FROM outcome ORDER BY created_at DESC"),
      db().query("SELECT outcome_id, project_id, requirement FROM outcome_project_link"),
      db().query("SELECT id, name, position, wip_limit FROM stream WHERE active=true ORDER BY position"),
    ]);
    return Response.json({
      connection: connection.rows[0] ?? null,
      projects: projects.rows,
      outcomes: outcomes.rows,
      links: links.rows,
      streams: streams.rows,
    });
  } catch (error) { return responseError(error); }
}
