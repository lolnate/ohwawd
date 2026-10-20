"use client";

import type { ForecastResult } from "@/lib/forecast";
import { addCalendarDays, calendarDaysBetween, cycleLocalDates, planningWeeks, shortCalendarDate, timelineSpan, type CalendarCycle, type CalendarAdjustment, type PlanningWeek, type WeeklyAvailability } from "@/lib/planning-calendar";
import type { QueueState } from "@/lib/sequencing";
import type { BoardProject } from "./project-plan-card";

type Props = { name: string; projects: BoardProject[]; forecast: ForecastResult; cycles: CalendarCycle[]; timezone: string; anchorDate: string;
  weeklyAdjustments: WeeklyAvailability[]; holidays: WeeklyAvailability[]; cycleAdjustments: CalendarAdjustment[]; sequencing: QueueState;
  onEditWeek: (week: PlanningWeek) => void; onOpenProject: (project: BoardProject) => void };

export default function StreamTimeline({ name, projects, forecast, cycles, timezone, anchorDate, weeklyAdjustments, holidays, cycleAdjustments, sequencing, onEditWeek, onOpenProject }: Props) {
  const weeks = planningWeeks({ cycles, timezone, anchorDate, overrides: weeklyAdjustments, holidays, adjustments: cycleAdjustments });
  const months: { key: string; label: string; count: number }[] = [];
  for (const week of weeks) {
    const prior = months.at(-1);
    if (prior?.key === week.month) prior.count++;
    else months.push({ key: week.month, label: week.monthLabel, count: 1 });
  }
  const weekTitle = (week: PlanningWeek) => `Week of ${shortCalendarDate(week.start)} – ${shortCalendarDate(addCalendarDays(week.end, -1))}: ${week.label}, ${Math.round(week.availability * 100)}% availability. ${week.coverage === "none" ? "No imported Linear calendar." : week.coverage === "partial" ? "Partial Linear calendar coverage." : "Imported Linear calendar."}`;
  const hasMissing = weeks.some((week) => week.coverage !== "full");
  return <div className="stream-calendar">
    <div className="timeline-scroll calendar-scroll" role="region" aria-label={`${name} forecast timeline. Months and weeks; scroll horizontally for later dates.`} tabIndex={0}>
      <table className="month-week-timeline" style={{ "--week-count": weeks.length } as React.CSSProperties}>
        <colgroup><col className="timeline-project-col" />{weeks.map((week) => <col className="timeline-week-col" key={week.start} />)}</colgroup>
        <thead>
          <tr className="timeline-months"><th rowSpan={3} className="timeline-project-heading" scope="col">Project<span>Dependency order · cycle-based forecast</span></th>
            {months.map((month) => <th key={month.key} colSpan={month.count} scope="colgroup">{month.label}</th>)}
          </tr>
          <tr className="timeline-weeks">{weeks.map((week) => <th key={week.start} scope="col" data-week-start={week.start}
            className={`${week.availability < 1 ? "reduced-week " : ""}${week.coverage === "none" ? "no-calendar" : ""}`}>
            <button type="button" onClick={() => onEditWeek(week)} aria-label={`Edit week of ${week.start}`} title={weekTitle(week)}>
              {shortCalendarDate(week.start)}<small>{week.availability < 1 || week.overridden ? `${Math.round(week.availability * 100)}%` : "Week of"}</small>
            </button>
          </th>)}</tr>
          <tr className="timeline-cycle-context">{weeks.map((week) => <th key={week.start} title={week.cycleIds.map((id) => {
            const cycle = cycles.find((item) => item.id === id)!;
            const range = cycleLocalDates(cycle, timezone);
            return `${cycle.name || `Cycle ${cycle.number}`}: ${range.start} – ${addCalendarDays(range.end, -1)}`;
          }).join("; ") || "No imported Linear cycle"}>
            {week.cycleIds.length ? week.cycleIds.map((id) => `C${cycles.find((cycle) => cycle.id === id)!.number}`).join(" / ") : "—"}
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
              <span className={blockers.length ? "timeline-after" : ""} title={blockers.length ? `After ${blockers.join(", ")}` : undefined}>{blockers.length ? `After ${blockers.join(", ")}` : projection?.provisional ? "Provisional scope" : "Estimated scope"}</span>
            </th>
            <td colSpan={weeks.length} className="timeline-track-cell"><div className="timeline-track">
              {weeks.map((week, index) => <span key={week.start} aria-hidden="true" data-week-band={week.start}
                className={`timeline-week-band ${week.availability < 1 ? "reduced-week" : ""} ${week.coverage === "none" ? "no-calendar" : week.coverage === "partial" ? "partial-calendar" : ""}`}
                style={{ left: `${index / weeks.length * 100}%`, width: `${100 / weeks.length}%` }} />)}
              {span ? <div className={`calendar-project-bar${partial ? " continuing" : ""}${projection?.provisional ? " provisional" : ""}`} style={{ left: `${span.left}%`, width: `${span.width}%` }}
                title={`${project.name}: starts ${start}; ${partial ? `continues beyond the simulated calendar. ${reason}` : `finishes at cycle end ${finalCycle!.end}`}`}>
                <span>{partial ? "Continues →" : calendarDaysBetween(start!, end!) <= 7 ? `Ends ${shortCalendarDate(finalCycle!.end)}` : `${shortCalendarDate(start!)} – ${shortCalendarDate(finalCycle!.end)}`}</span>
              </div> : <span className="calendar-row-reason" title={reason}>{reason}</span>}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="calendar-legend"><span className="calendar-legend-swatch reduced-week" /> Reduced availability · select a week to edit. {hasMissing && <><span className="calendar-legend-swatch no-calendar" /> Shaded weeks have missing or partial Linear calendar coverage; no delivery dates are invented.</>}</p>
    <p className="calendar-coverage-note">{cycles.length ? `Imported forecast calendar through ${addCalendarDays(cycleLocalDates(cycles.at(-1)!, timezone).end, -1)} (${timezone}). Add upcoming cycles in Linear to forecast further.` : "No upcoming Linear cycles are available. Calendar weeks are shown for planning only."}</p>
  </div>;
}
