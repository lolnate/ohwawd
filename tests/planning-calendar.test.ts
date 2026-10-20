import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
import { addCalendarDays, cycleAvailability, holidayWeeksForRange, mondayOf, planningWeeks, timelineSpan } from "../src/lib/planning-calendar";
import { schemaSql } from "../src/lib/db";
import { weeklyCapacitySchemaSql } from "../src/lib/weekly-capacity-schema";
import { saveHolidayPreset, saveWeeklyAvailability } from "../src/lib/weekly-capacity-store";
import { forecast, type ForecastInput } from "../src/lib/forecast";

test("calendar weeks group into months with stable Thanksgiving and Christmas defaults across years", () => {
  assert.equal(mondayOf("2026-11-26"), "2026-11-23");
  const holidays = holidayWeeksForRange("2026-10-01", "2027-02-01");
  assert.deepEqual(holidays.map((week) => [week.weekStart, week.availability]), [["2026-11-23", 0.5], ["2026-12-21", 0.5], ["2026-12-28", 0.5]]);
  assert.equal(holidayWeeksForRange("2023-12-25", "2024-01-08").some((week) => week.weekStart === "2024-01-01"), true);
  const cycles = [{ id: "45", number: 45, name: null, startsAt: "2026-10-27T00:00:00Z", endsAt: "2026-11-10T00:00:00Z" }];
  const weeks = planningWeeks({ cycles, timezone: "UTC", anchorDate: "2026-10-27", overrides: [], holidays });
  assert.equal(weeks.length, 26);
  assert.equal(weeks[0].start, "2026-10-26");
  assert.equal(weeks[0].monthLabel, "Oct 2026");
  assert.equal(weeks[1].monthLabel, "Nov 2026");
  assert.equal(weeks[0].coverage, "partial");
  assert.equal(weeks[1].coverage, "full");
  assert.equal(weeks[2].coverage, "partial");
  assert.equal(weeks[3].coverage, "none");
  assert.equal(weeks.find((week) => week.start === "2026-11-23")!.availability, 0.5);
  assert.deepEqual(timelineSpan("2026-10-27", "2026-11-10", "2026-10-26", 4), { left: 1 / 28 * 100, width: 14 / 28 * 100 });
  assert.equal(timelineSpan("2027-01-01", "2027-02-01", "2026-10-26", 4), null);
});

test("weekly availability is weekday-weighted across cycle boundaries and DST without double reduction", () => {
  const holidays = holidayWeeksForRange("2026-11-01", "2027-01-10");
  const fortnight = { startsAt: "2026-11-16T00:00:00Z", endsAt: "2026-11-30T00:00:00Z" };
  assert.equal(cycleAvailability(fortnight, "UTC", 1, [], holidays), 0.75);
  const thanksgiving = { startsAt: "2026-11-23T00:00:00Z", endsAt: "2026-11-30T00:00:00Z" };
  assert.equal(cycleAvailability(thanksgiving, "UTC", 0.5, [], holidays), 0.5);
  assert.equal(cycleAvailability(thanksgiving, "UTC", 0.5, [{ weekStart: "2026-11-23", availability: 1, label: "Restored" }], holidays), 1);
  assert.equal(cycleAvailability({ startsAt: "2026-11-24T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" }, "UTC", 1, [], holidays), 0.6);
  assert.equal(cycleAvailability({ startsAt: "2026-10-26T04:00:00Z", endsAt: "2026-11-09T05:00:00Z" }, "America/New_York", 1,
    [{ weekStart: "2026-11-02", availability: 0.5, label: "Leave" }], []), 0.75);
  assert.equal(cycleAvailability({ startsAt: "2026-11-28T00:00:00Z", endsAt: "2026-11-30T00:00:00Z" }, "UTC", 1, [], holidays), 0.5);
});

test("holiday weighting changes actual forecast capacity and preserves reserve and allocation rules", () => {
  const input: ForecastInput = { packages: [{ id: "linear:p", projectId: "p", name: "Work", status: "planned", streamId: "core", selected: true,
    sequence: 1, known: 100, openIssueCount: 1, unknownIssueIds: [], crossTeam: false, needsReview: false }],
    streams: [{ id: "core", name: "Core", allocation: 0.5, wip: 1 }], dependencies: [], outcomes: [], baseline: 100, reserve: 10,
    linearCycles: [{ id: "c1", number: 1, name: null, startsAt: "2026-11-16T00:00:00Z", endsAt: "2026-11-30T00:00:00Z" }],
    horizon: 1, sourceAt: "2026-11-01T12:00:00Z", timezone: "UTC", holidaysEnabled: true };
  let result = forecast(input);
  assert.equal(result.cycles[0].availability, 0.75);
  assert.equal(result.cycles[0].available, 65);
  assert.equal(result.cycles[0].streams[0].budget, 32.5);
  input.weeklyAdjustments = [{ weekStart: "2026-11-23", availability: 1, label: "Working normally" }];
  result = forecast(input);
  assert.equal(result.cycles[0].available, 90);
  assert.equal(result.cycles[0].streams[0].budget, 45);
  input.holidaysEnabled = false;
  input.weeklyAdjustments = [{ weekStart: "2026-11-16", availability: 0, label: "Closed" }];
  assert.equal(forecast(input).cycles[0].available, 40);
});

test("weekly schema is idempotent and overrides validate Monday dates, fractions, labels and removal", async () => {
  const database = new PGlite();
  try {
    await database.exec(schemaSql);
    await database.query("INSERT INTO workspace(id) VALUES(1)");
    const client = database as unknown as PoolClient;
    await saveHolidayPreset(client, true);
    await saveWeeklyAvailability(client, { weekStart: "2026-11-23", availability: 0.5 });
    await database.exec(weeklyCapacitySchemaSql);
    assert.equal((await database.query("SELECT * FROM weekly_capacity_adjustment")).rows.length, 1);
    await saveWeeklyAvailability(client, { weekStart: "2026-11-23", availability: 1, label: "Full capacity" });
    assert.equal((await database.query<{ availability: string }>("SELECT availability FROM weekly_capacity_adjustment")).rows[0].availability, "1");
    for (const weekStart of ["2026-11-24", "2026-02-30", "invalid"]) await assert.rejects(() => saveWeeklyAvailability(client, { weekStart, availability: 0.5 }), /Monday-start/);
    for (const availability of [-0.1, 1.1, NaN, Infinity]) await assert.rejects(() => saveWeeklyAvailability(client, { weekStart: "2026-11-23", availability }), /0–100/);
    await assert.rejects(() => saveHolidayPreset(client, "true"), /whether/);
    await saveWeeklyAvailability(client, { weekStart: "2026-11-23", remove: true });
    assert.equal((await database.query("SELECT * FROM weekly_capacity_adjustment")).rows.length, 0);
    await saveHolidayPreset(client, false);
    assert.equal((await database.query<{ holidays_enabled: boolean }>("SELECT holidays_enabled FROM capacity_profile")).rows[0].holidays_enabled, false);
    assert.equal(addCalendarDays("2026-12-28", 7), "2027-01-04");
  } finally { await database.close(); }
});
