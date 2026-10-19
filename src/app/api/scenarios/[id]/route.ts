import { saveScenario } from "@/lib/scenarios";
import { transaction } from "@/lib/db";
import { requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    const input = await request.json();
    const scenario = await transaction((client) => saveScenario(id, input, client));
    return Response.json({ scenario });
  } catch (error) { return responseError(error); }
}
