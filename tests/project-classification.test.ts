import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { migrations } from "../src/lib/db";
import { resolveProjectClassification } from "../src/lib/project-classification";
import { projectClassificationState, saveLocalProjectClassification } from "../src/lib/project-classification";
import { saveImport } from "../src/lib/import";
import { getBoard } from "../src/lib/board";
import { getWorkspaceState } from "../src/lib/workspace-state";
import { planningToken } from "../src/lib/planning-token";
import { assertRoadmapInvariants } from "../src/lib/roadmap-store";

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

test("token-protected local decisions retain source authority and reconcile roadmap membership without removing links", async () => {
  const database = new PGlite();
  const client = database as unknown as PoolClient;
  try {
    for (const migration of migrations) {
      if (migration.sql) await database.exec(migration.sql);
      if ("up" in migration) await migration.up(client);
    }
    const project = (labels: { id: string; name: string }[]) => ({ id: "project", teamId: "team", name: "Project", description: "", status: "started",
      url: "https://linear.app/project", updatedAt: new Date("2026-11-01"), crossTeam: false, issues: [], labels });
    const input = (labels: { id: string; name: string }[]) => ({ encryptedKey: "test", viewer: { id: "owner", name: "Owner" },
      team: { id: "team", name: "Team" }, projects: [project(labels)] });
    await saveImport(client, input([{ id: "roadmap-label", name: "Roadmap" }]));
    const outcomeId = "00000000-0000-4000-8000-000000000010";
    await database.query("INSERT INTO outcome(id,title,stream_id,stream_position) VALUES($1,'Outcome','stream-1',1)", [outcomeId]);
    await database.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES($1,'project')", [outcomeId]);
    await database.query("UPDATE work_package SET roadmap_state='included',selected=true,stream_id='stream-1',capacity_outcome_id=$1,sequence_position=1 WHERE project_id='project'", [outcomeId]);

    const staleToken = await planningToken(client);
    await saveLocalProjectClassification(client, { projectId: "project", classification: "ongoing", planningToken: staleToken });
    let state = (await projectClassificationState(client)).get("project")!;
    assert.deepEqual([state.classification, state.provenance, state.localClassification], ["roadmap", "linear-label", "ongoing"]);
    assert.deepEqual((await database.query("SELECT roadmap_state,selected,capacity_outcome_id FROM work_package WHERE project_id='project'")).rows[0],
      { roadmap_state: "included", selected: true, capacity_outcome_id: outcomeId });

    await assert.rejects(saveLocalProjectClassification(client, { projectId: "project", classification: "roadmap", planningToken: staleToken }), /Refresh workspace/);
    assert.equal((await projectClassificationState(client)).get("project")!.localClassification, "ongoing");

    await saveImport(client, input([]));
    state = (await projectClassificationState(client)).get("project")!;
    assert.deepEqual([state.classification, state.provenance], ["ongoing", "local-decision"]);
    assert.deepEqual((await database.query("SELECT roadmap_state,selected,stream_id,capacity_outcome_id,sequence_position FROM work_package WHERE project_id='project'")).rows[0],
      { roadmap_state: null, selected: false, stream_id: null, capacity_outcome_id: null, sequence_position: null });
    assert.equal((await database.query("SELECT count(*)::integer AS count FROM outcome_project_link WHERE project_id='project'")).rows[0].count, 1);

    await saveLocalProjectClassification(client, { projectId: "project", classification: "roadmap", planningToken: await planningToken(client) });
    assert.deepEqual((await database.query("SELECT roadmap_state,selected FROM work_package WHERE project_id='project'")).rows[0],
      { roadmap_state: "candidate", selected: false });
    await saveImport(client, input([{ id: "ongoing-label", name: "Ongoing" }]));
    state = (await projectClassificationState(client)).get("project")!;
    assert.deepEqual([state.classification, state.provenance, state.localClassification], ["ongoing", "linear-label", "roadmap"]);
    await saveImport(client, input([]));
    assert.deepEqual([(await projectClassificationState(client)).get("project")!.classification,
      (await database.query<{ roadmap_state: string }>("SELECT roadmap_state FROM work_package WHERE project_id='project'")).rows[0].roadmap_state], ["roadmap", "candidate"]);
    await assertRoadmapInvariants(client);

    const boardProject = (await getBoard(client)).packages[0];
    const workspaceProject = (await getWorkspaceState(client)).projects[0];
    for (const exposed of [boardProject, workspaceProject]) {
      assert.equal(exposed.effective_classification, "roadmap");
      assert.equal(exposed.classification_provenance, "local-decision");
      assert.deepEqual(exposed.roadmap_label_ids, []);
      assert.deepEqual(exposed.ongoing_label_ids, []);
      assert.equal(exposed.local_classification, "roadmap");
      assert.equal(exposed.local_classification_updated_by, "Owner");
      assert.ok(exposed.local_classification_updated_at);
    }
  } finally { await database.close(); }
});
