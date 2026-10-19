import { publishScenario } from "@/lib/scenarios";
import { transaction } from "@/lib/db";
import { requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const { id } = await context.params;
    const input = await request.json();
    const revision = await transaction((client) => publishScenario(id, input, client));
    return Response.json({ revision }, { status: 201 });
  } catch (error) { return responseError(error); }
}
