import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { hashPassword, setPasswordHashInEnv } from "../src/lib/password";

function askHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }
  process.stdout.write(`${label}: `);
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003" || character === "\u0004") return finish(new Error("Canceled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = Array.from(value).slice(0, -1).join("");
        else if (character >= " ") value += character;
      }
    };
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const password = await askHidden("New owner password (input hidden)");
  if (Array.from(password).length < 12) throw new Error("Use at least 12 characters.");
  const confirmation = await askHidden("Confirm password (input hidden)");
  if (password !== confirmation) throw new Error("Passwords did not match. No file was changed.");

  const destination = join(process.cwd(), ".env.local");
  const template = join(process.cwd(), ".env.example");
  let source: string;
  try {
    const info = await lstat(destination);
    if (!info.isFile()) throw new Error(".env.local must be a regular file.");
    source = await readFile(destination, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    source = await readFile(template, "utf8");
  }

  const updated = setPasswordHashInEnv(source, hashPassword(password));
  const temporary = join(process.cwd(), `.env.local.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, updated, { mode: 0o600, flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  process.stdout.write("Owner password saved as a salted hash. Restart the app to use it.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Setup failed."}\n`);
  process.exitCode = 1;
});
