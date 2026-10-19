import assert from "node:assert/strict";
import { test } from "node:test";
import { forecast, historicalBaseline, type ForecastInput, type ForecastPackage } from "../src/lib/forecast";

const pkg = (id: string, streamId: string | null, known: number): ForecastPackage => ({
  id, projectId: id, name: id, status: "planned", streamId, selected: true,
  priority: 1, earliest: null, preferred: null, known, openIssueCount: 1,
  unknownIssueIds: [], crossTeam: false, needsReview: false,
});
const base = (packages: ForecastPackage[]): ForecastInput => ({
  packages, streams: [{ id: "stream-a", name: "A", allocation: 0.6, wip: 2 }, { id: "stream-b", name: "B", allocation: 0.4, wip: 1 }],
  dependencies: [], outcomes: [], baseline: 12, reserve: 2,
  linearCycles: Array.from({ length: 8 }, (_, index) => ({ id: `cycle-${45 + index}`, number: 45 + index, name: null,
    startsAt: new Date(Date.UTC(2026, 9, 19 + 7 * index)).toISOString(),
    endsAt: new Date(Date.UTC(2026, 9, 26 + 7 * index)).toISOString() })),
  horizon: 8, sourceAt: "2026-10-15T14:00:00Z", timezone: "UTC",
});

test("contract example: equal WIP split, redistribution, dependency unlock next cycle", () => {
  const input = base([pkg("a1", "stream-a", 8), pkg("a2", "stream-a", 4), pkg("b1", "stream-b", 4)]);
  input.dependencies = [{ predecessorId: "a1", successorId: "b1", source: "local" }];
  input.outcomes = [{ id: "outcome", title: "Launch", neededBy: "2026-11-08", links: [{ projectId: "a1", requirement: "minimum" }, { projectId: "b1", requirement: "minimum" }] }];
  // Package IDs in the app are linear:<project ID>.
  input.packages.forEach((item) => { item.projectId = item.id; item.id = `linear:${item.id}`; });
  input.dependencies = [{ predecessorId: "linear:a1", successorId: "linear:b1", source: "local" }];
  const result = forecast(input);
  const a1 = result.packages.find((item) => item.id === "linear:a1")!;
  const a2 = result.packages.find((item) => item.id === "linear:a2")!;
  const b1 = result.packages.find((item) => item.id === "linear:b1")!;
  assert.deepEqual(a1.consumed, [3, 5]);
  assert.deepEqual(a2.consumed, [3, 1]);
  assert.equal(a1.finish, 2);
  assert.equal(b1.start, 3);
  assert.equal(b1.finish, 3);
  assert.equal(result.cycles[0].streams[1].idle, 4);
  assert.equal(result.outcomes[0].finish, 3);
  assert.equal(result.outcomes[0].endDate, "2026-11-08");
  assert.equal(result.outcomes[0].target, "met");
});

test("WIP one, priority and soft start order are deterministic", () => {
  const a = pkg("a", "stream-a", 6);
  const b = pkg("b", "stream-a", 6);
  b.preferred = 4;
  b.priority = 0;
  const result = forecast(base([b, a]));
  assert.equal(result.packages.find((item) => item.id === "a")?.start, 1);
  const one = base([b, a]); one.streams[0].wip = 1;
  const serial = forecast(one);
  assert.equal(serial.packages.find((item) => item.id === "a")?.finish, 1);
  assert.equal(serial.packages.find((item) => item.id === "b")?.start, 2);
});

test("unknown, unassigned, paused, and optional work explain minimum outcome", () => {
  const required = pkg("linear:r", null, 5);
  const optional = pkg("linear:o", "stream-a", 3);
  optional.unknownIssueIds = ["missing"];
  optional.openIssueCount = 2;
  const input = base([required, optional]);
  input.outcomes = [{ id: "launch", title: "Launch", neededBy: "2026-11-01", links: [
    { projectId: "r", requirement: "minimum" }, { projectId: "o", requirement: "optional" },
  ] }];
  let result = forecast(input);
  assert.equal(result.outcomes[0].status, "blocked");
  assert.match(result.outcomes[0].reasons[0], /Needs assignment/);
  required.streamId = "stream-a";
  result = forecast(input);
  assert.equal(result.outcomes[0].status, "forecast");
  assert.equal(result.outcomes[0].target, "met");
  input.dependencies = [{ predecessorId: optional.id, successorId: required.id, source: "local" }];
  result = forecast(input);
  assert.equal(result.outcomes[0].status, "blocked");
  assert.equal(result.outcomes[0].requiredIds.includes(optional.id), true);
  optional.unestimatedAllowance = { points: 2, issueIds: ["missing"] };
  result = forecast(input);
  assert.equal(result.outcomes[0].status, "provisional");
  optional.selected = false;
  result = forecast(input);
  assert.equal(result.outcomes[0].status, "blocked");
  assert.match(result.outcomes[0].reasons.join(" "), /Deferred/);
});

test("availability, reserve, allocation, and horizon conserve capacity", () => {
  const input = base([pkg("big", "stream-a", 20), pkg("parallel", "stream-b", 4)]);
  input.adjustments = [{ cycleId: "cycle-45", availability: 0.5, reserve: 1 }, { cycleId: "cycle-46", availability: 0, reserve: null }];
  input.horizon = 2;
  const result = forecast(input);
  assert.equal(result.cycles[0].available, 5);
  assert.equal(result.cycles[0].streams[0].budget, 3);
  assert.equal(result.cycles[0].streams[1].budget, 2);
  assert.equal(result.cycles[1].available, 0);
  assert.match(result.packages.find((item) => item.id === "big")?.reason || "", /Beyond horizon/);
  for (const cycle of result.cycles) assert.ok(cycle.streams.reduce((sum, stream) => sum + stream.budget, 0) <= cycle.available + 0.001);
});

