import type { PoolClient } from "pg";
import { HttpError } from "./security";
import { placeProjects, requireSequenceToken } from "./sequence-store";
import { roadmapActive, requirePlanningToken, planningToken } from "./planning-token";
import type { RoadmapState } from "./roadmap-planning";
import { reconcileOutcomeCompletions } from "./outcome-lifecycle";
type Client = Pick<PoolClient, "query">;

/** Internal helpers share the caller's workspace-locked transaction. */
export async function detachOutcomeWork(client: Client, outcomeId: string, retainedProjectIds: string[] = []) {
  if (!await roadmapActive(client)) return [];
  const affected = (await client.query<{ id: string; name: string }>(`SELECT w.id,p.name FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id
    WHERE w.capacity_outcome_id=$1 AND w.roadmap_state='included' AND NOT(w.project_id=ANY($2::text[])) ORDER BY w.id`, [outcomeId, retainedProjectIds])).rows;
  await client.query(`UPDATE work_package SET capacity_outcome_id=NULL,stream_id=NULL,selected=false,sequence_position=NULL,
    roadmap_state=CASE WHEN roadmap_state='included' THEN 'candidate' ELSE roadmap_state END,
    roadmap_conversion=jsonb_build_object('reason','needs-owner','previousStreamId',stream_id,'previousStreamName',(SELECT name FROM stream WHERE id=stream_id),
      'candidateOutcomeIds','[]'::jsonb,'message','Needs assignment: the owning outcome or link was removed. Future demand is excluded until an owner is chosen.')
    WHERE capacity_outcome_id=$1 AND NOT(project_id=ANY($2::text[]))`, [outcomeId, retainedProjectIds]);
  return affected;
}

export async function normalizeOutcomeRanks(client: Client) {
  await client.query("SET CONSTRAINTS outcome_stream_position_key DEFERRED");
  await client.query(`UPDATE outcome o SET stream_position=r.position FROM
    (SELECT id,row_number() OVER(PARTITION BY stream_id ORDER BY stream_position NULLS LAST,created_at DESC,id)::integer AS position
      FROM outcome WHERE stream_id IS NOT NULL) r WHERE o.id=r.id`);
}

export async function placeRoadmapOutcome(client: Client, input: { outcomeId: string; streamId: string | null; beforeOutcomeId?: unknown; afterOutcomeId?: unknown }) {
  await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const current = (await client.query<{ stream_id: string | null }>("SELECT stream_id FROM outcome WHERE id=$1", [input.outcomeId])).rows[0];
  if (!current) throw new HttpError(404, "Outcome not found.");
  if (input.streamId !== null && !(await client.query("SELECT id FROM stream WHERE id=$1 AND active", [input.streamId])).rowCount) throw new HttpError(400, "Choose an active stream.");
  if (input.beforeOutcomeId !== undefined && input.afterOutcomeId !== undefined) throw new HttpError(400, "Choose before or after, not both.");
  if ((input.beforeOutcomeId !== undefined && typeof input.beforeOutcomeId !== "string") || (input.afterOutcomeId !== undefined && typeof input.afterOutcomeId !== "string")) throw new HttpError(400, "Choose an insertion outcome ID.");
  const target = input.beforeOutcomeId ?? input.afterOutcomeId;
  if (target !== undefined && (typeof target !== "string" || target === input.outcomeId || input.streamId === null)) throw new HttpError(400, "Choose another outcome in the destination stream.");
  if (current.stream_id === input.streamId && target === undefined) return { affectedCandidates: [] };
  const lane = (await client.query<{ id: string }>("SELECT id FROM outcome WHERE stream_id=$1 AND id<>$2 ORDER BY stream_position,id", [input.streamId, input.outcomeId])).rows.map((item) => item.id);
  let index = lane.length;
  if (target !== undefined) { index = lane.indexOf(target as string); if (index < 0) throw new HttpError(409, "The insertion outcome changed. Refresh the Board."); if (input.afterOutcomeId !== undefined) index++; }
  const affectedCandidates = input.streamId === null ? await detachOutcomeWork(client, input.outcomeId) : [];
  await client.query("SET CONSTRAINTS outcome_stream_position_key DEFERRED");
  await client.query("UPDATE outcome SET stream_id=$2,stream_position=$3,updated_at=now() WHERE id=$1", [input.outcomeId, input.streamId, input.streamId === null ? null : index + 1]);
  if (input.streamId !== null) {
    lane.splice(index, 0, input.outcomeId);
    for (let position = 0; position < lane.length; position++) await client.query("UPDATE outcome SET stream_position=$2 WHERE id=$1", [lane[position], position + 1]);
    const owned = (await client.query<{ id: string }>("SELECT id FROM work_package WHERE capacity_outcome_id=$1 AND roadmap_state='included' ORDER BY sequence_position NULLS LAST,id", [input.outcomeId])).rows;
    // Deferred return context follows its owner without including its demand.
    await client.query("UPDATE work_package SET stream_id=$2 WHERE capacity_outcome_id=$1 AND roadmap_state='deferred'", [input.outcomeId, input.streamId]);
    await placeProjects(client, owned.map((item) => ({ packageId: item.id, streamId: input.streamId, selected: true, outcomeId: input.outcomeId })));
  }
  await normalizeOutcomeRanks(client);
  return { affectedCandidates };
}

