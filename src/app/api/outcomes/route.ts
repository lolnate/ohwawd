import { randomUUID } from "node:crypto";
import { db, ensureSchema } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) throw new HttpError(400, "Enter an outcome title of at most 200 characters.");
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 4000) : "";
    const owner = typeof body.owner === "string" ? body.owner.trim().slice(0, 160) : "";
    const successSignal = typeof body.successSignal === "string" ? body.successSignal.trim().slice(0, 1000) : "";
    const neededBy = body.neededBy === "" || body.neededBy == null ? null : body.neededBy;
    if (neededBy !== null && (typeof neededBy !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(neededBy) || Number.isNaN(Date.parse(neededBy)))) {
      throw new HttpError(400, "Enter a valid needed-by date.");
    }
    await ensureSchema();
    const id = randomUUID();
    await db().query(`INSERT INTO outcome (id,title,description,owner,success_signal,needed_by)
      VALUES ($1,$2,$3,$4,$5,$6)`, [id, title, description, owner, successSignal, neededBy]);
    return Response.json({ id }, { status: 201 });
  } catch (error) { return responseError(error); }
}
