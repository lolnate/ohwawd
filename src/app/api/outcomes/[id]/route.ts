import { transaction } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError, validDateString } from "@/lib/security";
import { deleteOutcome } from "@/lib/roadmap-mutations";

function outcomeFields(body: Record<string, unknown>) {
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
  return { title, description, owner, successSignal, neededBy };
}

function validId(id: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Invalid outcome ID.");
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    validId(id);
    const fields = outcomeFields(await request.json());
    await transaction(async (client) => {
      await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
      const result = await client.query(`UPDATE outcome SET title=$2,description=$3,owner=$4,success_signal=$5,needed_by=$6,updated_at=now()
        WHERE id=$1`, [id, fields.title, fields.description, fields.owner, fields.successSignal, fields.neededBy]);
      if (!result.rowCount) throw new HttpError(404, "Outcome not found.");
    });
    return Response.json({ saved: true });
  } catch (error) { return responseError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    validId(id);
    const body = await request.json().catch(() => null);
    return Response.json(await transaction((client) => deleteOutcome(client, id, body?.planningToken)));
  } catch (error) { return responseError(error); }
}
