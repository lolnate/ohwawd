import { createScenario, listScenarios } from "@/lib/scenarios";
import { readTransaction, transaction } from "@/lib/db";
import { requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function GET(): Promise<Response> {
  try {
    await requireOwner();
    return Response.json(await readTransaction((client) => listScenarios(client)));
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    const input = await request.json();
    const scenario = await transaction((client) => createScenario(input, client));
    return Response.json({ scenario }, { status: 201 });
  } catch (error) { return responseError(error); }
}
