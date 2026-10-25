"use client";

import { addCalendarDays, mondayOf, shortCalendarDate, type WeeklyAvailability } from "@/lib/planning-calendar";

export type WeekDraft = { weekStart: string; availability: string; label: string };
type Props = { enabled: boolean; overrides: WeeklyAvailability[]; holidays: WeeklyAvailability[]; draft: WeekDraft; busy: boolean;
  onChange: (draft: WeekDraft) => void; onChooseWeek: (week: string) => void;
  onSave: (change: Record<string, unknown>, message: string) => Promise<boolean> };

export default function CalendarAvailability({ enabled, overrides, holidays, draft, busy, onChange, onChooseWeek, onSave }: Props) {
  const { weekStart, availability, label } = draft;
  return <div id="calendar-availability">
    <p className="meta">{enabled ? "Holiday preset on" : "Holiday preset off"} · {overrides.length} week overrides</p>
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
      <div className="board-fields"><label>Week starting (Monday)<input id="settings-week" type="date" value={weekStart} required onChange={(event) => onChooseWeek(event.target.value ? mondayOf(event.target.value) : "")} /></label>
        <label>Week availability %<input type="number" min="0" max="100" step="1" value={availability} required onChange={(event) => onChange({ ...draft, availability: event.target.value })} /></label>
        <label>Week label (optional)<input value={label} maxLength={120} onChange={(event) => onChange({ ...draft, label: event.target.value })} /></label></div>
      {weekStart && <p className="meta">Applies {shortCalendarDate(weekStart)} – {shortCalendarDate(addCalendarDays(weekStart, 6))} in the team's timezone. Use 100% to restore a holiday week.</p>}
      <button className="secondary" disabled={busy || !weekStart}>Save week availability</button>
    </form>
    {overrides.length > 0 && <ul className="week-override-list">{overrides.map((week) => <li key={week.weekStart}>
      <span>{week.weekStart} · {Math.round(week.availability * 100)}%{week.label ? ` · ${week.label}` : ""}</span>
      <button type="button" className="text-button" disabled={busy} aria-label={`Remove override for ${week.weekStart}`} onClick={() => void onSave({ type: "weeklyAvailability", weekStart: week.weekStart, remove: true }, "Week override removed.")}>Remove override</button>
    </li>)}</ul>}
  </div>;
}
