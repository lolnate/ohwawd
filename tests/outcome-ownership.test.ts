import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import { getBoard } from "../src/lib/board";
import { assignOutcomeToStream, replaceOutcomeLinks, transferProjectOwnership } from "../src/lib/outcome-ownership";
import { inferOutcomePlanning, outcomeRows, projectCodes } from "../src/lib/outcome-planning";
import { outcomeOwnershipMigrationSql } from "../src/lib/outcome-ownership-schema";
import { activateScenario, compareScenarios, createScenario, listScenarios, publishScenario } from "../src/lib/scenarios";
import { placeProjects } from "../src/lib/sequence-store";
import { previewStreamRetirement, retireStream } from "../src/lib/streams";

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const third = "00000000-0000-4000-8000-000000000003";

test("outcome rows add only deduplicated immediate prerequisites without changing direct links", () => {
  const packages = ["a", "b", "c", "d"].map((id, index) => ({ id: `linear:${id}`, project_id: id, name: id.toUpperCase(), stream_id: "core", selected: true, sequence_position: index + 1 }));
  const outcomes = [{ id: first, title: "Launch", stream_id: "core", stream_position: 1 }];
  const links = [{ outcome_id: first, project_id: "b", requirement: "minimum" as const }, { outcome_id: first, project_id: "d", requirement: "optional" as const }];
  const dependencies = [
    { predecessorId: "linear:a", successorId: "linear:b" },
    { predecessorId: "linear:a", successorId: "linear:b" },
    { predecessorId: "linear:c", successorId: "linear:a" },
    { predecessorId: "linear:d", successorId: "linear:a" },
    { predecessorId: "linear:missing", successorId: "linear:b" },
  ];
  const before = structuredClone({ packages, outcomes, links, dependencies });
  const row = outcomeRows("core", packages, outcomes, links, dependencies)[0];
  assert.deepEqual(row.projects.map((item) => item.id), ["linear:a", "linear:b", "linear:d"]);
  assert.deepEqual(row.derivedProjectIds, ["linear:a", "linear:missing"]);
  assert.deepEqual(row.unavailablePrerequisiteIds, ["linear:missing"]);
  assert.deepEqual(row.immediateEdges, [{ predecessorId: "linear:a", successorId: "linear:b" }, { predecessorId: "linear:d", successorId: "linear:a" }, { predecessorId: "linear:missing", successorId: "linear:b" }]);
  assert.deepEqual({ packages, outcomes, links, dependencies }, before);
});

async function fixture() {
  const pg = new PGlite();
  await pg.exec(schemaSql);
  const client = pg as unknown as PoolClient;
  await pg.query("INSERT INTO workspace(id) VALUES(1)");
  await pg.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,0.5),('delivery','Delivery',2,0.5)");
  const at = new Date("2026-10-20T12:00:00Z");
  await saveImport(client, { encryptedKey: "test", viewer: { id: "owner", name: "Owner" }, team: { id: "team", name: "Team" },
    projects: ["a", "b"].map((id) => ({ id, teamId: "team", name: `API ${id}`, description: "Scope", status: "planned", url: `https://linear.app/${id}`, updatedAt: at, crossTeam: false,
      issues: [{ id: `i-${id}`, projectId: id, teamId: "team", identifier: id, title: id, estimate: 10, stateType: "started", completedAt: null, updatedAt: at }] })),
    cycles: Array.from({ length: 6 }, (_, index) => ({ id: `c-${index}`, teamId: "team", number: index + 1, name: null, startsAt: new Date(Date.UTC(2026, 10, 2 + index * 7)), endsAt: new Date(Date.UTC(2026, 10, 9 + index * 7)), cycleDays: 7, completedAt: null, completedPoints: null })),
    cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 1, cycleCooldownTime: 0, upcomingCycleCount: 6 } }, at);
  await pg.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason,holidays_enabled) VALUES(1,20,'Test',false)");
  await placeProjects(client, [{ packageId: "linear:a", streamId: "core", selected: true }, { packageId: "linear:b", streamId: "delivery", selected: true }]);
  await pg.query("INSERT INTO outcome(id,title,stream_id,created_at) VALUES($1,'Launch','core','2026-01-01'),($2,'Growth','delivery','2026-01-02'),($3,'Retention','core','2026-01-03')", [first, second, third]);
  for (const id of [first, second, third]) await replaceOutcomeLinks(client, id, [{ projectId: "a", requirement: id === third ? "optional" : "minimum" }]);
  const transfer = async (outcomeId: string | null) => {
    const board = await getBoard(client);
    await transferProjectOwnership(client, { packageId: "linear:a", outcomeId, sequenceToken: board.sequenceToken, ownershipToken: board.ownershipToken });
  };
  return { pg, client, transfer };
}

