"use client";

import type { ForecastResult } from "@/lib/forecast";
import { addCalendarDays, calendarDaysBetween, cycleLocalDates, planningWeeks, shortCalendarDate, timelineSpan, type CalendarCycle, type CalendarAdjustment, type PlanningWeek, type WeeklyAvailability } from "@/lib/planning-calendar";
import type { QueueState } from "@/lib/sequencing";
import type { BoardProject } from "./project-plan-card";
import { planningCycleLabel, shortLinearCycleLabel } from "@/lib/cycles";
import type { CalendarProjection } from "@/lib/cycle-projection";
import { teamLocalDate } from "@/lib/project-scope";

type Props = { name: string; projects: BoardProject[]; forecast: ForecastResult; cycles: CalendarCycle[]; timezone: string; anchorDate: string;
  weeklyAdjustments: WeeklyAvailability[]; holidays: WeeklyAvailability[]; cycleAdjustments: CalendarAdjustment[]; sequencing: QueueState; calendarProjection?: CalendarProjection;
  onEditWeek: (week: PlanningWeek) => void; onOpenProject: (project: BoardProject) => void };

export default function StreamTimeline({ name, projects, forecast, cycles, timezone, anchorDate, weeklyAdjustments, holidays, cycleAdjustments, sequencing, calendarProjection, onEditWeek, onOpenProject }: Props) {
  const weeks = planningWeeks({ cycles, timezone, anchorDate, overrides: weeklyAdjustments, holidays, adjustments: cycleAdjustments });
  const months: { key: string; label: string; count: number }[] = [];
  for (const week of weeks) {
    const prior = months.at(-1);
    if (prior?.key === week.month) prior.count++;
    else months.push({ key: week.month, label: week.monthLabel, count: 1 });
  }
  const weekTitle = (week: PlanningWeek) => `Week of ${shortCalendarDate(week.start)} – ${shortCalendarDate(addCalendarDays(week.end, -1))}: ${week.label}, ${Math.round(week.availability * 100)}% availability. ${week.projected ? "Includes cadence-projected cycles. " : ""}${week.coverage === "none" ? "No active cycle: cooldown or unavailable calendar." : week.coverage === "partial" ? "Partial cycle coverage." : week.projected ? "Projected planning calendar." : "Imported Linear calendar."}`;
  const hasMissing = weeks.some((week) => week.coverage !== "full");
  const projectedCount = cycles.filter((cycle) => cycle.projected).length;
  const importedCount = cycles.length - projectedCount;
  const importedThrough = calendarProjection?.importedThrough ?? cycles.filter((cycle) => !cycle.projected).at(-1)?.endsAt;
  const throughDate = (timestamp: string) => teamLocalDate(new Date(Date.parse(timestamp) - 1), timezone);
  return <div className="stream-calendar">
    <div className="timeline-scroll calendar-scroll" role="region" aria-label={`${name} forecast timeline. Months and weeks; scroll horizontally for later dates.`} tabIndex={0}>
      <table className="month-week-timeline" style={{ "--week-count": weeks.length } as React.CSSProperties}>
        <colgroup><col className="timeline-project-col" />{weeks.map((week) => <col className="timeline-week-col" key={week.start} />)}</colgroup>
        <thead>
          <tr className="timeline-months"><th rowSpan={3} className="timeline-project-heading" scope="col">Project<span>Dependency order · cycle-based forecast</span></th>
            {months.map((month) => <th key={month.key} colSpan={month.count} scope="colgroup">{month.label}</th>)}
          </tr>
          <tr className="timeline-weeks">{weeks.map((week) => <th key={week.start} scope="col" data-week-start={week.start}
            className={`${week.availability < 1 ? "reduced-week " : ""}${week.projected ? "projected-week " : ""}${week.coverage === "none" ? "no-calendar" : ""}`}>
            <button type="button" onClick={() => onEditWeek(week)} aria-label={`Edit week of ${week.start}`} title={weekTitle(week)}>
              {shortCalendarDate(week.start)}<small>{week.availability < 1 || week.overridden ? `${Math.round(week.availability * 100)}%` : "Week of"}</small>
            </button>
          </th>)}</tr>
          <tr className="timeline-cycle-context">{weeks.map((week) => <th key={week.start} title={week.cycleIds.map((id) => {
            const cycle = cycles.find((item) => item.id === id)!;
            const range = cycleLocalDates(cycle, timezone);
            return `${planningCycleLabel(cycle)}: ${range.start} – ${addCalendarDays(range.end, -1)}`;
          }).join("; ") || "No active cycle: cooldown or unavailable calendar"}>
            {week.cycleIds.length ? week.cycleIds.map((id, index) => {
              const cycle = cycles.find((item) => item.id === id)!;
              return <span key={id} className={cycle.projected ? "projected-cycle-label" : undefined}>{index > 0 ? " / " : ""}{shortLinearCycleLabel(cycle)}{cycle.projected ? "*" : ""}</span>;
            }) : "—"}
          </th>)}</tr>
        </thead>
        <tbody>{projects.map((project) => {
          const projection = forecast.packages.find((item) => item.id === project.id);
          const predecessors = [...new Set(sequencing.dependencies.filter((edge) => edge.successorId === project.id).map((edge) => edge.predecessorId))];
          const blockers = predecessors.map((id) => sequencing.packages.find((item) => item.id === id)?.name ?? "Unavailable project");
          const start = projection?.start ? forecast.cycles[projection.start - 1]?.start ?? null : null;
          const finalCycle = projection?.finish ? forecast.cycles[projection.finish - 1] : forecast.cycles.at(-1);
          const end = start && finalCycle ? addCalendarDays(finalCycle.end, 1) : null;
          const span = start && end ? timelineSpan(start, end, weeks[0].start, weeks.length) : null;
          const partial = !!start && projection?.finish === null;
          const reason = projection?.finish === 0 ? "Complete before the next forecast cycle" : projection?.reason || "No forecast date yet";
          return <tr key={project.id} data-timeline-project={project.id}>
            <th scope="row" className="timeline-project-heading"><button className="timeline-project-link" title={project.name} onClick={() => onOpenProject(project)}>{project.name}</button>
              <span className={blockers.length ? "timeline-after" : ""} title={blockers.length ? `After ${blockers.join(", ")}` : undefined}>{blockers.length ? `After ${blockers.join(", ")}` : projection?.calendarProjected ? "Projected cycle dates" : projection?.provisional ? "Provisional scope" : "Estimated scope"}</span>
            </th>
            <td colSpan={weeks.length} className="timeline-track-cell"><div className="timeline-track">
              {weeks.map((week, index) => <span key={week.start} aria-hidden="true" data-week-band={week.start}
                className={`timeline-week-band ${week.availability < 1 ? "reduced-week" : ""} ${week.projected ? "projected-calendar" : ""} ${week.coverage === "none" ? "no-calendar" : week.coverage === "partial" ? "partial-calendar" : ""}`}
                style={{ left: `${index / weeks.length * 100}%`, width: `${100 / weeks.length}%` }} />)}
              {span ? <div className={`calendar-project-bar${partial ? " continuing" : ""}${projection?.provisional ? " provisional" : ""}${projection?.calendarProjected ? " uses-projected-cycles" : ""}`} style={{ left: `${span.left}%`, width: `${span.width}%` }}
                title={`${project.name}: starts ${start}; ${partial ? `continues beyond the simulated calendar. ${reason}` : `finishes at cycle end ${finalCycle!.end}`}${projection?.calendarProjected ? "; provisional date using projected cycles" : ""}`}>
                <span>{partial ? "Continues →" : calendarDaysBetween(start!, end!) <= 7 ? `Ends ${shortCalendarDate(finalCycle!.end)}` : `${shortCalendarDate(start!)} – ${shortCalendarDate(finalCycle!.end)}`}</span>
              </div> : <span className="calendar-row-reason" title={reason}>{reason}</span>}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="calendar-legend"><span className="calendar-legend-swatch reduced-week" /> Reduced availability · select a week to edit.
      {projectedCount > 0 && <><span className="calendar-legend-swatch projected-calendar" /> * Projected from Linear cadence; dates using this capacity are provisional.</>}
      {hasMissing && <><span className="calendar-legend-swatch no-calendar" /> Uncovered dates have no active cycle, including cooldowns or unavailable calendar.</>}
    </p>
    <p className="calendar-coverage-note">{importedThrough ? `Synced calendar through ${throughDate(importedThrough)} (${timezone}). ` : "No imported upcoming cycles. "}
      {projectedCount > 0 ? `${importedCount} imported · ${projectedCount} projected cycles shown. Projected through ${throughDate(cycles.at(-1)!.endsAt)} using ${calendarProjection?.cadence.durationWeeks ?? "configured"}-week cycles and ${calendarProjection?.cadence.cooldownWeeks ?? 0}-week cooldown.` : calendarProjection?.reason || "No additional projected cycles are needed for this calendar."}
    </p>
  </div>;
}
