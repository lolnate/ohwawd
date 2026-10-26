import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import { getBoard, assignPackagesToStream } from "../src/lib/board";
import { activateRoadmapPlanning, assertRoadmapInvariants } from "../src/lib/roadmap-store";
import { assignOutcomeToStream, replaceOutcomeLinks, transferProjectOwnership } from "../src/lib/outcome-ownership";
import { changeRoadmapMembership, deleteOutcome, includeExistingUnambiguousCandidates, placeRoadmapOutcome } from "../src/lib/roadmap-mutations";
import { planningToken, requirePlanningToken } from "../src/lib/planning-token";
import { placeProjects, sequencingState, rejectNewOrderConflicts } from "../src/lib/sequence-store";
import { orderConflicts } from "../src/lib/sequencing";
import { retireStream, previewStreamRetirement } from "../src/lib/streams";
import { activateScenario, publishScenario } from "../src/lib/scenarios";

const H = "00000000-0000-4000-8000-000000000001", L = "00000000-0000-4000-8000-000000000002", O = "00000000-0000-4000-8000-000000000003", E = "00000000-0000-4000-8000-000000000004";
async function tx<T>(client: PoolClient, fn: () => Promise<T>) {
  await client.query("BEGIN");
  try { const result = await fn(); await assertRoadmapInvariants(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}
async function fixture() {
  const pg = new PGlite(); const client = pg as unknown as PoolClient;
  await pg.exec(schemaSql); await pg.query("INSERT INTO workspace(id) VALUES(1)");
  await pg.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,0.5),('delivery','Delivery',2,0.5)");
  const source = { encryptedKey: "test", viewer: { id: "owner", name: "Owner" }, team: { id: "team", name: "Team" },
    projects: ["a", "b", "c", "d", "x"].map((id) => ({ id, name: id.toUpperCase(), teamId: "team", description: "", status: "started", url: `https://linear.app/${id}`,
      updatedAt: new Date("2026-10-20"), crossTeam: false, issues: [{ id: `issue-${id}`, projectId: id, teamId: "team", identifier: id, title: "Work", estimate: 3, stateType: "started", completedAt: null, updatedAt: new Date("2026-10-20") }] })) };
  await saveImport(client, source, new Date("2026-10-20"));
  await pg.query("UPDATE work_package SET stream_id='core',sequence_position=1");
  for (const [id, name, stream, date] of [[H, "High", "core", "2026-10-24"], [L, "Low", "core", "2026-10-23"], [O, "Other", "delivery", "2026-10-22"], [E, "Empty", "core", "2026-10-21"]]) {
    await pg.query("INSERT INTO outcome(id,title,stream_id,created_at) VALUES($1,$2,$3,$4)", [id, name, stream, date]);
  }
  for (const [projectId, owner] of [["a", H], ["a", L], ["a", O], ["b", H], ["b", L], ["c", O], ["x", H]]) await pg.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES($1,$2)", [owner, projectId]);
  await pg.query("UPDATE work_package SET capacity_outcome_id=$1 WHERE project_id IN ('a','x')", [H]);
  await pg.query("UPDATE work_package SET capacity_outcome_id=$1 WHERE project_id='b'", [L]);
  await pg.query("UPDATE work_package SET capacity_outcome_id=$1,stream_id='delivery' WHERE project_id='c'", [O]);
  await pg.query("UPDATE work_package SET selected=false WHERE project_id='x'");
  await pg.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:b','linear:a','linear')");
  const legacy = await getBoard(client);
  await tx(client, () => activateRoadmapPlanning(client));
  const board = () => getBoard(client);
  const move = async (outcomeId: string, streamId: string | null, extra = {}) => { const current = await board(); return tx(client, () => assignOutcomeToStream(client, { outcomeId, streamId, sequenceToken: current.sequenceToken, ownershipToken: current.ownershipToken, ...extra })); };
  const membership = async (packageId: string, action: string, extra = {}) => { const current = await board(); return tx(client, () => changeRoadmapMembership(client, { packageId: `linear:${packageId}`, action, sequenceToken: current.sequenceToken, planningToken: current.planningToken, ...extra })); };
  return { pg, client, source, legacy, board, move, membership };
}

test("outcome before/after ordering, append moves and idempotent repeats preserve exclusive owners", async () => {
  const f = await fixture();
  try {
    const order = async (stream: string) => (await f.board()).outcomes.filter((item) => item.stream_id === stream).sort((a, b) => a.stream_position! - b.stream_position!).map((item) => item.id);
    assert.deepEqual(await order("core"), [H, L, E]);
    await f.move(E, "core", { beforeOutcomeId: H }); assert.deepEqual(await order("core"), [E, H, L]);
    await f.move(H, "core", { afterOutcomeId: L }); assert.deepEqual(await order("core"), [E, L, H]);
    const before = await f.board();
    await f.move(H, "core"); assert.equal((await f.board()).planningToken, before.planningToken);
    await assert.rejects(f.move(H, "core", { beforeOutcomeId: L, afterOutcomeId: E }), /before or after/);
    assert.equal((await f.board()).planningToken, before.planningToken);
    await f.move(H, "delivery"); assert.deepEqual(await order("delivery"), [O, H]);
    const board = await f.board();
    assert.deepEqual(board.packages.filter((item) => item.capacity_outcome_id === H).map((item) => [item.project_id, item.stream_id, item.roadmap_state]), [["a", "delivery", "included"], ["x", "delivery", "deferred"]]);
    assert.equal(board.packages.find((item) => item.project_id === "b")!.capacity_outcome_id, L);
    assert.equal(board.links.length, before.links.length);
    await assert.rejects(tx(f.client, () => assignOutcomeToStream(f.client, { outcomeId: H, streamId: "core", sequenceToken: before.sequenceToken, ownershipToken: before.ownershipToken })), /changed/);
  } finally { await f.pg.close(); }
});

test("explicit roadmap membership and transfers retain one charge and separate source visibility", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.membership("d", "include", { outcomeId: H }), /linked owning outcome/);
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [{ projectId: "a", requirement: "minimum" }, { projectId: "b", requirement: "minimum" }, { projectId: "d", requirement: "optional" }, { projectId: "x", requirement: "optional" }]));
    await f.membership("d", "include", { outcomeId: H });
    const before = await f.board();
    await tx(f.client, () => transferProjectOwnership(f.client, { packageId: "linear:a", outcomeId: O, sequenceToken: before.sequenceToken, ownershipToken: before.ownershipToken }));
    assert.equal((await f.board()).forecast.selectedKnown, before.forecast.selectedKnown);
    await f.membership("a", "defer", { reason: "" });
    let a = (await f.board()).packages.find((item) => item.project_id === "a")!;
    assert.deepEqual([a.roadmap_state, a.capacity_outcome_id, a.stream_id, a.selected], ["deferred", O, "delivery", false]);
    await f.membership("a", "resume");
    await f.pg.query("UPDATE linear_project_cache SET in_scope=false WHERE linear_id='a'");
    assert.equal((await f.board()).packages.find((item) => item.project_id === "a")!.selected, true);
    await f.membership("a", "dismiss");
    a = (await f.board()).packages.find((item) => item.project_id === "a")!;
    assert.deepEqual([a.roadmap_state, a.capacity_outcome_id, a.stream_id, a.in_scope], ["dismissed", null, null, false]);
    await f.membership("a", "restore");
    await assert.rejects(f.membership("a", "include"), /linked owning outcome/);
    await f.membership("a", "include", { outcomeId: L });
    assert.equal((await f.board()).packages.find((item) => item.project_id === "a")!.capacity_outcome_id, L);
    await assert.rejects(tx(f.client, () => assignPackagesToStream(f.client, "delivery", ["linear:a", "linear:b"])), /owning outcome/);
    assert.equal((await f.board()).packages.filter((item) => item.project_id === "a").length, 1);
  } finally { await f.pg.close(); }
});

