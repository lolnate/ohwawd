import { createLinearSource, linearReadError } from "@/lib/linear";
import { db, ensureSchema } from "@/lib/db";
import { decryptKey, HttpError, requireOwner, requireSameOrigin } from "@/lib/security";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const body = await request.json();
    let apiKey = body.apiKey;
    if (!apiKey) {
      await ensureSchema();
      const saved = await db().query<{ encrypted_key: string }>("SELECT encrypted_key FROM linear_connection WHERE workspace_id=1");
      if (!saved.rows[0]) throw new HttpError(400, "Enter a Linear API key.");
      apiKey = decryptKey(saved.rows[0].encrypted_key);
    }
    if (typeof apiKey !== "string") throw new HttpError(400, "Enter a Linear API key.");
    const source = createLinearSource(apiKey);
    const [viewer, teams] = await Promise.all([source.identity(), source.teams()]);
    if (!body.teamId) return Response.json({ viewer, teams });
    if (!teams.some((team) => team.id === body.teamId)) throw new HttpError(400, "Choose an available team.");
    const projects = await source.previewProjects(body.teamId);
    return Response.json({ viewer, teams, projects });
  } catch (error) { return linearReadError(error, "load the project list"); }
}
