import { readTransaction } from "@/lib/db";
import { parseOngoingWorkDetailSelector, readOngoingWorkIssueDetails } from "@/lib/ongoing-work-insights";
import { HttpError, requireOwner, responseError } from "@/lib/security";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireOwner();
    const selector = parseOngoingWorkDetailSelector(new URL(request.url).searchParams);
    return Response.json(await readTransaction(async (client) => {
      const connection = await client.query<{ team_id: string }>("SELECT team_id FROM linear_connection WHERE workspace_id=1");
      if (!connection.rows[0]) throw new HttpError(404, "Connect a Linear team first.");
      return { issues: await readOngoingWorkIssueDetails(client, connection.rows[0].team_id, selector) };
    }));
  } catch (error) { return responseError(error); }
}