test("a sole minimum-required candidate is included when linking or outcome placement completes its owner", async () => {
  const f = await fixture();
  try {
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [{ projectId: "a", requirement: "minimum" }, { projectId: "b", requirement: "minimum" }, { projectId: "d", requirement: "minimum" }, { projectId: "x", requirement: "optional" }]));
    let d = (await f.board()).packages.find((item) => item.project_id === "d")!;
    assert.deepEqual([d.roadmap_state, d.selected, d.capacity_outcome_id, d.stream_id], ["included", true, H, "core"]);

    await f.membership("d", "candidate");
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [{ projectId: "a", requirement: "minimum" }, { projectId: "b", requirement: "minimum" }, { projectId: "x", requirement: "optional" }]));
    const N = "00000000-0000-4000-8000-000000000011";
    await f.pg.query("INSERT INTO outcome(id,title) VALUES($1,'New outcome')", [N]);
    await tx(f.client, () => replaceOutcomeLinks(f.client, N, [{ projectId: "d", requirement: "minimum" }]));
    assert.equal((await f.board()).packages.find((item) => item.project_id === "d")!.roadmap_state, "candidate");
    await f.move(N, "delivery");
    d = (await f.board()).packages.find((item) => item.project_id === "d")!;
    assert.deepEqual([d.roadmap_state, d.selected, d.capacity_outcome_id, d.stream_id], ["included", true, N, "delivery"]);
  } finally { await f.pg.close(); }
});

