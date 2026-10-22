import { randomUUID } from "node:crypto";
import { transaction } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError, validDateString } from "@/lib/security";
import { replaceOutcomeLinks } from "@/lib/outcome-ownership";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) throw new HttpError(400, "Enter an outcome title of at most 200 characters.");
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const owner = typeof body.owner === "string" ? body.owner.trim() : "";
    const successSignal = typeof body.successSignal === "string" ? body.successSignal.trim() : "";
    if (description.length > 4000 || owner.length > 160 || successSignal.length > 1000) throw new HttpError(400, "Outcome notes, owner, or success signal is too long.");
    const neededBy = body.neededBy === "" || body.neededBy == null ? null : body.neededBy;
    if (neededBy !== null && !validDateString(neededBy)) {
      throw new HttpError(400, "Enter a valid needed-by date.");
    }
    const requestedLinks = body.links ?? [];
    if (!Array.isArray(requestedLinks) || requestedLinks.length > 500) throw new HttpError(400, "Invalid project links.");
    const links: { projectId: string; requirement: "minimum" | "optional" }[] = [];
    const projectIds = new Set<string>();
    for (const link of requestedLinks) {
      if (!link || typeof link.projectId !== "string" || !["minimum", "optional"].includes(link.requirement) || projectIds.has(link.projectId)) {
        throw new HttpError(400, "Each project may be linked once as minimum or optional.");
      }
      projectIds.add(link.projectId);
      links.push(link);
    }
    const id = randomUUID();
    await transaction(async (client) => {
      await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
      const projects = await client.query<{ linear_id: string }>("SELECT linear_id FROM linear_project_cache WHERE linear_id=ANY($1::text[])", [[...projectIds]]);
      if (projects.rowCount !== projectIds.size) throw new HttpError(400, "A selected project is not imported.");
      await client.query(`INSERT INTO outcome (id,title,description,owner,success_signal,needed_by)
        VALUES ($1,$2,$3,$4,$5,$6)`, [id, title, description, owner, successSignal, neededBy]);
      await replaceOutcomeLinks(client, id, links);
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) { return responseError(error); }
}
