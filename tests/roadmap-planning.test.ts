import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { convertRoadmapPlanning, type RoadmapPackage, type RoadmapState } from "../src/lib/roadmap-planning";
import { roadmapSchemaSql } from "../src/lib/roadmap-schema";
import { activateRoadmapPlanning } from "../src/lib/roadmap-store";
import { getWorkspaceState } from "../src/lib/workspace-state";
import { getBoard } from "../src/lib/board";
import { migrations, schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";

const ids = { older: "00000000-0000-4000-8000-000000000001", newer: "00000000-0000-4000-8000-000000000002", other: "00000000-0000-4000-8000-000000000003" };
const streams = [{ id: "core", name: "Core", position: 1 }, { id: "delivery", name: "Delivery", position: 2 }];
const outcomes = [
  { id: ids.older, title: "Older", stream_id: "core", created_at: "2026-01-01T00:00:00Z" },
  { id: ids.newer, title: "Newer", stream_id: "core", created_at: "2026-02-01T00:00:00Z" },
  { id: ids.other, title: "Other", stream_id: "delivery", created_at: "2026-03-01T00:00:00Z" },
];
const project = (id: string, extra: Partial<RoadmapPackage> = {}) => ({ id: `linear:${id}`, project_id: id, name: id, selected: true, stream_id: "core", sequence_position: 7, ...extra });
const link = (projectId: string, outcomeId = ids.older) => ({ project_id: projectId, outcome_id: outcomeId, requirement: "minimum" as const });

test("roadmap conversion preserves valid owners and infers only an unambiguous legacy owner", () => {
  const packages = [project("valid", { capacity_outcome_id: ids.older }), project("one"), project("none"), project("many")];
  const links = [link("valid"), link("valid", ids.newer), link("one"), link("none", ids.other), link("many"), link("many", ids.newer)];
  const result = convertRoadmapPlanning({ packages, outcomes, streams, links });
  assert.deepEqual(result.packages.map((item) => [item.project_id, item.roadmap_state, item.capacity_outcome_id, item.stream_id, item.selected]), [
    ["valid", "included", ids.older, "core", true], ["one", "included", ids.older, "core", true],
    ["none", "candidate", null, null, false], ["many", "candidate", null, null, false],
  ]);
  assert.equal(result.packages[0].roadmap_conversion, null);
  assert.equal(result.packages[1].roadmap_conversion?.reason, "inferred-owner");
  assert.equal(result.packages[3].roadmap_conversion?.previousStreamName, "Core");
  assert.deepEqual(result.packages[3].roadmap_conversion?.candidateOutcomeIds, [ids.older, ids.newer]);
  assert.match(result.packages[3].roadmap_conversion!.message, /Future demand is excluded/);
  assert.ok(result.packages.every((item) => item.sequence_position === 7));
});

test("roadmap ranks seed prior displayed order with stable IDs and preserve explicit placement", () => {
  const result = convertRoadmapPlanning({ packages: [], streams, links: [], outcomes: [
    ...outcomes, { id: "a", title: "Tie A", created_at: "2026-02-01", stream_id: "core" },
    { id: "z", title: "Tie Z", created_at: "2026-02-01", stream_id: "core" },
    { id: "unassigned", title: "Unassigned", stream_id: null, stream_position: 99 },
    { id: "retired", title: "Retired", stream_id: "retired", stream_position: 1 },
  ] });
  assert.deepEqual(result.outcomes.filter((item) => item.stream_id === "core").sort((a, b) => a.stream_position! - b.stream_position!).map((item) => item.id), [ids.newer, "a", "z", ids.older]);
  assert.equal(result.outcomes.find((item) => item.id === ids.other)!.stream_position, 1);
  assert.ok(result.outcomes.filter((item) => ["unassigned", "retired"].includes(item.id)).every((item) => item.stream_position === null && item.stream_id === null));
  const reordered = result.outcomes.map((item) => item.id === ids.older ? { ...item, stream_position: 1 } : item.id === ids.newer ? { ...item, stream_position: 4 } : item);
  assert.equal(convertRoadmapPlanning({ packages: [], streams, links: [], outcomes: reordered }).outcomes.find((item) => item.id === ids.older)!.stream_position, 1);
});

test("missing old ownership fields do not lose ambiguity to earliest-owner inference", () => {
  const input = { packages: [project("p")], streams, links: [link("p"), link("p", ids.newer)],
    outcomes: outcomes.slice(0, 2).map(({ stream_id: _stream, ...item }) => item) };
  const converted = convertRoadmapPlanning(input);
  assert.ok(converted.outcomes.every((item) => item.stream_id === "core"));
  assert.equal(converted.packages[0].roadmap_state, "candidate");
  assert.equal(converted.packages[0].capacity_outcome_id, null);
  assert.deepEqual(converted.packages[0].roadmap_conversion?.candidateOutcomeIds, [ids.older, ids.newer]);
});

test("conversion retains deferred and explicit excluded states without automatic inclusion", () => {
  const packages = [project("deferred", { selected: false, capacity_outcome_id: ids.older }), project("paused", { selected: false }),
    ...(["candidate", "dismissed"] as RoadmapState[]).map((state) => project(state, { roadmap_state: state, selected: false, stream_id: null })),
    project("invalid", { capacity_outcome_id: ids.other }), project("retired", { stream_id: "retired", capacity_outcome_id: ids.older }),
    project("modern-broken", { roadmap_state: "included", capacity_outcome_id: null })];
  const result = convertRoadmapPlanning({ packages, outcomes, streams, links: packages.map((item) => link(item.project_id)) });
  assert.equal(result.packages[0].roadmap_state, "deferred");
  assert.equal(result.packages[0].capacity_outcome_id, ids.older);
  assert.equal(result.packages[1].stream_id, null);
  assert.equal(result.packages[1].roadmap_conversion?.reason, "cleared-deferred-context");
  assert.deepEqual(result.packages.slice(2).map((item) => item.roadmap_state), ["candidate", "dismissed", "candidate", "candidate", "candidate"]);
  assert.equal(result.packages[4].roadmap_conversion?.reason, "invalid-owner");
});

test("conversion is immutable and idempotent and preserves source, scope and project preferences", () => {
  const input = { packages: [{ ...project("p"), in_scope: false, pause_reason: "Optional note", extra: { points: 4, issueIds: ["unknown"] } }],
    outcomes, streams, links: [link("p")] };
  const before = structuredClone(input);
  const result = convertRoadmapPlanning(input);
  assert.deepEqual(input, before);
  assert.equal(result.packages[0].in_scope, false);
  assert.deepEqual(result.packages[0].extra, { points: 4, issueIds: ["unknown"] });
  assert.equal(result.packages[0].pause_reason, "Optional note");
  assert.deepEqual(convertRoadmapPlanning({ ...input, ...result }), result);
});

async function legacyDatabase() {
  const database = new PGlite();
  // Build the actual pre-foundation shape, rather than accidentally starting
  // with the latest schemaSql's additive columns already installed.
  await database.exec(schemaSql.replace(roadmapSchemaSql, ""));
  await database.query("INSERT INTO workspace(id) VALUES(1)");
  await database.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,0.5),('delivery','Delivery',2,0.5)");
  const client = database as unknown as PoolClient;
  const source = (projectIds: string[]) => ({ encryptedKey: "test", viewer: { id: "owner", name: "Owner" }, team: { id: "team", name: "Team" },
    projects: projectIds.map((id) => ({ id, name: id, teamId: "team", description: "Imported notes", status: "started", url: `https://linear.app/${id}`,
      updatedAt: new Date("2026-10-20T00:00:00Z"), crossTeam: false,
      issues: [{ id: `issue-${id}`, projectId: id, teamId: "team", identifier: id, title: "Work", estimate: 3, stateType: "started", completedAt: null, updatedAt: new Date("2026-10-20T00:00:00Z") }] })) });
  // Seed the historical writer's rows directly: the current importer now audits
  // lifecycle changes and correctly requires the current schema to do so.
  const imported = source(["valid", "one", "none", "many", "deferred"]);
  const importId = "00000000-0000-4000-8000-000000000090";
  for (const item of imported.projects) {
    await database.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,description,status,url,source_updated_at,last_seen_at,last_seen_import_id)
      VALUES($1,'team',$2,$3,$4,$5,$6,$6,$7)`, [item.id, item.name, item.description, item.status, item.url, item.updatedAt, importId]);
    await database.query("INSERT INTO work_package(id,project_id,team_id) VALUES($1,$2,'team')", [`linear:${item.id}`, item.id]);
    for (const issue of item.issues) await database.query(`INSERT INTO linear_issue_cache(linear_id,project_id,team_id,identifier,title,estimate,state_type,source_updated_at,last_seen_at,last_seen_import_id)
      VALUES($1,$2,'team',$3,$4,$5,$6,$7,$7,$8)`, [issue.id, item.id, issue.identifier, issue.title, issue.estimate, issue.stateType, issue.updatedAt, importId]);
  }
  await database.query(`INSERT INTO linear_connection(workspace_id,encrypted_key,viewer_id,viewer_name,team_id,team_name,last_imported_at)
    VALUES(1,'test','owner','Owner','team','Team','2026-10-20')`);
  await database.query("UPDATE work_package SET stream_id='core',sequence_position=7,pause_reason='Keep this note'");
  for (const item of outcomes) await database.query("INSERT INTO outcome(id,title,stream_id,created_at) VALUES($1,$2,$3,$4)", [item.id, item.title, item.stream_id, item.created_at]);
  for (const item of [link("valid"), link("one"), link("many"), link("many", ids.newer), link("deferred")]) {
    await database.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES($1,$2,$3)", [item.outcome_id, item.project_id, item.requirement]);
  }
  await database.query("UPDATE work_package SET capacity_outcome_id=$1 WHERE project_id IN ('valid','deferred')", [ids.older]);
  await database.query("UPDATE work_package SET selected=false WHERE project_id='deferred'");
  await database.query("UPDATE linear_project_cache SET in_scope=false WHERE linear_id='one'");
  await database.query("INSERT INTO package_extra_scope(package_id,points,notes,issue_ids) VALUES('linear:many',4,'Keep budget',ARRAY['unknown'])");
  await database.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:many','linear:valid','local')");
  await database.query(`INSERT INTO scenario(id,workspace_id,name,draft_source_at,draft_source_snapshot,draft_snapshot)
    VALUES('00000000-0000-4000-8000-000000000010',1,'Old draft',now(),'{}','{"calculationVersion":"v4","legacy":true}')`);
  await database.query(`INSERT INTO scenario_revision(id,scenario_id,revision_number,draft_edit_version,calculation_version,source_at,source_snapshot,snapshot,rationale,author)
    VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000010',1,1,'v4',now(),'{}','{"calculationVersion":"v4","frozen":true}','Original','Owner')`);
  return { database, client, source };
}

