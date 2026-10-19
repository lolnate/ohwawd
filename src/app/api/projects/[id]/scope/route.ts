import { db, ensureSchema } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    const body = await request.json();
    if (typeof body.inScope !== "boolean") throw new HttpError(400, "Choose whether to show this project in planning lists.");
    await ensureSchema();
    const result = await db().query("UPDATE linear_project_cache SET in_scope=$1 WHERE linear_id=$2 RETURNING linear_id", [body.inScope, id]);
    if (!result.rowCount) throw new HttpError(404, "Imported project not found.");
    return Response.json({ saved: true });
  } catch (error) { return responseError(error); }
}