test("shared same/cross-stream appearances charge once and transfer the sole queue entry", async () => {
  const { pg, client, transfer } = await fixture();
  try {
    await transfer(first);
    let board = await getBoard(client);
    const originalTotals = board.forecast.selectedKnown;
    const appearances = board.streams.flatMap((stream) => outcomeRows(stream.id, board.packages, board.outcomes, board.links));
    assert.equal(appearances.filter((row) => row.projects.some((project) => project.project_id === "a")).length, 3);
    assert.equal(appearances.flatMap((row) => row.projects.filter((project) => project.capacity_outcome_id === row.id)).length, 1);
    assert.equal(board.forecast.packages.length, 2);
    const stale = { sequenceToken: board.sequenceToken, ownershipToken: board.ownershipToken };
    await transfer(third); // Same-stream changes still invalidate the ownership token.
    await assert.rejects(transferProjectOwnership(client, { packageId: "linear:a", outcomeId: second, ...stale }), /ownership changed/);
    await transfer(second);
    board = await getBoard(client);
    assert.equal(board.packages.find((project) => project.id === "linear:a").stream_id, "delivery");
    assert.equal(board.packages.find((project) => project.id === "linear:a").capacity_outcome_id, second);
    assert.equal(board.forecast.selectedKnown, originalTotals);
    assert.equal(board.links.length, 3);
    const consumed = board.forecast.cycles.reduce((sum, cycle) => sum + cycle.streams.reduce((total, stream) => total + stream.used, 0), 0);
    assert.equal(consumed, 20);
  } finally { await pg.close(); }
});

test("retained links preserve owners; unlink, deletion, independent moves and deferral clear ownership", async () => {
  const { pg, client, transfer } = await fixture();
  try {
    await transfer(first);
    await replaceOutcomeLinks(client, first, [{ projectId: "a", requirement: "optional" }, { projectId: "b", requirement: "minimum" }]);
    assert.equal((await getBoard(client)).packages.find((item) => item.project_id === "a").capacity_outcome_id, first);
    await replaceOutcomeLinks(client, first, []);
    let board = await getBoard(client);
    assert.equal(board.packages.find((item) => item.project_id === "a").capacity_outcome_id, null);
    assert.equal(outcomeRows("core", board.packages, board.outcomes, board.links).find((row) => row.outcome === null)!.projects[0].project_id, "a");
    await transfer(third);
    await pg.query("DELETE FROM outcome WHERE id=$1", [third]);
    assert.equal((await getBoard(client)).packages.find((item) => item.project_id === "a").capacity_outcome_id, null);
    await transfer(second);
    await placeProjects(client, [{ packageId: "linear:a", streamId: "core", selected: true }]);
    board = await getBoard(client);
    assert.equal(board.packages.find((item) => item.project_id === "a").capacity_outcome_id, null);
    await transfer(second);
    await placeProjects(client, [{ packageId: "linear:a", streamId: null, selected: false }]);
    board = await getBoard(client);
    assert.equal(board.packages.find((item) => item.project_id === "a").capacity_outcome_id, null);
    assert.equal(board.forecast.selectedKnown, 10);
  } finally { await pg.close(); }
});

