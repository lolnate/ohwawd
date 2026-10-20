import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { latestMigrationVersion, migrations } from "../src/lib/db";

test("versioned migrations build the current schema transactionally", async () => {
  const database = new PGlite();
  await database.exec("BEGIN");
  await database.exec("CREATE TABLE schema_migration(version integer PRIMARY KEY,name text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
  for (const migration of migrations) {
    await database.exec(migration.sql);
    await database.query("INSERT INTO schema_migration(version,name) VALUES($1,$2)", [migration.version, migration.name]);
  }
  await database.exec("COMMIT");
  assert.equal((await database.query<{ version: number }>("SELECT MAX(version)::integer AS version FROM schema_migration")).rows[0].version, latestMigrationVersion);
  assert.equal((await database.query("SELECT linear_sync_generation,cycle_sync_generation FROM workspace WHERE id=1")).rows.length, 1);
  assert.equal((await database.query("SELECT id FROM stream WHERE active=true")).rows.length, 5);
  await database.close();
});
