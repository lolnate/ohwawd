import assert from "node:assert/strict";
import { test } from "node:test";
import { linearCycleLabel, shortLinearCycleLabel, nextCycleName, type PlanningCycle } from "../src/lib/cycles";
import { projectCycleCalendar, type CycleCadence } from "../src/lib/cycle-projection";
import { forecast, type ForecastInput } from "../src/lib/forecast";

const cadence: CycleCadence = { teamId: "team", enabled: true, durationWeeks: 1, startDay: 2, cooldownWeeks: 0, timezone: "America/New_York" };
const sourceCycles = (): PlanningCycle[] => [
  { id: "actual-26", number: 26, name: "Cycle 46", startsAt: "2026-10-27T04:00:00Z", endsAt: "2026-11-03T05:00:00Z" },
  { id: "actual-27", number: 27, name: "Cycle 47", startsAt: "2026-11-03T05:00:00Z", endsAt: "2026-11-10T05:00:00Z" },
  { id: "actual-28", number: 28, name: "Cycle 48", startsAt: "2026-11-10T05:00:00Z", endsAt: "2026-11-17T05:00:00Z" },
  { id: "actual-29", number: 29, name: "Cycle 49", startsAt: "2026-11-17T05:00:00Z", endsAt: "2026-11-24T05:00:00Z" },
];

test("compact labels honor the visible cycle name independently of internal ordinals and IDs", () => {
  assert.equal(linearCycleLabel(sourceCycles()[0]), "Cycle 46");
  assert.equal(shortLinearCycleLabel(sourceCycles()[0]), "C46");
  assert.equal(shortLinearCycleLabel({ number: 26, name: "Release prep" }), "Release prep");
  assert.equal(shortLinearCycleLabel({ number: 26, name: null }), "C26");
  assert.equal(nextCycleName("Cycle 049"), "Cycle 050");
  assert.equal(nextCycleName("Sprint 22"), "Sprint 23");
  assert.equal(nextCycleName("Release prep"), null);
});

test("four actual cycles extend into visible Cycle 50 onward without mutating source facts", () => {
  const cycles = sourceCycles();
  const before = JSON.stringify(cycles);
  const result = projectCycleCalendar({ cycles, cadence, anchorAt: "2026-10-20T22:00:00Z", horizon: 26 });
  assert.equal(result.projection.reason, null);
  assert.equal(result.projection.importedFutureCount, 4);
  assert.equal(result.projection.projectedCount, 22);
  assert.equal(result.cycles[4].number, 30);
  assert.equal(result.cycles[4].name, "Cycle 50");
  assert.equal(result.cycles[4].startsAt, "2026-11-24T05:00:00.000Z");
  assert.equal(result.cycles[4].endsAt, "2026-12-01T05:00:00.000Z");
  assert.match(result.cycles[4].id, /^projected:team:/);
  assert.equal(result.cycles.at(-1)!.name, "Cycle 71");
  assert.deepEqual(result.cycles.slice(0, 4), cycles);
  assert.equal(JSON.stringify(cycles), before);
});

