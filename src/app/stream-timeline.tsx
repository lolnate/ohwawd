"use client";

import type { ForecastResult } from "@/lib/forecast";
import { addCalendarDays, cycleLocalDates, planningWeeks, shortCalendarDate, timelineSpan, type CalendarCycle, type CalendarAdjustment, type PlanningWeek, type WeeklyAvailability } from "@/lib/planning-calendar";
import type { QueueState } from "@/lib/sequencing";
import type { BoardProject } from "./project-plan-card";
import { planningCycleLabel, shortLinearCycleLabel } from "@/lib/cycles";
import type { CalendarProjection } from "@/lib/cycle-projection";
import { teamLocalDate } from "@/lib/project-scope";
import { outcomeRows, projectCodes, type OutcomePlacement, type OutcomeProjectLink } from "@/lib/outcome-planning";

type Props = { name: string; streamId: string; projects: BoardProject[]; outcomes: OutcomePlacement[]; links: OutcomeProjectLink[]; streams: { id: string; name: string }[]; forecast: ForecastResult; cycles: CalendarCycle[]; timezone: string; anchorDate: string;
  weeklyAdjustments: WeeklyAvailability[]; holidays: WeeklyAvailability[]; cycleAdjustments: CalendarAdjustment[]; sequencing: QueueState; calendarProjection?: CalendarProjection;
  onEditWeek: (week: PlanningWeek) => void; onOpenProject: (project: BoardProject) => void };

