import type { PoolClient } from "pg";
import { HttpError } from "./security";
import { requireSequenceToken, rejectNewOrderConflicts } from "./sequence-store";
import { reconcileOutcomeCompletions } from "./outcome-lifecycle";

/** Caller owns the complete workspace-locked transaction, including review audit. */
export async function saveDependency(client: Pick<PoolClient, "query">, input: { predecessorId?: unknown; successorId?: unknown; action?: unknown; reason?: unknown; sequenceToken?: unknown }) {
  const before = await requireSequenceToken(client, input.sequenceToken);
  if (typeof input.predecessorId !== "string" || typeof input.successorId !== "string" || input.predecessorId === input.successorId) throw new HttpError(400, "Choose two different packages.");
  const pair = [input.predecessorId, input.successorId];
  if (input.action === "remove") await client.query("DELETE FROM package_dependency WHERE predecessor_id=$1 AND successor_id=$2 AND source='local'", pair);
  else if (input.action === "waive") {
    if (typeof input.reason !== "string" || !input.reason.trim()) throw new HttpError(400, "Explain the Linear dependency waiver.");
    const result = await client.query("UPDATE package_dependency SET waived=true,waiver_reason=$3 WHERE predecessor_id=$1 AND successor_id=$2 AND source='linear'", [...pair, input.reason.trim()]);
    if (!result.rowCount) throw new HttpError(404, "Linear dependency not found.");
  } else if (input.action === "restore") {
    const result = await client.query("UPDATE package_dependency SET waived=false,waiver_reason='' WHERE predecessor_id=$1 AND successor_id=$2 AND source='linear'", pair);
    if (!result.rowCount) throw new HttpError(404, "Linear dependency not found.");
    await rejectNewOrderConflicts(client, before);
  } else if (input.action === "add") {
    const found = await client.query("SELECT id FROM work_package WHERE id=ANY($1::text[])", [pair]);
    if (found.rowCount !== 2) throw new HttpError(400, "Both packages must exist.");
    await client.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES($1,$2,'local') ON CONFLICT DO NOTHING", pair);
    await rejectNewOrderConflicts(client, before);
  } else throw new HttpError(400, "Invalid dependency action.");
  await reconcileOutcomeCompletions(client);
}
