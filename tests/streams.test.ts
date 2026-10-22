import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import { activateScenario, createScenario, listScenarios, publishScenario } from "../src/lib/scenarios";
import { addStream, previewStreamRetirement, reorderStreams, restoreStream, retireStream } from "../src/lib/streams";
import { HttpError } from "../src/lib/security";

async function inTransaction<T>(database: PGlite, action: () => Promise<T>): Promise<T> {
  await database.query("BEGIN");
  try {
    const result = await action();
    await database.query("COMMIT");
    return result;
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
}

test("stream lifecycle migrates work, updates the active draft, and preserves old draft conflicts", async () => {
  const database = new PGlite();
  await database.exec(schemaSql);
  await database.query("INSERT INTO workspace(id) VALUES(1)");
  await database.query("INSERT INTO stream(id,name,position,allocation) VALUES('stream-1','First',1,0.6),('stream-2','Second',2,0.4)");
  const client = database as unknown as PoolClient;
  const seenAt = new Date("2026-10-15T12:00:00Z");
  await saveImport(client, {
    encryptedKey: "ciphertext", viewer: { id: "viewer", name: "Owner" }, team: { id: "team", name: "Team" },
    projects: ["one", "two"].map((id) => ({ id, teamId: "team", name: `Project ${id}`, description: "", status: "planned", url: `https://linear.app/${id}`,
      updatedAt: seenAt, crossTeam: false, issues: [] })),
    cycles: [{ id: "cycle-1", teamId: "team", number: 1, name: null, startsAt: new Date("2026-10-19T00:00:00Z"), endsAt: new Date("2026-10-26T00:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null }],
    cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 1, cycleCooldownTime: 0, upcomingCycleCount: 1 },
  }, seenAt);
  await database.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason,reserve,horizon) VALUES(1,10,'test baseline',0,4)");
  await database.query("UPDATE work_package SET stream_id='stream-1' WHERE project_id='one'");
  await database.query("UPDATE work_package SET stream_id='stream-1',selected=false,pause_reason='later' WHERE project_id='two'");
  const oldDraft = await createScenario({ name: "Old stream plan" }, client);
  const activeDraft = await createScenario({ name: "Active plan" }, client);

  await assert.rejects(inTransaction(database, () => addStream({ name: "Overlapping", wip: 2, actor: "Owner", expectedScenarioVersion: activeDraft.editVersion }, client)), /one project at a time/);
  const added = await inTransaction(database, () => addStream({ name: "Third", actor: "Owner", expectedScenarioVersion: activeDraft.editVersion }, client));
  const streamsAfterAdd = await database.query<{ id: string; allocation: string; position: number }>("SELECT id,allocation,position FROM stream WHERE active=true ORDER BY position");
  assert.equal(streamsAfterAdd.rows[2].id, added.streamId);
  assert.equal(streamsAfterAdd.rows[2].allocation, "0");
  assert.equal(added.activeScenarioVersion, 2);

  const reordered = await inTransaction(database, () => reorderStreams({ streamIds: [added.streamId, "stream-2", "stream-1"], actor: "Owner", expectedScenarioVersion: 2 }, client));
  assert.equal(reordered.activeScenarioVersion, 3);
  assert.deepEqual((await database.query<{ id: string }>("SELECT id FROM stream WHERE active=true ORDER BY position")).rows.map((row) => row.id),
    [added.streamId, "stream-2", "stream-1"]);

  const migrations = [
    { packageId: "linear:one", targetStreamId: added.streamId },
    { packageId: "linear:two", targetStreamId: null },
  ];
  const preview = await inTransaction(database, () => previewStreamRetirement("stream-1", { migrations }, client));
  assert.equal(preview.packages.length, 2);
  assert.equal(preview.retiring.allocation, 0.6);

  const retired = await inTransaction(database, () => retireStream("stream-1", {
    migrations, previewToken: preview.previewToken, reason: "Focus merged", actor: "Owner", expectedScenarioVersion: 3,
  }, client));
  assert.equal(retired.activeScenarioVersion, 4);
  assert.deepEqual((await database.query<{ project_id: string; stream_id: string | null; selected: boolean }>("SELECT project_id,stream_id,selected FROM work_package ORDER BY project_id")).rows, [
    { project_id: "one", stream_id: added.streamId, selected: true },
    { project_id: "two", stream_id: null, selected: false },
  ]);
  assert.deepEqual((await database.query<{ active: boolean; allocation: string; retirement_reason: string }>("SELECT active,allocation,retirement_reason FROM stream WHERE id='stream-1'")).rows[0],
    { active: false, allocation: "0", retirement_reason: "Focus merged" });

  const scenarios = await listScenarios(client);
  assert.deepEqual(scenarios.scenarios.find((scenario) => scenario.id === oldDraft.id)?.streamConflicts, [{ id: "stream-1", name: "First" }]);
  assert.deepEqual(scenarios.scenarios.find((scenario) => scenario.id === activeDraft.id)?.streamConflicts, []);
  await assert.rejects(
    activateScenario(oldDraft.id, { expectedVersion: oldDraft.editVersion, confirmReplace: true }, client),
    (error: unknown) => error instanceof HttpError && error.details?.code === "STREAM_RECONCILIATION_REQUIRED",
  );
  await assert.rejects(
    publishScenario(oldDraft.id, { expectedVersion: oldDraft.editVersion, rationale: "Old decision", author: "Owner" }, client),
    (error: unknown) => error instanceof HttpError && error.details?.code === "STREAM_RECONCILIATION_REQUIRED",
  );

  const restored = await inTransaction(database, () => restoreStream("stream-1", { actor: "Owner", expectedScenarioVersion: 4 }, client));
  assert.equal(restored.activeScenarioVersion, 5);
  assert.deepEqual((await database.query<{ active: boolean; allocation: string; position: number }>("SELECT active,allocation,position FROM stream WHERE id='stream-1'")).rows[0],
    { active: true, allocation: "0", position: 3 });
  assert.deepEqual((await listScenarios(client)).scenarios.find((scenario) => scenario.id === oldDraft.id)?.streamConflicts, []);
  assert.equal((await database.query("SELECT id FROM stream_lifecycle_event")).rows.length, 4);
  await database.close();
});

test("stream lifecycle rolls back when audit persistence fails", async () => {
  const database = new PGlite();
  await database.exec(schemaSql);
  await database.query("INSERT INTO workspace(id) VALUES(1)");
  await database.query("INSERT INTO stream(id,name,position) VALUES('stream-1','First',1)");
  await database.query("ALTER TABLE stream_lifecycle_event RENAME TO disabled_stream_lifecycle_event");
  const client = database as unknown as PoolClient;
  await assert.rejects(inTransaction(database, () => addStream({ name: "Must roll back", wip: 1 }, client)));
  await database.query("ALTER TABLE disabled_stream_lifecycle_event RENAME TO stream_lifecycle_event");
  assert.equal((await database.query("SELECT id FROM stream WHERE name='Must roll back'")).rows.length, 0);
  await database.close();
});
