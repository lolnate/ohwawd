import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { assignPackagesToStream, getBoard } from "../src/lib/board";
import { schemaSql } from "../src/lib/db";
import { saveCycleData, saveImport } from "../src/lib/import";
import { saveExtraScope } from "../src/lib/scope-store";
import { placeProjects } from "../src/lib/sequence-store";

test("board reads the connected team's Linear cycles and ID-bound exception", async () => {
  const pg = new PGlite();
  await pg.exec(schemaSql);
  await pg.query("INSERT INTO workspace(id) VALUES(1)");
  for (let position = 1; position <= 5; position++) {
    await pg.query("INSERT INTO stream(id,name,position) VALUES($1,$2,$3)", [`stream-${position}`, `Stream ${position}`, position]);
  }
  try {
    await saveImport(pg as unknown as PoolClient, {
      encryptedKey: "ciphertext", viewer: { id: "viewer", name: "Owner" }, team: { id: "devops", name: "DevOps" },
      projects: [{ id: "p", teamId: "devops", name: "Project", description: "", status: "planned", url: "https://linear.app/p/p",
        updatedAt: new Date("2026-10-15T12:00:00Z"), crossTeam: false,
        issues: [{ id: "issue", projectId: "p", teamId: "devops", identifier: "OPS-1", title: "Work", estimate: 3,
          stateType: "started", completedAt: null, updatedAt: new Date("2026-10-15T12:00:00Z") }] },
      { id: "q", teamId: "devops", name: "Second project", description: "", status: "planned", url: "https://linear.app/p/q",
        updatedAt: new Date("2026-10-15T12:00:00Z"), crossTeam: false, issues: [] }],
      cycles: [
        { id: "c44", teamId: "devops", number: 24, name: "Cycle 44", startsAt: new Date("2026-10-12T00:00:00Z"), endsAt: new Date("2026-10-19T00:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null },
        { id: "c45", teamId: "devops", number: 25, name: "Cycle 45", startsAt: new Date("2026-10-19T00:00:00Z"), endsAt: new Date("2026-10-26T00:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null },
      ], cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 1, cycleCooldownTime: 0, upcomingCycleCount: 1 },
    }, new Date("2026-10-15T12:00:00Z"));
    await pg.query("UPDATE work_package SET stream_id='stream-1' WHERE project_id='p'");
    await pg.query("UPDATE stream SET allocation=1 WHERE id='stream-1'");
    await pg.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason,reserve,horizon) VALUES(1,6,'test',0,4)");
    await pg.query("INSERT INTO linear_cycle_adjustment(linear_cycle_id,availability,reserve) VALUES('c45',0.5,NULL)");
    const board = await getBoard(pg as unknown as PoolClient, new Date("2026-10-15T12:00:00Z"));
    assert.deepEqual(board.futureCycleIds, ["c45"]);
    assert.equal(board.currentCycleId, "c44");
    assert.equal(board.connection.team_name, "DevOps");
    assert.equal(board.forecast.cycles[0].number, 25);
    assert.equal(board.forecast.cycles[0].name, "Cycle 45");
    assert.equal(board.forecast.cycles[0].available, 3);
    assert.equal(board.forecast.packages[0].finish, 1);
    await assignPackagesToStream(pg as unknown as PoolClient, "stream-2", ["linear:p", "linear:q"]);
    const assignments = await pg.query<{ id: string; stream_id: string; selected: boolean }>("SELECT id,stream_id,selected FROM work_package ORDER BY id");
    assert.deepEqual(assignments.rows, [
      { id: "linear:p", stream_id: "stream-2", selected: true },
      { id: "linear:q", stream_id: "stream-2", selected: true },
    ]);
  } finally {
    await pg.close();
  }
});

test("extra scope is unchanged and advisory when newly estimated work appears", async () => {
  const pg = new PGlite();
  await pg.exec(schemaSql);
  await pg.query("INSERT INTO workspace(id) VALUES(1)");
  await pg.query("INSERT INTO stream(id,name,position,allocation) VALUES('stream-1','Stream 1',1,1)");
  const client = pg as unknown as PoolClient;
  const project = {
    id: "p", teamId: "team", name: "Project", description: "", status: "planned", url: "https://linear.app/p/p",
    updatedAt: new Date("2026-10-15T12:00:00Z"), crossTeam: false,
    issues: [{ id: "known", projectId: "p", teamId: "team", identifier: "T-1", title: "Known", estimate: 3,
      stateType: "started", completedAt: null, updatedAt: new Date("2026-10-15T12:00:00Z") }],
  };
  const source = { encryptedKey: "ciphertext", viewer: { id: "viewer", name: "Owner" }, team: { id: "team", name: "Team" }, projects: [project] };
  await saveImport(client, source, new Date("2026-10-15T12:00:00Z"));
  await pg.query("UPDATE work_package SET stream_id='stream-1' WHERE project_id='p'");
  await saveExtraScope(client, { packageId: "linear:p", points: 2 });
  assert.equal((await getBoard(client)).reconciliationWarnings.length, 0);

  project.issues.push({ id: "new", projectId: "p", teamId: "team", identifier: "T-2", title: "New", estimate: 2,
    stateType: "started", completedAt: null, updatedAt: new Date("2026-10-16T12:00:00Z") });
  await saveImport(client, source, new Date("2026-10-16T12:00:00Z"));
  const board = await getBoard(client);
  assert.equal(board.reconciliationWarnings.length, 0);
  assert.match(board.scoping[0].review || "", /1 added/);
  assert.equal(board.forecast.packages[0].demand, 7);
  assert.equal(board.extraScopes[0].points, 2);
  await pg.close();
});

test("new Linear dependencies preserve user order and only withhold affected lane dates until repair", async () => {
  const database = new PGlite();
  try {
    await database.exec(schemaSql);
    await database.query("INSERT INTO workspace(id) VALUES(1)");
    await database.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,0.5),('other','Other',2,0.5)");
    await database.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason) VALUES(1,20,'Test')");
    const at = new Date("2026-10-15T12:00:00Z");
    const projects = ["a", "b", "c"].map((id) => ({ id, teamId: "team", name: id.toUpperCase(), description: "", status: "planned", url: `https://linear.app/${id}`,
      updatedAt: at, crossTeam: false, dependencies: [] as string[], issues: [{ id: `issue-${id}`, projectId: id, teamId: "team", identifier: id, title: id,
        estimate: 3, stateType: "started", completedAt: null, updatedAt: at }] }));
    const input = { encryptedKey: "test", viewer: { id: "v", name: "Owner" }, team: { id: "team", name: "Team" }, projects,
      cycles: Array.from({ length: 3 }, (_, index) => ({ id: `cycle-${index}`, teamId: "team", number: index + 1, name: null,
        startsAt: new Date(Date.UTC(2026, 10, 20 + index * 7)), endsAt: new Date(Date.UTC(2026, 10, 27 + index * 7)), cycleDays: 7, completedAt: null, completedPoints: null })) };
    const client = database as unknown as PoolClient;
    await saveImport(client, input, at);
    await placeProjects(client, [{ packageId: "linear:b", streamId: "core", selected: true }, { packageId: "linear:a", streamId: "core", selected: true }, { packageId: "linear:c", streamId: "other", selected: true }]);
    await placeProjects(client, [{ packageId: "linear:b", streamId: "core", selected: true, beforeId: "linear:a" }]);
    projects[0].dependencies = ["b"];
    await saveImport(client, input, new Date("2026-10-16T12:00:00Z"));
    let board = await getBoard(client);
    assert.deepEqual(board.packages.filter((item) => item.stream_id === "core").map((item) => item.project_id), ["b", "a"]);
    assert.equal(board.sequenceConflicts.length, 1);
    assert.equal(board.forecast.packages.find((item) => item.id === "linear:a")!.finish, null);
    assert.equal(board.forecast.packages.find((item) => item.id === "linear:b")!.finish, null);
    assert.equal(board.forecast.packages.find((item) => item.id === "linear:c")!.finish, 1);
    await placeProjects(client, [{ packageId: "linear:a", streamId: "core", selected: true, beforeId: "linear:b" }], board.sequenceToken);
    board = await getBoard(client);
    assert.equal(board.sequenceConflicts.length, 0);
    assert.equal(board.forecast.packages.find((item) => item.id === "linear:b")!.start, 2);
  } finally { await database.close(); }
});

