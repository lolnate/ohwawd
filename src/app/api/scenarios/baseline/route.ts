import { designateBaseline } from "@/lib/scenarios";
import { transaction } from "@/lib/db";
import { HttpError, requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function PUT(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.revisionId !== "string") throw new HttpError(400, "revisionId is required.");
    return Response.json(await transaction((client) => designateBaseline(body.revisionId, client)));
  } catch (error) { return responseError(error); }
}
