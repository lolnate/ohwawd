import { db, ensureSchema, transaction } from "@/lib/db";
import { saveCycleData } from "@/lib/import";
import { createLinearSource, linearReadError } from "@/lib/linear";
import { decryptKey, HttpError, requireOwner, requireSameOrigin } from "@/lib/security";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    await ensureSchema();
    const connection = await db().query<{ team_id: string; encrypted_key: string }>("SELECT team_id,encrypted_key FROM linear_connection WHERE workspace_id=1");
    if (!connection.rows[0]) throw new HttpError(400, "Connect a Linear team first.");
    const source = createLinearSource(decryptKey(connection.rows[0].encrypted_key));
    const { cycles, settings } = await source.cycles(connection.rows[0].team_id);
    const seenAt = new Date();
    await transaction(async (client) => {
      await saveCycleData(client, connection.rows[0].team_id, cycles, seenAt);
      await client.query(`UPDATE linear_connection SET cycles_refreshed_at=$1,team_timezone=$2,cycles_enabled=$3,
        cycle_duration=$4,cycle_start_day=$5,cycle_cooldown_time=$6,upcoming_cycle_count=$7 WHERE workspace_id=1`,
      [seenAt, settings.timezone, settings.cyclesEnabled, settings.cycleDuration, settings.cycleStartDay, settings.cycleCooldownTime, settings.upcomingCycleCount]);
      await client.query("UPDATE workspace SET timezone=$1 WHERE id=1", [settings.timezone]);
    });
    return Response.json({ refreshed: cycles.length, asOf: seenAt.toISOString() });
  } catch (error) { return linearReadError(error, "refresh team cycles"); }
}
