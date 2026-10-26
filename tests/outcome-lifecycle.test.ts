import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { completionEvidence, type CompletionProject } from "../src/lib/outcome-completion";
import { getOutcomeLifecycles, saveOutcomeCompletion, reconcileOutcomeCompletions } from "../src/lib/outcome-lifecycle";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import { activateRoadmapPlanning } from "../src/lib/roadmap-store";
import { replaceOutcomeLinks } from "../src/lib/outcome-ownership";
import { getWorkspaceState } from "../src/lib/workspace-state";
import { getBoard } from "../src/lib/board";
import { saveExtraScope } from "../src/lib/scope-store";
import { saveDependency } from "../src/lib/dependency-store";
import { planningToken } from "../src/lib/planning-token";
import { deleteOutcome } from "../src/lib/roadmap-mutations";
import { activateScenario, listScenarios } from "../src/lib/scenarios";
import { HttpError } from "../src/lib/security";

const H = "00000000-0000-4abc-8def-000000000001", S = "00000000-0000-4000-8000-000000000002";
const done = (id: string): CompletionProject => ({ id: `linear:${id}`, name: id.toUpperCase(), status: "completed", openIssueCount: 0, openIssues: [], needsReview: false, crossTeam: false, externalBlockers: [] });
const link = (projectId: string, requirement: "minimum" | "optional" = "minimum") => ({ projectId, requirement });
const edge = (prior: string, next: string, waived = false) => ({ predecessorId: `linear:${prior}`, successorId: `linear:${next}`, waived });
const status = (expected: number, code?: string) => (error: unknown) => error instanceof HttpError && error.status === expected && (!code || error.details?.code === code);

test("completion proof requires actual reconciled full closure while optional work, placement and forecasts are irrelevant", () => {
  const projects = new Map([done("r"), done("p"), done("d"), { ...done("o"), status: "planned", openIssueCount: 1, openIssues: [{ id: "open", stateType: "started", estimate: null }] }].map((item) => [item.id, item]));
  const dependencies = [edge("p", "r"), edge("d", "p")];
  const links = [link("r"), link("o", "optional")]; const original = structuredClone({ projects, links, dependencies });
  let proof = completionEvidence(links, projects, dependencies);
  assert.equal(proof.ready, true); assert.deepEqual(proof.requiredIds, ["linear:d", "linear:p", "linear:r"]);
  assert.deepEqual({ projects, links, dependencies }, original);
  const prior = projects.get("linear:d")!; prior.status = "started";
  proof = completionEvidence(links, projects, dependencies); assert.equal(proof.ready, false); assert.equal(proof.blockers[0].packageId, "linear:d");
  dependencies[1].waived = true; assert.equal(completionEvidence(links, projects, dependencies).ready, true);
  assert.equal(completionEvidence([link("o", "optional")], projects, []).blockers[0].code, "no_required_scope");
});

test("completion proof distinguishes canceled, source discrepancies, missing nodes and required versus unrelated cycles", () => {
  for (const [change, code] of [[{ status: "canceled" }, "unfinished_project"], [{ openIssueCount: 1, openIssues: [{ id: "open", stateType: "started", estimate: null }] }, "open_issues"],
    [{ extraScope: { points: 2, issueIds: [] } }, "remaining_extra_scope"], [{ needsReview: true }, "source_review"], [{ crossTeam: true }, "cross_team"], [{ externalBlockers: ["outside"] }, "external_blockers"]] as const) {
    const item = { ...done("r"), ...structuredClone(change) };
    const proof = completionEvidence([link("r")], new Map([[item.id, item]]), []);
    assert.equal(proof.ready, false); assert.ok(proof.blockers.some((item) => item.code === code));
  }
  const projects = new Map([done("r"), done("p"), done("x"), done("y")].map((item) => [item.id, item]));
  assert.equal(completionEvidence([link("r")], projects, [edge("x", "y"), edge("y", "x")]).ready, true);
  assert.ok(completionEvidence([link("r")], projects, [edge("p", "r"), edge("r", "p")]).blockers.some((item) => item.code === "dependency_cycle"));
  assert.ok(completionEvidence([link("r")], projects, [edge("missing", "r")]).blockers.some((item) => item.code === "missing_project"));
});

