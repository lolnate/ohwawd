import { authenticated, responseError, requireSameOrigin, signIn, signOut, validPassword } from "@/lib/security";

export async function GET(): Promise<Response> {
  try { return Response.json({ authenticated: await authenticated() }); }
  catch (error) { return responseError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.password !== "string" || !validPassword(body.password)) {
      return Response.json({ error: "Incorrect password." }, { status: 401 });
    }
    await signIn();
    return Response.json({ authenticated: true });
  } catch (error) { return responseError(error); }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    await requireSameOrigin(request);
    await signOut();
    return Response.json({ authenticated: false });
  } catch (error) { return responseError(error); }
}