async function activate(client: PoolClient) {
  await client.query("BEGIN");
  try { const feedback = await activateRoadmapPlanning(client); await client.query("COMMIT"); return feedback; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}

test("migration 6 is additive and activation shares conservative conversion without rewriting snapshots", async () => {
  const { database, client } = await legacyDatabase();
  try {
    const original = (await database.query("SELECT * FROM work_package ORDER BY id")).rows;
    const snapshots = (await database.query("SELECT draft_snapshot::text FROM scenario UNION ALL SELECT snapshot::text FROM scenario_revision")).rows;
    const sourceBefore = (await database.query("SELECT row_to_json(p) AS source FROM linear_project_cache p ORDER BY linear_id")).rows;
    const foundation = migrations.find((migration) => migration.version === 6)!;
    assert.equal(foundation.sql, roadmapSchemaSql);
    await database.exec(foundation.sql);
    await database.exec(roadmapSchemaSql);
    const beforeActivation = await getWorkspaceState(client);
    assert.equal(beforeActivation.roadmapPlanningMigrated, false);
    assert.ok(beforeActivation.projects.every((item) => item.roadmap_state === null));
    assert.deepEqual(beforeActivation.roadmapConversionFeedback, []);
    assert.deepEqual((await database.query("SELECT id,stream_id,selected FROM work_package ORDER BY id")).rows, original.map(({ id, stream_id, selected }) => ({ id, stream_id, selected })));
    const feedback = await activate(client);
    const state = await getWorkspaceState(client);
    const board = await getBoard(client);
    assert.equal(state.roadmapPlanningMigrated, true);
    assert.equal(board.roadmapPlanningMigrated, true);
    assert.equal(board.calculationVersion, "v5"); // Cannot publish altered membership semantics as v4.
    assert.deepEqual(state.roadmapConversionFeedback, feedback);
    assert.deepEqual(board.roadmapConversionFeedback, feedback);
    const byId = new Map(state.projects.map((item) => [item.id, item]));
    assert.equal(byId.get("valid")!.roadmap_state, "included");
    assert.equal(byId.get("one")!.roadmap_state, "included");
    assert.equal(byId.get("one")!.in_scope, false);
    assert.equal(byId.get("many")!.roadmap_state, "candidate");
    assert.equal(byId.get("many")!.stream_id, null);
    assert.equal(byId.get("none")!.roadmap_state, "candidate");
    assert.equal(byId.get("deferred")!.roadmap_state, "deferred");
    assert.equal(byId.get("deferred")!.capacity_outcome_id, ids.older);
    assert.deepEqual(state.outcomes.filter((item) => item.stream_id === "core").map((item) => [item.id, item.stream_position]), [[ids.newer, 1], [ids.older, 2]]);
    assert.ok((await database.query<{ sequence_position: number; pause_reason: string }>("SELECT sequence_position,pause_reason FROM work_package")).rows.every((item) => item.sequence_position === 7 && item.pause_reason === "Keep this note"));
    assert.deepEqual((await database.query("SELECT draft_snapshot::text FROM scenario UNION ALL SELECT snapshot::text FROM scenario_revision")).rows, snapshots);
    assert.deepEqual((await database.query("SELECT row_to_json(p) AS source FROM linear_project_cache p ORDER BY linear_id")).rows, sourceBefore);
    assert.equal((await database.query<{ points: string }>("SELECT points FROM package_extra_scope")).rows[0].points, "4.000");
    assert.equal((await database.query("SELECT * FROM package_dependency")).rows.length, 1);
    assert.equal(state.links.length, 5);
    assert.equal((await database.query("SELECT * FROM outcome_lifecycle")).rows.length, 0);
    await database.query("UPDATE work_package SET roadmap_state='dismissed' WHERE project_id='many'");
    assert.equal(await activate(client), undefined);
    await database.exec(roadmapSchemaSql);
    assert.equal((await getWorkspaceState(client)).projects.find((item) => item.id === "many")!.roadmap_state, "dismissed");
  } finally { await database.close(); }
});

test("activated defaults import only new candidates and sync preserves inclusion, hidden work and feedback", async () => {
  const { database, client, source } = await legacyDatabase();
  try {
    await database.exec(roadmapSchemaSql); await activate(client);
    const before = await getWorkspaceState(client);
    await saveImport(client, source(["valid", "one", "none", "many", "deferred", "new"]));
    const state = await getWorkspaceState(client);
    const incoming = state.projects.find((item) => item.id === "new")!;
    assert.deepEqual([incoming.roadmap_state, incoming.selected, incoming.stream_id, incoming.capacity_outcome_id], ["candidate", false, null, null]);
    assert.deepEqual(state.projects.filter((item) => item.id !== "new").map((item) => [item.id, item.roadmap_state, item.selected, item.capacity_outcome_id, item.in_scope]), before.projects.map((item) => [item.id, item.roadmap_state, item.selected, item.capacity_outcome_id, item.in_scope]));
    assert.deepEqual(state.roadmapConversionFeedback, before.roadmapConversionFeedback);
    assert.equal(state.outcomes.length, before.outcomes.length);
    assert.equal(state.links.length, before.links.length);
  } finally { await database.close(); }
});

test("activated storage enforces membership, owning-link and outcome rank invariants", async () => {
  const { database, client } = await legacyDatabase();
  try {
    await database.exec(roadmapSchemaSql); await activate(client);
    for (const sql of [
      "UPDATE work_package SET roadmap_state=NULL WHERE project_id='valid'",
      "UPDATE work_package SET capacity_outcome_id=NULL WHERE project_id='valid'",
      "UPDATE work_package SET stream_id=NULL WHERE project_id='valid'",
      "UPDATE work_package SET selected=false WHERE project_id='valid'",
      "UPDATE work_package SET roadmap_state='dismissed' WHERE project_id='valid'",
      "UPDATE work_package SET roadmap_state='invented' WHERE project_id='none'",
      `UPDATE work_package SET capacity_outcome_id='${ids.other}' WHERE project_id='valid'`,
      "UPDATE outcome SET stream_position=NULL WHERE stream_id='core'",
      "UPDATE outcome SET stream_position=0 WHERE stream_id='core'",
      `UPDATE outcome SET stream_position=1 WHERE id='${ids.older}'`,
    ]) await assert.rejects(database.exec(sql));
    await database.exec("BEGIN; SET CONSTRAINTS outcome_stream_position_key DEFERRED");
    await database.query("UPDATE outcome SET stream_position=CASE WHEN stream_position=1 THEN 2 ELSE 1 END WHERE stream_id='core'");
    await database.exec("COMMIT");
    await activate(client);
    assert.equal((await getWorkspaceState(client)).outcomes.find((item) => item.id === ids.older)!.stream_position, 1);
    await database.query("INSERT INTO outcome(id,title) VALUES('00000000-0000-4000-8000-000000000099','Unassigned')");
  } finally { await database.close(); }
});

test("failed activation rolls back live conversion, defaults and constraints together", async () => {
  const { database, client } = await legacyDatabase();
  try {
    await database.exec(roadmapSchemaSql);
    const before = (await database.query("SELECT * FROM work_package ORDER BY id")).rows;
    await database.exec(`CREATE FUNCTION reject_activation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Activation interrupted'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER interrupt_activation BEFORE UPDATE ON workspace FOR EACH ROW EXECUTE FUNCTION reject_activation()`);
    await assert.rejects(activate(client), /Activation interrupted/);
    assert.deepEqual((await database.query("SELECT * FROM work_package ORDER BY id")).rows, before);
    assert.equal((await getWorkspaceState(client)).roadmapPlanningMigrated, false);
    assert.ok((await getWorkspaceState(client)).outcomes.every((item) => item.stream_position === null));
    await database.query("INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id) SELECT 'after','team','After','planned','https://linear.app',now(),now(),last_seen_import_id FROM linear_project_cache LIMIT 1");
    await database.query("INSERT INTO work_package(id,project_id,team_id) VALUES('linear:after','after','team')");
    assert.deepEqual((await database.query("SELECT selected,roadmap_state FROM work_package WHERE project_id='after'")).rows[0], { selected: true, roadmap_state: null });
  } finally { await database.close(); }
});

test("workspace lifecycle history survives planning outcome deletion and recreation", async () => {
  const { database } = await legacyDatabase();
  try {
    await database.exec(roadmapSchemaSql);
    await database.query("INSERT INTO outcome_lifecycle(outcome_id,completed_at,lifecycle_version,scope_signature) VALUES($1,'2026-10-25',1,'required-proof')", [ids.other]);
    await database.query("INSERT INTO outcome_lifecycle_event(id,outcome_id,action,actor,lifecycle_version,payload) VALUES('00000000-0000-4000-8000-000000000100',$1,'complete','Owner',1,'{\"requiredIds\":[\"linear:valid\"]}')", [ids.other]);
    const history = (await database.query("SELECT * FROM outcome_lifecycle_event")).rows;
    await database.query("DELETE FROM outcome WHERE id=$1", [ids.other]);
    await database.query("INSERT INTO outcome(id,title) VALUES($1,'Restored scenario definition')", [ids.other]);
    assert.equal((await database.query("SELECT lifecycle_version FROM outcome_lifecycle")).rows[0].lifecycle_version, 1);
    assert.deepEqual((await database.query("SELECT * FROM outcome_lifecycle_event")).rows, history);
    await assert.rejects(database.query("DELETE FROM outcome_lifecycle WHERE outcome_id=$1", [ids.other]));
    await assert.rejects(database.query("UPDATE outcome_lifecycle SET completed_at=NULL WHERE outcome_id=$1", [ids.other]));
    await assert.rejects(database.query("UPDATE outcome_lifecycle_event SET action='unknown'"));
    await assert.rejects(database.query("UPDATE outcome_lifecycle_event SET actor=''"));
  } finally { await database.close(); }
});
