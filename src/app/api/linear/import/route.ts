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
    const existing = await db().query<{ team_id: string; encrypted_key: string }>("SELECT team_id, encrypted_key FROM linear_connection WHERE workspace_id=1");
    if (existing.rows[0] && existing.rows[0].team_id !== body.teamId) throw new HttpError(409, "This proof workspace is already connected to another team.");
    const apiKey = body.apiKey || (existing.rows[0] && decryptKey(existing.rows[0].encrypted_key));
    if (typeof apiKey !== "string") throw new HttpError(400, "Enter a Linear API key.");
    const source = createLinearSource(apiKey);
    const [viewer, teams] = await Promise.all([source.identity(), source.teams()]);
    const team = teams.find((item) => item.id === body.teamId);
    if (!team) throw new HttpError(400, "Choose an available team.");
    // Fetch and validate the complete source before opening the write transaction.
    const [projects, cycleSource] = await Promise.all([source.projects(team.id, true), source.cycles(team.id)]);
    const result = await transaction((client) => saveImport(client, {
      encryptedKey: encryptKey(apiKey.trim()), viewer, team, projects, cycles: cycleSource.cycles, cycleSettings: cycleSource.settings,
    }));
    return Response.json(result);
  } catch (error) { return linearReadError(error, "import projects and issues"); }
}
