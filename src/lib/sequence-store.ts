import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { HttpError } from "./security";
import { dependencyPaths, orderConflicts, planPlacements, type Placement, type QueueState } from "./sequencing";

type Client = Pick<PoolClient, "query">;

export async function sequencingState(client: Client): Promise<QueueState> {
  const [packages, streams, edges] = await Promise.all([
    client.query(`SELECT w.id,p.name,w.stream_id,w.selected,w.sequence_position,
      (p.status ILIKE '%completed%' AND NOT p.needs_review AND NOT p.cross_team AND cardinality(p.external_blockers)=0
        AND NOT EXISTS(SELECT 1 FROM linear_issue_cache i WHERE i.project_id=w.project_id AND i.state_type NOT IN ('completed','canceled'))
        AND NOT EXISTS(SELECT 1 FROM package_extra_scope e WHERE e.package_id=w.id)) AS complete
      FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id ORDER BY w.id`),
    client.query("SELECT id FROM stream WHERE active=true ORDER BY id"),
    client.query("SELECT predecessor_id,successor_id FROM package_dependency WHERE NOT waived ORDER BY predecessor_id,successor_id,source"),
  ]);
  return { packages: packages.rows.map((row) => ({ id: row.id, name: row.name, streamId: row.stream_id, selected: row.selected, position: row.sequence_position, complete: row.complete })),
    streamIds: streams.rows.map((row) => row.id), dependencies: edges.rows.map((row) => ({ predecessorId: row.predecessor_id, successorId: row.successor_id })) };
}

export function sequenceToken(state: QueueState): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

export async function requireSequenceToken(client: Client, token: unknown): Promise<QueueState> {
  const state = await sequencingState(client);
  const current = sequenceToken(state);
  if (typeof token !== "string" || token !== current) throw new HttpError(409, "The project sequence or dependencies changed. Refresh the board and try the move again.", {
    code: "SEQUENCE_CONFLICT", sequenceToken: current, sequencing: state,
  });
  return state;
}

export async function placeProjects(client: Client, placements: Placement[], expectedToken?: unknown): Promise<void> {
  const state = expectedToken === undefined ? await sequencingState(client) : await requireSequenceToken(client, expectedToken);
  let packages;
  try { packages = planPlacements(state, placements); }
  catch (error) { throw new HttpError(409, error instanceof Error ? error.message : "Invalid project placement.", { code: "INVALID_PLACEMENT" }); }
  for (const item of packages) {
    const before = state.packages.find((candidate) => candidate.id === item.id)!;
    if (item.streamId !== before.streamId || item.selected !== before.selected || item.position !== before.position) {
      await client.query("UPDATE work_package SET stream_id=$2,selected=$3,sequence_position=$4 WHERE id=$1", [item.id, item.streamId, item.selected, item.position]);
    }
  }
  await clearIncompatibleOutcomeOwners(client);
}

export async function clearIncompatibleOutcomeOwners(client: Client): Promise<void> {
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
