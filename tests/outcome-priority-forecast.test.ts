import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { forecast, type ForecastInput, type ForecastOutcome, type ForecastPackage } from "../src/lib/forecast";
import { effectivePredecessors, effectiveRequiredClosure, isActuallyComplete } from "../src/lib/delivery-scope";
import { schemaSql } from "../src/lib/db";
import { saveImport } from "../src/lib/import";
import { activateRoadmapPlanning } from "../src/lib/roadmap-store";
import { getBoard } from "../src/lib/board";
import { assignOutcomeToStream } from "../src/lib/outcome-ownership";
import { changeRoadmapMembership } from "../src/lib/roadmap-mutations";

const project = (id: string, ownerOutcomeId: string, known = 5, streamId = "core", sequence = 1): ForecastPackage => ({ id: `linear:${id}`, projectId: id, name: id.toUpperCase(),
  ownerOutcomeId, roadmapState: "included", selected: true, sequence, streamId, status: "planned", known, openIssueCount: 1,
  unknownIssueIds: [], crossTeam: false, needsReview: false });
const outcome = (id: string, rank: number, projects: string[], optional: string[] = [], streamId = "core"): ForecastOutcome => ({ id, title: id.toUpperCase(), rank, streamId, neededBy: null,
  links: [...projects.map((projectId) => ({ projectId, requirement: "minimum" as const })), ...optional.map((projectId) => ({ projectId, requirement: "optional" as const }))] });
const base = (packages: ForecastPackage[], outcomes: ForecastOutcome[]): ForecastInput => ({ schedulingMode: "outcome", packages, outcomes,
  streams: [{ id: "core", name: "Core", allocation: 1, wip: 2 }], baseline: 10, reserve: 0, dependencies: [], horizon: 8, timezone: "UTC", sourceAt: "2026-10-20T00:00:00Z",
  linearCycles: Array.from({ length: 8 }, (_, index) => ({ id: `cycle-${index}`, number: index + 1, name: null, startsAt: new Date(Date.UTC(2026, 10, 1 + index * 7)).toISOString(), endsAt: new Date(Date.UTC(2026, 10, 8 + index * 7)).toISOString() })) });
const edge = (prior: string, next: string, waived = false) => ({ predecessorId: `linear:${prior}`, successorId: `linear:${next}`, source: "linear" as const, waived });
const span = (result: ReturnType<typeof forecast>, id: string) => { const item = result.packages.find((item) => item.id === `linear:${id}`)!; return [item.start, item.finish]; };

test("v5 worked example skips blocked High without donating its rank: C, A, then B", () => {
  const input = base([project("b", "high"), project("c", "middle", 5, "core", 99), project("a", "low")], [outcome("high", 1, ["b"]), outcome("middle", 2, ["c"]), outcome("low", 3, ["a"])]);
  input.dependencies = [edge("a", "b")];
  const before = structuredClone(input);
  let result = forecast(input);
  assert.deepEqual(result.cycles.map((cycle) => cycle.streams[0].active), [["linear:c"], ["linear:a"], ["linear:b"]]);
  assert.deepEqual(span(result, "b"), [3, 3]);
  const high = result.outcomes.find((item) => item.id === "high")!;
  assert.deepEqual(high.requiredIds, ["linear:a", "linear:b"]);
  assert.deepEqual(high.waiting, [{ prerequisiteId: "linear:a", prerequisiteName: "A", ownerOutcomeId: "low", ownerOutcomeTitle: "LOW", streamId: "core", streamName: "Core", roadmapState: "included",
    successorIds: ["linear:b"], requiredForDelivery: true, firstCycle: 1, lastCycle: 2, forecastFinish: 2, reason: null, action: "inspect" }]);
  assert.deepEqual(high.priorityBypass, [
    { cycle: 1, selectedPackageId: "linear:c", selectedOutcomeId: "middle", blockedPackageIds: ["linear:b"], prerequisiteIds: ["linear:a"] },
    { cycle: 2, selectedPackageId: "linear:a", selectedOutcomeId: "low", blockedPackageIds: ["linear:b"], prerequisiteIds: ["linear:a"] },
  ]);
  assert.deepEqual(input, before);
  input.outcomes.find((item) => item.id === "low")!.rank = 2; input.outcomes.find((item) => item.id === "middle")!.rank = 3;
  result = forecast(input);
  assert.deepEqual(result.cycles.map((cycle) => cycle.streams[0].active), [["linear:a"], ["linear:b"], ["linear:c"]]);
});

