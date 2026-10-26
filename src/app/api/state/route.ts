import { readTransaction } from "@/lib/db";
import { requireOwner, responseError } from "@/lib/security";
import { getWorkspaceState } from "@/lib/workspace-state";

export async function GET(): Promise<Response> {
  try {
    await requireOwner();
    return Response.json(await readTransaction(getWorkspaceState));
  } catch (error) { return responseError(error); }
}
