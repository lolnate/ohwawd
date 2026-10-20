import { transaction } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function PUT(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    let parsed: unknown;
    try { parsed = await request.json(); } catch { throw new HttpError(400, "Send a valid JSON request body."); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "Send a valid project scope request.");
    const body = parsed as Record<string, unknown>;
    if (typeof body.inScope !== "boolean") throw new HttpError(400, "Choose whether to show these projects in planning lists.");
    if (!Array.isArray(body.projectIds) || !body.projectIds.length || body.projectIds.length > 500 || body.projectIds.some((id: unknown) => typeof id !== "string" || !id)) {
      throw new HttpError(400, "Choose between 1 and 500 imported projects.");
    }
    const projectIds = [...new Set<string>(body.projectIds as string[])];
    await transaction(async (client) => {
      await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
      const result = await client.query("UPDATE linear_project_cache SET in_scope=$1 WHERE linear_id = ANY($2::text[]) RETURNING linear_id", [body.inScope, projectIds]);
      if (result.rowCount !== projectIds.length) throw new HttpError(404, "One or more imported projects were not found.");
    });
    return Response.json({ saved: projectIds.length });
  } catch (error) { return responseError(error); }
}