test("source cycles, target dates, and cycles are explicit", () => {
  const input = base([pkg("linear:a", "stream-a", 6)]);
  input.outcomes = [{ id: "target", title: "Target", neededBy: "2026-10-24", links: [{ projectId: "a", requirement: "minimum" }] }];
  const result = forecast(input);
  assert.equal(result.cycles[0].start, "2026-10-19");
  assert.equal(result.cycles[0].end, "2026-10-25");
  assert.equal(result.outcomes[0].target, "missed");
  assert.equal(result.outcomes[0].gapCycles, 1);
  input.outcomes[0].neededBy = "2026-10-25";
  assert.equal(forecast(input).outcomes[0].target, "met");
});

test("dependency cycle prevents forecast", () => {
  const input = base([pkg("a", "stream-a", 1), pkg("b", "stream-b", 1)]);
  input.dependencies = [{ predecessorId: "a", successorId: "b", source: "linear" }, { predecessorId: "b", successorId: "a", source: "local" }];
  const result = forecast(input);
  assert.equal(result.ready, false);
  assert.match(result.errors[0], /Dependency cycle/);
});

test("historical baseline uses up to six comparable completed observations", () => {
  assert.equal(historicalBaseline([4, 8]), null);
  assert.equal(historicalBaseline([4, 8, 12]), 8);
  assert.equal(historicalBaseline([1, 3, 8, 20]), 5.5);
  assert.equal(historicalBaseline([1, 2, 3, 4, 5, 6, 100]), 3.5);
});

test("cross-team and external Linear blockers have no misleading date", () => {
  const external = pkg("external", "stream-a", 4);
  external.externalBlockers = ["outside-id"];
  const crossTeam = pkg("cross", "stream-b", 4);
  crossTeam.crossTeam = true;
  const result = forecast(base([external, crossTeam]));
  assert.equal(result.packages.every((item) => item.finish === null), true);
  assert.match(result.packages[0].reason || "", /outside the imported team/);
  assert.match(result.packages[1].reason || "", /Cross-team/);
});

test("thousandth-point rounding never creates extra stream capacity", () => {
  const input = base([pkg("tiny-a", "stream-a", 1), pkg("tiny-b", "stream-b", 1)]);
  input.baseline = 0.001;
  input.reserve = 0;
  input.streams[0].allocation = 0.5;
  input.streams[1].allocation = 0.5;
  input.horizon = 1;
  const result = forecast(input);
  assert.equal(result.cycles[0].available, 0.001);
  assert.equal(result.cycles[0].streams.reduce((sum, stream) => sum + stream.budget, 0), 0);
});

test("completed source work satisfies a predecessor before C1", () => {
  const done = pkg("done", null, 0);
  done.status = "completed";
  done.openIssueCount = 0;
  const next = pkg("next", "stream-b", 4);
  const input = base([done, next]);
  input.dependencies = [{ predecessorId: "done", successorId: "next", source: "linear" }];
  const result = forecast(input);
  assert.equal(result.packages.find((item) => item.id === "done")?.finish, 0);
  assert.equal(result.packages.find((item) => item.id === "next")?.start, 1);
});

test("explicit zero demand still waits for its predecessor", () => {
  const input = base([pkg("first", "stream-a", 6), pkg("zero", "stream-b", 0)]);
  input.dependencies = [{ predecessorId: "first", successorId: "zero", source: "local" }];
  const result = forecast(input);
  assert.equal(result.packages.find((item) => item.id === "first")?.finish, 1);
  assert.equal(result.packages.find((item) => item.id === "zero")?.finish, 2);
});

test("Linear Cycle 44 is context; moved Cycle 46 and its ID-bound exception drive the forecast", () => {
  const input = base([pkg("long", "stream-a", 20)]);
  input.linearCycles = [
    { id: "cycle-44", number: 44, name: null, startsAt: "2026-10-12T00:00:00Z", endsAt: "2026-10-19T00:00:00Z" },
    { id: "cycle-45", number: 45, name: null, startsAt: "2026-10-19T00:00:00Z", endsAt: "2026-10-26T00:00:00Z" },
    { id: "cycle-46", number: 46, name: "Holiday week", startsAt: "2026-10-27T00:00:00Z", endsAt: "2026-11-03T00:00:00Z" },
  ];
  input.adjustments = [{ cycleId: "cycle-46", availability: 0.5, reserve: 2 }];
  input.horizon = 26;
  const result = forecast(input);
  assert.deepEqual(result.cycles.map((cycle) => cycle.number), [45, 46]);
  assert.equal(result.cycles[0].start, "2026-10-19");
  assert.equal(result.cycles[1].start, "2026-10-27");
  assert.equal(result.cycles[1].available, 4);
  assert.equal(result.packages[0].finish, null);
  assert.match(result.packages[0].reason || "", /Beyond imported Linear calendar after Holiday week/);
});

test("no upcoming Linear cycle means no fabricated forecast calendar", () => {
  const input = base([pkg("work", "stream-a", 3)]);
  input.linearCycles = [{ id: "cycle-44", number: 44, name: null, startsAt: "2026-10-12T00:00:00Z", endsAt: "2026-10-19T00:00:00Z" }];
  const result = forecast(input);
  assert.equal(result.ready, false);
  assert.equal(result.cycles.length, 0);
  assert.match(result.setup.join(" "), /No upcoming Linear cycles/);
});
