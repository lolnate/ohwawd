import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { HttpError } from "./security";
import { dependencyPaths, orderConflicts, planPlacements, type Placement, type QueueState } from "./sequencing";

type Client = Pick<PoolClient, "query">;

export async function sequencingState(client: Client): Promise<QueueState> {
  const [packages, streams, edges, workspace, outcomes, links] = await Promise.all([
    client.query(`SELECT w.id,p.name,w.stream_id,w.selected,w.sequence_position,w.capacity_outcome_id,w.roadmap_state,
      (p.status ILIKE '%completed%' AND NOT p.needs_review AND NOT p.cross_team AND cardinality(p.external_blockers)=0
        AND NOT EXISTS(SELECT 1 FROM linear_issue_cache i WHERE i.project_id=w.project_id AND i.state_type NOT IN ('completed','canceled'))
        AND NOT EXISTS(SELECT 1 FROM package_extra_scope e WHERE e.package_id=w.id)) AS complete
      FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id ORDER BY w.id`),
    client.query("SELECT id FROM stream WHERE active=true ORDER BY id"),
    client.query("SELECT predecessor_id,successor_id FROM package_dependency WHERE NOT waived ORDER BY predecessor_id,successor_id,source"),
    client.query("SELECT w.roadmap_planning_migrated,l.last_imported_at FROM workspace w LEFT JOIN linear_connection l ON l.workspace_id=w.id WHERE w.id=1"),
    client.query("SELECT id,stream_id,stream_position FROM outcome ORDER BY id"),
    client.query("SELECT w.id AS package_id,l.outcome_id FROM outcome_project_link l JOIN work_package w ON w.project_id=l.project_id ORDER BY w.id,l.outcome_id"),
  ]);
  const active = workspace.rows[0]?.roadmap_planning_migrated;
  return { packages: packages.rows.map((row) => ({ id: row.id, name: row.name, streamId: row.stream_id, selected: row.selected, position: row.sequence_position, complete: row.complete })),
    streamIds: streams.rows.map((row) => row.id), dependencies: edges.rows.map((row) => ({ predecessorId: row.predecessor_id, successorId: row.successor_id })),
    ...(active ? { outcomeScoped: true, sourceAt: workspace.rows[0].last_imported_at?.toISOString() ?? null,
      packages: packages.rows.map((row) => ({ id: row.id, name: row.name, streamId: row.stream_id, selected: row.selected, position: row.sequence_position, complete: row.complete, ownerId: row.capacity_outcome_id, roadmapState: row.roadmap_state })),
      outcomes: outcomes.rows.map((row) => ({ id: row.id, streamId: row.stream_id, position: row.stream_position })), links: links.rows.map((row) => ({ packageId: row.package_id, outcomeId: row.outcome_id })) } : {}) };
}

export function sequenceToken(state: QueueState): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

export async function requireSequenceToken(client: Client, token: unknown): Promise<QueueState> {
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const state = await sequencingState(client);
  const current = sequenceToken(state);
  if (typeof token !== "string" || token !== current) throw new HttpError(409, "The project sequence, outcome priority or dependencies changed. Refresh the board and try the move again.", {
    code: "SEQUENCE_CONFLICT", sequenceToken: current, sequencing: state,
  });
  return state;
}

export async function placeProjects(client: Client, placements: Placement[], expectedToken?: unknown): Promise<void> {
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const state = expectedToken === undefined ? await sequencingState(client) : await requireSequenceToken(client, expectedToken);
  let packages;
  try { packages = planPlacements(state, placements); }
  catch (error) { throw new HttpError(409, error instanceof Error ? error.message : "Invalid project placement.", { code: "INVALID_PLACEMENT" }); }
  for (const item of packages) {
    const before = state.packages.find((candidate) => candidate.id === item.id)!;
    if (item.streamId !== before.streamId || item.selected !== before.selected || item.position !== before.position) {
      if (!state.outcomeScoped) await client.query("UPDATE work_package SET stream_id=$2,selected=$3,sequence_position=$4 WHERE id=$1", [item.id, item.streamId, item.selected, item.position]);
    }
    if (state.outcomeScoped && (item.streamId !== before.streamId || item.selected !== before.selected || item.position !== before.position || item.ownerId !== before.ownerId || item.roadmapState !== before.roadmapState)) await client.query(`UPDATE work_package SET stream_id=$2,selected=$3,sequence_position=$4,capacity_outcome_id=$5,roadmap_state=$6,roadmap_conversion=NULL WHERE id=$1`, [item.id, item.streamId, item.selected, item.position, item.ownerId, item.roadmapState]);
  }
  await clearIncompatibleOutcomeOwners(client);
}

export async function clearIncompatibleOutcomeOwners(client: Client): Promise<void> {
  if ((await client.query("SELECT roadmap_planning_migrated FROM workspace WHERE id=1")).rows[0]?.roadmap_planning_migrated) {
    await client.query(`UPDATE work_package w SET capacity_outcome_id=NULL,stream_id=NULL,selected=false,sequence_position=NULL,
      roadmap_state=CASE WHEN w.roadmap_state='included' THEN 'candidate' ELSE w.roadmap_state END
      WHERE (w.capacity_outcome_id IS NOT NULL OR w.roadmap_state='included') AND NOT EXISTS(
        SELECT 1 FROM outcome o JOIN stream s ON s.id=o.stream_id AND s.active JOIN outcome_project_link l ON l.outcome_id=o.id AND l.project_id=w.project_id
        WHERE o.id=w.capacity_outcome_id AND o.stream_id=w.stream_id)`);
    return;
  }
  await client.query(`UPDATE work_package w SET capacity_outcome_id=NULL FROM outcome o
    WHERE w.capacity_outcome_id=o.id AND (NOT w.selected OR w.stream_id IS DISTINCT FROM o.stream_id)`);
}

export async function rejectNewOrderConflicts(client: Client, before: QueueState): Promise<void> {
  const after = await sequencingState(client);
  if ([...dependencyPaths(after.dependencies)].some(([id, reached]) => reached.has(id))) throw new HttpError(400, "That dependency would create a cycle.");
  const known = new Set(orderConflicts(before).map((item) => item.key));
  const conflict = orderConflicts(after).find((item) => !known.has(item.key));
  if (conflict) throw new HttpError(409, conflict.message, { code: "DEPENDENCY_ORDER_CONFLICT" });
}