test("optional and multiply linked candidates remain excluded", async () => {
  const f = await fixture();
  try {
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [{ projectId: "a", requirement: "minimum" }, { projectId: "b", requirement: "minimum" }, { projectId: "d", requirement: "optional" }, { projectId: "x", requirement: "optional" }]));
    assert.equal((await f.board()).packages.find((item) => item.project_id === "d")!.roadmap_state, "candidate");
    await tx(f.client, () => replaceOutcomeLinks(f.client, L, [{ projectId: "a", requirement: "minimum" }, { projectId: "b", requirement: "minimum" }, { projectId: "d", requirement: "minimum" }]));
    assert.equal((await f.board()).packages.find((item) => item.project_id === "d")!.roadmap_state, "candidate");
  } finally { await f.pg.close(); }
});

test("existing sole minimum-required candidates are reconciled conservatively", async () => {
  const f = await fixture();
  try {
    await f.pg.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES($1,'d','minimum')", [H]);
    assert.equal((await f.board()).packages.find((item) => item.project_id === "d")!.roadmap_state, "candidate");
    assert.deepEqual(await tx(f.client, () => includeExistingUnambiguousCandidates(f.client)), ["linear:d"]);
    const d = (await f.board()).packages.find((item) => item.project_id === "d")!;
    assert.deepEqual([d.roadmap_state, d.selected, d.capacity_outcome_id, d.stream_id], ["included", true, H, "core"]);
    assert.deepEqual(await tx(f.client, () => includeExistingUnambiguousCandidates(f.client)), []);
  } finally { await f.pg.close(); }
});

test("already satisfied project assignments preserve exact scoped preferences", async () => {
  const f = await fixture();
  try {
    await f.pg.query("UPDATE work_package SET sequence_position=7 WHERE project_id='a'");
    const before = await planningToken(f.client);
    await tx(f.client, () => assignPackagesToStream(f.client, "core", ["linear:a"]));
    assert.equal(await planningToken(f.client), before);
    assert.equal((await f.board()).packages.find((item) => item.project_id === "a")!.sequence_position, 7);
  } finally { await f.pg.close(); }
});

