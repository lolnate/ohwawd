import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import {
  activateScenario,
  compareScenarios,
  createScenario,
  designateBaseline,
  listScenarios,
  previewScenarioRebase,
  publishScenario,
  rebaseScenario,
  saveScenario,
  ScenarioConflictError,
} from "../src/lib/scenarios";
import { HttpError } from "../src/lib/security";

const outcomeId = "00000000-0000-4000-8000-000000000001";

async function fixture() {
  const database = new PGlite();
  await database.exec(schemaSql);
  await database.query("INSERT INTO workspace(id) VALUES(1)");
  for (let position = 1; position <= 5; position++) {
    await database.query("INSERT INTO stream(id,name,position) VALUES($1,$2,$3)", [`stream-${position}`, `Stream ${position}`, position]);
  }
  const client = database as unknown as PoolClient;
  await importAt(client, 3, new Date("2026-10-15T12:00:00Z"));
  await database.query("UPDATE work_package SET stream_id='stream-1' WHERE project_id='project-1'");
  await database.query("UPDATE stream SET allocation=1 WHERE id='stream-1'");
  await database.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason,reserve,horizon) VALUES(1,6,'test baseline',0,4)");
  await database.query("INSERT INTO outcome(id,title,needed_by) VALUES($1,'Launch','2026-11-30')", [outcomeId]);
  await database.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES($1,'project-1')", [outcomeId]);
  return { database, client };
}

