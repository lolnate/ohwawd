import { readTransaction } from "@/lib/db";
import { getOngoingWorkInsights, parseHistoryRange } from "@/lib/ongoing-work-insights";
import { HttpError, requireOwner, responseError } from "@/lib/security";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireOwner();
    const range = parseHistoryRange(new URL(request.url).searchParams);
    return Response.json(await readTransaction(async (client) => {
      const connection = await client.query<{ team_id: string }>("SELECT team_id FROM linear_connection WHERE workspace_id=1");
      if (!connection.rows[0]) throw new HttpError(404, "Connect a Linear team first.");
      return getOngoingWorkInsights(client, connection.rows[0].team_id, range);
    }));
  } catch (error) { return responseError(error); }
}
