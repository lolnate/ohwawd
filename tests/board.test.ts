import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Pool, PoolClient } from "pg";
import { assignPackagesToStream, getBoard } from "../src/lib/board";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";

test("board reads the connected team's Linear cycles and ID-bound exception", async () => {
  const pg = new PGlite();
  const priorUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "pglite-test";
  globalThis.ohwawdPool = { query: (sql: string, params?: unknown[]) => sql === schemaSql
    ? pg.exec(sql).then(() => ({ rows: [], rowCount: 0 }))
    : pg.query(sql, params) } as unknown as Pool;
  try {
    await getBoard();
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
    const board = await getBoard(undefined, new Date("2026-10-15T12:00:00Z"));
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
    globalThis.ohwawdPool = undefined;
    if (priorUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorUrl;
    await pg.close();
  }
});
