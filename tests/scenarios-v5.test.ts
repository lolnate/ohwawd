import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { schemaSql } from "../src/lib/db";
import { getBoard } from "../src/lib/board";
import { saveImport } from "../src/lib/import";
import { activateRoadmapPlanning, assertRoadmapInvariants } from "../src/lib/roadmap-store";
import { assignOutcomeToStream, transferProjectOwnership, replaceOutcomeLinks } from "../src/lib/outcome-ownership";
import { changeRoadmapMembership, deleteOutcome } from "../src/lib/roadmap-mutations";
import { getOutcomeLifecycles, saveOutcomeCompletion } from "../src/lib/outcome-lifecycle";
import { planningToken } from "../src/lib/planning-token";
import { saveExtraScope } from "../src/lib/scope-store";
import { addStream, previewStreamRetirement, retireStream, restoreStream } from "../src/lib/streams";
import { activateScenario, compareScenarios, compareSnapshots, createScenario, listScenarios, previewScenarioRebase, publishScenario, rebaseScenario, saveScenario, stablePreviewBoard, type ScenarioSnapshot } from "../src/lib/scenarios";
import { HttpError } from "../src/lib/security";

const H = "00000000-0000-4000-8000-000000000001", L = "00000000-0000-4000-8000-000000000002", O = "00000000-0000-4000-8000-000000000003";
const link = (projectId: string, requirement: "minimum" | "optional" = "minimum") => ({ projectId, requirement });
const code = (expected: string) => (error: unknown) => error instanceof HttpError && error.details?.code === expected;
async function tx<T>(client: PoolClient, action: () => Promise<T>) {
  await client.query("BEGIN"); try { const result = await action(); await assertRoadmapInvariants(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}
async function fixture() {
  const pg = new PGlite(), client = pg as unknown as PoolClient;
  await pg.exec(schemaSql); await pg.query("INSERT INTO workspace(id) VALUES(1)");
  await pg.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,0.5),('delivery','Delivery',2,0.5)");
  const source: Parameters<typeof saveImport>[1] = { encryptedKey: "test-key-not-in-snapshots", viewer: { id: "owner", name: "Owner" }, team: { id: "team", name: "Team" },
    projects: ["a", "b", "c", "x", "u"].map((id) => ({ id, teamId: "team", name: id.toUpperCase(), description: "", status: id === "a" ? "completed" : "planned", url: `https://linear.app/${id}`, updatedAt: new Date("2026-10-20"), crossTeam: false,
      issues: [{ id: `issue-${id}`, projectId: id, teamId: "team", identifier: id, title: "Work", estimate: 5, stateType: id === "a" ? "completed" : "started", completedAt: id === "a" ? new Date("2026-10-20") : null, updatedAt: new Date("2026-10-20") }] })),
    cycles: Array.from({ length: 8 }, (_, index) => ({ id: `cycle-${index}`, teamId: "team", number: index + 1, name: null, startsAt: new Date(Date.UTC(2026, 10, 1 + index * 7)), endsAt: new Date(Date.UTC(2026, 10, 8 + index * 7)), completedAt: null, cycleDays: 7, completedPoints: null })),
    cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 0, cycleCooldownTime: 0, upcomingCycleCount: 8 } };
  await saveImport(client, source, new Date("2026-10-20"));
  await pg.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason,holidays_enabled) VALUES(1,20,'Test',false)");
  for (const [id, title, stream, date] of [[H, "High", "core", "2026-10-24"], [L, "Low", "core", "2026-10-23"], [O, "Other", "delivery", "2026-10-22"]]) {
    await pg.query("INSERT INTO outcome(id,title,stream_id,created_at) VALUES($1,$2,$3,$4)", [id, title, stream, date]);
  }
  await replaceOutcomeLinks(client, H, [link("a"), link("x", "optional")]); await replaceOutcomeLinks(client, L, [link("b"), link("a", "optional")]); await replaceOutcomeLinks(client, O, [link("c"), link("a", "optional")]);
  for (const [projectId, owner, stream, sequence] of [["a", H, "core", 1], ["x", H, "core", 2], ["b", L, "core", 1], ["c", O, "delivery", 1]]) await pg.query("UPDATE work_package SET capacity_outcome_id=$2,stream_id=$3,sequence_position=$4 WHERE project_id=$1", [projectId, owner, stream, sequence]);
  await tx(client, () => activateRoadmapPlanning(client));
  const board = () => getBoard(client);
  const membership = async (id: string, action: string, outcomeId?: string) => { const current = await board(); return tx(client, () => changeRoadmapMembership(client, { packageId: `linear:${id}`, action, outcomeId, sequenceToken: current.sequenceToken, planningToken: current.planningToken })); };
  const move = async (id: string, streamId: string, extra = {}) => { const current = await board(); return tx(client, () => assignOutcomeToStream(client, { outcomeId: id, streamId, sequenceToken: current.sequenceToken, ownershipToken: current.ownershipToken, ...extra })); };
  const complete = async (completed: boolean) => { const current = (await getOutcomeLifecycles(client)).get(H)!; return tx(client, () => saveOutcomeCompletion(client, H, { completed, expectedLifecycleVersion: current.lifecycleVersion, eligibilityToken: current.eligibilityToken })); };
  const snapshot = async (id: string) => (await pg.query<{ draft_snapshot: ScenarioSnapshot }>("SELECT draft_snapshot FROM scenario WHERE id=$1", [id])).rows[0].draft_snapshot;
  const publish = (id: string, expectedVersion = 1, extra = {}) => tx(client, () => publishScenario(id, { expectedVersion, rationale: "Reviewed plan", author: "Owner", ...extra }, client));
  return { pg, client, source, board, membership, move, complete, snapshot, publish };
}