test("outcome assignment preserves other owners and deferred work; retirement unassigns outcomes", async () => {
  const { pg, client, transfer } = await fixture();
  try {
    await transfer(first);
    let board = await getBoard(client);
    await assignOutcomeToStream(client, { outcomeId: second, streamId: "core", sequenceToken: board.sequenceToken, ownershipToken: board.ownershipToken });
    assert.equal((await getBoard(client)).packages.find((item) => item.project_id === "a").capacity_outcome_id, first);
    await placeProjects(client, [{ packageId: "linear:a", selected: false, streamId: null }]);
    board = await getBoard(client);
    await assignOutcomeToStream(client, { outcomeId: second, streamId: "delivery", sequenceToken: board.sequenceToken, ownershipToken: board.ownershipToken });
    assert.equal((await getBoard(client)).packages.find((item) => item.project_id === "a").selected, false);
    await pg.exec("BEGIN");
    const preview = await previewStreamRetirement("core", {}, client);
    assert.deepEqual(preview.outcomes.map((outcome) => outcome.id).sort(), [first, third]);
    await retireStream("core", { previewToken: preview.previewToken, migrations: [], reason: "Merge" }, client);
    await pg.exec("COMMIT");
    board = await getBoard(client);
    assert.equal(board.outcomes.find((outcome) => outcome.id === first).stream_id, null);
    assert.equal(board.outcomes.find((outcome) => outcome.id === third).stream_id, null);
  } finally { await pg.close(); }
});

test("ownership and outcome stream placement are scenario inputs and published snapshots stay frozen", async () => {
  const { pg, client, transfer } = await fixture();
  try {
    await transfer(first);
    const scenario = await createScenario({ name: "Launch plan" }, client);
    const revision = await publishScenario(scenario.id, { expectedVersion: 1, rationale: "Launch owns shared capacity", author: "Owner" }, client);
    await transfer(third);
    assert.equal((await listScenarios(client)).activeDraftDirty, true);
    const another = await createScenario({ name: "Retention plan" }, client);
    const comparison = await compareScenarios({ kind: "draft", id: scenario.id }, { kind: "draft", id: another.id }, client);
    assert.equal(comparison.packages[0].from?.capacityOutcomeId, first);
    assert.equal(comparison.packages[0].to?.capacityOutcomeId, third);
    await activateScenario(scenario.id, { expectedVersion: 1, confirmReplace: true }, client);
    const board = await getBoard(client);
    assert.equal(board.packages.find((item) => item.project_id === "a").capacity_outcome_id, first);
    assert.equal(board.outcomes.find((item) => item.id === second).stream_id, "delivery");
    const frozen = (await pg.query<{ snapshot: typeof board }>("SELECT snapshot FROM scenario_revision WHERE id=$1", [revision.id])).rows[0].snapshot;
    assert.equal(frozen.packages.find((item) => item.project_id === "a").capacity_outcome_id, first);
    assert.equal((await listScenarios(client)).activeDraftDirty, false);
  } finally { await pg.close(); }
});