test("board keeps projected cycles out of the source cache and replaces them with real imports", async () => {
  const database = new PGlite();
  try {
    await database.exec(schemaSql);
    await database.query("INSERT INTO workspace(id) VALUES(1)");
    const client = database as unknown as PoolClient;
    const source = { id: "real-49", teamId: "team", number: 29, name: "Cycle 49", startsAt: new Date("2026-11-17T05:00:00Z"),
      endsAt: new Date("2026-11-24T05:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null };
    await saveImport(client, { encryptedKey: "test", viewer: { id: "v", name: "Owner" }, team: { id: "team", name: "Team" }, projects: [], cycles: [source],
      cycleSettings: { timezone: "America/New_York", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 2, cycleCooldownTime: 0, upcomingCycleCount: 4 } }, new Date("2026-11-16T12:00:00Z"));
    let board = await getBoard(client);
    const projection = board.planningCycles.find((cycle) => cycle.name === "Cycle 50")!;
    assert.equal(projection.projected, true);
    assert.equal(board.linearCycles.length, 1);
    assert.equal((await database.query("SELECT * FROM linear_cycle_cache")).rows.length, 1);
    const actual = { ...source, id: "real-50", number: 30, name: "Cycle 50", startsAt: new Date("2026-11-24T05:00:00Z"), endsAt: new Date("2026-12-01T05:00:00Z") };
    await saveCycleData(client, "team", [source, actual], new Date("2026-11-16T13:00:00Z"));
    board = await getBoard(client);
    const cycle50 = board.planningCycles.filter((cycle) => cycle.name === "Cycle 50");
    assert.equal(cycle50.length, 1);
    assert.equal(cycle50[0].id, "real-50");
    assert.notEqual(cycle50[0].projected, true);
    assert.equal(board.planningCycles.some((cycle) => cycle.id === projection.id), false);
    assert.equal(board.linearCycles.length, 2);
    assert.equal((await database.query("SELECT * FROM linear_cycle_cache WHERE linear_id LIKE 'projected:%'")).rows.length, 0);
  } finally { await database.close(); }
});
