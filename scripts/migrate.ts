import { Pool } from "pg";
import { databasePoolConfig, migrations } from "../src/lib/db";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

async function main(): Promise<void> {
  const pool = new Pool({ ...databasePoolConfig(), max: 1, application_name: "ohwawd-migrator" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [184928119]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migration (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ version: number; name: string }>("SELECT version,name FROM schema_migration ORDER BY version");
    if (applied.rows.length > migrations.length || applied.rows.some((row, index) =>
      row.version !== migrations[index].version || row.name !== migrations[index].name)) {
      throw new Error("Database migration ledger is not an exact prefix of the application migration history");
    }
    const appliedVersions = new Set(applied.rows.map((row) => row.version));
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      if (migration.sql) await client.query(migration.sql);
      if ("up" in migration) await migration.up(client);
      await client.query("INSERT INTO schema_migration(version,name) VALUES($1,$2)", [migration.version, migration.name]);
      console.log(`Applied migration ${migration.version}: ${migration.name}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Database migration failed");
  process.exitCode = 1;
});