test("v5 rank, membership, ownership and scoped order round-trip and compare separately from source priority", async () => {
  const f = await fixture();
  try {
    const scenario = await tx(f.client, () => createScenario({ name: "Priority plan" }, f.client));
    const first = await f.publish(scenario.id); assert.equal(first.calculationVersion, "v5");
    await f.membership("x", "defer"); await f.membership("u", "dismiss"); await f.move(L, "core", { beforeOutcomeId: H });
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [link("a"), link("x", "optional"), link("b", "optional")]));
    const before = await f.board();
    await tx(f.client, () => transferProjectOwnership(f.client, { packageId: "linear:b", outcomeId: H, sequenceToken: before.sequenceToken, ownershipToken: before.ownershipToken }));
    assert.equal((await listScenarios(f.client)).activeDraftDirty, true);
    await assert.rejects(f.publish(scenario.id), code("DRAFT_HAS_UNSAVED_CHANGES"));
    const saved = await tx(f.client, () => saveScenario(scenario.id, { expectedVersion: 1 }, f.client));
    const expected = await f.snapshot(scenario.id), second = await f.publish(scenario.id, saved.editVersion);
    assert.equal(expected.calculationVersion, "v5"); assert.deepEqual(expected.outcomeCatalogIds, [H, L, O]);
    const comparison = await compareScenarios({ kind: "revision", id: first.id }, { kind: "revision", id: second.id }, f.client);
    assert.deepEqual(comparison.calculationVersions, { from: "v5", to: "v5" }); assert.deepEqual(comparison.priorities, []);
    assert.equal(comparison.packages.find((item) => item.id === "linear:x")!.to!.roadmapState, "deferred");
    assert.equal(comparison.packages.find((item) => item.id === "linear:u")!.to!.roadmapState, "dismissed");
    assert.equal(comparison.packages.find((item) => item.id === "linear:b")!.to!.capacityOutcomeId, H);
    assert.equal(comparison.outcomes.find((item) => item.id === H)!.to!.streamPosition, 2);
    await f.membership("x", "resume"); await f.membership("u", "restore"); await f.move(H, "core", { beforeOutcomeId: L });
    await f.pg.query("UPDATE linear_project_cache SET name='Current source name' WHERE linear_id='b'");
    await tx(f.client, () => activateScenario(scenario.id, { expectedVersion: saved.editVersion, confirmReplace: true }, f.client));
    const restored = await f.board();
    assert.deepEqual(restored.packages.map((item) => [item.id, item.roadmap_state, item.capacity_outcome_id, item.sequence_position]), expected.packages.map((item) => [item.id, item.roadmap_state, item.capacity_outcome_id, item.sequence_position]));
    assert.equal(restored.outcomes.find((item) => item.id === H)!.stream_position, 2); assert.equal(restored.packages.find((item) => item.id === "linear:b")!.name, "Current source name");
    assert.equal((await listScenarios(f.client)).activeDraftDirty, false);
  } finally { await f.pg.close(); }
});

