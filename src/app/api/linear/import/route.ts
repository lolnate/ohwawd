import { db, ensureSchema, transaction } from "@/lib/db";
import { saveImport } from "@/lib/import";
import { createLinearSource, linearReadError } from "@/lib/linear";
import { decryptKey, encryptKey, HttpError, requireOwner, requireSameOrigin } from "@/lib/security";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.teamId !== "string") throw new HttpError(400, "Choose a team.");
    await ensureSchema();
    const reservation = await transaction(async (client) => {
      const generations = await client.query<{ linear: string | number; cycles: string | number }>(`UPDATE workspace
        SET linear_sync_generation=linear_sync_generation+1,cycle_sync_generation=cycle_sync_generation+1 WHERE id=1
        RETURNING linear_sync_generation AS linear,cycle_sync_generation AS cycles`);
      const existing = await client.query<{ team_id: string; encrypted_key: string }>("SELECT team_id,encrypted_key FROM linear_connection WHERE workspace_id=1");
      return { generation: { linear: Number(generations.rows[0].linear), cycles: Number(generations.rows[0].cycles) }, existing: existing.rows[0] };
    });
    if (reservation.existing && reservation.existing.team_id !== body.teamId) throw new HttpError(409, "This proof workspace is already connected to another team.");
    const apiKey = body.apiKey || (reservation.existing && decryptKey(reservation.existing.encrypted_key));
    if (typeof apiKey !== "string") throw new HttpError(400, "Enter a Linear API key.");
    const source = createLinearSource(apiKey);
    const [viewer, teams] = await Promise.all([source.identity(), source.teams()]);
    const team = teams.find((item) => item.id === body.teamId);
    if (!team) throw new HttpError(400, "Choose an available team.");
    // Fetch and validate the complete source before opening the write transaction.
    const [projects, cycleSource] = await Promise.all([source.projects(team.id, true), source.cycles(team.id)]);
    const seenAt = new Date();
    const result = await transaction((client) => saveImport(client, {
      encryptedKey: encryptKey(apiKey.trim()), viewer, team, projects, cycles: cycleSource.cycles, cycleSettings: cycleSource.settings,
    }, seenAt, reservation.generation));
    return Response.json(result);
  } catch (error) { return linearReadError(error, "import projects and issues"); }
}