test("scope signatures normalize effective edges and ignore names/optional metadata without hiding changes to required roots", () => {
  const projects = new Map([done("r"), done("p")].map((item) => [item.id, item]));
  const a = completionEvidence([link("r"), link("p", "optional")], projects, [edge("p", "r")]);
  projects.get("linear:p")!.name = "Renamed project";
  const b = completionEvidence([link("p", "optional"), link("r")], projects, [edge("p", "r"), edge("p", "r"), edge("ignored", "r", true)]);
  assert.equal(a.scopeSignature, b.scopeSignature); assert.equal(a.evidenceSignature, b.evidenceSignature);
  const changedRoot = completionEvidence([link("r"), link("p")], projects, [edge("p", "r")]);
  assert.notEqual(changedRoot.scopeSignature, b.scopeSignature);
});

async function tx<T>(client: PoolClient, fn: () => Promise<T>) {
  await client.query("BEGIN"); try { const result = await fn(); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}
async function fixture() {
  const pg = new PGlite(); const client = pg as unknown as PoolClient;
  await pg.exec(schemaSql); await pg.query("INSERT INTO workspace(id) VALUES(1)"); await pg.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,1)");
  const source: Parameters<typeof saveImport>[1] = { encryptedKey: "test", viewer: { id: "owner", name: "Owner" }, team: { id: "team", name: "Team" }, projects: ["r", "p", "d", "o"].map((id) => ({ id, name: id.toUpperCase(), teamId: "team", description: "", status: id === "o" ? "started" : "completed",
    blockedBy: id === "r" ? ["p"] : id === "p" ? ["d"] : [], crossTeam: false, url: `https://linear.app/${id}`, updatedAt: new Date("2026-10-20"),
    issues: [{ id: `issue-${id}`, projectId: id, teamId: "team", identifier: id, title: "Work", estimate: 3, stateType: id === "o" ? "started" : "completed", completedAt: id === "o" ? null : new Date("2026-10-20"), updatedAt: new Date("2026-10-20") }] })) };
  await saveImport(client, source, new Date("2026-10-20"));
  await pg.query("INSERT INTO outcome(id,title) VALUES($1,'Outcome')", [H]);
  await replaceOutcomeLinks(client, H, [link("r"), link("o", "optional")]);
  await tx(client, () => activateRoadmapPlanning(client));
  const read = async () => (await getOutcomeLifecycles(client)).get(H)!;
  const submit = async (completed: boolean) => { const current = await read(); return tx(client, () => saveOutcomeCompletion(client, H, { completed, expectedLifecycleVersion: current.lifecycleVersion, eligibilityToken: current.eligibilityToken })); };
  return { pg, client, source, read, submit };
}

test("complete/reopen persist accepted snapshots and audit without changing planning or source and without forecast setup", async () => {
  const f = await fixture();
  try {
    const token = await planningToken(f.client), before = await f.read();
    assert.equal(before.ready, true); assert.equal(before.completedAt, null); assert.equal(before.lifecycleVersion, 0);
    assert.equal((await getBoard(f.client)).forecast.ready, false);
    const completed = await f.submit(true);
    assert.ok(completed.lifecycle.completedAt); assert.equal(completed.lifecycle.lifecycleVersion, 1); assert.equal(completed.lifecycle.completedScopeSignature, before.scopeSignature);
    assert.equal(await planningToken(f.client), token);
    assert.deepEqual((await getWorkspaceState(f.client)).outcomes[0].lifecycle, completed.lifecycle);
    assert.deepEqual((await getBoard(f.client)).outcomes[0].lifecycle, completed.lifecycle);
    await assert.rejects(tx(f.client, () => saveOutcomeCompletion(f.client, H, { completed: true, expectedLifecycleVersion: 0, eligibilityToken: before.eligibilityToken })), status(409, "OUTCOME_EVIDENCE_CONFLICT"));
    await assert.rejects(f.submit(true), status(409, "OUTCOME_ALREADY_COMPLETED"));
    const current = await f.read();
    const reopened = await tx(f.client, () => saveOutcomeCompletion(f.client, H.toUpperCase(), { completed: false, expectedLifecycleVersion: current.lifecycleVersion, eligibilityToken: current.eligibilityToken }));
    assert.equal(reopened.lifecycle.completedAt, null); assert.equal(reopened.lifecycle.lifecycleVersion, 2); assert.equal(reopened.lifecycle.ready, true);
    assert.equal(await planningToken(f.client), token);
    const history = (await f.pg.query<{ action: string; lifecycle_version: number; actor: string; payload: { previousCompletedAt: string | null } }>("SELECT action,lifecycle_version,actor,payload FROM outcome_lifecycle_event ORDER BY lifecycle_version")).rows;
    assert.deepEqual(history.map((item) => [item.action, item.lifecycle_version, item.actor]), [["complete", 1, "Owner"], ["reopen", 2, "Owner"]]);
    assert.equal(history[1].payload.previousCompletedAt, completed.lifecycle.completedAt);
    await assert.rejects(f.submit(false), status(409, "OUTCOME_ALREADY_OPEN"));
  } finally { await f.pg.close(); }
});