test("legacy editable versions preserve raw owner ambiguity, budgets and stored JSON until explicit v5 save", async () => {
  const f = await fixture();
  try {
    const original = await f.board();
    for (const version of ["v0", "v1", "v2", "v3", "v4"]) {
      const old = JSON.parse(JSON.stringify(original)); old.calculationVersion = version;
      delete old.outcomeCatalogIds;
      for (const item of old.packages) { delete item.roadmap_state; delete item.roadmap_conversion; item.must_include = true; item.preferred_cycle = 99; item.earliest_cycle = 99; }
      for (const item of old.outcomes) { delete item.stream_position; delete item.lifecycle; }
      old.packages.find((item: { id: string }) => item.id === "linear:a").capacity_outcome_id = null;
      old.packages.find((item: { id: string }) => item.id === "linear:c").capacity_outcome_id = null;
      if (version === "v0") {
        delete old.calculationVersion; delete old.extraScopes; delete old.weeklyAdjustments; delete old.holidayWeeks; delete old.capacity.holidays_enabled;
        old.allowances = [{ package_id: "linear:a", kind: "unestimated", points: 6, issue_ids: ["issue-a"], rationale: "Carried estimate" }, { package_id: "linear:a", kind: "discovery", points: 2, issue_ids: [], rationale: "Discovery" }];
      }
      const id = randomUUID(), serialized = JSON.stringify(old);
      await f.pg.query("INSERT INTO scenario(id,workspace_id,name,draft_source_at,draft_source_snapshot,draft_snapshot) VALUES($1,1,$2,'2026-10-20','{}',$3::jsonb)", [id, `Legacy ${version}`, serialized]);
      const stored = (await f.pg.query<{ value: string }>("SELECT draft_snapshot::text AS value FROM scenario WHERE id=$1", [id])).rows[0].value;
      await assert.rejects(f.publish(id), code("LEGACY_DRAFT_REQUIRES_SAVE"));
      const loaded = await tx(f.client, () => activateScenario(id, { expectedVersion: 1, confirmReplace: true }, f.client));
      assert.equal(loaded.requiresConversion, true); assert.match(loaded.conversionNotice!, /v5/);
      const board = await f.board();
      assert.equal(board.packages.find((item) => item.id === "linear:a")!.roadmap_state, "candidate");
      assert.equal(board.packages.find((item) => item.id === "linear:c")!.capacity_outcome_id, O);
      assert.ok(loaded.activationFeedback.conversionFeedback.some((item) => item.packageId === "linear:a" && item.reason === "needs-owner"));
      if (version === "v0") assert.equal(board.extraScopes.find((item) => item.package_id === "linear:a")!.points, 3); // 6 - 5 known + 2 discovery.
      assert.equal((await f.pg.query<{ value: string }>("SELECT draft_snapshot::text AS value FROM scenario WHERE id=$1", [id])).rows[0].value, stored);
      assert.equal((await listScenarios(f.client)).activeDraftDirty, true);
      await assert.rejects(f.publish(id), code("LEGACY_DRAFT_REQUIRES_SAVE"));
      const saved = await tx(f.client, () => saveScenario(id, { expectedVersion: 1 }, f.client));
      assert.equal(saved.requiresConversion, false); assert.equal((await f.snapshot(id)).calculationVersion, "v5");
      const published = await f.publish(id, saved.editVersion); assert.equal(published.calculationVersion, "v5");
    }
  } finally { await f.pg.close(); }
});

