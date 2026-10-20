import { compareScenarios, type ScenarioReference } from "@/lib/scenarios";
import { readTransaction } from "@/lib/db";
import { HttpError, requireOwner, responseError } from "@/lib/security";

function reference(value: string | null): ScenarioReference {
  const [kind, id, extra] = value?.split(":") ?? [];
  if (extra || (kind !== "draft" && kind !== "revision") || !id) {
    throw new HttpError(400, "Use draft:<id> or revision:<id> for each comparison side.");
  }
  return { kind, id };
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireOwner();
    const url = new URL(request.url);
    return Response.json(await readTransaction((client) => compareScenarios(
      reference(url.searchParams.get("left")), reference(url.searchParams.get("right")), client,
    )));
  } catch (error) { return responseError(error); }
}