test("required tier outranks earlier optional-only work; optional sharing alone does not promote demand", () => {
  const input = base([project("a", "high"), project("b", "low"), project("c", "last")], [outcome("high", 1, [], ["a"]), outcome("low", 2, ["b"], ["c"]), outcome("last", 3, [], ["c"])]);
  let result = forecast(input);
  assert.deepEqual(result.cycles.map((cycle) => cycle.streams[0].active), [["linear:b"], ["linear:a"], ["linear:c"]]);
  assert.equal(result.outcomes[0].status, "unplanned"); assert.equal(result.outcomes[0].finish, null);
  assert.deepEqual(result.outcomes[1].requiredIds, ["linear:b"]);
  assert.deepEqual(result.outcomes[0].priorityBypass, []);
  input.dependencies = [edge("c", "b")];
  result = forecast(input);
  assert.deepEqual(result.cycles.map((cycle) => cycle.streams[0].active), [["linear:c"], ["linear:b"], ["linear:a"]]);
  assert.deepEqual(result.outcomes[1].requiredIds, ["linear:b", "linear:c"]);
});

test("started optional work carries without preemption when required work becomes eligible", () => {
  const input = base([project("b", "high"), project("optional", "high", 25, "core", 2), project("x", "other", 5, "other")], [outcome("high", 1, ["b"], ["optional"]), outcome("other", 1, [], ["x"], "other")]);
  input.streams = [{ id: "core", name: "Core", allocation: 0.5, wip: 2 }, { id: "other", name: "Other", allocation: 0.5, wip: 1 }]; input.baseline = 20;
  input.dependencies = [edge("x", "b")];
  const result = forecast(input);
  assert.deepEqual(result.packages.find((item) => item.id === "linear:optional")!.consumed, [10, 10, 5]);
  assert.deepEqual(span(result, "x"), [1, 1]); assert.deepEqual(span(result, "b"), [4, 4]);
  assert.ok(result.cycles.every((cycle) => cycle.streams.every((stream) => stream.active.length <= 1)));
  assert.deepEqual(result.outcomes[0].priorityBypass, []);
});

test("cross-stream prerequisite waits retain one shared forecast and next-cycle unlocking", () => {
  const input = base([project("b", "high"), project("c", "low"), project("a", "other", 15, "other")], [outcome("high", 1, ["b"], ["a"]), outcome("low", 2, ["c"]), outcome("other", 1, ["a"], [], "other")]);
  input.baseline = 20; input.streams = [{ id: "core", name: "Core", allocation: 0.5, wip: 2 }, { id: "other", name: "Other", allocation: 0.5, wip: 1 }]; input.dependencies = [edge("a", "b")];
  const result = forecast(input);
  assert.deepEqual(span(result, "c"), [1, 1]); assert.deepEqual(span(result, "a"), [1, 2]); assert.deepEqual(span(result, "b"), [3, 3]);
  assert.equal(result.selectedKnown, 25);
  assert.equal(result.outcomes[0].waiting![0].streamId, "other");
  assert.deepEqual(result.outcomes[0].priorityBypass!.map((item) => item.selectedPackageId), ["linear:c"]);
  assert.equal(result.cycles[0].streams.reduce((sum, stream) => sum + stream.used, 0), 15);
});

