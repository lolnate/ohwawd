import { ensureSchema, transaction } from "@/lib/db";
import { previewStreamRetirement, restoreStream, retireStream } from "@/lib/streams";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    await ensureSchema();
    const { id } = await context.params;
    const input = await request.json();
    let result: unknown;
    if (input.action === "preview-retirement") result = await transaction((client) => previewStreamRetirement(id, input, client));
    else if (input.action === "retire") result = await transaction((client) => retireStream(id, input, client));
    else if (input.action === "restore") result = await transaction((client) => restoreStream(id, input, client));
    else throw new HttpError(400, "Choose a valid stream lifecycle action.");
    return Response.json(result);
  } catch (error) { return responseError(error); }
}
