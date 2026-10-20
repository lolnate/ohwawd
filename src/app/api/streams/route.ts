import { ensureSchema, readTransaction, transaction } from "@/lib/db";
import { addStream, listStreams, reorderStreams } from "@/lib/streams";
import { requireOwner, requireSameOrigin, responseError } from "@/lib/security";

export async function GET(): Promise<Response> {
  try {
    await requireOwner();
    return Response.json(await readTransaction((client) => listStreams(client)));
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    await ensureSchema();
    const input = await request.json();
    const result = await transaction((client) => addStream(input, client));
    return Response.json(result, { status: 201 });
  } catch (error) { return responseError(error); }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    await requireOwner();
    await requireSameOrigin(request);
    await ensureSchema();
    const input = await request.json();
    const result = await transaction((client) => reorderStreams(input, client));
    return Response.json(result);
  } catch (error) { return responseError(error); }
}
