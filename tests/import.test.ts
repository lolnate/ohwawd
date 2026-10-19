import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { schemaSql } from "../src/lib/db";
import { saveCycleData, saveImport } from "../src/lib/import";
import type { ImportedProject } from "../src/lib/linear";
import type { PoolClient } from "pg";

test("repeat import upserts by Linear ID and preserves shared outcome links", async () => {
  const db = new PGlite();
  await db.exec(schemaSql);
  await db.query("INSERT INTO workspace(id) VALUES (1)");
  const project = (id: string, name: string): ImportedProject => ({
    id, teamId: "team-a", name, description: "", status: "planned", url: `https://linear.app/p/${id}`,
    updatedAt: new Date("2026-10-15T12:00:00Z"), crossTeam: false,
    issues: [{ id: `${id}-issue`, projectId: id, teamId: "team-a", identifier: "A-1", title: "Task",
      estimate: null, stateType: "started", completedAt: null, updatedAt: new Date("2026-10-15T12:00:00Z") }],
  });
  const input = (projects: ImportedProject[]) => ({ encryptedKey: "ciphertext", viewer: { id: "viewer", name: "Owner" }, team: { id: "team-a", name: "A" }, projects });
  const client = db as unknown as PoolClient;
  const initial = project("one", "Original");
  initial.dependencies = ["two"];
  await saveImport(client, { ...input([initial, project("two", "Second")]), cycles: [{ id: "cycle-1", teamId: "team-a", number: 44, name: null, startsAt: new Date("2026-10-01T00:00:00Z"), endsAt: new Date("2026-10-15T00:00:00Z"), completedAt: new Date("2026-10-15T00:00:00Z"), cycleDays: 14, completedPoints: 21 },
    { id: "cycle-2", teamId: "team-a", number: 45, name: null, startsAt: new Date("2026-10-19T00:00:00Z"), endsAt: new Date("2026-10-26T00:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null }],
    cycleSettings: { timezone: "America/New_York", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 1, cycleCooldownTime: 0, upcomingCycleCount: 2 } });
  const first = await db.query<{ id: string }>("SELECT id FROM work_package");
  assert.deepEqual(first.rows.map((row) => row.id).sort(), ["linear:one", "linear:two"]);
  assert.equal((await db.query("SELECT * FROM package_dependency WHERE predecessor_id='linear:one' AND successor_id='linear:two' AND source='linear'")).rows.length, 1);
  assert.equal((await db.query<{ completed_points: string }>("SELECT completed_points FROM cycle_observation WHERE linear_id='cycle-1'")).rows[0].completed_points, "21");
  assert.deepEqual((await db.query<{ number: number }>("SELECT number FROM linear_cycle_cache WHERE active=true ORDER BY number")).rows.map((row) => row.number), [44, 45]);

  await db.query("INSERT INTO outcome(id,title) VALUES ('00000000-0000-4000-8000-000000000001','Outcome A'), ('00000000-0000-4000-8000-000000000002','Outcome B')");
  await db.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES ('00000000-0000-4000-8000-000000000001','one'),('00000000-0000-4000-8000-000000000002','one')");
  await db.query("UPDATE linear_project_cache SET in_scope=false WHERE linear_id='one'");
  const changed = project("one", "Renamed");
  changed.issues[0].estimate = 3;
  await saveImport(client, input([changed]));

  const projects = await db.query<{ linear_id: string; name: string; needs_review: boolean }>("SELECT linear_id,name,needs_review FROM linear_project_cache ORDER BY linear_id");
  assert.deepEqual(projects.rows, [
    { linear_id: "one", name: "Renamed", needs_review: false },
    { linear_id: "two", name: "Second", needs_review: true },
  ]);
  assert.equal((await db.query("SELECT id FROM work_package WHERE project_id='one'")).rows.length, 1);
  assert.equal((await db.query<{ in_scope: boolean }>("SELECT in_scope FROM linear_project_cache WHERE linear_id='one'")).rows[0].in_scope, false);
  assert.equal((await db.query("SELECT * FROM outcome_project_link WHERE project_id='one'")).rows.length, 2);
  assert.equal((await db.query("SELECT * FROM package_dependency WHERE source='linear'")).rows.length, 0);
  assert.equal((await db.query<{ estimate: string }>("SELECT estimate FROM linear_issue_cache WHERE project_id='one'")).rows[0].estimate, "3");
  await db.close();
});

test("old relative cycle settings migrate to Linear cycle IDs on import", async () => {
  const db = new PGlite();
  await db.exec(schemaSql);
  await db.query("INSERT INTO workspace(id) VALUES (1)");
  const client = db as unknown as PoolClient;
  const project: ImportedProject = { id: "p", teamId: "team-a", name: "Project", description: "", status: "planned", url: "https://linear.app/p/p", updatedAt: new Date("2026-10-15T12:00:00Z"), crossTeam: false, issues: [] };
  const base = { encryptedKey: "ciphertext", viewer: { id: "viewer", name: "Owner" }, team: { id: "team-a", name: "A" }, projects: [project] };
  await saveImport(client, base);
  await db.query("UPDATE workspace SET timezone='UTC' WHERE id=1");
  await db.query("INSERT INTO capacity_profile(workspace_id,cycle_anchor,cycle_days) VALUES(1,'2026-10-12',7)");
  await db.query("UPDATE work_package SET earliest_cycle=2,preferred_cycle=3 WHERE project_id='p'");
  await db.query("INSERT INTO cycle_adjustment(cycle_number,availability,reserve) VALUES(1,0.5,1)");
  await db.query("INSERT INTO cycle_adjustment(cycle_number,availability,reserve) VALUES(3,0.2,NULL)");
  const future = [45, 46].map((number, index) => ({ id: `cycle-${number}`, teamId: "team-a", number, name: null,
    startsAt: new Date(Date.UTC(2026, 9, 19 + index * 7)), endsAt: new Date(Date.UTC(2026, 9, 26 + index * 7)),
    completedAt: null, cycleDays: 7, completedPoints: null }));
  await saveImport(client, { ...base, cycles: future, cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 1, cycleCooldownTime: 0, upcomingCycleCount: 2 } });
  const saved = await db.query<{ earliest_linear_cycle_id: string; earliest_cycle: number | null; preferred_linear_cycle_id: string | null; preferred_cycle: number | null }>("SELECT earliest_linear_cycle_id,earliest_cycle,preferred_linear_cycle_id,preferred_cycle FROM work_package WHERE project_id='p'");
  assert.deepEqual(saved.rows[0], { earliest_linear_cycle_id: "cycle-46", earliest_cycle: null, preferred_linear_cycle_id: null, preferred_cycle: 3 });
  const adjusted = await db.query<{ linear_cycle_id: string; availability: string }>("SELECT linear_cycle_id,availability FROM linear_cycle_adjustment");
  assert.deepEqual(adjusted.rows, [{ linear_cycle_id: "cycle-45", availability: "0.5" }]);
  assert.deepEqual((await db.query<{ cycle_number: number }>("SELECT cycle_number FROM cycle_adjustment")).rows, [{ cycle_number: 3 }]);
  assert.equal((await db.query<{ team_timezone: string }>("SELECT team_timezone FROM linear_connection WHERE workspace_id=1")).rows[0].team_timezone, "UTC");
  future[0].startsAt = new Date("2026-10-20T00:00:00Z");
  future[0].endsAt = new Date("2026-10-27T00:00:00Z");
  await saveCycleData(client, "team-a", future, new Date("2026-10-15T18:00:00Z"));
  assert.equal((await db.query<{ starts_at: Date }>("SELECT starts_at FROM linear_cycle_cache WHERE linear_id='cycle-45'")).rows[0].starts_at.toISOString().slice(0, 10), "2026-10-20");
  assert.equal((await db.query("SELECT * FROM linear_cycle_adjustment WHERE linear_cycle_id='cycle-45'")).rows.length, 1);
  await db.close();
});
