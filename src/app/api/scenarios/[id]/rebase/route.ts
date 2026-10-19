import { previewScenarioRebase, rebaseScenario } from "@/lib/scenarios";
import { transaction } from "@/lib/db";
import { requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    const input = await request.json();
    if (input.preview === true) return Response.json(await previewScenarioRebase(id, input));
    return Response.json(await transaction((client) => rebaseScenario(id, input, client)));
  } catch (error) { return responseError(error); }
}