test("excluded unfinished prerequisites withhold dates and totals but actually complete excluded work unlocks them", () => {
  for (const membership of ["candidate", "dismissed", "deferred"] as const) {
    const prior = { ...project("a", "low", 5), roadmapState: membership, selected: false, streamId: null, ownerOutcomeId: null, unknownIssueIds: ["unknown"] };
    const input = base([prior, project("b", "high")], [outcome("high", 1, ["b"])]); input.dependencies = [edge("a", "b")];
    let result = forecast(input);
    assert.deepEqual(span(result, "b"), [null, null]); assert.equal(result.selectedKnown, 5); assert.equal(result.selectedUnknown, 0);
    assert.equal(result.outcomes[0].status, "blocked"); assert.equal(result.outcomes[0].waiting![0].roadmapState, membership);
    assert.equal(result.outcomes[0].waiting![0].action, membership === "deferred" ? "resume" : "include_on_roadmap");
    assert.deepEqual(result.outcomes[0].priorityBypass, []);
    prior.status = "completed"; prior.openIssueCount = 0; prior.unknownIssueIds = []; prior.known = 0;
    result = forecast(input);
    assert.deepEqual(span(result, "a"), [null, 0]); assert.deepEqual(span(result, "b"), [1, 1]); assert.deepEqual(result.outcomes[0].waiting, []);
  }
});

test("v5 membership and valid ownership govern demand, never stale selected flags or ownerless queues", () => {
  const excluded = { ...project("a", "high"), roadmapState: "dismissed" as const, selected: true };
  const invalid = { ...project("b", "missing"), selected: true };
  const mismatch = project("c", "other");
  const input = base([excluded, invalid, mismatch], [outcome("high", 1, ["a"]), outcome("other", 1, ["c"], [], "other")]);
  const result = forecast(input);
  assert.equal(result.selectedKnown, 0); assert.equal(result.packages.every((item) => item.start === null && item.finish === null), true);
  assert.match(result.packages[1].reason!, /owning outcome/); assert.match(result.packages[2].reason!, /same active stream/);
});

test("source order conflicts withhold one owner's work while other owners in the same stream run", () => {
  const input = base([project("a", "high", 5, "core", 2), project("b", "high", 5, "core", 1), project("c", "low")], [outcome("high", 1, ["b"], ["a"]), outcome("low", 2, ["c"])]);
  input.dependencies = [edge("a", "b")];
  const result = forecast(input);
  assert.deepEqual(span(result, "a"), [null, null]); assert.deepEqual(span(result, "b"), [null, null]); assert.deepEqual(span(result, "c"), [1, 1]);
  assert.match(result.packages[0].reason!, /owning outcome project order/);
  assert.deepEqual(result.outcomes[0].priorityBypass, []); // Withheld scope is not an otherwise-eligible candidate.
});

test("required closure includes deep and missing prerequisites, ignores waivers and remains distinct from optional context", () => {
  const input = base([project("a", "middle"), project("b", "high"), project("c", "low")], [outcome("high", 1, ["b"]), outcome("middle", 2, [], ["a"]), outcome("low", 3, [], ["c"])]);
  input.dependencies = [edge("a", "b"), edge("c", "a"), edge("missing", "c")];
  let result = forecast(input);
  assert.deepEqual(result.outcomes[0].requiredIds, ["linear:a", "linear:b", "linear:c", "linear:missing"]);
  assert.equal(result.outcomes[0].waiting!.find((item) => item.prerequisiteId === "linear:missing")!.action, "review_source");
  assert.equal(result.outcomes[0].waiting!.every((item) => item.requiredForDelivery), true);
  assert.equal(result.outcomes[1].waiting!.every((item) => !item.requiredForDelivery), true);
  input.dependencies[1].waived = true;
  result = forecast(input);
  assert.deepEqual(result.outcomes[0].requiredIds, ["linear:a", "linear:b"]); assert.deepEqual(span(result, "b"), [2, 2]);
});

test("uncovered estimates, missing setup and dependency cycles do not invent waits, bypasses or dates", () => {
  const unknown = { ...project("a", "high"), unknownIssueIds: ["unknown"] };
  const input = base([unknown, project("b", "low")], [outcome("high", 1, ["a"]), outcome("low", 2, ["b"])]);
  let result = forecast(input);
  assert.deepEqual(span(result, "b"), [1, 1]); assert.match(result.packages[0].reason!, /no estimate/); assert.deepEqual(result.outcomes[0].priorityBypass, []); assert.deepEqual(result.outcomes[0].waiting, []);
  input.dependencies = [edge("b", "a")]; input.baseline = null;
  result = forecast(input); assert.equal(result.cycles.length, 0); assert.equal(result.outcomes[0].waiting![0].firstCycle, null); assert.deepEqual(result.outcomes[0].priorityBypass, []);
  input.baseline = 10; input.dependencies.push(edge("a", "b"));
  result = forecast(input); assert.equal(result.ready, false); assert.match(result.errors[0], /Dependency cycle/); assert.equal(result.cycles.length, 0);
});

