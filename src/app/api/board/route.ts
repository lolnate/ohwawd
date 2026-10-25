import { transaction } from "@/lib/db";
import { assignPackagesToStream, getBoard } from "@/lib/board";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";
import { placeProjects, requireSequenceToken, rejectNewOrderConflicts } from "@/lib/sequence-store";
import { saveExtraScope, saveScopingWindow } from "@/lib/scope-store";
import { saveHolidayPreset, saveWeeklyAvailability } from "@/lib/weekly-capacity-store";
import { assignOutcomeToStream, transferProjectOwnership } from "@/lib/outcome-ownership";
import { saveCapacityProfile } from "@/lib/capacity-store";

const finite = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export async function GET(): Promise<Response> {
  try { await requireOwner(); return Response.json(await getBoard()); }
  catch (error) { return responseError(error); }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    await requireOwner(); await requireSameOrigin(request);
    const body = await request.json();
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid board change.");
    await transaction(async (client) => {
      await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
      if (body.type === "package") {
        for (const field of ["priority", "priorityRank", "priority_rank", "mustInclude", "must_include", "earliestCycle", "preferredCycle", "earliestCycleId", "preferredCycleId", "earliest_cycle", "preferred_cycle", "earliest_linear_cycle_id", "preferred_linear_cycle_id", "earliest", "preferred"]) {
          if (field in body) throw new HttpError(400, `Unsupported planning control: ${field}. Use stream sequence instead.`);
        }
        await requireSequenceToken(client, body.sequenceToken);
        const current = await client.query("SELECT w.*,p.status FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id WHERE w.id=$1 FOR UPDATE", [body.id]);
        const row = current.rows[0];
        if (!row) throw new HttpError(404, "Package not found.");
        const selected = body.selected === undefined ? row.selected : body.selected;
        if (typeof selected !== "boolean") throw new HttpError(400, "Invalid selection.");
        const streamId = body.streamId === undefined ? row.stream_id : body.streamId;
        if (streamId !== null && (typeof streamId !== "string" || !(await client.query("SELECT id FROM stream WHERE id=$1 AND active=true", [streamId])).rowCount)) throw new HttpError(400, "Choose an active stream.");
        const reason = body.reason === undefined ? row.pause_reason : body.reason;
        if (typeof reason !== "string" || reason.length > 1000) throw new HttpError(400, "Invalid rationale.");
        if (body.beforeId !== undefined && body.beforeId !== null && typeof body.beforeId !== "string") throw new HttpError(400, "Choose an insertion project or end of stream.");
        await placeProjects(client, [{ packageId: body.id, selected, streamId, beforeId: body.beforeId }]);
        await client.query("UPDATE work_package SET pause_reason=$2 WHERE id=$1", [body.id, reason.trim()]);
      } else if (body.type === "outcomeAssignment") {
        await assignOutcomeToStream(client, body);
      } else if (body.type === "ownership") {
        await transferProjectOwnership(client, body);
      } else if (body.type === "stream") {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (typeof body.id !== "string" || !name || name.length > 80 || !finite(body.allocation, 0, 1)) throw new HttpError(400, "Enter a stream name and a 0–100% allocation.");
        if (body.wip !== undefined && body.wip !== 1) throw new HttpError(400, "Streams run one project at a time; WIP must be one.");
        const exists = await client.query("SELECT id FROM stream WHERE id=$1 AND active=true", [body.id]);
        if (!exists.rowCount) throw new HttpError(404, "Stream not found.");
        const duplicate = await client.query("SELECT id FROM stream WHERE active=true AND id<>$1 AND lower(name)=lower($2)", [body.id, name]);
        if (duplicate.rowCount) throw new HttpError(409, "Choose a unique stream name.");
        const total = await client.query<{ sum: number }>("SELECT COALESCE(SUM(allocation),0)::float AS sum FROM stream WHERE active=true AND id<>$1", [body.id]);
        if (total.rows[0].sum + body.allocation > 1.000001) throw new HttpError(400, "Allocations may total at most 100%.");
        await client.query("UPDATE stream SET name=$2,allocation=$3,wip_limit=1 WHERE id=$1", [body.id, name, body.allocation]);
      } else if (body.type === "assignment") {
        await requireSequenceToken(client, body.sequenceToken);
        if (typeof body.streamId !== "string" || !Array.isArray(body.packageIds) || !body.packageIds.length ||
          body.packageIds.length > 5000 || body.packageIds.some((id: unknown) => typeof id !== "string") ||
          new Set(body.packageIds).size !== body.packageIds.length) throw new HttpError(400, "Choose one or more unique packages.");
        const stream = await client.query("SELECT id FROM stream WHERE id=$1 AND active=true", [body.streamId]);
        if (!stream.rowCount) throw new HttpError(404, "Stream not found.");
        const packages = await client.query("SELECT id FROM work_package WHERE id=ANY($1::text[]) FOR UPDATE", [body.packageIds]);
        if (packages.rowCount !== body.packageIds.length) throw new HttpError(400, "Every package must exist.");
        // stream_id is scalar, so assigning here moves existing assignments rather than duplicating them.
        await assignPackagesToStream(client, body.streamId, body.packageIds);
      } else if (body.type === "capacity") {
        await saveCapacityProfile(client, body);
      } else if (body.type === "adjustment") {
        if (!Array.isArray(body.cycleIds) || !body.cycleIds.length || body.cycleIds.length > 15 || body.cycleIds.some((id: unknown) => typeof id !== "string") || new Set(body.cycleIds).size !== body.cycleIds.length) throw new HttpError(400, "Select one or more upcoming Linear cycles.");
        const found = await client.query(`SELECT c.linear_id FROM linear_cycle_cache c JOIN linear_connection l ON l.team_id=c.team_id
          WHERE c.linear_id=ANY($1::text[]) AND c.active=true AND c.completed_at IS NULL
            AND c.starts_at>COALESCE(GREATEST(l.last_imported_at,l.cycles_refreshed_at),l.connected_at)`, [body.cycleIds]);
        if (found.rowCount !== body.cycleIds.length) throw new HttpError(400, "Every selected cycle must be upcoming in the connected Linear team.");
        if (body.action === "clear") {
          await client.query("DELETE FROM linear_cycle_adjustment WHERE linear_cycle_id=ANY($1::text[])", [body.cycleIds]);
          return;
        }
        if (!finite(body.availability, 0, 1) || (body.reserve !== null && !finite(body.reserve, 0, 100000))) throw new HttpError(400, "Invalid cycle adjustment.");
        for (const id of body.cycleIds) await client.query(`INSERT INTO linear_cycle_adjustment(linear_cycle_id,availability,reserve) VALUES($1,$2,$3)
          ON CONFLICT(linear_cycle_id) DO UPDATE SET availability=$2,reserve=$3`, [id, body.availability, body.reserve]);
      } else if (body.type === "extraScope") {
        await saveExtraScope(client, body);
      } else if (body.type === "scoping") {
        await saveScopingWindow(client, body.leadDays);
      } else if (body.type === "weeklyAvailability") {
        await saveWeeklyAvailability(client, body);
      } else if (body.type === "holidayPreset") {
        await saveHolidayPreset(client, body.enabled);
      } else if (body.type === "allowance") {
        throw new HttpError(400, "Scope allowances have been replaced by Extra scope points and optional notes.");
      } else if (body.type === "dependency") {
        const beforeSequence = await requireSequenceToken(client, body.sequenceToken);
        if (typeof body.predecessorId !== "string" || typeof body.successorId !== "string" || body.predecessorId === body.successorId) throw new HttpError(400, "Choose two different packages.");
        if (body.action === "remove") { await client.query("DELETE FROM package_dependency WHERE predecessor_id=$1 AND successor_id=$2 AND source='local'", [body.predecessorId, body.successorId]); return; }
        if (body.action === "waive") {
          if (typeof body.reason !== "string" || !body.reason.trim()) throw new HttpError(400, "Explain the Linear dependency waiver.");
          const result = await client.query("UPDATE package_dependency SET waived=true,waiver_reason=$3 WHERE predecessor_id=$1 AND successor_id=$2 AND source='linear'", [body.predecessorId, body.successorId, body.reason.trim()]);
          if (!result.rowCount) throw new HttpError(404, "Linear dependency not found.");
          return;
        }
        if (body.action === "restore") {
          const result = await client.query("UPDATE package_dependency SET waived=false,waiver_reason='' WHERE predecessor_id=$1 AND successor_id=$2 AND source='linear'", [body.predecessorId, body.successorId]);
          if (!result.rowCount) throw new HttpError(404, "Linear dependency not found.");
          await rejectNewOrderConflicts(client, beforeSequence);
          return;
        }
        if (body.action !== "add") throw new HttpError(400, "Invalid dependency action.");
        const found = await client.query("SELECT id FROM work_package WHERE id=ANY($1::text[])", [[body.predecessorId, body.successorId]]);
        if (found.rowCount !== 2) throw new HttpError(400, "Both packages must exist.");
        await client.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES($1,$2,'local') ON CONFLICT DO NOTHING", [body.predecessorId, body.successorId]);
        await rejectNewOrderConflicts(client, beforeSequence);
      } else throw new HttpError(400, "Unknown board change.");
    });
    return Response.json(await getBoard());
  } catch (error) { return responseError(error); }
}
