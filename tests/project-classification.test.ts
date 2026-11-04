import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { migrations } from "../src/lib/db";
import { resolveProjectClassification } from "../src/lib/project-classification";

test("classification resolves exact Linear labels and retains matching label IDs", () => {
  assert.deepEqual(resolveProjectClassification([
    { id: "roadmap-b", name: "Roadmap" },
    { id: "similar", name: "Roadmap candidate" },
    { id: "roadmap-a", name: "Roadmap" },
  ], null), {
    classification: "roadmap",
    provenance: "linear-label",
    roadmapLabelIds: ["roadmap-a", "roadmap-b"],
    ongoingLabelIds: [],
  });
  assert.deepEqual(resolveProjectClassification([{ id: "ongoing", name: "Ongoing" }], "roadmap"), {
    classification: "ongoing",
    provenance: "linear-label",
    roadmapLabelIds: [],
    ongoingLabelIds: ["ongoing"],
  });
});

test("ambiguous labels use a local decision or remain unresolved", () => {
  const conflicting = [{ id: "roadmap", name: "Roadmap" }, { id: "ongoing", name: "Ongoing" }];
  assert.deepEqual(resolveProjectClassification(conflicting, "ongoing"), {
    classification: "ongoing",
    provenance: "local-decision",
    roadmapLabelIds: ["roadmap"],
    ongoingLabelIds: ["ongoing"],
  });
  assert.deepEqual(resolveProjectClassification([{ id: "similar", name: "ongoing" }], null), {
    classification: "unresolved",
    provenance: "unresolved",
    roadmapLabelIds: [],
    ongoingLabelIds: [],
  });
  assert.equal(resolveProjectClassification([], "roadmap").classification, "roadmap");
});

test("classification migration backfills existing plans and leaves new projects unresolved", async () => {
  const database = new PGlite();
  try {
    for (const migration of migrations.slice(0, 9)) {
      if (migration.sql) await database.exec(migration.sql);
      if ("up" in migration) await migration.up(database as unknown as PoolClient);
    }
    const projectIds = ["candidate", "included", "deferred", "dismissed"];
    for (const projectId of projectIds) {
      await database.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id)
        VALUES($1,'team',$1,'planned','https://linear.app',now(),now(),'00000000-0000-4000-8000-000000000001')`, [projectId]);
      await database.query("INSERT INTO work_package(id,project_id,team_id,sequence_position) VALUES($1,$2,'team',$3)", [`linear:${projectId}`, projectId, projectIds.indexOf(projectId) + 1]);
    }
    const outcomeId = "00000000-0000-4000-8000-000000000002";
    await database.query("INSERT INTO outcome(id,title,stream_id,stream_position) VALUES($1,'Owner','stream-1',1)", [outcomeId]);
    await database.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES($1,'included')", [outcomeId]);
    await database.query("UPDATE work_package SET roadmap_state='included',selected=true,stream_id='stream-1',capacity_outcome_id=$1 WHERE project_id='included'", [outcomeId]);
    await database.query("UPDATE work_package SET roadmap_state='deferred' WHERE project_id='deferred'");
    await database.query("UPDATE work_package SET roadmap_state='dismissed' WHERE project_id='dismissed'");

    await database.exec(migrations[9].sql);

    const migrated = (await database.query<{ project_id: string; roadmap_state: string; sequence_position: number; local_classification: string; local_classification_updated_by: string }>(`
      SELECT project_id,roadmap_state,sequence_position,local_classification,local_classification_updated_by
      FROM work_package ORDER BY sequence_position`)).rows;
    assert.deepEqual(migrated.map((row) => [row.project_id, row.roadmap_state, row.sequence_position]), [
      ["candidate", "candidate", 1],
      ["included", "included", 2],
      ["deferred", "deferred", 3],
      ["dismissed", "dismissed", 4],
    ]);
    assert.ok(migrated.every((row) => row.local_classification === "roadmap" && row.local_classification_updated_by === "Migration"));

    await database.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id)
      VALUES('new','team','New','planned','https://linear.app',now(),now(),'00000000-0000-4000-8000-000000000001')`);
    await database.query("INSERT INTO work_package(id,project_id,team_id) VALUES('linear:new','new','team')");
    const added = (await database.query<{ roadmap_state: string | null; local_classification: string | null; selected: boolean }>(
      "SELECT roadmap_state,local_classification,selected FROM work_package WHERE project_id='new'",
    )).rows[0];
    assert.deepEqual(added, { roadmap_state: null, local_classification: null, selected: false });
    await assert.rejects(database.query("UPDATE work_package SET selected=true WHERE project_id='new'"), /package_roadmap_membership/);
    await assert.rejects(database.query("UPDATE work_package SET sequence_position=5 WHERE project_id='new'"), /package_roadmap_membership/);
    await assert.rejects(database.query("UPDATE work_package SET local_classification='ongoing' WHERE project_id='new'"), /package_local_classification/);
    await assert.rejects(database.query("UPDATE work_package SET local_classification_updated_at=now(),local_classification_updated_by='Owner' WHERE project_id='new'"), /package_local_classification/);

    await database.query("INSERT INTO linear_project_label_cache(project_id,label_id,name) VALUES('new','label-1','Roadmap'),('new','label-2','Roadmap')");
    assert.deepEqual((await database.query<{ label_id: string }>("SELECT label_id FROM linear_project_label_cache WHERE project_id='new' ORDER BY label_id")).rows, [
      { label_id: "label-1" }, { label_id: "label-2" },
    ]);
  } finally { await database.close(); }
});
