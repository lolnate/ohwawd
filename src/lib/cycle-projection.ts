import { nextCycleName, type PlanningCycle } from "./cycles";
import { addCalendarDays, mondayOf } from "./planning-calendar";
import { teamLocalDate } from "./project-scope";

export type CycleCadence = { teamId: string; enabled: boolean; durationWeeks: number | null; startDay: number | null; cooldownWeeks: number | null; timezone: string };
export type CalendarProjection = { cadence: CycleCadence; reason: string | null; importedFutureCount: number; projectedCount: number;
  importedThrough: string | null; projectedThrough: string | null };

function wallClock(timestamp: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp));
  const field = (name: string) => Number(parts.find((part) => part.type === name)!.value);
  return { year: field("year"), month: field("month"), day: field("day"), hour: field("hour"), minute: field("minute"), second: field("second"), millisecond: new Date(timestamp).getUTCMilliseconds() };
}

/** Resolve a team-local calendar date/time, recomputing offsets across DST boundaries. */
function localTimestamp(date: string, clock: ReturnType<typeof wallClock>, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, clock.hour, clock.minute, clock.second, clock.millisecond);
  let instant = target;
  for (let attempt = 0; attempt < 6; attempt++) {
    const actual = wallClock(new Date(instant).toISOString(), timezone);
    const observed = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, actual.millisecond);
    if (observed === target) return new Date(instant).toISOString();
    instant += target - observed;
  }
  throw new Error("The configured local cycle boundary cannot be resolved in the team timezone.");
}

export function projectCycleCalendar(input: { cycles: PlanningCycle[]; cadence: CycleCadence; anchorAt: string; horizon: number; displayWeeks?: number }): { cycles: PlanningCycle[]; projection: CalendarProjection } {
  const imported = input.cycles.filter((cycle) => !cycle.projected).map((cycle) => ({ ...cycle })).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const anchor = Date.parse(input.anchorAt);
  const future = imported.filter((cycle) => Date.parse(cycle.startsAt) > anchor && !cycle.completedAt);
  const last = imported.reduce<PlanningCycle | undefined>((prior, cycle) => !prior || Date.parse(cycle.endsAt) > Date.parse(prior.endsAt) ? cycle : prior, undefined);
  const projection: CalendarProjection = { cadence: input.cadence, reason: null, importedFutureCount: future.length, projectedCount: 0, importedThrough: last?.endsAt ?? null, projectedThrough: null };
  const result = { cycles: imported, projection };
  const settings = input.cadence;
  if (!settings.enabled) { projection.reason = "Linear cycles are not enabled for this team."; return result; }
  if (!Number.isInteger(settings.durationWeeks) || settings.durationWeeks! < 1 || settings.durationWeeks! > 8 ||
    !Number.isInteger(settings.startDay) || settings.startDay! < 0 || settings.startDay! > 6 ||
    !Number.isSafeInteger(settings.cooldownWeeks) || settings.cooldownWeeks! < 0) {
    projection.reason = "Sync a valid Linear cycle duration, starting weekday and cooldown to project the calendar."; return result;
  }
  if (!last || !Number.isFinite(anchor) || !Number.isFinite(Date.parse(last.endsAt)) || !Number.isFinite(Date.parse(last.startsAt)) || Date.parse(last.endsAt) <= Date.parse(last.startsAt)) {
    projection.reason = "Sync at least one dated Linear cycle to anchor calendar projections."; return result;
  }
  try {
    const firstDate = mondayOf(teamLocalDate(future[0]?.startsAt ?? input.anchorAt, settings.timezone));
    const displayEnd = addCalendarDays(firstDate, (input.displayWeeks ?? 26) * 7);
    const horizon = Math.max(1, Math.min(104, Math.floor(input.horizon)));
    const clock = wallClock(last.endsAt, settings.timezone);
    let previous = last;
    let futureCount = future.length;
    let through = teamLocalDate(last.endsAt, settings.timezone);
    const generated: PlanningCycle[] = [];
    let attempts = 0;
    while ((futureCount < horizon || through < displayEnd) && attempts++ < 10_000) {
      const afterCooldown = addCalendarDays(teamLocalDate(previous.endsAt, settings.timezone), settings.cooldownWeeks! * 7);
      const weekday = new Date(`${afterCooldown}T12:00:00Z`).getUTCDay();
      const startDate = addCalendarDays(afterCooldown, (settings.startDay! - weekday + 7) % 7);
      const endDate = addCalendarDays(startDate, settings.durationWeeks! * 7);
      const startsAt = localTimestamp(startDate, clock, settings.timezone);
      const cycle: PlanningCycle = { id: `projected:${settings.teamId}:${startsAt}`, number: previous.number + 1,
        name: nextCycleName(previous.name), startsAt, endsAt: localTimestamp(endDate, clock, settings.timezone), projected: true };
      if (Date.parse(startsAt) > anchor) { generated.push(cycle); futureCount++; }
      previous = cycle; through = endDate;
    }
    if (attempts >= 10_000) throw new Error("The imported calendar is too far from the planning horizon to project safely.");
    result.cycles = [...imported, ...generated];
    projection.projectedCount = generated.length;
    projection.projectedThrough = generated.at(-1)?.endsAt ?? null;
  } catch (error) { projection.reason = error instanceof Error ? error.message : "The configured cycle cadence could not be projected."; }
  return result;
}
