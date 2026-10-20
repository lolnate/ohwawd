import { db, ensureSchema } from "@/lib/db";
import { responseError } from "@/lib/security";

export async function GET(): Promise<Response> {
  try {
    await ensureSchema();
    await db().query("SELECT 1");
    return Response.json({ status: "ready" });
  } catch (error) {
    return responseError(error);
  }
}