test("published v0–v4 inputs/output/version stay byte-equivalent and historical lifecycle is never inferred", async () => {
  const f = await fixture();
  try {
    const plan = await tx(f.client, () => createScenario({ name: "Historical records" }, f.client));
    const original = await f.board(), oldIds: string[] = [];
    for (const version of ["v0", "v1", "v2", "v3", "v4"]) {
      const old = JSON.parse(JSON.stringify(original)); old.calculationVersion = version;
      if (version === "v0") { delete old.calculationVersion; delete old.extraScopes; old.allowances = []; }
      for (const item of old.packages) { delete item.roadmap_state; delete item.roadmap_conversion; }
      for (const item of old.outcomes) { delete item.lifecycle; delete item.stream_position; }
      old.forecast.outcomes[0].endDate = "1999-01-01"; old.forecast.packages[0].finish = 42;
      const id = randomUUID(); oldIds.push(id);
      await f.pg.query(`INSERT INTO scenario_revision(id,scenario_id,revision_number,draft_edit_version,calculation_version,source_at,source_snapshot,snapshot,rationale,author)
        VALUES($1,$2,$3,1,$4,'2026-10-20',$5::jsonb,$6::jsonb,'Historical','Owner')`, [id, plan.id, oldIds.length, version, JSON.stringify({ version, frozen: true }), JSON.stringify(old)]);
    }
    const before = (await f.pg.query("SELECT id,calculation_version,source_snapshot::text,snapshot::text FROM scenario_revision ORDER BY id")).rows;
    await f.complete(true);
    const saved = await tx(f.client, () => saveScenario(plan.id, { expectedVersion: 1 }, f.client)), current = await f.publish(plan.id, saved.editVersion);
    for (let index = 0; index < oldIds.length; index++) {
      const comparison = await compareScenarios({ kind: "revision", id: oldIds[index] }, { kind: "revision", id: current.id }, f.client);
      assert.deepEqual(comparison.calculationVersions, { from: `v${index}`, to: "v5" });
      assert.equal(comparison.outcomes[0].from!.endDate, "1999-01-01");
      assert.deepEqual(comparison.outcomeLifecycles.find((item) => item.id === H)!.from, { recorded: false });
      assert.equal(comparison.outcomeLifecycles.find((item) => item.id === H)!.to!.recorded, true);
    }
    assert.deepEqual((await f.pg.query("SELECT id,calculation_version,source_snapshot::text,snapshot::text FROM scenario_revision WHERE id=ANY($1::uuid[]) ORDER BY id", [oldIds])).rows, before);
  } finally { await f.pg.close(); }
});

