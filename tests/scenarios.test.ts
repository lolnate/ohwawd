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
import { getBoard } from "../src/lib/board";
import { saveExtraScope, saveScopingWindow } from "../src/lib/scope-store";
import { adaptLegacyPlanning } from "../src/lib/legacy-planning";
import { placeProjects } from "../src/lib/sequence-store";
import { saveHolidayPreset, saveWeeklyAvailability } from "../src/lib/weekly-capacity-store";

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

    await database.query("UPDATE work_package SET sequence_position=7 WHERE project_id='project-1'");
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
    assert.equal(revision.calculationVersion, "v2");
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

test("v2 drafts round-trip sequence, extra scope and lead days; source review is advisory and frozen reminders remain unchanged", async () => {
  const { database, client } = await fixture();
  try {
    await placeProjects(client, [{ packageId: "linear:project-1", selected: true, streamId: "stream-1" }]);
    await saveExtraScope(client, { packageId: "linear:project-1", points: 5, notes: "Remaining discovery" });
    await saveScopingWindow(client, 21);
    const scenario = await createScenario({ name: "Scoped queue" }, client);
    await saveExtraScope(client, { packageId: "linear:project-1", points: 8 });
    assert.equal((await listScenarios(client)).activeDraftDirty, true);
    await activateScenario(scenario.id, { expectedVersion: 1, confirmReplace: true }, client);
    let board = await getBoard(client);
    assert.equal(board.extraScopes[0].points, 5);
    assert.equal(board.extraScopes[0].notes, "Remaining discovery");
    assert.equal(board.capacity.scoping_lead_days, 21);
    assert.equal(board.packages[0].sequence_position, 1);
    const saved = await saveScenario(scenario.id, { expectedVersion: 1 }, client);
    const first = await publishScenario(scenario.id, { expectedVersion: saved.editVersion, author: "Owner", rationale: "Rough scope is acceptable" }, client);
    const frozen = (await database.query<{ snapshot: unknown }>("SELECT snapshot FROM scenario_revision WHERE id=$1", [first.id])).rows[0].snapshot;
    await importAt(client, 4, new Date("2026-10-16T12:00:00Z"));
    board = await getBoard(client);
    assert.ok(board.scoping[0].review);
    assert.equal(board.forecast.packages[0].demand, 9);
    const preview = await previewScenarioRebase(scenario.id, { expectedVersion: saved.editVersion }, client);
    const rebased = await rebaseScenario(scenario.id, { expectedVersion: saved.editVersion, confirm: true, previewToken: preview.previewToken }, client);
    await publishScenario(scenario.id, { expectedVersion: rebased.scenario.editVersion, author: "Owner", rationale: "Review reminder retained" }, client);
    await getBoard(client, undefined, new Date("2030-01-01T12:00:00Z"));
    assert.deepEqual((await database.query<{ snapshot: unknown }>("SELECT snapshot FROM scenario_revision WHERE id=$1", [first.id])).rows[0].snapshot, frozen);
  } finally { await database.close(); }
});

