import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { scopeReadiness, linearPriorityLabel } from "../src/lib/project-scope";
import { saveExtraScope, saveScopingWindow } from "../src/lib/scope-store";
import { getBoard } from "../src/lib/board";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import type { ImportedProject } from "../src/lib/linear";

const readiness = (changes: Partial<Parameters<typeof scopeReadiness>[0]> = {}) => scopeReadiness({ packageId: "p", selected: true, complete: false,
  status: "planned", extra: true, startDate: "2026-11-20", leadDays: 14, evaluatedAt: "2026-11-06T12:00:00Z", timezone: "America/New_York", review: null, ...changes });

test("scoping uses inclusive team-local calendar boundaries across DST and responds to scheduling", () => {
  assert.equal(readiness().dueDate, "2026-11-06");
  assert.equal(readiness().status, "needs_scoping");
  assert.equal(readiness({ evaluatedAt: "2026-11-06T02:00:00Z" }).status, "scheduled");
  assert.equal(readiness({ startDate: "2026-11-10" }).dueDate, "2026-10-27");
  assert.equal(readiness({ leadDays: 0, evaluatedAt: "2026-11-20T12:00:00Z" }).status, "needs_scoping");
  assert.equal(readiness({ leadDays: 365 }).dueDate, "2025-11-20");
  assert.equal(readiness({ startDate: "2026-12-20", review: "Review source" }).status, "scheduled");
  assert.equal(readiness({ startDate: "2026-12-20", review: "Review source" }).review, "Review source");
  assert.equal(readiness({ selected: false }).status, "none");
  assert.equal(readiness({ complete: true }).status, "none");
  assert.equal(readiness({ extra: false }).status, "none");
  assert.equal(readiness({ startDate: null }).status, "date_unavailable");
  assert.equal(readiness({ startDate: null, status: "in progress" }).status, "needs_scoping");
  assert.equal(linearPriorityLabel(null), "Unknown");
  assert.equal(linearPriorityLabel(0), "No priority");
  assert.equal(linearPriorityLabel(1), "Urgent");
});

test("extra scope is manually reconciled, unknown coverage is explicit, and reminder dates do not gate forecasts", async () => {
  const database = new PGlite();
  try {
    await database.exec(schemaSql);
    await database.query("INSERT INTO workspace(id) VALUES(1)");
    await database.query("INSERT INTO stream(id,name,position,allocation) VALUES('one','One',1,1)");
    await database.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason) VALUES(1,100,'Test')");
    const project: ImportedProject = { id: "p", teamId: "team", name: "Project", description: "", status: "planned", priority: 2,
      url: "https://linear.app/p/p", crossTeam: false, updatedAt: new Date("2026-10-15T12:00:00Z"), issues: [] };
    const issue = (id: string, estimate: number | null) => ({ id, projectId: "p", teamId: "team", identifier: id, title: id, estimate,
      stateType: "started", updatedAt: project.updatedAt, completedAt: null });
    project.issues = [issue("known", 20), issue("unknown", null)];
    const input = { encryptedKey: "ciphertext", viewer: { id: "v", name: "Owner" }, team: { id: "team", name: "Team" }, projects: [project],
      cycles: [{ id: "cycle", teamId: "team", number: 45, name: null, startsAt: new Date("2026-11-20T05:00:00Z"), endsAt: new Date("2026-12-04T05:00:00Z"), cycleDays: 14, completedAt: null, completedPoints: null }],
      cycleSettings: { timezone: "America/New_York", cyclesEnabled: true, cycleDuration: 2, cycleStartDay: 5, cycleCooldownTime: 0, upcomingCycleCount: 1 } };
    const client = database as unknown as PoolClient;
    await saveImport(client, input, new Date("2026-10-15T12:00:00Z"));
    await database.query("UPDATE work_package SET stream_id='one',sequence_position=1");
    await saveExtraScope(client, { packageId: "linear:p", points: 10 });
    const boardAt = (time: string) => getBoard(client, undefined, new Date(time));
    let board = await boardAt("2026-11-05T12:00:00Z");
    assert.equal(board.scoping[0].status, "scheduled");
    assert.equal(board.forecast.packages[0].demand, 30);
    assert.equal(board.forecast.packages[0].finish, 1);
    assert.equal(board.forecast.packages[0].provisional, true);
    assert.equal((await boardAt("2026-11-06T12:00:00Z")).scoping[0].status, "needs_scoping");
    project.issues[1].estimate = 4;
    await saveImport(client, input, new Date("2026-10-16T12:00:00Z"));
    board = await boardAt("2026-11-06T12:00:00Z");
    assert.equal(board.forecast.packages[0].demand, 34);
    assert.equal(board.forecast.packages[0].finish, 1);
    assert.match(board.scoping[0].review!, /1 estimates or completion/);
    assert.equal(board.reconciliationWarnings.length, 0);
    await saveExtraScope(client, { packageId: "linear:p", points: 6, notes: "" });
    board = await boardAt("2026-11-06T12:00:00Z");
    assert.equal(board.forecast.packages[0].demand, 30);
    assert.equal(board.scoping[0].review, null);
    project.issues.push(issue("new", null));
    await saveImport(client, input, new Date("2026-10-17T12:00:00Z"));
    board = await boardAt("2026-11-06T12:00:00Z");
    assert.equal(board.forecast.packages[0].finish, null);
    assert.match(board.forecast.packages[0].reason!, /no estimate/);
    await saveExtraScope(client, { packageId: "linear:p", points: 6 });
    assert.equal((await boardAt("2026-11-06T12:00:00Z")).forecast.packages[0].finish, 1);
    await saveExtraScope(client, { packageId: "linear:p", points: 0 });
    assert.equal((await boardAt("2026-11-06T12:00:00Z")).forecast.packages[0].finish, null);
    assert.equal((await database.query("SELECT * FROM package_extra_scope")).rows.length, 0);
    for (const invalid of [-1, NaN, Infinity, 100001, 0.0001]) await assert.rejects(() => saveExtraScope(client, { packageId: "linear:p", points: invalid }), /Extra scope must/);
    for (const invalid of [-1, 1.5, 366]) await assert.rejects(() => saveScopingWindow(client, invalid), /whole number/);
    await saveScopingWindow(client, 21);
    assert.equal((await boardAt("2026-11-06T12:00:00Z")).capacity.scoping_lead_days, 21);
  } finally { await database.close(); }
});