test("lifecycle-only changes stay scheduling-clean and publication freezes saved evidence, not live markers", async () => {
  const f = await fixture();
  try {
    const plan = await tx(f.client, () => createScenario({ name: "Business evidence" }, f.client));
    const previewBefore = JSON.stringify(stablePreviewBoard(await f.board()));
    const completed = await f.complete(true);
    assert.equal((await listScenarios(f.client)).activeDraftDirty, false); assert.equal(JSON.stringify(stablePreviewBoard(await f.board())), previewBefore);
    const first = await f.publish(plan.id);
    const saved = await tx(f.client, () => saveScenario(plan.id, { expectedVersion: 1 }, f.client)); const second = await f.publish(plan.id, saved.editVersion);
    await f.complete(false);
    const comparison = await compareScenarios({ kind: "revision", id: first.id }, { kind: "revision", id: second.id }, f.client);
    const evidence = comparison.outcomeLifecycles.find((item) => item.id === H)!;
    assert.equal(evidence.from!.recorded && evidence.from!.completedAt, null); assert.equal(evidence.to!.recorded && evidence.to!.completedAt, completed.lifecycle.completedAt);
    assert.deepEqual(comparison.packages, []); assert.deepEqual(comparison.outcomes, []);
    await tx(f.client, () => activateScenario(plan.id, { expectedVersion: saved.editVersion, confirmReplace: true }, f.client));
    assert.equal((await getOutcomeLifecycles(f.client)).get(H)!.completedAt, null);
  } finally { await f.pg.close(); }
});

test("managed omission alternatives remove and restore definitions while preserving business history and newer unrelated outcomes", async () => {
  const f = await fixture();
  try {
    const withOutcome = await tx(f.client, () => createScenario({ name: "With High" }, f.client));
    const completed = await f.complete(true), token = await planningToken(f.client);
    await tx(f.client, () => deleteOutcome(f.client, H, token));
    const withoutOutcome = await tx(f.client, () => createScenario({ name: "Without High" }, f.client));
    assert.ok((await f.snapshot(withoutOutcome.id)).outcomeCatalogIds!.includes(H));
    const comparison = await compareScenarios({ kind: "draft", id: withOutcome.id }, { kind: "draft", id: withoutOutcome.id }, f.client);
    assert.deepEqual(comparison.managedOutcomes.find((item) => item.id === H)?.to, { managed: true, present: false });
    const captured = await f.snapshot(withOutcome.id), extra = randomUUID();
    const scopeOnly = compareSnapshots(captured, { ...captured, outcomeCatalogIds: [...captured.outcomeCatalogIds!, extra] });
    assert.deepEqual(scopeOnly.managedOutcomes[0], { id: extra, name: extra, from: { managed: false, present: false }, to: { managed: true, present: false } });
    const newer = randomUUID(); await f.pg.query("INSERT INTO outcome(id,title) VALUES($1,'Newer unrelated outcome')", [newer]);
    await tx(f.client, () => activateScenario(withOutcome.id, { expectedVersion: 1, confirmReplace: true }, f.client));
    const restoredCompletion = (await getOutcomeLifecycles(f.client)).get(H)!;
    assert.equal(restoredCompletion.completedAt, completed.lifecycle.completedAt); assert.equal(restoredCompletion.reviewNeeded, true);
    assert.match(restoredCompletion.reviewReasons.join(" "), /definition was removed/);
    const originalCreated = (await f.snapshot(withOutcome.id)).outcomes.find((item) => item.id === H)!.created_at;
    assert.equal((await f.board()).outcomes.find((item) => item.id === H)!.created_at.toISOString(), new Date(originalCreated).toISOString());
    const omission = await tx(f.client, () => activateScenario(withoutOutcome.id, { expectedVersion: 1, confirmReplace: true }, f.client));
    assert.deepEqual(omission.activationFeedback.omittedOutcomeIds, [H]);
    assert.equal((await f.board()).outcomes.some((item) => item.id === H), false); assert.ok((await f.board()).outcomes.some((item) => item.id === newer));
    assert.equal((await f.pg.query("SELECT * FROM outcome_lifecycle WHERE outcome_id=$1", [H])).rows.length, 1);
    await tx(f.client, () => activateScenario(withOutcome.id, { expectedVersion: 1, confirmReplace: true }, f.client));
    assert.equal((await getOutcomeLifecycles(f.client)).get(H)!.completedAt, completed.lifecycle.completedAt);
  } finally { await f.pg.close(); }
});

