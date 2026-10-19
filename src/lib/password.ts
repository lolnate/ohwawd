import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const format = /^scrypt:v1:([0-9a-f]{32}):([0-9a-f]{128})$/;

export function hashPassword(password: string): string {
  if (!password) throw new Error("Password cannot be empty.");
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:v1:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const match = format.exec(encoded);
  if (!match) return false;
  const expected = Buffer.from(match[2], "hex");
  const actual = scryptSync(password, Buffer.from(match[1], "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function setPasswordHashInEnv(source: string, hash: string): string {
  if (!format.test(hash)) throw new Error("Invalid password hash.");
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const result: string[] = [];
  let placed = false;
  for (const line of lines) {
    if (/^\s*OWNER_PASSWORD(?:_HASH)?\s*=/.test(line)) {
      if (!placed) result.push(`OWNER_PASSWORD_HASH=${hash}`);
      placed = true;
    } else result.push(line);
  }
  if (!placed) result.push(`OWNER_PASSWORD_HASH=${hash}`);
  return result.join(newline).replace(/\n*$/, "") + newline;
}
