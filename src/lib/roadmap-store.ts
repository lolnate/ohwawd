import type { PoolClient } from "pg";
import { convertRoadmapPlanning, roadmapConversionFeedback, type RankedOutcome, type RoadmapPackage } from "./roadmap-planning";
import { activateRoadmapConstraintsSql } from "./roadmap-schema";
import { roadmapActive } from "./planning-token";
import { HttpError } from "./security";

export async function assertRoadmapInvariants(client: Pick<PoolClient, "query">) {
  if (!await roadmapActive(client)) return;
  const invalid = await client.query(`SELECT w.id FROM work_package w WHERE
    (w.roadmap_state='included' OR w.capacity_outcome_id IS NOT NULL) AND NOT EXISTS (
      SELECT 1 FROM outcome o JOIN stream s ON s.id=o.stream_id AND s.active
      JOIN outcome_project_link l ON l.outcome_id=o.id AND l.project_id=w.project_id
      WHERE o.id=w.capacity_outcome_id AND o.stream_id=w.stream_id) LIMIT 1`);
  const invalidOutcome = await client.query("SELECT o.id FROM outcome o LEFT JOIN stream s ON s.id=o.stream_id WHERE o.stream_id IS NOT NULL AND NOT COALESCE(s.active,false) LIMIT 1");
  if (invalid.rowCount || invalidOutcome.rowCount) throw new HttpError(409, "Roadmap ownership and stream placement must agree. Refresh and choose a valid linked owner.");
}

/** Migration-only activation. The caller MUST own the transaction. This is not
 * called from reads/imports or registered until the v5 writers are ready. */
export async function activateRoadmapPlanning(client: Pick<PoolClient, "query">) {
  const workspace = await client.query<{ roadmap_planning_migrated: boolean }>("SELECT roadmap_planning_migrated FROM workspace WHERE id=1 FOR UPDATE");
  if (!workspace.rowCount) throw new Error("Create the workspace before activating roadmap planning.");
  if (workspace.rows[0].roadmap_planning_migrated) return;
  const [packages, outcomes, links, streams] = await Promise.all([
    client.query<RoadmapPackage>(`SELECT w.*,p.name FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id ORDER BY w.id`),
    client.query<RankedOutcome>("SELECT * FROM outcome ORDER BY created_at DESC,id"),
    client.query<{ outcome_id: string; project_id: string; requirement: "minimum" | "optional" }>("SELECT outcome_id,project_id,requirement FROM outcome_project_link"),
    client.query<{ id: string; name: string; position: number; active: boolean }>("SELECT id,name,position,active FROM stream"),
  ]);
  const converted = convertRoadmapPlanning({ packages: packages.rows, outcomes: outcomes.rows, links: links.rows, streams: streams.rows });
  await client.query("SET CONSTRAINTS outcome_stream_position_key DEFERRED");
  for (const outcome of converted.outcomes) await client.query("UPDATE outcome SET stream_id=$2,stream_position=$3 WHERE id=$1", [outcome.id, outcome.stream_id, outcome.stream_position]);
  for (const item of converted.packages) await client.query(`UPDATE work_package SET
    stream_id=$2,capacity_outcome_id=$3,selected=$4,roadmap_state=$5,roadmap_conversion=$6::jsonb WHERE id=$1`,
  [item.id, item.stream_id, item.capacity_outcome_id, item.selected, item.roadmap_state, item.roadmap_conversion ? JSON.stringify(item.roadmap_conversion) : null]);
  await client.query(activateRoadmapConstraintsSql);
  await client.query("UPDATE workspace SET roadmap_planning_migrated=true WHERE id=1");
  return roadmapConversionFeedback(converted.packages);
}
