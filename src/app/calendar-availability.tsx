"use client";

import { useEffect, useRef, useState } from "react";
import { addCalendarDays, mondayOf, shortCalendarDate, type PlanningWeek, type WeeklyAvailability } from "@/lib/planning-calendar";

type Props = { enabled: boolean; overrides: WeeklyAvailability[]; holidays: WeeklyAvailability[]; selectedWeek: PlanningWeek | null; busy: boolean;
  onSave: (change: Record<string, unknown>, message: string) => Promise<boolean> };

export default function CalendarAvailability({ enabled, overrides, holidays, selectedWeek, busy, onSave }: Props) {
  const [weekStart, setWeekStart] = useState("");
  const [availability, setAvailability] = useState("50");
  const [label, setLabel] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const appliedOverride = overrides.find((week) => week.weekStart === weekStart);
  const appliedHoliday = enabled ? holidays.find((week) => week.weekStart === weekStart) : undefined;
  const baseAvailability = selectedWeek?.start === weekStart ? selectedWeek.baseAvailability : 1;
  useEffect(() => {
    if (!weekStart) return;
    setAvailability(String(Math.round((appliedOverride?.availability ?? appliedHoliday?.availability ?? baseAvailability) * 100)));
    setLabel(appliedOverride?.label ?? appliedHoliday?.label ?? "");
  }, [weekStart, appliedOverride?.availability, appliedOverride?.label, appliedHoliday?.availability, appliedHoliday?.label, baseAvailability]);
  useEffect(() => {
    if (!selectedWeek) return;
    setWeekStart(selectedWeek.start); setAvailability(String(Math.round(selectedWeek.availability * 100)));
    setLabel(selectedWeek.label === "Normal availability" ? "" : selectedWeek.label);
    if (details.current) details.current.open = true;
    dateInput.current?.focus();
    details.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedWeek]);
  function chooseWeek(value: string) {
    if (!value) { setWeekStart(""); return; }
    const monday = mondayOf(value);
    const current = overrides.find((week) => week.weekStart === monday) ?? holidays.find((week) => week.weekStart === monday);
    setWeekStart(monday); setAvailability(String(Math.round((current?.availability ?? 1) * 100))); setLabel(current?.label ?? "");
  }
  return <details className="board-settings" id="calendar-availability" ref={details}>
    <summary>Weekly availability and holidays <span>{enabled ? "Holiday preset on" : "Holiday preset off"} · {overrides.length} week overrides</span></summary>
    <label className="board-check holiday-preset"><input type="checkbox" checked={enabled} disabled={busy}
      onChange={(event) => void onSave({ type: "holidayPreset", enabled: event.target.checked }, "Holiday availability updated.")} />
      US Thanksgiving + Christmas: 3 holiday weeks at 50%
    </label>
    <p>Thanksgiving week, Christmas week, and the following week. These are editable planning assumptions. A week override takes precedence over both this preset and cycle availability; reductions are not multiplied twice.</p>
    {enabled && <div className="holiday-week-list">{holidays.map((week) => {
      const effective = overrides.find((entry) => entry.weekStart === week.weekStart) ?? week;
      return <span key={week.weekStart}>{shortCalendarDate(week.weekStart)} · {week.label} · {Math.round(effective.availability * 100)}%{effective !== week ? " override" : ""}</span>;
    })}</div>}
    <form onSubmit={(event) => { event.preventDefault(); void onSave({ type: "weeklyAvailability", weekStart, availability: Number(availability) / 100, label }, "Week availability saved."); }}>
      <div className="board-fields"><label>Week starting (Monday)<input ref={dateInput} type="date" value={weekStart} required onChange={(event) => chooseWeek(event.target.value)} /></label>
        <label>Week availability %<input type="number" min="0" max="100" step="1" value={availability} required onChange={(event) => setAvailability(event.target.value)} /></label>
        <label>Week label (optional)<input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} /></label></div>
      {weekStart && <p className="meta">Applies {shortCalendarDate(weekStart)} – {shortCalendarDate(addCalendarDays(weekStart, 6))} in the team's timezone. Use 100% to restore a holiday week.</p>}
      <button className="secondary" disabled={busy || !weekStart}>Save week availability</button>
    </form>
    {overrides.length > 0 && <ul className="week-override-list">{overrides.map((week) => <li key={week.weekStart}>
      <span>{week.weekStart} · {Math.round(week.availability * 100)}%{week.label ? ` · ${week.label}` : ""}</span>
      <button className="text-button" disabled={busy} aria-label={`Remove override for ${week.weekStart}`} onClick={() => void onSave({ type: "weeklyAvailability", weekStart: week.weekStart, remove: true }, "Week override removed.")}>Remove override</button>
    </li>)}</ul>}
  </details>;
}