test("API-shaped validation rejects unsupported saves, invalid versions, unknown outcomes and not-ready proof", async () => {
  const f = await fixture();
  try {
    const proof = await f.read();
    for (const body of [null, [], { completed: "yes", expectedLifecycleVersion: 0 }, { completed: true, expectedLifecycleVersion: "0" }, { completed: true, expectedLifecycleVersion: -1 },
      { completed: true, expectedLifecycleVersion: 0, eligibilityToken: proof.eligibilityToken, title: "Implicit metadata save" }]) await assert.rejects(tx(f.client, () => saveOutcomeCompletion(f.client, H, body)), status(400));
    await assert.rejects(tx(f.client, () => saveOutcomeCompletion(f.client, "bad", {})), status(400));
    await assert.rejects(tx(f.client, () => saveOutcomeCompletion(f.client, S, { completed: true, expectedLifecycleVersion: 0, eligibilityToken: proof.eligibilityToken })), status(404));
    await assert.rejects(tx(f.client, () => saveOutcomeCompletion(f.client, H, { completed: true, expectedLifecycleVersion: 0 })), status(409));
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [link("o", "optional")]));
    assert.equal((await f.read()).ready, false); await assert.rejects(f.submit(true), status(422, "OUTCOME_NOT_READY"));
    await f.pg.query(`INSERT INTO linear_project_cache(linear_id,team_id,name,status,url,source_updated_at,last_seen_at,last_seen_import_id)
      SELECT 'ghost',team_id,'Unavailable package','completed',url,source_updated_at,last_seen_at,last_seen_import_id FROM linear_project_cache LIMIT 1`);
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [link("ghost")]));
    assert.ok((await f.read()).blockers.some((item) => item.code === "missing_project")); await assert.rejects(f.submit(true), status(422));
    assert.equal((await f.pg.query("SELECT * FROM outcome_lifecycle_event")).rows.length, 0);
  } finally { await f.pg.close(); }
});

test("source changes reject stale evidence and latch review once without auto-reopening or losing the original time", async () => {
  const f = await fixture();
  try {
    const initiallyReady = await f.read();
    f.source.projects.find((item) => item.id === "d")!.issues[0].stateType = "started";
    f.source.projects.find((item) => item.id === "d")!.issues[0].estimate = null;
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-21")));
    await assert.rejects(tx(f.client, () => saveOutcomeCompletion(f.client, H, { completed: true, expectedLifecycleVersion: 0, eligibilityToken: initiallyReady.eligibilityToken })), status(409, "OUTCOME_EVIDENCE_CONFLICT"));
    await assert.rejects(f.submit(true), status(422));
    f.source.projects.find((item) => item.id === "d")!.issues[0].stateType = "completed";
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-22")));
    const completed = await f.submit(true);
    f.source.projects.find((item) => item.id === "r")!.issues[0].stateType = "started";
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-23")));
    let state = await f.read(); assert.equal(state.reviewNeeded, true); assert.equal(state.lifecycleVersion, 2); assert.equal(state.completedAt, completed.lifecycle.completedAt); assert.equal(state.ready, false);
    f.source.projects.find((item) => item.id === "r")!.issues[0].stateType = "completed";
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-24")));
    state = await f.read(); assert.equal(state.ready, true); assert.equal(state.reviewNeeded, true); assert.equal(state.lifecycleVersion, 2);
    assert.match(state.reviewReasons.join(" "), /open issue/);
    const events = (await f.pg.query<{ action: string; actor: string }>("SELECT action,actor FROM outcome_lifecycle_event ORDER BY lifecycle_version")).rows;
    assert.deepEqual(events, [{ action: "complete", actor: "Owner" }, { action: "review", actor: "Linear sync" }]);
    await assert.rejects(f.submit(true), status(409, "OUTCOME_ALREADY_COMPLETED"));
    await f.submit(false); const again = await f.submit(true); assert.equal(again.lifecycle.lifecycleVersion, 4); assert.equal(again.lifecycle.reviewNeeded, false);
  } finally { await f.pg.close(); }
});