test("migration and legacy inference agree without moving project streams or touching saved JSON", async () => {
  const { pg, client } = await fixture();
  try {
    const original = await getBoard(client);
    const legacyPackages = original.packages.map(({ capacity_outcome_id: _owner, ...project }) => project);
    const legacyOutcomes = original.outcomes.map(({ stream_id: _stream, ...outcome }) => outcome);
    const inferred = inferOutcomePlanning(legacyPackages, legacyOutcomes, original.links, original.streams);
    const scenario = await createScenario({ name: "Before migration" }, client);
    const revision = await publishScenario(scenario.id, { expectedVersion: 1, author: "Owner", rationale: "Frozen before migration" }, client);
    const savedBefore = (await pg.query("SELECT draft_snapshot FROM scenario WHERE id=$1", [scenario.id])).rows[0].draft_snapshot;
    const frozenBefore = (await pg.query("SELECT snapshot FROM scenario_revision WHERE id=$1", [revision.id])).rows[0].snapshot;
    await pg.exec(outcomeOwnershipMigrationSql);
    const migrated = await getBoard(client);
    assert.deepEqual(migrated.packages.map((item) => [item.id, item.stream_id, item.capacity_outcome_id]), inferred.packages.map((item) => [item.id, item.stream_id, item.capacity_outcome_id]));
    assert.deepEqual(migrated.outcomes.map((item) => [item.id, item.stream_id]), inferred.outcomes.map((item) => [item.id, item.stream_id]));
    assert.equal(original.packages[0].capacity_outcome_id, null);
    assert.equal(inferOutcomePlanning(original.packages, original.outcomes, original.links, original.streams).packages[0].capacity_outcome_id, null);
    assert.deepEqual((await pg.query("SELECT draft_snapshot FROM scenario WHERE id=$1", [scenario.id])).rows[0].draft_snapshot, savedBefore);
    assert.deepEqual((await pg.query("SELECT snapshot FROM scenario_revision WHERE id=$1", [revision.id])).rows[0].snapshot, frozenBefore);
    await pg.query("UPDATE scenario SET draft_snapshot=$2::jsonb WHERE id=$1", [scenario.id, JSON.stringify({ ...savedBefore, packages: legacyPackages, outcomes: legacyOutcomes })]);
    await activateScenario(scenario.id, { expectedVersion: 1, confirmReplace: true }, client);
    const loaded = await getBoard(client);
    assert.deepEqual(loaded.packages.map((item) => [item.id, item.stream_id, item.capacity_outcome_id]), inferred.packages.map((item) => [item.id, item.stream_id, item.capacity_outcome_id]));
    assert.equal(new Set(projectCodes([{ id: "a", name: "API foundation" }, { id: "b", name: "API framework" }]).values()).size, 2);
  } finally { await pg.close(); }
});

test("a dependency-invalid ownership move rejects atomically and leaves all outcome links intact", async () => {
  const { pg, client, transfer } = await fixture();
  try {
    await transfer(first);
    // A contradictory imported order must be repaired, not silently rewritten by a transfer.
    await placeProjects(client, [{ packageId: "linear:b", streamId: "core", selected: true, beforeId: "linear:a" }]);
    await pg.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id)
      SELECT 'c',team_id,'Blocker','planned',url,source_updated_at,last_seen_at,last_seen_import_id FROM linear_project_cache WHERE linear_id='a'`);
    await pg.query("INSERT INTO work_package(id,project_id,team_id,stream_id,sequence_position) VALUES('linear:c','c','team','core',3)");
    await pg.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:c','linear:b','linear')");
    const before = await getBoard(client);
    await pg.exec("BEGIN");
    await assert.rejects(transfer(second), /Repair the existing dependency order/);
    await pg.exec("ROLLBACK");
    const after = await getBoard(client);
    assert.deepEqual(after.packages, before.packages);
    assert.deepEqual(after.links, before.links);
    assert.equal(after.ownershipToken, before.ownershipToken);
  } finally { await pg.close(); }
});

test("loading a draft clears incompatible owners of projects imported after that draft", async () => {
  const { pg, client, transfer } = await fixture();
  try {
    await transfer(first);
    const scenario = await createScenario({ name: "Before new work" }, client);
    let board = await getBoard(client);
    await assignOutcomeToStream(client, { outcomeId: first, streamId: "delivery", sequenceToken: board.sequenceToken, ownershipToken: board.ownershipToken });
    await pg.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id)
      SELECT 'new',team_id,'New project','planned',url,source_updated_at,last_seen_at,last_seen_import_id FROM linear_project_cache WHERE linear_id='a'`);
    await pg.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES($1,'new')", [first]);
    await pg.query("INSERT INTO work_package(id,project_id,team_id,stream_id,selected,sequence_position,capacity_outcome_id) VALUES('linear:new','new','team','delivery',true,3,$1)", [first]);
    await activateScenario(scenario.id, { expectedVersion: 1, confirmReplace: true }, client);
    board = await getBoard(client);
    const later = board.packages.find((project) => project.project_id === "new");
    assert.equal(later.stream_id, "delivery");
    assert.equal(later.capacity_outcome_id, null);
    assert.equal(later.selected, true);
  } finally { await pg.close(); }
});