test("scoped dependency order permits lower-ranked blockers and rejects reversal atomically", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(orderConflicts(await sequencingState(f.client)), []); // Low owns B, which blocks High's A.
    let board = await f.board();
    await tx(f.client, () => transferProjectOwnership(f.client, { packageId: "linear:a", outcomeId: L, sequenceToken: board.sequenceToken, ownershipToken: board.ownershipToken }));
    board = await f.board();
    const positions = board.packages.filter((item) => item.capacity_outcome_id === L).sort((a, b) => a.sequence_position! - b.sequence_position!).map((item) => item.project_id);
    assert.deepEqual(positions, ["b", "a"]);
    const token = board.planningToken;
    await assert.rejects(tx(f.client, () => placeProjects(f.client, [{ packageId: "linear:a", streamId: "core", selected: true, beforeId: "linear:b" }], board.sequenceToken)), /must precede/);
    assert.equal((await f.board()).planningToken, token);
    await assert.rejects(tx(f.client, () => placeProjects(f.client, [{ packageId: "linear:b", streamId: "core", selected: true, beforeId: "linear:c" }])), /within the destination/);
    await assert.rejects(tx(f.client, async () => { const before = await sequencingState(f.client); await f.pg.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:a','linear:b','local')"); await rejectNewOrderConflicts(f.client, before); }), /cycle/);
    assert.equal((await f.board()).planningToken, token);
  } finally { await f.pg.close(); }
});

test("owner link removal, deletion and unassignment exclude demand without guessing replacement owners", async () => {
  const f = await fixture();
  try {
    const result = await tx(f.client, () => replaceOutcomeLinks(f.client, H, [{ projectId: "b", requirement: "optional" }]));
    assert.deepEqual(result.affectedCandidates.map((item) => item.id), ["linear:a"]);
    let board = await f.board();
    const a = board.packages.find((item) => item.project_id === "a")!;
    assert.deepEqual([a.roadmap_state, a.capacity_outcome_id, a.stream_id], ["candidate", null, null]);
    assert.ok(board.links.some((link) => link.outcome_id === L && link.project_id === "a"));
    assert.equal(board.packages.find((item) => item.project_id === "x")!.roadmap_state, "deferred");
    assert.match(a.roadmap_conversion!.message, /owning outcome or link was removed/);
    await assert.rejects(tx(f.client, () => deleteOutcome(f.client, L, undefined)), /Refresh workspace/);
    const removed = await tx(f.client, () => deleteOutcome(f.client, L, board.planningToken));
    assert.deepEqual(removed.affectedCandidates.map((item) => item.id), ["linear:b"]);
    board = await f.board();
    assert.equal(board.packages.find((item) => item.project_id === "b")!.roadmap_state, "candidate");
    await f.membership("c", "defer"); await f.move(O, null);
    const c = (await f.board()).packages.find((item) => item.project_id === "c")!;
    assert.deepEqual([c.roadmap_state, c.capacity_outcome_id, c.stream_id], ["deferred", null, null]);
    await assert.rejects(f.membership("c", "resume"), /linked owning outcome/);
  } finally { await f.pg.close(); }
});

test("source-introduced scoped conflicts retain order and permit incremental repair without new violations", async () => {
  const f = await fixture();
  try {
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, ["a", "b", "d", "x"].map((projectId) => ({ projectId, requirement: projectId === "d" ? "optional" as const : "minimum" as const }))));
    await f.membership("x", "resume"); await f.membership("d", "include", { outcomeId: H });
    await f.pg.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:d','linear:a','linear'),('linear:x','linear:a','linear')");
    let state = await sequencingState(f.client);
    assert.equal(orderConflicts(state).length, 2);
    assert.deepEqual(state.packages.filter((item) => item.ownerId === H && item.selected).sort((a, b) => a.position! - b.position!).map((item) => item.id), ["linear:a", "linear:x", "linear:d"]);
    await tx(f.client, () => placeProjects(f.client, [{ packageId: "linear:d", selected: true, streamId: "core", beforeId: "linear:a" }]));
    state = await sequencingState(f.client); assert.equal(orderConflicts(state).length, 1);
    await tx(f.client, () => placeProjects(f.client, [{ packageId: "linear:x", selected: true, streamId: "core", beforeId: "linear:a" }]));
    assert.deepEqual(orderConflicts(await sequencingState(f.client)), []);
  } finally { await f.pg.close(); }
});

test("bulk inclusion and stale source, link, rank and membership tokens reject without partial writes", async () => {
  const f = await fixture();
  try {
    const initial = await f.board();
    await assert.rejects(tx(f.client, () => placeProjects(f.client, [{ packageId: "linear:c", streamId: "core", outcomeId: H, selected: true }, { packageId: "linear:d", streamId: "core", outcomeId: H, selected: true }])), /linked owning outcome/);
    assert.equal((await f.board()).planningToken, initial.planningToken);
    await f.move(E, "core", { beforeOutcomeId: H });
    await assert.rejects(tx(f.client, () => requirePlanningToken(f.client, initial.planningToken)), /changed/);
    const beforeSource = await f.board();
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-21")));
    await assert.rejects(tx(f.client, () => placeProjects(f.client, [{ packageId: "linear:a", streamId: "core", selected: true }], beforeSource.sequenceToken)), /changed/);
    const beforeMembership = await planningToken(f.client);
    await f.membership("a", "dismiss");
    await assert.rejects(tx(f.client, () => requirePlanningToken(f.client, beforeMembership)), /changed/);
    const beforeLink = await planningToken(f.client);
    await tx(f.client, () => replaceOutcomeLinks(f.client, O, []));
    await assert.rejects(tx(f.client, () => requirePlanningToken(f.client, beforeLink)), /changed/);
  } finally { await f.pg.close(); }
});

