import { db, transaction } from "@/lib/db";
import { getBoard } from "@/lib/board";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";

const finite = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

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
      if (body.type === "package") {
        const current = await client.query("SELECT w.*,p.status FROM work_package w JOIN linear_project_cache p ON p.linear_id=w.project_id WHERE w.id=$1 FOR UPDATE", [body.id]);
        const row = current.rows[0];
        if (!row) throw new HttpError(404, "Package not found.");
        const selected = body.selected === undefined ? row.selected : body.selected;
        if (typeof selected !== "boolean") throw new HttpError(400, "Invalid selection.");
        const streamId = body.streamId === undefined ? row.stream_id : body.streamId;
        if (streamId !== null && (typeof streamId !== "string" || !(await client.query("SELECT id FROM stream WHERE id=$1 AND active=true", [streamId])).rowCount)) throw new HttpError(400, "Choose an active stream.");
        const mustInclude = body.mustInclude === undefined ? row.must_include : body.mustInclude;
        if (typeof mustInclude !== "boolean") throw new HttpError(400, "Invalid must-include flag.");
        const priority = body.priority === undefined ? row.priority_rank : body.priority;
        if (!Number.isInteger(priority) || !finite(priority, 0, 100000)) throw new HttpError(400, "Priority must be a nonnegative integer.");
        const earliest = body.earliestCycleId === undefined ? row.earliest_linear_cycle_id : body.earliestCycleId;
        const preferred = body.preferredCycleId === undefined ? row.preferred_linear_cycle_id : body.preferredCycleId;
        for (const id of [earliest, preferred]) if (id !== null) {
          if (typeof id !== "string") throw new HttpError(400, "Choose a Linear cycle or blank.");
          const found = await client.query(`SELECT c.linear_id FROM linear_cycle_cache c JOIN linear_connection l ON l.team_id=c.team_id
            WHERE c.linear_id=$1 AND c.active=true AND c.completed_at IS NULL AND c.starts_at>GREATEST(l.last_imported_at,l.cycles_refreshed_at)`, [id]);
          if (!found.rowCount) throw new HttpError(400, "Choose an upcoming cycle from this Linear team.");
        }
        const reason = body.reason === undefined ? row.pause_reason : body.reason;
        if (typeof reason !== "string" || reason.length > 1000) throw new HttpError(400, "Invalid rationale.");
        if (!selected && (mustInclude || /started|progress/i.test(row.status)) && !reason.trim()) throw new HttpError(400, "Pausing must-include or in-progress work requires a rationale.");
        await client.query(`UPDATE work_package SET selected=$2,stream_id=$3,must_include=$4,priority_rank=$5,
          earliest_linear_cycle_id=$6,preferred_linear_cycle_id=$7,earliest_cycle=NULL,preferred_cycle=NULL,pause_reason=$8 WHERE id=$1`,
        [body.id, selected, streamId, mustInclude, priority, earliest, preferred, reason.trim()]);
      } else if (body.type === "stream") {
        if (typeof body.id !== "string" || !finite(body.allocation, 0, 1) || !Number.isInteger(body.wip) || !finite(body.wip, 1, 50)) throw new HttpError(400, "Enter a 0–100% allocation and a positive WIP limit.");
        const exists = await client.query("SELECT id FROM stream WHERE id=$1 AND active=true", [body.id]);
        if (!exists.rowCount) throw new HttpError(404, "Stream not found.");
        const total = await client.query<{ sum: number }>("SELECT COALESCE(SUM(allocation),0)::float AS sum FROM stream WHERE active=true AND id<>$1", [body.id]);
        if (total.rows[0].sum + body.allocation > 1.000001) throw new HttpError(400, "Allocations may total at most 100%.");
        await client.query("UPDATE stream SET allocation=$2,wip_limit=$3 WHERE id=$1", [body.id, body.allocation, body.wip]);
      } else if (body.type === "capacity") {
        if ((body.baseline !== null && !finite(body.baseline, 0, 100000)) || !finite(body.reserve, 0, 100000) || !Number.isInteger(body.horizon) || !finite(body.horizon, 1, 104) || typeof body.reason !== "string" || body.reason.length > 1000) throw new HttpError(400, "Enter a baseline, reserve, and horizon.");
        const team = await client.query<{ cycle_duration: number | null }>("SELECT cycle_duration FROM linear_connection WHERE workspace_id=1");
        const cycleDays = team.rows[0]?.cycle_duration ? team.rows[0].cycle_duration * 7 : 14;
        if (body.baseline !== null && !body.reason.trim()) throw new HttpError(400, "Explain the provisional baseline or override.");
        if (body.baseline === null) {
          const observed = await client.query("SELECT 1 FROM cycle_observation WHERE cycle_days=$1 ORDER BY completed_at DESC LIMIT 3", [cycleDays]);
          if ((observed.rowCount ?? 0) < 3) throw new HttpError(400, "Fewer than three comparable completed cycles; enter a provisional baseline.");
        }
        await client.query(`INSERT INTO capacity_profile(workspace_id,cycle_days,baseline,baseline_reason,reserve,horizon) VALUES(1,$1,$2,$3,$4,$5)
          ON CONFLICT(workspace_id) DO UPDATE SET cycle_anchor=NULL,cycle_days=$1,baseline=$2,baseline_reason=$3,reserve=$4,horizon=$5`,
        [cycleDays, body.baseline, body.reason.trim(), body.reserve, body.horizon]);
      } else if (body.type === "adjustment") {
        if (!Array.isArray(body.cycleIds) || !body.cycleIds.length || body.cycleIds.length > 15 || body.cycleIds.some((id: unknown) => typeof id !== "string") || new Set(body.cycleIds).size !== body.cycleIds.length) throw new HttpError(400, "Select one or more upcoming Linear cycles.");
        const found = await client.query(`SELECT c.linear_id FROM linear_cycle_cache c JOIN linear_connection l ON l.team_id=c.team_id
          WHERE c.linear_id=ANY($1::text[]) AND c.active=true AND c.completed_at IS NULL AND c.starts_at>GREATEST(l.last_imported_at,l.cycles_refreshed_at)`, [body.cycleIds]);
        if (found.rowCount !== body.cycleIds.length) throw new HttpError(400, "Every selected cycle must be upcoming in the connected Linear team.");
        if (body.action === "clear") {
          await client.query("DELETE FROM linear_cycle_adjustment WHERE linear_cycle_id=ANY($1::text[])", [body.cycleIds]);
          return;
        }
        if (!finite(body.availability, 0, 1) || (body.reserve !== null && !finite(body.reserve, 0, 100000))) throw new HttpError(400, "Invalid cycle adjustment.");
        for (const id of body.cycleIds) await client.query(`INSERT INTO linear_cycle_adjustment(linear_cycle_id,availability,reserve) VALUES($1,$2,$3)
          ON CONFLICT(linear_cycle_id) DO UPDATE SET availability=$2,reserve=$3`, [id, body.availability, body.reserve]);
      } else if (body.type === "allowance") {
        if (typeof body.packageId !== "string" || !["unestimated", "discovery"].includes(body.kind)) throw new HttpError(400, "Invalid allowance.");
        if (body.remove === true) { await client.query("DELETE FROM package_allowance WHERE package_id=$1 AND kind=$2", [body.packageId, body.kind]); return; }
        if (!finite(body.points, 0.001, 100000) || typeof body.owner !== "string" || !body.owner.trim() || !date(body.reviewDate) || typeof body.rationale !== "string" || !body.rationale.trim() || !Array.isArray(body.issueIds)) throw new HttpError(400, "Allowance needs positive points, owner, review date, and rationale.");
        if (body.kind === "unestimated") {
          if (!body.issueIds.length || new Set(body.issueIds).size !== body.issueIds.length) throw new HttpError(400, "Choose unestimated issues to cover.");
          const issues = await client.query("SELECT i.linear_id FROM linear_issue_cache i JOIN work_package w ON w.project_id=i.project_id WHERE w.id=$1 AND i.estimate IS NULL AND i.state_type NOT IN ('completed','canceled') AND i.linear_id=ANY($2::text[])", [body.packageId, body.issueIds]);
          if (issues.rowCount !== body.issueIds.length) throw new HttpError(400, "Allowance issue IDs must be open and unestimated in this package.");
        } else if (body.issueIds.length) throw new HttpError(400, "Discovery allowances do not claim issues.");
        await client.query(`INSERT INTO package_allowance(package_id,kind,points,issue_ids,owner,review_date,rationale) VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(package_id,kind) DO UPDATE SET points=$3,issue_ids=$4,owner=$5,review_date=$6,rationale=$7`, [body.packageId, body.kind, body.points, body.issueIds, body.owner.trim(), body.reviewDate, body.rationale.trim()]);
      } else if (body.type === "dependency") {
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
          return;
        }
        if (body.action !== "add") throw new HttpError(400, "Invalid dependency action.");
        const found = await client.query("SELECT id FROM work_package WHERE id=ANY($1::text[])", [[body.predecessorId, body.successorId]]);
        if (found.rowCount !== 2) throw new HttpError(400, "Both packages must exist.");
        await client.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES($1,$2,'local') ON CONFLICT DO NOTHING", [body.predecessorId, body.successorId]);
        const edges = (await client.query("SELECT predecessor_id,successor_id FROM package_dependency WHERE waived=false")).rows;
        const graph = new Map<string, string[]>();
        for (const edge of edges) graph.set(edge.predecessor_id, [...(graph.get(edge.predecessor_id) || []), edge.successor_id]);
        const seen = new Set<string>();
        const walk = (id: string): boolean => id === body.predecessorId || (!seen.has(id) && (seen.add(id), (graph.get(id) || []).some(walk)));
        if (walk(body.successorId)) throw new HttpError(400, "That dependency would create a cycle.");
      } else throw new HttpError(400, "Unknown board change.");
    });
    return Response.json(await getBoard());
  } catch (error) { return responseError(error); }
}