test("duplicate source/local edges share one wait and a Linear waiver does not remove a local constraint", () => {
  const input = base([{ ...project("a", "low"), roadmapState: "candidate", selected: false, ownerOutcomeId: null, streamId: null }, project("b", "high")], [outcome("high", 1, ["b"])]);
  input.dependencies = [edge("a", "b"), { ...edge("a", "b"), source: "local" }];
  let result = forecast(input);
  assert.equal(result.outcomes[0].waiting!.length, 1); assert.equal(result.packages.find((item) => item.id === "linear:b")!.reason, "Waiting for A.");
  input.dependencies[0].waived = true; result = forecast(input); assert.equal(result.outcomes[0].finish, null);
  input.dependencies.pop(); result = forecast(input); assert.deepEqual(span(result, "b"), [1, 1]); assert.deepEqual(result.outcomes[0].waiting, []);
});

test("v5 preserves rounding, reserves and no borrowing; zero budget does not falsely start positive work", () => {
  const input = base([project("a", "high", 5), project("b", "low", 5, "other")], [outcome("high", 1, ["a"]), outcome("low", 1, ["b"], [], "other")]);
  input.baseline = 0.001; input.streams = [{ id: "core", name: "Core", allocation: 0.5, wip: 2 }, { id: "other", name: "Other", allocation: 0.5, wip: 2 }]; input.horizon = 1;
  let result = forecast(input); assert.equal(result.cycles[0].available, 0.001); assert.equal(result.cycles[0].streams.reduce((sum, item) => sum + item.budget, 0), 0);
  assert.deepEqual(span(result, "a"), [null, null]); assert.deepEqual(span(result, "b"), [null, null]);
  input.baseline = 20; input.reserve = 2; input.horizon = 2; input.adjustments = [{ cycleId: "cycle-0", availability: 0.5, reserve: 1 }];
  result = forecast(input); assert.equal(result.cycles[0].available, 9);
  for (const cycle of result.cycles) { assert.ok(cycle.streams.reduce((sum, item) => sum + item.budget, 0) <= cycle.available); assert.ok(cycle.streams.every((item) => item.used <= item.budget && item.active.length <= 1)); }
});

test("zero demand waits for its predecessor, and projected provenance stays separate from outcome priority", () => {
  const input = base([project("a", "high"), project("b", "low", 0)], [outcome("high", 1, ["a"]), outcome("low", 2, ["b"])]);
  input.dependencies = [edge("a", "b")]; input.linearCycles[1].projected = true;
  const result = forecast(input); assert.deepEqual(span(result, "b"), [2, 2]); assert.equal(result.outcomes[1].calendarProjected, true); assert.equal(result.outcomes[1].status, "provisional");
});

test("zero-budget zero-demand selection does not falsely attribute bypass of positive work to a dependency", () => {
  const prior = { ...project("prior", "missing"), roadmapState: "candidate" as const, selected: false, streamId: null, ownerOutcomeId: null };
  const input = base([prior, project("a", "high"), project("zero", "low", 0)], [outcome("high", 1, ["a"]), outcome("low", 2, ["zero"])]);
  input.baseline = 0; input.horizon = 1; input.dependencies = [edge("prior", "a")];
  const result = forecast(input);
  assert.deepEqual(span(result, "zero"), [1, 1]); assert.deepEqual(span(result, "a"), [null, null]);
  assert.equal(result.outcomes[0].waiting!.length, 1); assert.deepEqual(result.outcomes[0].priorityBypass, []);
});

