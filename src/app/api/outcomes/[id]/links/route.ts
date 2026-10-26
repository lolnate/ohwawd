import { transaction } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";
import { replaceOutcomeLinks } from "@/lib/outcome-ownership";
import { requirePlanningToken } from "@/lib/planning-token";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Invalid outcome ID.");
    const body = await request.json();
    if (!Array.isArray(body.links) || body.links.length > 500) throw new HttpError(400, "Invalid project links.");
    const links: { projectId: string; requirement: "minimum" | "optional" }[] = [];
    const ids = new Set<string>();
    for (const link of body.links) {
      if (!link || typeof link.projectId !== "string" || !["minimum", "optional"].includes(link.requirement) || ids.has(link.projectId)) {
        throw new HttpError(400, "Each project may be linked once as minimum or optional.");
      }
      ids.add(link.projectId);
      links.push(link);
    }
    const result = await transaction(async (client) => {
      await requirePlanningToken(client, body.planningToken);
      const outcome = await client.query("SELECT id FROM outcome WHERE id=$1 FOR UPDATE", [id]);
      if (!outcome.rowCount) throw new HttpError(404, "Outcome not found.");
      const projects = await client.query<{ linear_id: string }>("SELECT linear_id FROM linear_project_cache WHERE linear_id=ANY($1::text[])", [[...ids]]);
      if (projects.rowCount !== ids.size) throw new HttpError(400, "A selected project is not imported.");
      return replaceOutcomeLinks(client, id, links);
    });
    return Response.json(result);
  } catch (error) { return responseError(error); }
}
