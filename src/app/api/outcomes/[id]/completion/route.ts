import { transaction } from "@/lib/db";
import { saveOutcomeCompletion } from "@/lib/outcome-lifecycle";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner(); await requireSameOrigin(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => { throw new HttpError(400, "Invalid outcome completion action."); });
    return Response.json(await transaction((client) => saveOutcomeCompletion(client, id, body)));
  } catch (error) { return responseError(error); }
}