test("required link and effective graph changes latch review but optional metadata, duplicate edges and unrelated imports do not", async () => {
  const f = await fixture();
  try {
    const completed = await f.submit(true);
    f.source.projects.find((item) => item.id === "r")!.name = "Renamed root";
    f.source.projects.find((item) => item.id === "o")!.issues[0].estimate = 5;
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-21")));
    await f.pg.query("UPDATE outcome SET description='Notes',owner='New owner',needed_by='2027-01-01' WHERE id=$1", [H]);
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [link("r")]));
    assert.equal((await f.read()).eligibilityToken, completed.lifecycle.eligibilityToken);
    let board = await getBoard(f.client);
    await tx(f.client, () => saveDependency(f.client, { action: "add", predecessorId: "linear:p", successorId: "linear:r", sequenceToken: board.sequenceToken }));
    assert.equal((await f.read()).reviewNeeded, false); // The same effective edge already exists in Linear.
    board = await getBoard(f.client);
    await tx(f.client, () => saveDependency(f.client, { action: "waive", predecessorId: "linear:p", successorId: "linear:r", reason: "Local equivalent", sequenceToken: board.sequenceToken }));
    assert.equal((await f.read()).reviewNeeded, false);
    board = await getBoard(f.client);
    await tx(f.client, () => saveDependency(f.client, { action: "remove", predecessorId: "linear:p", successorId: "linear:r", sequenceToken: board.sequenceToken }));
    const changed = await f.read(); assert.equal(changed.reviewNeeded, true); assert.match(changed.reviewReasons.join(" "), /scope changed/); assert.equal(changed.completedAt, completed.lifecycle.completedAt);
    await f.submit(false); await f.submit(true);
    board = await getBoard(f.client);
    await tx(f.client, () => saveDependency(f.client, { action: "restore", predecessorId: "linear:p", successorId: "linear:r", sequenceToken: board.sequenceToken }));
    assert.equal((await f.read()).reviewNeeded, true);
    await f.submit(false); await f.submit(true);
    const result = await tx(f.client, () => replaceOutcomeLinks(f.client, H, [link("r"), link("d")]));
    assert.equal(result.lifecycle!.reviewNeeded, true); assert.equal(result.lifecycle!.ready, true); // All complete, but explicit required roots changed.
  } finally { await f.pg.close(); }
});

test("source missing/reconciliation and cycles withhold completion even when project statuses are completed", async () => {
  const f = await fixture();
  try {
    f.source.projects.find((item) => item.id === "d")!.blockedBy = ["r"];
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-21")));
    assert.ok((await f.read()).blockers.some((item) => item.code === "dependency_cycle")); await assert.rejects(f.submit(true), status(422));
    f.source.projects.find((item) => item.id === "d")!.blockedBy = [];
    await tx(f.client, () => saveImport(f.client, f.source, new Date("2026-10-22")));
    await f.submit(true);
    const withoutDeep = { ...f.source, projects: f.source.projects.filter((item) => item.id !== "d") };
    await tx(f.client, () => saveImport(f.client, withoutDeep, new Date("2026-10-23")));
    // Missing source is retained for review rather than silently treated complete.
    const state = await f.read(); assert.equal(state.reviewNeeded, true); assert.ok(state.blockers.some((item) => item.code === "source_review" || item.code === "external_blockers"));
  } finally { await f.pg.close(); }
});

