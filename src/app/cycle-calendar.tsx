"use client";

import { useEffect, useMemo, useState } from "react";
import { linearCycleLabel } from "@/lib/cycles";

export type CalendarCycle = { id: string; number: number; name: string | null; startsAt: string; endsAt: string; selectable: boolean; adjusted: boolean };

const dateOnly = (value: string, timezone: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));
const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const shiftMonth = (month: string, count: number) => monthKey(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + count, 1)));

export default function CycleCalendar({ cycles, timezone, sourceAt, selectedIds, onToggle }: {
  cycles: CalendarCycle[]; timezone: string; sourceAt: string; selectedIds: string[]; onToggle: (id: string) => void;
}) {
  const dated = useMemo(() => cycles.map((cycle) => ({ ...cycle, start: dateOnly(cycle.startsAt, timezone),
    end: dateOnly(new Date(Date.parse(cycle.endsAt) - 1).toISOString(), timezone) })), [cycles, timezone]);
  const sourceMonth = dateOnly(sourceAt, timezone).slice(0, 7);
  const earliestMonth = dated[0]?.start.slice(0, 7) || sourceMonth;
  const lastMonth = dated.at(-1)?.end.slice(0, 7) || sourceMonth;
  const firstMonth = sourceMonth < earliestMonth ? earliestMonth : sourceMonth > lastMonth ? lastMonth : sourceMonth;
  const [month, setMonth] = useState(firstMonth);
  useEffect(() => { setMonth(firstMonth); }, [firstMonth]);
  const months = [month, shiftMonth(month, 1)].filter((key) => key <= lastMonth);
  const selected = new Set(selectedIds);
  return <div className="linear-calendar">
    <div className="calendar-nav"><button type="button" className="secondary" disabled={month <= earliestMonth} onClick={() => setMonth(shiftMonth(month, -1))}>← Earlier</button><span>Linear team cycle calendar · {timezone}</span><button type="button" className="secondary" disabled={shiftMonth(month, 2) > lastMonth} onClick={() => setMonth(shiftMonth(month, 2))}>Later →</button></div>
    <div className="calendar-months">{months.map((key) => {
      const first = utcDate(`${key}-01`);
      const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(first);
      const offset = first.getUTCDay();
      const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
      return <div className="calendar-month" key={key}><h4>{label}</h4><div className="calendar-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: cells }, (_, index) => {
        const day = isoDay(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), index - offset + 1)));
        const cycle = dated.find((item) => item.start <= day && day <= item.end);
        const inMonth = day.slice(0, 7) === key;
        const className = ["calendar-day", !inMonth && "outside", !cycle && "no-cycle", cycle && !cycle.selectable && "current-cycle", cycle?.adjusted && "adjusted", cycle && selected.has(cycle.id) && "chosen"].filter(Boolean).join(" ");
        return <button type="button" key={day} className={className} disabled={!inMonth || !cycle?.selectable} aria-pressed={!!cycle && selected.has(cycle.id)} aria-label={`${day}${cycle ? `, Linear ${linearCycleLabel(cycle)}` : ", no Linear cycle"}`} title={cycle ? `${linearCycleLabel(cycle)}: ${cycle.start} – ${cycle.end}${cycle.adjusted ? " · adjusted" : ""}` : "No Linear cycle"} onClick={() => cycle && onToggle(cycle.id)}><span>{Number(day.slice(8))}</span>{cycle && <small>{linearCycleLabel(cycle)}</small>}</button>;
      })}</div></div>;
    })}</div>
    <p className="meta">Select any date in an upcoming cycle. Dates without a Linear cycle cannot receive a planning exception; the current partial cycle is shown for context.</p>
  </div>;
}
