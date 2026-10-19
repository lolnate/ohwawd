import { activateScenario } from "@/lib/scenarios";
import { transaction } from "@/lib/db";
import { requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    const input = await request.json();
    return Response.json({ scenario: await transaction((client) => activateScenario(id, input, client)) });
  } catch (error) { return responseError(error); }
}