test("stable IDs break ties without mutating input order or applying source priority and lifecycle markers", () => {
  const input = base([project("z", "high", 5, "core", 1), project("a", "high", 5, "core", 1)], [outcome("high", 1, ["a", "z"])]);
  Object.assign(input.packages[0], { linearPriority: 0, completedAt: "2026-01-01" }); Object.assign(input.outcomes[0], { completedAt: "2026-01-01" });
  const before = structuredClone(input); const result = forecast(input);
  assert.deepEqual(result.cycles.map((cycle) => cycle.streams[0].active), [["linear:a"], ["linear:z"]]); assert.deepEqual(input, before);
  input.packages.reverse(); input.outcomes[0].links.reverse();
  assert.deepEqual(forecast(input).cycles, result.cycles);
});

test("shared actual-completion evidence and cycle-safe closure do not depend on forecasts", () => {
  const done = { ...project("a", "high", 0), status: "completed", openIssueCount: 0 };
  assert.equal(isActuallyComplete(done), true);
  for (const extra of [{ status: "canceled" }, { openIssueCount: 1 }, { extraScope: { points: 1 } }, { needsReview: true }, { crossTeam: true }, { externalBlockers: ["outside"] }]) assert.equal(isActuallyComplete({ ...done, ...extra }), false);
  const edges = [edge("a", "b"), edge("b", "a"), edge("missing", "a"), edge("ignored", "a", true)];
  const before = structuredClone(edges);
  assert.deepEqual([...effectiveRequiredClosure(["linear:b"], effectivePredecessors(edges))], ["linear:a", "linear:b", "linear:missing"]); assert.deepEqual(edges, before);
});

async function boardFixture() {
  const pg = new PGlite(); const client = pg as unknown as PoolClient;
  await pg.exec(schemaSql); await pg.query("INSERT INTO workspace(id) VALUES(1)"); await pg.query("INSERT INTO stream(id,name,position,allocation) VALUES('core','Core',1,1)");
  await saveImport(client, { encryptedKey: "test", viewer: { id: "owner", name: "Owner" }, team: { id: "team", name: "Team" },
    projects: ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), teamId: "team", description: "", status: "planned", url: `https://linear.app/${id}`, updatedAt: new Date("2026-10-20"), crossTeam: false, blockedBy: id === "b" ? ["a"] : [],
      issues: [{ id: `issue-${id}`, projectId: id, teamId: "team", identifier: id, title: "Work", estimate: 5, stateType: "started", completedAt: null, updatedAt: new Date("2026-10-20") }] })),
    cycles: base([], []).linearCycles.map((cycle) => ({ ...cycle, teamId: "team", startsAt: new Date(cycle.startsAt), endsAt: new Date(cycle.endsAt), completedAt: null, cycleDays: 7, completedPoints: null })),
    cycleSettings: { timezone: "UTC", cyclesEnabled: true, cycleDuration: 1, cycleStartDay: 0, cycleCooldownTime: 0, upcomingCycleCount: 8 } }, new Date("2026-10-20"));
  const high = "00000000-0000-4000-8000-000000000001", middle = "00000000-0000-4000-8000-000000000002", low = "00000000-0000-4000-8000-000000000003";
  for (const [id, projectId, date, title] of [[high, "b", "2026-10-24", "High"], [middle, "c", "2026-10-23", "Middle"], [low, "a", "2026-10-22", "Low"]]) {
    await pg.query("INSERT INTO outcome(id,title,stream_id,created_at) VALUES($1,$3,'core',$2)", [id, date, title]); await pg.query("INSERT INTO outcome_project_link(outcome_id,project_id) VALUES($1,$2)", [id, projectId]);
    await pg.query("UPDATE work_package SET stream_id='core',capacity_outcome_id=$2,sequence_position=1 WHERE project_id=$1", [projectId, id]);
  }
  await pg.query("INSERT INTO capacity_profile(workspace_id,baseline,baseline_reason,holidays_enabled) VALUES(1,10,'Test',false)");
  await pg.query("BEGIN"); await activateRoadmapPlanning(client); await pg.query("COMMIT");
  return { pg, client, high, middle, low };
}

