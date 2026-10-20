import { authenticated, responseError, requireSameOrigin, signIn, signOut, validPassword } from "@/lib/security";

type LoginAttempt = { failures: number; windowStartedAt: number; blockedUntil: number };
declare global {
  // Keep local throttling stable across development reloads.
  // eslint-disable-next-line no-var
  var ohwawdLoginAttempts: Map<string, LoginAttempt> | undefined;
}
const attempts = (globalThis.ohwawdLoginAttempts ??= new Map<string, LoginAttempt>());
const windowMs = 15 * 60 * 1000;
const blockMs = 15 * 60 * 1000;

function loginKey(request: Request): string {
  if (process.env.TRUST_PROXY !== "true") return "direct-client";
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown-proxy-client";
}

function activeAttempt(key: string): LoginAttempt | null {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (!attempt) return null;
  if (attempt.blockedUntil > now) return attempt;
  if (now - attempt.windowStartedAt >= windowMs) { attempts.delete(key); return null; }
  return attempt;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const current = activeAttempt(key) ?? { failures: 0, windowStartedAt: now, blockedUntil: 0 };
  current.failures += 1;
  if (current.failures >= 5) current.blockedUntil = now + blockMs;
  attempts.set(key, current);
  if (attempts.size > 1000) attempts.delete(attempts.keys().next().value!);
}

export async function GET(): Promise<Response> {
  try { return Response.json({ authenticated: await authenticated() }); }
  catch (error) { return responseError(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireSameOrigin(request);
    const key = loginKey(request);
    const attempt = activeAttempt(key);
    if (attempt && attempt.blockedUntil > Date.now()) {
      return Response.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(Math.ceil((attempt.blockedUntil - Date.now()) / 1000)) } });
    }
    const body = await request.json();
    if (typeof body.password !== "string" || !validPassword(body.password)) {
      recordFailure(key);
      return Response.json({ error: "Incorrect password." }, { status: 401 });
    }
    attempts.delete(key);
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