async function importAt(client: PoolClient, estimate: number, seenAt: Date) {
  return saveImport(client, {
    encryptedKey: "must-not-appear-in-snapshots",
    viewer: { id: "viewer", name: "Owner" },
    team: { id: "team-1", name: "Team One" },
    projects: [{
      id: "project-1", teamId: "team-1", name: "Project One", description: "", status: "planned", url: "https://linear.app/project-1",
      updatedAt: seenAt, crossTeam: false,
      issues: [{ id: "issue-1", projectId: "project-1", teamId: "team-1", identifier: "ONE-1", title: "Build it",
        estimate, stateType: "started", completedAt: null, updatedAt: seenAt }],
    }],
    cycles: [
      { id: "cycle-1", teamId: "team-1", number: 1, name: null, startsAt: new Date("2026-10-19T00:00:00Z"), endsAt: new Date("2026-10-26T00:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null },
      { id: "cycle-2", teamId: "team-1", number: 2, name: null, startsAt: new Date("2026-10-26T00:00:00Z"), endsAt: new Date("2026-11-02T00:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null },
      { id: "cycle-3", teamId: "team-1", number: 3, name: null, startsAt: new Date("2026-11-02T00:00:00Z"), endsAt: new Date("2026-11-09T00:00:00Z"), completedAt: null, cycleDays: 7, completedPoints: null },
    ],
    cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 1, cycleCooldownTime: 0, upcomingCycleCount: 3 },
  }, seenAt);
}

test("scenario lifecycle saves drafts with optimistic versions and publishes frozen revisions", async () => {
  const { database, client } = await fixture();
  try {
    const created = await createScenario({ name: "Launch plan" }, client);
    assert.equal(created.editVersion, 1);
    assert.equal(created.stale, false);
    const listed = await listScenarios(client);
    assert.equal(listed.scenarios[0].name, "Launch plan");
    assert.equal(listed.creationReadiness.ready, true);
    assert.deepEqual(listed.creationReadiness.blockers, []);

    await database.query("UPDATE work_package SET priority_rank=7 WHERE project_id='project-1'");
    const saved = await saveScenario(created.id, { expectedVersion: 1, name: "Launch plan", archived: false }, client);
    assert.equal(saved.editVersion, 2);

    await assert.rejects(
      saveScenario(created.id, { expectedVersion: 1 }, client),
      (error: unknown) => error instanceof ScenarioConflictError && error.details?.currentVersion === 2,
    );
    await assert.rejects(
      publishScenario(created.id, { expectedVersion: 2, rationale: "", author: "Owner" }, client),
      (error: unknown) => error instanceof HttpError && error.status === 400,
    );

    const revision = await publishScenario(created.id, {
      expectedVersion: 2, rationale: "Commit to the launch scope.", author: "Owner",
    }, client);
    assert.equal(revision.revisionNumber, 1);
    assert.equal(revision.calculationVersion, "v0");
    assert.equal(revision.draftEditVersion, 2);
    assert.equal(JSON.stringify((await database.query("SELECT snapshot FROM scenario_revision WHERE id=$1", [revision.id])).rows[0]).includes("must-not-appear-in-snapshots"), false);
    await assert.rejects(database.query("UPDATE scenario_revision SET rationale='rewritten' WHERE id=$1", [revision.id]), /immutable/i);
    await assert.rejects(database.query("DELETE FROM scenario WHERE id=$1", [created.id]));

    await database.query("UPDATE linear_project_cache SET name='Changed live name' WHERE linear_id='project-1'");
    const frozen = await database.query<{ snapshot: { packages: { name: string }[] } }>("SELECT snapshot FROM scenario_revision WHERE id=$1", [revision.id]);
    assert.equal(frozen.rows[0].snapshot.packages[0].name, "Project One");
  } finally {
    await database.close();
  }
});

test("scenario creation rejects a board with incomplete forecast prerequisites", async () => {
  const { database, client } = await fixture();
  try {
    await database.query("DELETE FROM capacity_profile WHERE workspace_id=1");
    await assert.rejects(
      createScenario({ name: "Not ready" }, client),
      (error: unknown) => error instanceof HttpError && error.status === 422 && error.details?.code === "SCENARIO_BOARD_NOT_READY",
    );
    assert.equal((await database.query("SELECT id FROM scenario")).rows.length, 0);
  } finally {
    await database.close();
  }
});

test("published revisions can be designated as the single workspace baseline", async () => {
  const { database, client } = await fixture();
  try {
    const first = await createScenario({ name: "First" }, client);
    const second = await createScenario({ name: "Second" }, client);
    const firstRevision = await publishScenario(first.id, { expectedVersion: 1, rationale: "First choice", author: "Owner" }, client);
    const secondRevision = await publishScenario(second.id, { expectedVersion: 1, rationale: "Second choice", author: "Owner" }, client);
    await designateBaseline(firstRevision.id, client);
    assert.equal((await listScenarios(client)).baselineRevisionId, firstRevision.id);
    await designateBaseline(secondRevision.id, client);
    assert.equal((await listScenarios(client)).baselineRevisionId, secondRevision.id);
    assert.equal((await database.query("SELECT * FROM workspace_baseline")).rows.length, 1);
  } finally {
    await database.close();
  }
});

test("publishing rejects stale source unless confirmed and rebase exposes the forecast delta", async () => {
  const { database, client } = await fixture();
  try {
    const scenario = await createScenario({ name: "Pinned source" }, client);
    await importAt(client, 12, new Date("2026-10-16T12:00:00Z"));
    assert.equal((await listScenarios(client)).scenarios[0].stale, true);

    await assert.rejects(
      publishScenario(scenario.id, { expectedVersion: 1, rationale: "Use old inputs", author: "Owner" }, client),
      (error: unknown) => error instanceof HttpError && error.status === 409 && error.details?.code === "STALE_SOURCE_CONFIRMATION_REQUIRED",
    );
    const staleRevision = await publishScenario(scenario.id, {
      expectedVersion: 1, rationale: "Use the reviewed old inputs", author: "Owner", confirmStaleSource: true,
    }, client);
    assert.equal(staleRevision.staleSourceConfirmed, true);
    const frozen = await database.query<{ snapshot: { forecast: { selectedKnown: number } } }>("SELECT snapshot FROM scenario_revision WHERE id=$1", [staleRevision.id]);
    assert.equal(frozen.rows[0].snapshot.forecast.selectedKnown, 3);

    const preview = await previewScenarioRebase(scenario.id, { expectedVersion: 1 }, client);
    assert.equal(preview.scenario.editVersion, 1);
    assert.equal(preview.comparison.sourceChanged, true);
    const rebased = await rebaseScenario(scenario.id, { expectedVersion: 1, confirm: true, previewToken: preview.previewToken }, client);
    assert.equal(rebased.scenario.editVersion, 2);
    assert.equal(rebased.scenario.stale, false);
    assert.equal(rebased.comparison.sourceChanged, true);
    assert.equal(rebased.comparison.outcomes.length, 1);
    assert.notEqual(rebased.comparison.outcomes[0].from?.endDate, rebased.comparison.outcomes[0].to?.endDate);
  } finally {
    await database.close();
  }
});

test("comparison reports planning and forecast changes between immutable revisions", async () => {
  const { database, client } = await fixture();
  try {
    const scenario = await createScenario({ name: "Capacity options" }, client);
    const first = await publishScenario(scenario.id, { expectedVersion: 1, rationale: "Six points", author: "Owner" }, client);
    await database.query("UPDATE capacity_profile SET baseline=2,baseline_reason='lower capacity' WHERE workspace_id=1");
    await database.query("UPDATE stream SET name='Customer experience' WHERE id='stream-1'");
    const saved = await saveScenario(scenario.id, { expectedVersion: 1 }, client);
    const second = await publishScenario(scenario.id, { expectedVersion: saved.editVersion, rationale: "Two points", author: "Owner" }, client);

    const comparison = await compareScenarios(
      { kind: "revision", id: first.id },
      { kind: "revision", id: second.id },
      client,
    );
    assert.equal(comparison.capacity.from.baseline, 6);
    assert.equal(comparison.capacity.to.baseline, 2);
    assert.equal(comparison.streams[0].from?.name, "Stream 1");
    assert.equal(comparison.streams[0].to?.name, "Customer experience");
    assert.equal(comparison.outcomes.length, 1);
    assert.notEqual(comparison.outcomes[0].from?.endDate, comparison.outcomes[0].to?.endDate);
  } finally {
    await database.close();
  }
});

test("activating a draft restores planning inputs without rolling back Linear source", async () => {
  const { database, client } = await fixture();
  try {
    const scenario = await createScenario({ name: "Restorable plan" }, client);
    await database.query("UPDATE work_package SET selected=false,stream_id=NULL,pause_reason='alternative' WHERE project_id='project-1'");
    await database.query("UPDATE stream SET allocation=0 WHERE id='stream-1'");
    await database.query("UPDATE linear_project_cache SET name='Latest Linear name' WHERE linear_id='project-1'");
    await database.query("INSERT INTO outcome(id,title) VALUES('00000000-0000-4000-8000-000000000099','Newer outcome')");

    await activateScenario(scenario.id, { expectedVersion: 1, confirmReplace: true }, client);
    const restored = await database.query<{ selected: boolean; stream_id: string; allocation: string }>(`SELECT w.selected,w.stream_id,s.allocation
      FROM work_package w JOIN stream s ON s.id=w.stream_id WHERE w.project_id='project-1'`);
    assert.deepEqual(restored.rows[0], { selected: true, stream_id: "stream-1", allocation: "1" });
    assert.equal((await database.query<{ name: string }>("SELECT name FROM linear_project_cache WHERE linear_id='project-1'")).rows[0].name, "Latest Linear name");
    assert.equal((await database.query("SELECT id FROM outcome WHERE id='00000000-0000-4000-8000-000000000099'")).rows.length, 1);
  } finally {
    await database.close();
  }
});

test("only the draft loaded on the board can capture live planning changes", async () => {
  const { database, client } = await fixture();
  try {
    const first = await createScenario({ name: "First draft" }, client);
    const second = await createScenario({ name: "Second draft" }, client);
    assert.equal((await listScenarios(client)).activeScenarioId, second.id);
    await assert.rejects(
      saveScenario(first.id, { expectedVersion: 1 }, client),
      (error: unknown) => error instanceof HttpError && error.status === 409 && error.details?.code === "SCENARIO_NOT_ACTIVE",
    );
    await activateScenario(first.id, { expectedVersion: 1, confirmReplace: true }, client);
    assert.equal((await listScenarios(client)).activeScenarioId, first.id);
    assert.equal((await saveScenario(first.id, { expectedVersion: 1 }, client)).editVersion, 2);
  } finally {
    await database.close();
  }
});