test("activated Board reads persistently feed outcome ranks and shared prerequisite context to v5 scheduling", async () => {
  const f = await boardFixture();
  try {
    let board = await getBoard(f.client); assert.equal(board.calculationVersion, "v5");
    assert.deepEqual(board.forecast.cycles.map((cycle) => cycle.streams[0].active), [["linear:c"], ["linear:a"], ["linear:b"]]);
    assert.equal(board.forecast.outcomes.find((item) => item.id === f.high)!.waiting![0].ownerOutcomeId, f.low);
    await f.pg.query("BEGIN"); await assignOutcomeToStream(f.client, { outcomeId: f.low, streamId: "core", beforeOutcomeId: f.middle, sequenceToken: board.sequenceToken, ownershipToken: board.ownershipToken }); await f.pg.query("COMMIT");
    board = await getBoard(f.client); assert.deepEqual(board.forecast.cycles.map((cycle) => cycle.streams[0].active), [["linear:a"], ["linear:b"], ["linear:c"]]);
    assert.deepEqual((await getBoard(f.client)).forecast, board.forecast);
  } finally { await f.pg.close(); }
});

test("activated Board excludes dismissed prerequisites, then uses actual completed source evidence to unlock delivery", async () => {
  const f = await boardFixture();
  try {
    let board = await getBoard(f.client);
    await f.pg.query("BEGIN"); await changeRoadmapMembership(f.client, { packageId: "linear:a", action: "dismiss", sequenceToken: board.sequenceToken, planningToken: board.planningToken }); await f.pg.query("COMMIT");
    board = await getBoard(f.client); const high = board.forecast.outcomes.find((item) => item.id === f.high)!;
    assert.equal(high.finish, null); assert.equal(high.waiting![0].roadmapState, "dismissed"); assert.equal(high.waiting![0].action, "include_on_roadmap"); assert.equal(board.forecast.selectedKnown, 10);
    await f.pg.query("UPDATE linear_project_cache SET status='completed' WHERE linear_id='a'"); await f.pg.query("UPDATE linear_issue_cache SET state_type='completed' WHERE project_id='a'");
    board = await getBoard(f.client); assert.deepEqual(span(board.forecast, "b"), [1, 1]); assert.deepEqual(board.forecast.outcomes.find((item) => item.id === f.high)!.waiting, []);
  } finally { await f.pg.close(); }
});

test("Board source-conflict mapping withholds only its owner and agrees with actual-completion reconciliation", async () => {
  const f = await boardFixture();
  try {
    await f.pg.query("DELETE FROM package_dependency WHERE predecessor_id='linear:a' AND successor_id='linear:b'");
    await f.pg.query("INSERT INTO outcome_project_link(outcome_id,project_id,requirement) VALUES($1,'a','optional')", [f.high]);
    await f.pg.query("UPDATE work_package SET capacity_outcome_id=$1,sequence_position=2 WHERE project_id='a'", [f.high]);
    // A newly imported edge contradicts the saved within-owner B, A preference.
    await f.pg.query("INSERT INTO package_dependency(predecessor_id,successor_id,source) VALUES('linear:a','linear:b','linear')");
    let board = await getBoard(f.client);
    assert.deepEqual(span(board.forecast, "a"), [null, null]); assert.deepEqual(span(board.forecast, "b"), [null, null]); assert.deepEqual(span(board.forecast, "c"), [1, 1]);
    assert.equal(board.sequenceConflicts[0].ownerId, f.high);
    await f.pg.query("UPDATE linear_project_cache SET status='completed' WHERE linear_id='a'"); await f.pg.query("UPDATE linear_issue_cache SET state_type='completed' WHERE project_id='a'");
    board = await getBoard(f.client); assert.deepEqual(board.sequenceConflicts, []); assert.deepEqual(span(board.forecast, "b"), [1, 1]);
    await f.pg.query("UPDATE linear_project_cache SET needs_review=true WHERE linear_id='a'");
    board = await getBoard(f.client); assert.equal(board.sequenceConflicts.length, 1); assert.deepEqual(span(board.forecast, "b"), [null, null]); assert.deepEqual(span(board.forecast, "c"), [1, 1]);
  } finally { await f.pg.close(); }
});