export default function StreamTimeline({ name, streamId, projects, outcomes, links, streams, forecast, cycles, timezone, anchorDate, weeklyAdjustments, holidays, cycleAdjustments, sequencing, calendarProjection, onEditWeek, onOpenProject }: Props) {
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
  const rows = outcomeRows(streamId, projects, outcomes, links);
  const codes = projectCodes(projects);
  const countedLocation = (project: BoardProject) => {
    const owner = outcomes.find((outcome) => outcome.id === project.capacity_outcome_id);
    const stream = streams.find((stream) => stream.id === project.stream_id);
    return !project.selected ? "Deferred; not counted" : `${owner?.title ?? "Other selected work"} · ${stream?.name ?? "Needs assignment"}`;
  };
  return <div className="stream-calendar">
    <div className="timeline-scroll calendar-scroll" role="region" aria-label={`${name} forecast timeline. Months and weeks; scroll horizontally for later dates.`} tabIndex={0}>
      <table className="month-week-timeline" style={{ "--week-count": weeks.length } as React.CSSProperties}>
        <colgroup><col className="timeline-project-col" />{weeks.map((week) => <col className="timeline-week-col" key={week.start} />)}</colgroup>
        <thead>
          <tr className="timeline-months"><th rowSpan={3} className="timeline-project-heading" scope="col">Outcome<span>Project sequence · counted once</span></th>
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
        <tbody>{rows.map((row) => {
          const entries = row.projects.map((project) => {
            const projection = forecast.packages.find((item) => item.id === project.id);
            const predecessors = [...new Set(sequencing.dependencies.filter((edge) => edge.successorId === project.id).map((edge) => edge.predecessorId))];
            const blockers = predecessors.map((id) => sequencing.packages.find((item) => item.id === id)?.name ?? "Unavailable project");
            const start = projection?.start ? forecast.cycles[projection.start - 1]?.start ?? null : null;
            const finalCycle = projection?.finish ? forecast.cycles[projection.finish - 1] : forecast.cycles.at(-1);
            const end = start && finalCycle ? addCalendarDays(finalCycle.end, 1) : null;
            const span = project.selected && start && end && weeks.length ? timelineSpan(start, end, weeks[0].start, weeks.length) : null;
            const partial = !!start && projection?.finish === null;
            const reason = !project.selected ? "Deferred · not counted" : projection?.finish === 0 ? "Complete before the next forecast cycle" : projection?.reason || "No forecast date yet";
            const counted = project.selected && project.stream_id === streamId && (!row.outcome || project.capacity_outcome_id === row.id);
            const optional = links.some((link) => link.outcome_id === row.id && link.project_id === project.project_id && link.requirement === "optional");
            const detail = `${project.name} (${codes.get(project.id)}): ${counted ? `${projection?.demand ?? 0} pts counted here` : `Shared · 0 pts here. Counted in ${countedLocation(project)}`}. ${span ? `Starts ${start}; ${partial ? `continues beyond the simulated calendar. ${reason}` : `finishes at cycle end ${finalCycle!.end}`}` : reason}${blockers.length ? `. After ${blockers.join(", ")}` : ""}${optional ? ". Optional for this outcome" : ""}${!project.in_scope ? ". Hidden from source view" : ""}${projection?.calendarProjected ? ". Provisional date using projected cycles" : ""}`;
            return { project, projection, span, partial, reason, counted, optional, detail, blockers, lane: 0 };
          });
          const ownedEnds: number[] = [], sharedEnds: number[] = [];
          for (const entry of entries.filter((entry) => entry.span).sort((a, b) => a.span!.left - b.span!.left || a.project.id.localeCompare(b.project.id))) {
            const ends = entry.counted ? ownedEnds : sharedEnds;
            const available = ends.findIndex((end) => end <= entry.span!.left + 0.001);
            entry.lane = available < 0 ? ends.length : available;
            ends[entry.lane] = entry.span!.left + entry.span!.width;
          }
          const sharedTop = 16 + ownedEnds.length * 36 + (sharedEnds.length ? 22 : 0);
          const height = Math.max(72, sharedEnds.length ? sharedTop + sharedEnds.length * 36 + 10 : 26 + ownedEnds.length * 36);
          const countedPoints = entries.filter((entry) => entry.counted).reduce((sum, entry) => sum + (entry.projection?.demand ?? 0), 0);
          const outcomeForecast = forecast.outcomes.find((outcome) => outcome.id === row.id);
          return <tr key={row.id} data-timeline-outcome={row.id}>
            <th scope="row" className="timeline-project-heading"><strong className="timeline-outcome-title">{row.title}</strong>
              <span>{countedPoints.toLocaleString()} pts counted here · {entries.length} projects</span>
              {outcomeForecast && <span>{outcomeForecast.endDate ? `Delivery ${shortCalendarDate(outcomeForecast.endDate)}` : outcomeForecast.status.replaceAll("_", " ")}{outcomeForecast.status === "provisional" ? " · provisional" : ""}</span>}
              <details className="outcome-project-key"><summary>Project key & dependencies</summary>{entries.map((entry) => <button key={entry.project.id} onClick={() => onOpenProject(entry.project)} title={entry.detail}>
                <b>{codes.get(entry.project.id)}</b> {entry.project.name}<small>{entry.counted ? "Counts here" : `Shared · 0 pts here · ${countedLocation(entry.project)}`}{entry.optional ? " · optional" : ""}{!entry.project.in_scope ? " · hidden" : ""}{entry.blockers.length ? ` · After ${entry.blockers.join(", ")}` : ""}</small>
              </button>)}</details>
            </th>
            <td colSpan={weeks.length} className="timeline-track-cell"><div className="timeline-track outcome-timeline-track" style={{ height }}>
              {weeks.map((week, index) => <span key={week.start} aria-hidden="true" data-week-band={week.start}
                className={`timeline-week-band ${week.availability < 1 ? "reduced-week" : ""} ${week.projected ? "projected-calendar" : ""} ${week.coverage === "none" ? "no-calendar" : week.coverage === "partial" ? "partial-calendar" : ""}`}
                style={{ left: `${index / weeks.length * 100}%`, width: `${100 / weeks.length}%` }} />)}
              {sharedEnds.length > 0 && <span className="shared-band-caption" style={{ top: sharedTop - 20 }}>Shared dependencies / contributions · 0 pts here</span>}
              {entries.filter((entry) => entry.span).map((entry) => <button key={entry.project.id} type="button" data-timeline-project={entry.project.id} data-counted={entry.counted}
                className={`calendar-project-bar outcome-project-block${entry.counted ? " counted-project" : " shared-project"}${entry.partial ? " continuing" : ""}${entry.projection?.provisional ? " provisional" : ""}${entry.projection?.calendarProjected ? " uses-projected-cycles" : ""}`}
                style={{ left: `${entry.span!.left}%`, width: `${entry.span!.width}%`, top: (entry.counted ? 14 : sharedTop) + entry.lane * 36 }}
                aria-label={entry.detail} title={entry.detail} onClick={() => onOpenProject(entry.project)}>
                <span>{codes.get(entry.project.id)}{entry.counted ? ` · ${entry.projection?.demand ?? 0} pts` : " · Shared ↗"}{entry.blockers.length ? ` ← ${sequencing.dependencies.filter((edge) => edge.successorId === entry.project.id).map((edge) => codes.get(edge.predecessorId) ?? "?").join(", ")}` : ""}{entry.optional ? " · opt" : ""}{entry.partial ? " · Continues →" : ""}</span>
              </button>)}
              {!entries.length && <span className="calendar-row-reason">No linked projects yet</span>}
            </div>{entries.some((entry) => !entry.span) && <div className="outcome-unscheduled">{entries.filter((entry) => !entry.span).map((entry) => <button key={entry.project.id} type="button" data-timeline-project={entry.project.id} data-counted={entry.counted} className={`unscheduled-project${entry.counted ? "" : " shared-project"}`} title={entry.detail} onClick={() => onOpenProject(entry.project)}>
              <b>{codes.get(entry.project.id)}</b> · {entry.reason}{entry.counted ? "" : " · 0 pts here"}{entry.optional ? " · optional" : ""}{entry.blockers.length ? ` · After ${entry.blockers.join(", ")}` : ""}
            </button>)}</div>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="calendar-legend"><span className="calendar-legend-swatch reduced-week" /> Reduced availability · select a week to edit.
      <span className="calendar-legend-swatch counted-project" /> Solid: points counted here. <span className="calendar-legend-swatch shared-project" /> Outlined: shared reference, 0 pts here. Select a project to inspect or change its owner.
      {projectedCount > 0 && <><span className="calendar-legend-swatch projected-calendar" /> * Projected from Linear cadence; dates using this capacity are provisional.</>}
      {hasMissing && <><span className="calendar-legend-swatch no-calendar" /> Uncovered dates have no active cycle, including cooldowns or unavailable calendar.</>}
    </p>
    <p className="calendar-coverage-note">{importedThrough ? `Synced calendar through ${throughDate(importedThrough)} (${timezone}). ` : "No imported upcoming cycles. "}
      {projectedCount > 0 ? `${importedCount} imported · ${projectedCount} projected cycles shown. Projected through ${throughDate(cycles.at(-1)!.endsAt)} using ${calendarProjection?.cadence.durationWeeks ?? "configured"}-week cycles and ${calendarProjection?.cadence.cooldownWeeks ?? 0}-week cooldown.` : calendarProjection?.reason || "No additional projected cycles are needed for this calendar."}
    </p>
  </div>;
}
