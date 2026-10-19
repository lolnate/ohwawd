import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { verifyPassword } from "./password";

const cookieName = "ohwawd_session";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validPassword(value: string): boolean {
  const encoded = process.env.OWNER_PASSWORD_HASH;
  if (!encoded) throw new HttpError(503, "Owner password is not configured. Run npm run set-owner-password on the server.");
  return verifyPassword(value, encoded);
}

export async function signIn(): Promise<void> {
  const expires = String(Date.now() + 12 * 60 * 60 * 1000);
  const signature = createHmac("sha256", required("SESSION_SECRET")).update(expires).digest("hex");
  (await cookies()).set(cookieName, `${expires}.${signature}`, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 60 * 60,
  });
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(cookieName);
}

export async function authenticated(): Promise<boolean> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  const expected = createHmac("sha256", required("SESSION_SECRET")).update(expires).digest("hex");
  return same(signature, expected);
}

export async function requireOwner(): Promise<void> {
  if (!(await authenticated())) throw new HttpError(401, "Sign in to continue.");
}

export async function requireSameOrigin(request: Request): Promise<void> {
  const origin = request.headers.get("origin");
  const host = (await headers()).get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new HttpError(403, "Invalid request origin.");
}

export function encryptKey(value: string): string {
  const key = Buffer.from(required("ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes encoded as base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptKey(value: string): string {
  const key = Buffer.from(required("ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes encoded as base64");
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function responseError(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Request failed", error instanceof Error ? error.name : "Unknown error");
  return Response.json({ error: "The request could not be completed. Check the server configuration or try again." }, { status: 500 });
}
