import { teamLocalDate } from "./project-scope";
import { linearCycleLabel, type PlanningCycle } from "./cycles";

export type WeeklyAvailability = { weekStart: string; availability: number; label: string };
export type CalendarCycle = PlanningCycle;
export type CalendarAdjustment = { cycleId: string; availability: number };
export type PlanningWeek = { start: string; end: string; month: string; monthLabel: string; cycleLabels: string[]; cycleIds: string[];
  coverage: "full" | "partial" | "none"; projected: boolean; availability: number; baseAvailability: number; label: string; overridden: boolean };

const dayMilliseconds = 86_400_000;
export function addCalendarDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export const calendarDaysBetween = (start: string, end: string) => Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / dayMilliseconds);
export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addCalendarDays(date, -((weekday + 6) % 7));
}
export const isWorkingDate = (date: string) => ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
export const shortCalendarDate = (date: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));

export function holidayWeeksForRange(start: string, end: string): WeeklyAvailability[] {
  const weeks: WeeklyAvailability[] = [];
  for (let year = Number(start.slice(0, 4)) - 1; year <= Number(end.slice(0, 4)); year++) {
    const novemberFirst = `${year}-11-01`;
    const weekday = new Date(`${novemberFirst}T12:00:00Z`).getUTCDay();
    const thanksgiving = addCalendarDays(novemberFirst, (4 - weekday + 7) % 7 + 21);
    const christmas = mondayOf(`${year}-12-25`);
    weeks.push({ weekStart: mondayOf(thanksgiving), availability: 0.5, label: "US Thanksgiving week" },
      { weekStart: christmas, availability: 0.5, label: "Christmas week" },
      { weekStart: addCalendarDays(christmas, 7), availability: 0.5, label: "Christmas / New Year week" });
  }
  return weeks.filter((week) => week.weekStart < end && addCalendarDays(week.weekStart, 7) > start).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function cycleLocalDates(cycle: Pick<CalendarCycle, "startsAt" | "endsAt">, timezone: string): { start: string; end: string } {
  return { start: teamLocalDate(cycle.startsAt, timezone), end: addCalendarDays(teamLocalDate(new Date(Date.parse(cycle.endsAt) - 1), timezone), 1) };
}

/** Week assumptions replace cycle availability on their dates, rather than multiplying it twice. */
export function cycleAvailability(cycle: Pick<CalendarCycle, "startsAt" | "endsAt">, timezone: string, base: number,
  overrides: WeeklyAvailability[], holidays: WeeklyAvailability[]): number {
  const range = cycleLocalDates(cycle, timezone);
  const dates: string[] = [];
  for (let date = range.start; date < range.end; date = addCalendarDays(date, 1)) dates.push(date);
  const working = dates.filter(isWorkingDate);
  const relevant = working.length ? working : dates;
  if (!relevant.length) return base;
  const availability = new Map(holidays.map((week) => [week.weekStart, week.availability]));
  for (const week of overrides) availability.set(week.weekStart, week.availability);
  return relevant.reduce((sum, date) => sum + (availability.get(mondayOf(date)) ?? base), 0) / relevant.length;
}

export function planningWeeks(input: { cycles: CalendarCycle[]; timezone: string; anchorDate: string; overrides: WeeklyAvailability[];
  holidays: WeeklyAvailability[]; adjustments?: CalendarAdjustment[]; minimumWeeks?: number }): PlanningWeek[] {
  const start = mondayOf(input.anchorDate);
  const ranges = input.cycles.map((cycle) => ({ cycle, ...cycleLocalDates(cycle, input.timezone) }));
  const last = ranges.reduce((value, range) => range.end > value ? range.end : value, start);
  const count = Math.min(104, Math.max(input.minimumWeeks ?? 26, Math.ceil(calendarDaysBetween(start, last) / 7)));
  return Array.from({ length: count }, (_, index) => {
    const date = addCalendarDays(start, index * 7);
    const end = addCalendarDays(date, 7);
    const overlapping = ranges.filter((range) => range.start < end && range.end > date);
    const dates = Array.from({ length: 7 }, (_, day) => addCalendarDays(date, day));
    const covered = dates.filter((day) => overlapping.some((range) => range.start <= day && range.end > day)).length;
    const explicit = input.overrides.find((week) => week.weekStart === date);
    const holiday = input.holidays.find((week) => week.weekStart === date);
    const fallback = dates.filter(isWorkingDate).reduce((sum, day) => {
      const range = overlapping.find((item) => item.start <= day && item.end > day);
      return sum + (input.adjustments?.find((item) => item.cycleId === range?.cycle.id)?.availability ?? 1);
    }, 0) / 5;
    return { start: date, end, month: date.slice(0, 7),
      monthLabel: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00Z`)),
      cycleLabels: overlapping.map((range) => linearCycleLabel(range.cycle)), cycleIds: overlapping.map((range) => range.cycle.id),
      projected: overlapping.some((range) => range.cycle.projected === true),
      coverage: covered === 7 ? "full" : covered ? "partial" : "none", availability: explicit?.availability ?? holiday?.availability ?? fallback, baseAvailability: fallback,
      label: explicit?.label || (explicit ? "Week override" : holiday?.label || (fallback < 1 ? "Cycle availability" : "Normal availability")), overridden: !!explicit };
  });
}

export function timelineSpan(start: string, end: string, firstWeek: string, weekCount: number): { left: number; width: number } | null {
  const total = weekCount * 7;
  const from = Math.max(0, calendarDaysBetween(firstWeek, start));
  const to = Math.min(total, calendarDaysBetween(firstWeek, end));
  return to <= from ? null : { left: from / total * 100, width: (to - from) / total * 100 };
}

export function fractionalTimelineSpan(start: string, finalCycleStart: string, finalCycleEnd: string, finalCycleFraction: number,
  firstWeek: string, weekCount: number): { left: number; width: number } | null {
  const total = weekCount * 7;
  const from = Math.max(0, calendarDaysBetween(firstWeek, start));
  const cycleStart = calendarDaysBetween(firstWeek, finalCycleStart);
  const cycleDays = calendarDaysBetween(finalCycleStart, finalCycleEnd);
  const to = Math.min(total, cycleStart + cycleDays * Math.max(0, Math.min(1, finalCycleFraction)));
  return to <= from ? null : { left: from / total * 100, width: (to - from) / total * 100 };
}