test("new candidates and lifecycle facts do not dirty planning; explicit membership and reviewed source rebase do", async () => {
  const f = await fixture();
  try {
    const plan = await tx(f.client, () => createScenario({ name: "Current source" }, f.client));
    f.source.projects.push({ ...structuredClone(f.source.projects[1]), id: "new", name: "New source project", issues: [{ ...structuredClone(f.source.projects[1].issues[0]), id: "issue-new", projectId: "new", identifier: "new" }] });
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-21")));
    assert.equal((await listScenarios(f.client)).activeDraftDirty, false); assert.equal((await listScenarios(f.client)).scenarios[0].stale, true);
    await assert.rejects(tx(f.client, () => saveScenario(plan.id, { expectedVersion: 1 }, f.client)), code("SOURCE_STALE"));
    await f.membership("new", "dismiss"); assert.equal((await listScenarios(f.client)).activeDraftDirty, true);
    const preview = await previewScenarioRebase(plan.id, { expectedVersion: 1 }, f.client);
    const rebased = await tx(f.client, () => rebaseScenario(plan.id, { expectedVersion: 1, confirm: true, previewToken: preview.previewToken }, f.client));
    assert.equal((await f.snapshot(plan.id)).calculationVersion, "v5"); assert.equal((await listScenarios(f.client)).activeDraftDirty, false);
    assert.equal((await f.publish(plan.id, rebased.scenario.editVersion)).calculationVersion, "v5");
  } finally { await f.pg.close(); }
});

test("retired streams reject legacy placement without partial owner changes and restore explicitly", async () => {
  const f = await fixture();
  try {
    const old = await tx(f.client, () => createScenario({ name: "Before retirement" }, f.client));
    await tx(f.client, () => createScenario({ name: "Retirement option" }, f.client));
    const preview = await tx(f.client, () => previewStreamRetirement("core", { targetStreamId: "delivery" }, f.client));
    const retired = await tx(f.client, () => retireStream("core", { targetStreamId: "delivery", previewToken: preview.previewToken, reason: "Consolidate", expectedScenarioVersion: 1 }, f.client));
    const before = await planningToken(f.client);
    await assert.rejects(tx(f.client, () => activateScenario(old.id, { expectedVersion: 1, confirmReplace: true }, f.client)), code("STREAM_RECONCILIATION_REQUIRED"));
    await assert.rejects(f.publish(old.id), code("STREAM_RECONCILIATION_REQUIRED")); assert.equal(await planningToken(f.client), before);
    await tx(f.client, () => restoreStream("core", { expectedScenarioVersion: retired.activeScenarioVersion }, f.client));
    await tx(f.client, () => activateScenario(old.id, { expectedVersion: 1, confirmReplace: true }, f.client));
    assert.ok((await f.board()).packages.filter((item) => item.selected).every((item) => item.capacity_outcome_id));
  } finally { await f.pg.close(); }
});

test("stream configuration writes cannot silently persist conversion of an old draft", async () => {
  const f = await fixture();
  try {
    const plan = await tx(f.client, () => createScenario({ name: "Legacy stream edit" }, f.client));
    const old = await f.snapshot(plan.id); old.calculationVersion = "v4";
    await f.pg.query("UPDATE scenario SET draft_snapshot=$2::jsonb WHERE id=$1", [plan.id, JSON.stringify(old)]);
    const before = (await f.pg.query<{ value: string }>("SELECT draft_snapshot::text AS value FROM scenario WHERE id=$1", [plan.id])).rows[0].value;
    await tx(f.client, () => addStream({ name: "New focus", expectedScenarioVersion: 1 }, f.client));
    assert.equal((await f.pg.query<{ value: string }>("SELECT draft_snapshot::text AS value FROM scenario WHERE id=$1", [plan.id])).rows[0].value, before);
    assert.equal((await listScenarios(f.client)).scenarios[0].editVersion, 1); assert.equal((await listScenarios(f.client)).activeDraftDirty, true);
  } finally { await f.pg.close(); }
});