test("stream retirement moves owners as coherent groups and rolls back rejected split destinations", async () => {
  const f = await fixture();
  try {
    const migrations = (await f.board()).packages.filter((item) => item.stream_id === "core").map((item) => ({ packageId: item.id, targetStreamId: "delivery" }));
    const preview = await tx(f.client, () => previewStreamRetirement("core", { migrations }, f.client));
    assert.equal((await f.board()).outcomes.find((item) => item.id === H)!.stream_id, "core");
    const beforeAuditFailure = await planningToken(f.client);
    await f.pg.exec(`CREATE FUNCTION reject_roadmap_retirement() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Audit unavailable'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_roadmap_retirement BEFORE INSERT ON stream_lifecycle_event FOR EACH ROW EXECUTE FUNCTION reject_roadmap_retirement()`);
    await assert.rejects(tx(f.client, () => retireStream("core", { migrations, previewToken: preview.previewToken, reason: "Consolidate" }, f.client)), /Audit unavailable/);
    assert.equal(await planningToken(f.client), beforeAuditFailure);
    await f.pg.exec("DROP TRIGGER fail_roadmap_retirement ON stream_lifecycle_event");
    await tx(f.client, () => retireStream("core", { migrations, previewToken: preview.previewToken, reason: "Consolidate" }, f.client));
    const board = await f.board();
    assert.deepEqual(board.outcomes.filter((item) => item.stream_id === "delivery").sort((a, b) => a.stream_position! - b.stream_position!).map((item) => item.id), [O, H, L, E]);
    assert.ok(board.packages.filter((item) => item.selected).every((item) => item.stream_id === "delivery" && item.capacity_outcome_id));
  } finally { await f.pg.close(); }
  const g = await fixture();
  try {
    const migrations = [{ packageId: "linear:a", targetStreamId: "delivery" }, { packageId: "linear:b", targetStreamId: "delivery" }, { packageId: "linear:x", targetStreamId: null }];
    const before = await planningToken(g.client);
    await assert.rejects(tx(g.client, () => previewStreamRetirement("core", { migrations }, g.client)), /must move together/);
    assert.equal(await planningToken(g.client), before);
    await tx(g.client, () => placeRoadmapOutcome(g.client, { outcomeId: H, streamId: null }));
    assert.equal((await g.board()).packages.find((item) => item.project_id === "a")!.roadmap_state, "candidate");
  } finally { await g.pg.close(); }
});

test("explicit retirement destinations include empty outcome rows", async () => {
  const f = await fixture();
  try {
    await f.move(H, "delivery"); await f.move(L, "delivery");
    const preview = await tx(f.client, () => previewStreamRetirement("core", { targetStreamId: "delivery" }, f.client));
    assert.equal(preview.packages.length, 0);
    await tx(f.client, () => retireStream("core", { targetStreamId: "delivery", previewToken: preview.previewToken, reason: "Empty lane" }, f.client));
    assert.equal((await f.board()).outcomes.find((item) => item.id === E)!.stream_id, "delivery");
  } finally { await f.pg.close(); }
});

test("activated scenario writers preserve invariants, ambiguous legacy owners and business history", async () => {
  const f = await fixture();
  try {
    const id = "00000000-0000-4000-8000-000000000010";
    f.legacy.links.push({ project_id: "d", outcome_id: H, requirement: "minimum" }, { project_id: "d", outcome_id: L, requirement: "minimum" });
    await f.pg.query("INSERT INTO scenario(id,workspace_id,name,draft_source_at,draft_source_snapshot,draft_snapshot) VALUES($1,1,'Legacy', '2026-10-20','{}',$2::jsonb)", [id, JSON.stringify(f.legacy)]);
    await f.pg.query("INSERT INTO outcome_lifecycle(outcome_id,completed_at,lifecycle_version,scope_signature) VALUES($1,'2026-10-20T00:00:00Z',1,'saved-proof')", [H]);
    await f.move(H, "delivery");
    await tx(f.client, () => activateScenario(id, { expectedVersion: 1, confirmReplace: true }, f.client));
    const board = await f.board();
    assert.equal(board.packages.find((item) => item.project_id === "d")!.roadmap_state, "candidate");
    assert.equal(board.packages.find((item) => item.project_id === "a")!.capacity_outcome_id, H);
    const marker = (await f.pg.query<{ lifecycle_version: number; review_needed: boolean; completed_at: Date }>("SELECT lifecycle_version,review_needed,completed_at FROM outcome_lifecycle")).rows[0];
    assert.equal(marker.lifecycle_version, 2); assert.equal(marker.review_needed, true);
    assert.equal(marker.completed_at.toISOString(), "2026-10-20T00:00:00.000Z");
    assert.equal((await f.pg.query<{ draft_snapshot: { calculationVersion: string } }>("SELECT draft_snapshot FROM scenario")).rows[0].draft_snapshot.calculationVersion, "v4");
    await assert.rejects(tx(f.client, () => publishScenario(id, { expectedVersion: 1, rationale: "Test", author: "Owner" }, f.client)), /Load and save this older draft/);
  } finally { await f.pg.close(); }
});
