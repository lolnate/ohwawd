import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { HttpError } from "./security";
type Client = Pick<PoolClient, "query">;

export async function roadmapActive(client: Client): Promise<boolean> {
  return (await client.query("SELECT roadmap_planning_migrated FROM workspace WHERE id=1")).rows[0]?.roadmap_planning_migrated === true;
}

// Available to saved-definition reads without loading or calculating a forecast.
export async function planningToken(client: Client): Promise<string> {
  const results = await Promise.all([
    client.query("SELECT id,stream_id,stream_position FROM outcome ORDER BY id"),
    client.query("SELECT outcome_id,project_id,requirement FROM outcome_project_link ORDER BY outcome_id,project_id"),
    client.query("SELECT id,stream_id,capacity_outcome_id,selected,roadmap_state,sequence_position FROM work_package ORDER BY id"),
    client.query("SELECT predecessor_id,successor_id,source,waived FROM package_dependency ORDER BY predecessor_id,successor_id,source"),
    client.query("SELECT id,active FROM stream ORDER BY id"),
    client.query("SELECT linear_id,status,needs_review,cross_team,external_blockers FROM linear_project_cache ORDER BY linear_id"),
    client.query("SELECT linear_id,project_id,state_type,estimate FROM linear_issue_cache ORDER BY linear_id"),
    client.query("SELECT package_id,points,issue_ids FROM package_extra_scope ORDER BY package_id"),
  ]);
  return createHash("sha256").update(JSON.stringify(results.map((result) => result.rows))).digest("hex");
}

export async function requirePlanningToken(client: Client, token: unknown) {
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  if (typeof token !== "string" || token !== await planningToken(client)) throw new HttpError(409, "The outcome links or planning context changed. Refresh workspace data and try again.", { code: "PLANNING_CONFLICT" });
}