test("completion and relevant-write audit failures roll back business markers, history and scope together", async () => {
  const f = await fixture();
  try {
    await f.pg.exec(`CREATE FUNCTION reject_completion_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Audit unavailable'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_completion_audit BEFORE INSERT ON outcome_lifecycle_event FOR EACH ROW EXECUTE FUNCTION reject_completion_audit()`);
    await assert.rejects(f.submit(true), /Audit unavailable/); assert.equal((await f.read()).lifecycleVersion, 0); assert.equal((await f.pg.query("SELECT * FROM outcome_lifecycle")).rows.length, 0);
    await f.pg.exec("DROP TRIGGER fail_completion_audit ON outcome_lifecycle_event"); await f.submit(true);
    await f.pg.exec("CREATE TRIGGER fail_completion_audit BEFORE INSERT ON outcome_lifecycle_event FOR EACH ROW EXECUTE FUNCTION reject_completion_audit()");
    const deletionToken = await planningToken(f.client);
    await assert.rejects(tx(f.client, () => deleteOutcome(f.client, H, deletionToken)), /Audit unavailable/);
    assert.equal((await getWorkspaceState(f.client)).outcomes.length, 1); assert.equal((await f.read()).reviewNeeded, false);
    await assert.rejects(tx(f.client, () => saveExtraScope(f.client, { packageId: "linear:r", points: 2 })), /Audit unavailable/);
    assert.equal((await f.read()).reviewNeeded, false); assert.equal((await f.pg.query("SELECT * FROM package_extra_scope")).rows.length, 0);
    await f.pg.exec("DROP TRIGGER fail_completion_audit ON outcome_lifecycle_event");
    await tx(f.client, () => saveExtraScope(f.client, { packageId: "linear:r", points: 2 })); assert.equal((await f.read()).reviewNeeded, true);
    await tx(f.client, () => saveExtraScope(f.client, { packageId: "linear:r", points: 0 })); assert.equal((await f.read()).ready, true); assert.equal((await f.read()).reviewNeeded, true);
    assert.equal((await f.read()).lifecycleVersion, 2);
  } finally { await f.pg.close(); }
});

test("serialized source updates invalidate displayed proof before a competing completion can commit", async () => {
  const f = await fixture();
  try {
    const before = await f.read();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; }), gate = new Promise<void>((resolve) => { release = resolve; });
    const source = f.pg.transaction(async (transaction) => {
      const client = transaction as unknown as PoolClient;
      await client.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE"); await client.query("UPDATE linear_project_cache SET status='started' WHERE linear_id='r'"); await reconcileOutcomeCompletions(client, "Linear sync"); entered(); await gate;
    });
    await started;
    const attempt = f.pg.transaction((transaction) => saveOutcomeCompletion(transaction as unknown as PoolClient, H, { completed: true, expectedLifecycleVersion: 0, eligibilityToken: before.eligibilityToken }));
    release(); await source; await assert.rejects(attempt, status(409)); assert.equal((await f.read()).completedAt, null);
  } finally { await f.pg.close(); }
});

test("scenario restore/deletion retain business history and lifecycle-only actions do not dirty scheduling inputs", async () => {
  const f = await fixture();
  try {
    const board = await getBoard(f.client);
    await f.pg.query("INSERT INTO scenario(id,workspace_id,name,draft_source_at,draft_source_snapshot,draft_snapshot) VALUES($1,1,'Snapshot','2026-10-20','{}',$2::jsonb)", [S, JSON.stringify(board)]);
    await f.pg.query("INSERT INTO workspace_scenario_state(workspace_id,active_scenario_id) VALUES(1,$1)", [S]);
    assert.equal((await listScenarios(f.client)).activeDraftDirty, false);
    const completed = await f.submit(true); assert.equal((await listScenarios(f.client)).activeDraftDirty, false);
    await tx(f.client, () => replaceOutcomeLinks(f.client, H, [link("r"), link("d")]));
    await tx(f.client, () => activateScenario(S, { expectedVersion: 1, confirmReplace: true }, f.client));
    assert.equal((await f.read()).completedAt, completed.lifecycle.completedAt); assert.equal((await f.read()).reviewNeeded, true);
    await f.pg.query("DELETE FROM outcome WHERE id=$1", [H]); assert.equal((await getOutcomeLifecycles(f.client)).has(H), false); assert.equal((await getWorkspaceState(f.client)).outcomes.length, 0);
    assert.equal((await f.pg.query("SELECT * FROM outcome_lifecycle")).rows.length, 1);
    await tx(f.client, () => activateScenario(S, { expectedVersion: 1, confirmReplace: true }, f.client));
    assert.equal((await f.read()).completedAt, completed.lifecycle.completedAt); assert.equal((await f.read()).reviewNeeded, true);
    assert.deepEqual((await f.pg.query<{ draft_snapshot: typeof board }>("SELECT draft_snapshot FROM scenario")).rows[0].draft_snapshot.outcomes[0].lifecycle.completedAt, null);
  } finally { await f.pg.close(); }
});