test("duration, weekday and cooldown produce genuine no-capacity gaps", () => {
  const result = projectCycleCalendar({ cycles: [{ id: "actual", number: 1, name: "Cycle 99", startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-15T00:00:00Z" }],
    cadence: { ...cadence, durationWeeks: 2, startDay: 1, cooldownWeeks: 1, timezone: "UTC" }, anchorAt: "2026-06-02T12:00:00Z", horizon: 3, displayWeeks: 4 });
  const projected = result.cycles.filter((cycle) => cycle.projected);
  assert.equal(projected[0].startsAt, "2026-06-22T00:00:00.000Z");
  assert.equal(projected[0].endsAt, "2026-07-06T00:00:00.000Z");
  assert.equal(projected[1].startsAt, "2026-07-13T00:00:00.000Z");
  assert.equal(projected[0].name, "Cycle 100");
});

test("projections retain local midnight through fall and spring daylight-saving transitions", () => {
  const fall = projectCycleCalendar({ cycles: [{ id: "c45", number: 25, name: "Cycle 45", startsAt: "2026-10-20T04:00:00Z", endsAt: "2026-10-27T04:00:00Z" }],
    cadence, anchorAt: "2026-10-21T12:00:00Z", horizon: 3, displayWeeks: 3 }).cycles.filter((cycle) => cycle.projected);
  assert.equal(fall[0].startsAt, "2026-10-27T04:00:00.000Z");
  assert.equal(fall[0].endsAt, "2026-11-03T05:00:00.000Z");
  assert.equal(fall[1].startsAt, "2026-11-03T05:00:00.000Z");
  const spring = projectCycleCalendar({ cycles: [{ id: "spring", number: 1, name: null, startsAt: "2026-02-23T05:00:00Z", endsAt: "2026-03-02T05:00:00Z" }],
    cadence: { ...cadence, startDay: 1 }, anchorAt: "2026-02-25T12:00:00Z", horizon: 3, displayWeeks: 3 }).cycles.filter((cycle) => cycle.projected);
  assert.equal(spring[0].startsAt, "2026-03-02T05:00:00.000Z");
  assert.equal(spring[0].endsAt, "2026-03-09T04:00:00.000Z");
  assert.equal(spring[1].startsAt, "2026-03-09T04:00:00.000Z");
});

test("incomplete or disabled configuration never manufactures a calendar", () => {
  for (const settings of [{ ...cadence, enabled: false }, { ...cadence, durationWeeks: null }, { ...cadence, durationWeeks: 0 }, { ...cadence, startDay: 7 }, { ...cadence, cooldownWeeks: -1 }]) {
    const result = projectCycleCalendar({ cycles: sourceCycles(), cadence: settings, anchorAt: "2026-10-20T22:00:00Z", horizon: 26 });
    assert.ok(result.projection.reason);
    assert.equal(result.projection.projectedCount, 0);
    assert.deepEqual(result.cycles, sourceCycles());
  }
  assert.match(projectCycleCalendar({ cycles: [], cadence, anchorAt: "2026-10-20T22:00:00Z", horizon: 26 }).projection.reason!, /dated Linear cycle/);
});

test("completed history can anchor future recurrence without counting the current partial cycle", () => {
  const result = projectCycleCalendar({ cycles: [{ id: "old", number: 24, name: "Cycle 44", startsAt: "2026-10-13T04:00:00Z", endsAt: "2026-10-20T04:00:00Z", completedAt: "2026-10-20T04:03:00Z" }],
    cadence, anchorAt: "2026-11-05T12:00:00Z", horizon: 2, displayWeeks: 4 });
  const projected = result.cycles.filter((cycle) => cycle.projected);
  assert.equal(projected[0].name, "Cycle 48");
  assert.equal(projected[0].startsAt, "2026-11-10T05:00:00.000Z");
  assert.ok(projected.every((cycle) => Date.parse(cycle.startsAt) > Date.parse("2026-11-05T12:00:00Z")));
});

test("actual imports replace derived cycles and individually moved boundaries re-anchor the extension", () => {
  const first = projectCycleCalendar({ cycles: sourceCycles(), cadence, anchorAt: "2026-10-20T22:00:00Z", horizon: 8 });
  const originalProjection = first.cycles.find((cycle) => cycle.name === "Cycle 50")!;
  const actual: PlanningCycle = { ...originalProjection, id: "real-linear-50", projected: false, startsAt: "2026-11-25T05:00:00Z", endsAt: "2026-12-02T05:00:00Z" };
  const second = projectCycleCalendar({ cycles: [...sourceCycles(), actual], cadence, anchorAt: "2026-10-20T22:00:00Z", horizon: 8 });
  assert.equal(second.cycles.filter((cycle) => cycle.name === "Cycle 50").length, 1);
  assert.equal(second.cycles.find((cycle) => cycle.name === "Cycle 50")!.id, "real-linear-50");
  assert.equal(second.cycles.find((cycle) => cycle.name === "Cycle 51")!.startsAt, "2026-12-08T05:00:00.000Z");
  assert.equal(second.cycles.some((cycle) => cycle.id === originalProjection.id), false);
});

test("forecast dates using projected capacity are provisional and preserve holiday weighting", () => {
  const calendar = projectCycleCalendar({ cycles: [sourceCycles()[3]], cadence, anchorAt: "2026-11-16T12:00:00Z", horizon: 6 });
  const input: ForecastInput = { packages: [{ id: "linear:p", projectId: "p", name: "Work", status: "planned", streamId: "core", selected: true, sequence: 1,
    known: 150, openIssueCount: 1, unknownIssueIds: [], crossTeam: false, needsReview: false }], streams: [{ id: "core", name: "Core", allocation: 1, wip: 1 }],
    dependencies: [], outcomes: [{ id: "outcome", title: "Launch", neededBy: null, links: [{ projectId: "p", requirement: "minimum" }] }],
    baseline: 100, reserve: 10, linearCycles: calendar.cycles, horizon: 6, sourceAt: "2026-11-16T12:00:00Z", timezone: cadence.timezone, holidaysEnabled: true };
  const result = forecast(input);
  assert.equal(result.cycles[1].projected, true);
  assert.equal(result.cycles[1].availability, 0.6);
  assert.equal(result.cycles[1].available, 50);
  assert.equal(result.packages[0].finish, 3);
  assert.equal(result.packages[0].calendarProjected, true);
  assert.equal(result.packages[0].provisional, true);
  assert.equal(result.outcomes[0].status, "provisional");
  assert.equal(result.outcomes[0].calendarProjected, true);
});
