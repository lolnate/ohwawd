import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { latestMigrationVersion, migrations } from "../src/lib/db";
import { assignmentMigrationSql } from "../src/lib/assignment-schema";
import type { PoolClient } from "pg";

test("versioned migrations build the current schema transactionally", async () => {
  const database = new PGlite();
  await database.exec("BEGIN");
  await database.exec("CREATE TABLE schema_migration(version integer PRIMARY KEY,name text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
  for (const migration of migrations) {
    if (migration.sql) await database.exec(migration.sql);
    if ("up" in migration) await migration.up(database as unknown as PoolClient);
    await database.query("INSERT INTO schema_migration(version,name) VALUES($1,$2)", [migration.version, migration.name]);
  }
  await database.exec("COMMIT");
  assert.equal((await database.query<{ version: number }>("SELECT MAX(version)::integer AS version FROM schema_migration")).rows[0].version, latestMigrationVersion);
  assert.equal((await database.query("SELECT linear_sync_generation,cycle_sync_generation FROM workspace WHERE id=1")).rows.length, 1);
  assert.equal((await database.query("SELECT id FROM stream WHERE active=true")).rows.length, 5);
  assert.equal((await database.query<{ roadmap_planning_migrated: boolean }>("SELECT roadmap_planning_migrated FROM workspace")).rows[0].roadmap_planning_migrated, true);
  await database.close();
});

test("assignment migration preserves effective scope, seeds dependency order once, and leaves scenario JSON frozen", async () => {
  const database = new PGlite();
  try {
    for (const migration of migrations.slice(0, 2)) await database.exec(migration.sql);
    for (const id of ["a", "b", "consumed"]) {
      await database.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id)
        VALUES($1,'team',$1,'planned','https://linear.app',now(),now(),'00000000-0000-4000-8000-000000000001')`, [id]);
      await database.query("INSERT INTO work_package(id,project_id,team_id,stream_id,priority_rank) VALUES($1,$2,'team','stream-1',$3)", [`linear:${id}`, id, id === "b" ? 1 : 10]);
      await database.query(`INSERT INTO linear_issue_cache(linear_id,project_id,team_id,identifier,title,estimate,state_type,source_updated_at,last_seen_at,last_seen_import_id)
        VALUES($1,$2,'team',$1,'Task',4,'started',now(),now(),'00000000-0000-4000-8000-000000000001')`, [`${id}-issue`, id]);
    }
    await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:a','linear:b','linear')");
    await database.query(`INSERT INTO package_allowance(package_id,kind,points,issue_ids,owner,review_date,rationale) VALUES
      ('linear:a','unestimated',10,ARRAY['a-issue'],'Owner','2026-11-01','Rough'),
      ('linear:a','discovery',3,ARRAY['a-issue'],'Owner','2026-11-01','Unknown work'),
      ('linear:consumed','unestimated',4,ARRAY['consumed-issue'],'Owner','2026-11-01','Consumed')`);
    await database.query(`INSERT INTO scenario(id,workspace_id,name,draft_source_at,draft_source_snapshot,draft_snapshot)
      VALUES('00000000-0000-4000-8000-000000000002',1,'Old',now(),'{}','{"legacy":true}')`);
    await database.exec(assignmentMigrationSql);
    const scope = (await database.query<{ points: string; issue_ids: string[] }>("SELECT points,issue_ids FROM package_extra_scope ORDER BY package_id")).rows;
    assert.deepEqual(scope, [{ points: "9.000", issue_ids: ["a-issue"] }]);
    const order = (await database.query<{ id: string }>("SELECT id FROM work_package ORDER BY sequence_position")).rows.map((row) => row.id);
    assert.ok(order.indexOf("linear:a") < order.indexOf("linear:b"));
    await database.query("UPDATE work_package SET sequence_position=99 WHERE id='linear:a'");
    await database.query("UPDATE package_extra_scope SET points=8 WHERE package_id='linear:a'");
    await database.exec(assignmentMigrationSql);
    assert.equal((await database.query<{ sequence_position: number }>("SELECT sequence_position FROM work_package WHERE id='linear:a'")).rows[0].sequence_position, 99);
    assert.equal((await database.query<{ points: string }>("SELECT points FROM package_extra_scope")).rows[0].points, "8.000");
    assert.deepEqual((await database.query<{ draft_snapshot: unknown }>("SELECT draft_snapshot FROM scenario")).rows[0].draft_snapshot, { legacy: true });
    assert.equal((await database.query<{ priority: number | null }>("SELECT priority FROM linear_project_cache LIMIT 1")).rows[0].priority, null);
  } finally { await database.close(); }
});