export async function changeRoadmapMembership(client: Client, input: { packageId?: unknown; action?: unknown; outcomeId?: unknown; beforeId?: unknown; reason?: unknown; sequenceToken?: unknown; planningToken?: unknown }) {
  await requireSequenceToken(client, input.sequenceToken);
  await requirePlanningToken(client, input.planningToken);
  if (!await roadmapActive(client)) throw new HttpError(409, "Roadmap planning has not been activated.");
  if (typeof input.packageId !== "string") throw new HttpError(400, "Choose a project.");
  const current = (await client.query("SELECT * FROM work_package WHERE id=$1", [input.packageId])).rows[0];
  if (!current) throw new HttpError(404, "Project not found.");
  const actions: Record<string, RoadmapState> = { include: "included", resume: "included", candidate: "candidate", defer: "deferred", dismiss: "dismissed", restore: "candidate" };
  const state = typeof input.action === "string" ? actions[input.action] : undefined;
  if (!state) throw new HttpError(400, "Choose include, resume, candidate, defer, dismiss or restore.");
  if (input.action === "restore" && current.roadmap_state !== "dismissed") throw new HttpError(400, "Only dismissed work can be restored.");
  if (input.action === "resume" && current.roadmap_state !== "deferred") throw new HttpError(400, "Only deferred work can be resumed.");
  if (input.beforeId !== undefined && input.beforeId !== null && typeof input.beforeId !== "string") throw new HttpError(400, "Choose an insertion project.");
  if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length > 1000)) throw new HttpError(400, "Invalid pause rationale.");
  const ownerId = input.outcomeId === undefined ? current.capacity_outcome_id : input.outcomeId;
  if (ownerId !== null && typeof ownerId !== "string") throw new HttpError(400, "Choose an owning outcome.");
  const owner = typeof ownerId === "string" ? (await client.query("SELECT stream_id FROM outcome WHERE id::text=$1", [ownerId])).rows[0] : undefined;
  await placeProjects(client, [{ packageId: current.id, roadmapState: state, selected: state === "included", streamId: state === "included" ? owner?.stream_id ?? null : null,
    outcomeId: ownerId, beforeId: input.beforeId as string | null | undefined }]);
  if (input.reason !== undefined) await client.query("UPDATE work_package SET pause_reason=$2 WHERE id=$1", [current.id, (input.reason as string).trim()]);
}

export async function deleteOutcome(client: Client, id: string, token: unknown) {
  await requirePlanningToken(client, token);
  if (!(await client.query("SELECT id FROM outcome WHERE id=$1", [id])).rowCount) throw new HttpError(404, "Outcome not found.");
  const affectedCandidates = await detachOutcomeWork(client, id);
  await client.query("DELETE FROM outcome WHERE id=$1", [id]);
  await reconcileOutcomeCompletions(client, "Owner", [id]);
  if (await roadmapActive(client)) await normalizeOutcomeRanks(client);
  return { deleted: true, affectedCandidates, planningToken: await planningToken(client) };
}
