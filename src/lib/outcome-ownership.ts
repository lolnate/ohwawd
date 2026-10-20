import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { HttpError } from "./security";
import { placeProjects, requireSequenceToken } from "./sequence-store";

type Client = Pick<PoolClient, "query">;

export async function ownershipToken(client: Client): Promise<string> {
  const [outcomes, links, packages] = await Promise.all([
    client.query("SELECT id,stream_id FROM outcome ORDER BY id"),
    client.query("SELECT outcome_id,project_id,requirement FROM outcome_project_link ORDER BY outcome_id,project_id"),
    client.query("SELECT id,capacity_outcome_id FROM work_package ORDER BY id"),
  ]);
  return createHash("sha256").update(JSON.stringify([outcomes.rows, links.rows, packages.rows])).digest("hex");
}

async function requireOwnershipToken(client: Client, token: unknown) {
  if (typeof token !== "string" || token !== await ownershipToken(client)) throw new HttpError(409, "Outcome placement, project links or capacity ownership changed. Refresh the board and try again.", { code: "OWNERSHIP_CONFLICT" });
}

export async function transferProjectOwnership(client: Client, input: { packageId?: unknown; outcomeId?: unknown; sequenceToken?: unknown; ownershipToken?: unknown }) {
  await requireSequenceToken(client, input.sequenceToken);
  await requireOwnershipToken(client, input.ownershipToken);
  if (typeof input.packageId !== "string" || (input.outcomeId !== null && (typeof input.outcomeId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.outcomeId)))) throw new HttpError(400, "Choose a project and a linked outcome.");
  const project = (await client.query("SELECT id,project_id,selected FROM work_package WHERE id=$1", [input.packageId])).rows[0];
  if (!project) throw new HttpError(404, "Project not found.");
  if (input.outcomeId === null) {
    await client.query("UPDATE work_package SET capacity_outcome_id=NULL WHERE id=$1", [project.id]);
    return;
  }
  const outcome = (await client.query(`SELECT o.stream_id FROM outcome o JOIN stream s ON s.id=o.stream_id AND s.active
    JOIN outcome_project_link l ON l.outcome_id=o.id AND l.project_id=$2 WHERE o.id=$1`, [input.outcomeId, project.project_id])).rows[0];
  if (!outcome) throw new HttpError(400, "Choose a linked outcome assigned to an active stream.");
  if (!project.selected) throw new HttpError(400, "Select this project in the plan before assigning its capacity owner.");
  await placeProjects(client, [{ packageId: project.id, streamId: outcome.stream_id, selected: true }]);
  await client.query("UPDATE work_package SET capacity_outcome_id=$2 WHERE id=$1", [project.id, input.outcomeId]);
}

export async function assignOutcomeToStream(client: Client, input: { outcomeId?: unknown; streamId?: unknown; sequenceToken?: unknown; ownershipToken?: unknown }) {
  await requireSequenceToken(client, input.sequenceToken);
  await requireOwnershipToken(client, input.ownershipToken);
  if (typeof input.outcomeId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.outcomeId) || (input.streamId !== null && typeof input.streamId !== "string")) throw new HttpError(400, "Choose an outcome and an active stream or Needs assignment.");
  if (!(await client.query("SELECT id FROM outcome WHERE id=$1", [input.outcomeId])).rowCount) throw new HttpError(404, "Outcome not found.");
  if (input.streamId !== null && !(await client.query("SELECT id FROM stream WHERE id=$1 AND active", [input.streamId])).rowCount) throw new HttpError(400, "Choose an active stream.");
  const projects = (await client.query(`SELECT w.id FROM work_package w JOIN outcome_project_link l ON l.project_id=w.project_id
    WHERE l.outcome_id=$1 AND w.selected AND (w.capacity_outcome_id=$1 OR w.capacity_outcome_id IS NULL) ORDER BY w.sequence_position NULLS LAST,w.id`, [input.outcomeId])).rows;
  if (input.streamId !== null) await placeProjects(client, projects.map((project) => ({ packageId: project.id, streamId: input.streamId as string, selected: true })));
  await client.query("UPDATE outcome SET stream_id=$2,updated_at=now() WHERE id=$1", [input.outcomeId, input.streamId]);
  if (input.streamId === null) await client.query("UPDATE work_package SET capacity_outcome_id=NULL WHERE capacity_outcome_id=$1", [input.outcomeId]);
  else await client.query("UPDATE work_package SET capacity_outcome_id=$2 WHERE id=ANY($1::text[])", [projects.map((item) => item.id), input.outcomeId]);
}

/** Retained links must not be deleted: their owner is protected by the composite FK. */
export async function replaceOutcomeLinks(client: Client, outcomeId: string, links: { projectId: string; requirement: "minimum" | "optional" }[]) {
  await client.query("DELETE FROM outcome_project_link WHERE outcome_id=$1 AND NOT(project_id=ANY($2::text[]))", [outcomeId, links.map((link) => link.projectId)]);
  for (const link of links) await client.query(`INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES($1,$2,$3)
    ON CONFLICT(outcome_id,project_id) DO UPDATE SET requirement=EXCLUDED.requirement`, [outcomeId, link.projectId, link.requirement]);
}
