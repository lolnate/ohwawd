import { randomUUID } from "node:crypto";
import { transaction } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError, validDateString } from "@/lib/security";

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
    const id = randomUUID();
    await transaction(async (client) => {
      await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
      await client.query(`INSERT INTO outcome (id,title,description,owner,success_signal,needed_by)
        VALUES ($1,$2,$3,$4,$5,$6)`, [id, title, description, owner, successSignal, neededBy]);
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) { return responseError(error); }
}
