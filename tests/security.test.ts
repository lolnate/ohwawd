import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { decryptKey, encryptKey, validDateString } from "../src/lib/security";
import { hashPassword, setPasswordHashInEnv, verifyPassword } from "../src/lib/password";
import { validPassword } from "../src/lib/security";

test("Linear key is encrypted at rest and decrypts with the configured key", () => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const secret = "lin_api_private_example";
  const ciphertext = encryptKey(secret);
  assert.equal(ciphertext.includes(secret), false);
  assert.equal(decryptKey(ciphertext), secret);
  assert.notEqual(encryptKey(secret), ciphertext);
});

test("owner password supports special characters without dotenv expansion", () => {
  const password = "spaces # and $VARIABLE ${PLACEHOLDER} \\ end";
  const encoded = hashPassword(password);
  assert.match(encoded, /^scrypt:v1:[0-9a-f:]+$/);
  assert.equal(encoded.includes(password), false);
  assert.equal(verifyPassword(password, encoded), true);
  assert.equal(verifyPassword("wrong", encoded), false);
  const previous = process.env.OWNER_PASSWORD_HASH;
  process.env.OWNER_PASSWORD_HASH = encoded;
  try {
    assert.equal(validPassword(password), true);
    assert.equal(validPassword("wrong"), false);
  } finally {
    if (previous === undefined) delete process.env.OWNER_PASSWORD_HASH;
    else process.env.OWNER_PASSWORD_HASH = previous;
  }
});

test("password setup replaces a plaintext setting and preserves other settings", () => {
  const encoded = hashPassword("an arbitrary $ password");
  const updated = setPasswordHashInEnv("DATABASE_URL=postgres://example\nOWNER_PASSWORD=old$raw\nSESSION_SECRET=stay\n", encoded);
  assert.equal(updated.includes("OWNER_PASSWORD=old"), false);
  assert.equal(updated.includes(`OWNER_PASSWORD_HASH=${encoded}`), true);
  assert.equal(updated.includes("SESSION_SECRET=stay"), true);
});

test("date validation rejects normalized impossible dates", () => {
  assert.equal(validDateString("2026-02-28"), true);
  assert.equal(validDateString("2026-02-29"), false);
  assert.equal(validDateString("2024-02-29"), true);
  assert.equal(validDateString("2026-13-01"), false);
});