test("legacy draft conversion preserves effective budgets and old revisions without restoring retired controls", async () => {
  const { database, client } = await fixture();
  try {
    const board = await getBoard(client);
    const legacy = JSON.parse(JSON.stringify(board));
    delete legacy.calculationVersion; delete legacy.extraScopes; delete legacy.scoping; delete legacy.evaluatedAt;
    delete legacy.weeklyAdjustments; delete legacy.holidayWeeks; delete legacy.capacity.holidays_enabled;
    delete legacy.capacity.scoping_lead_days;
    legacy.packages[0].priority_rank = 7;
    legacy.packages[0].must_include = true;
    legacy.packages[0].earliest_cycle = 99;
    delete legacy.packages[0].sequence_position;
    delete legacy.packages[0].linear_priority;
    legacy.allowances = [{ package_id: "linear:project-1", kind: "unestimated", points: 10, issue_ids: ["issue-1"], rationale: "Rough" },
      { package_id: "linear:project-1", kind: "discovery", points: 3, issue_ids: ["issue-1"], rationale: "Discovery" }];
    const before = JSON.stringify(legacy);
    const adapted = adaptLegacyPlanning(legacy);
    assert.equal(adapted.extraScopes[0].points, 10); // 10 - 3 known + 3 discovery
    assert.equal(adapted.packages[0].sequence_position, 1);
    assert.equal(adapted.packages[0].linear_priority, null);
    assert.equal(JSON.stringify(legacy), before);
    const scenario = await createScenario({ name: "Legacy" }, client);
    await database.query("UPDATE scenario SET draft_snapshot=$2::jsonb WHERE id=$1", [scenario.id, before]);
    await database.query(`INSERT INTO scenario_revision(id,scenario_id,revision_number,draft_edit_version,calculation_version,source_at,source_snapshot,snapshot,rationale,author)
      VALUES('00000000-0000-4000-8000-000000000088',$1,1,1,'v0',$2,'{}',$3::jsonb,'Historical','Owner')`, [scenario.id, board.forecast.sourceAt, before]);
    assert.match((await listScenarios(client)).scenarios[0].conversionNotice!, /retired/);
    await activateScenario(scenario.id, { expectedVersion: 1, confirmReplace: true }, client);
    assert.equal((await getBoard(client)).extraScopes[0].points, 10);
    assert.equal((await getBoard(client)).forecast.packages[0].start, 1);
    assert.equal((await database.query<{ must_include: boolean }>("SELECT must_include FROM work_package")).rows[0].must_include, false);
    const saved = await saveScenario(scenario.id, { expectedVersion: 1 }, client);
    const revision = await publishScenario(scenario.id, { expectedVersion: saved.editVersion, rationale: "New rules", author: "Owner" }, client);
    const comparison = await compareScenarios({ kind: "revision", id: "00000000-0000-4000-8000-000000000088" }, { kind: "revision", id: revision.id }, client);
    assert.deepEqual(comparison.calculationVersions, { from: "v0", to: "v2" });
    assert.deepEqual((await database.query<{ snapshot: unknown }>("SELECT snapshot FROM scenario_revision WHERE calculation_version='v0'")).rows[0].snapshot, JSON.parse(before));
  } finally { await database.close(); }
});

test("v2 weekly assumptions round-trip and v1 drafts preserve their former holiday-free capacity", async () => {
  const { database, client } = await fixture();
  try {
    await saveHolidayPreset(client, true);
    await saveWeeklyAvailability(client, { weekStart: "2026-12-21", availability: 0.75, label: "Christmas staffing" });
    const scenario = await createScenario({ name: "Holiday plan" }, client);
    const first = await publishScenario(scenario.id, { expectedVersion: 1, rationale: "Holiday availability", author: "Owner" }, client);
    const original = (await database.query<{ snapshot: Awaited<ReturnType<typeof getBoard>> }>("SELECT snapshot FROM scenario_revision WHERE id=$1", [first.id])).rows[0].snapshot;
    assert.equal(original.holidayWeeks.find((week) => week.weekStart === "2026-12-21")!.availability, 0.5);
    await saveWeeklyAvailability(client, { weekStart: "2026-12-21", availability: 1 });
    assert.equal((await listScenarios(client)).activeDraftDirty, true);
    await activateScenario(scenario.id, { expectedVersion: 1, confirmReplace: true }, client);
    assert.equal((await getBoard(client)).weeklyAdjustments[0].availability, 0.75);
    const saved = await saveScenario(scenario.id, { expectedVersion: 1 }, client);
    await saveWeeklyAvailability(client, { weekStart: "2026-12-21", availability: 1 });
    const newer = await saveScenario(scenario.id, { expectedVersion: saved.editVersion }, client);
    const second = await publishScenario(scenario.id, { expectedVersion: newer.editVersion, rationale: "Normal week", author: "Owner" }, client);
    const comparison = await compareScenarios({ kind: "revision", id: first.id }, { kind: "revision", id: second.id }, client);
    assert.equal(comparison.weeklyAvailability[0].from!.availability, 0.75);
    assert.equal(comparison.weeklyAvailability[0].to!.availability, 1);
    const legacy = JSON.parse(JSON.stringify(original));
    legacy.calculationVersion = "v1";
    delete legacy.weeklyAdjustments; delete legacy.holidayWeeks; delete legacy.capacity.holidays_enabled;
    await database.query("UPDATE scenario SET draft_snapshot=$2::jsonb WHERE id=$1", [scenario.id, JSON.stringify(legacy)]);
    await activateScenario(scenario.id, { expectedVersion: newer.editVersion, confirmReplace: true }, client);
    const board = await getBoard(client);
    assert.equal(board.capacity.holidays_enabled, false);
    assert.deepEqual(board.weeklyAdjustments, []);
    assert.deepEqual((await database.query<{ snapshot: unknown }>("SELECT snapshot FROM scenario_revision WHERE id=$1", [first.id])).rows[0].snapshot, original);
  } finally { await database.close(); }
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
