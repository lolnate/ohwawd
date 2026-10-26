"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ForecastResult } from "@/lib/forecast";
import { addCalendarDays, cycleLocalDates, fractionalTimelineSpan, planningWeeks, shortCalendarDate, timelineSpan, type CalendarCycle, type CalendarAdjustment, type PlanningWeek, type WeeklyAvailability } from "@/lib/planning-calendar";
import type { QueueState } from "@/lib/sequencing";
import type { BoardProject } from "./project-plan-card";
import { planningCycleLabel, shortLinearCycleLabel } from "@/lib/cycles";
import type { CalendarProjection } from "@/lib/cycle-projection";
import { outcomeRows, projectCodes, type OutcomePlacement, type OutcomeProjectLink } from "@/lib/outcome-planning";
import { outcomeLifecycleSummary } from "./outcome-lifecycle-view";

type Props = { name: string; streamId: string; projects: BoardProject[]; outcomes: OutcomePlacement[]; links: OutcomeProjectLink[]; streams: { id: string; name: string }[]; forecast: ForecastResult; cycles: CalendarCycle[]; timezone: string; anchorDate: string;
  weeklyAdjustments: WeeklyAvailability[]; holidays: WeeklyAvailability[]; cycleAdjustments: CalendarAdjustment[]; sequencing: QueueState; calendarProjection?: CalendarProjection;
  onEditWeek: (week: PlanningWeek) => void; onOpenProject: (project: BoardProject) => void; renderOutcome?: (id: string) => ReactNode; onOpenOutcome?: (id: string, opener: HTMLElement) => void };

export default function StreamTimeline({ name, streamId, projects, outcomes, links, streams, forecast, cycles, timezone, anchorDate, weeklyAdjustments, holidays, cycleAdjustments, sequencing, onEditWeek, onOpenProject, renderOutcome, onOpenOutcome }: Props) {
  const labelElements = useRef(new Map<string, HTMLDivElement>());
  const [labelHeights, setLabelHeights] = useState<Record<string, number>>({});
  const outcomeKey = outcomes.filter((outcome) => outcome.stream_id === streamId).map((outcome) => outcome.id).join("\0");
  useLayoutEffect(() => {
    if (!renderOutcome) return;
    const update = () => setLabelHeights((current) => {
      const next = Object.fromEntries([...labelElements.current].map(([id, element]) => [id, Math.ceil(element.getBoundingClientRect().height) + 24]));
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
    const observer = new ResizeObserver(update); labelElements.current.forEach((element) => observer.observe(element)); update();
    return () => observer.disconnect();
  }, [outcomeKey, !!renderOutcome]);
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
  const rows = outcomeRows(streamId, projects, outcomes, links, sequencing.dependencies);
  const codes = projectCodes(projects);
  const accountingContext = (project: BoardProject) => {
    const owner = outcomes.find((outcome) => outcome.id === project.capacity_outcome_id);
    const stream = streams.find((stream) => stream.id === project.stream_id);
    if (!project.selected) return `${project.roadmap_state === "candidate" ? "Needs assignment" : project.roadmap_state === "deferred" ? "Deferred" : project.roadmap_state === "dismissed" ? "Dismissed" : "Excluded"} · no capacity counted`;
    return owner || stream ? `Counted in ${owner?.title ?? "Other selected work"} · ${stream?.name ?? "Needs assignment"}` : "Needs assignment · no capacity counted";
  };
  const referenceLabel = (project: BoardProject, derived: boolean) => derived ? "Prerequisite" : project.selected ? "Shared" : project.roadmap_state === "candidate" ? "Needs assignment" : project.roadmap_state === "deferred" ? "Deferred" : project.roadmap_state === "dismissed" ? "Dismissed" : "Excluded";
  const outcomeStatus = (outcome: ForecastResult["outcomes"][number]) => {
    if (outcome.endDate) return `Delivery ${shortCalendarDate(outcome.endDate)}`;
    if (outcome.status !== "blocked") return outcome.status.replaceAll("_", " ");
    const reasons = outcome.reasons.join(" ");
    const cause = /Dismissed/i.test(reasons) ? "Dismissed" : /Deferred/i.test(reasons) ? "Deferred" : /Needs assignment|owning outcome/i.test(reasons) ? "Needs assignment" : /estimate|Extra scope|No issue/i.test(reasons) ? "Missing estimate" : /Waiting for|Blocked by/i.test(reasons) ? "Dependency" : /Cross-team/i.test(reasons) ? "Cross-team" : /latest Linear import/i.test(reasons) ? "Source review" : /project order/i.test(reasons) ? "Project order" : "Project attention";
    return `Blocked · ${cause}`;
  };
  return <div className={`stream-calendar${renderOutcome ? " outcome-priority-calendar" : ""}`}>
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
            // All appearances use the owning package's primary-stream simulation.
            // An unfinished package may occupy a slot through zero-capacity cycles;
            // those cycles are not simulated progress and must not extend its bar.
            const firstProgress = projection?.consumed.findIndex((points) => points > 0) ?? -1;
            const lastProgress = projection?.consumed.reduce((last, points, index) => points > 0 ? index : last, -1) ?? -1;
            const partial = projection?.finish === null && firstProgress >= 0;
            const startCycle = partial ? firstProgress : projection?.start ? projection.start - 1 : -1;
            const start = forecast.cycles[startCycle]?.start ?? null;
            const finalCycle = projection?.finish ? forecast.cycles[projection.finish - 1] : forecast.cycles[lastProgress];
            const end = start && finalCycle ? addCalendarDays(finalCycle.end, 1) : null;
            const finalBudget = finalCycle?.streams.find((item) => item.id === project.stream_id)?.budget ?? 0;
            const finalConsumed = projection?.finish ? projection.consumed[projection.finish - 1] ?? 0 : 0;
            const finishFraction = projection?.finish && finalBudget > 0 ? Math.min(1, finalConsumed / finalBudget) : 1;
            const span = project.selected && start && end && weeks.length ? projection?.finish
              ? fractionalTimelineSpan(start, finalCycle!.start, end, finishFraction, weeks[0].start, weeks.length)
              : timelineSpan(start, end, weeks[0].start, weeks.length) : null;
             const reason = projection?.finish === 0 ? "Complete before the next forecast cycle" : !project.selected ? `${project.roadmap_state ?? "Deferred"} · not counted` : projection?.reason || "No forecast date yet";
            const derived = row.derivedProjectIds.includes(project.id);
            const counted = !derived && project.selected && project.stream_id === streamId && (!row.outcome || project.capacity_outcome_id === row.id);
            const optional = !!row.outcome && !forecast.outcomes.find((item) => item.id === row.id)?.requiredIds.includes(project.id);
            const successors = row.immediateEdges.filter((edge) => edge.predecessorId === project.id).map((edge) => projects.find((item) => item.id === edge.successorId)?.name ?? "unavailable project");
             const label = referenceLabel(project, derived);
             const detail = `${project.name} (${codes.get(project.id)}): ${derived ? `Prerequisite reference · 0 pts here. ${accountingContext(project)}` : counted ? `${projection?.demand ?? 0} pts counted here` : `${label} · 0 pts here. ${accountingContext(project)}`}. ${span ? `Starts ${start}; ${partial ? `simulated progress through ${finalCycle!.end}; continues beyond the simulated calendar without a forecast finish. ${reason}` : `uses ${Math.round(finishFraction * 100)}% of its final cycle ending ${finalCycle!.end}`}` : reason}${successors.length ? `. Immediate prerequisite for ${successors.join(", ")}` : ""}${blockers.length ? `. After ${blockers.join(", ")}` : ""}${row.outcome ? optional ? ". Optional context for this outcome" : ". Required for delivery" : ""}${!project.in_scope ? ". Hidden from source view" : ""}${projection?.calendarProjected ? ". Provisional date using projected cycles" : ""}`;
             return { project, projection, span, partial, reason, counted, derived, optional, detail, label, blockers, finishFraction, lane: 0 };
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
          const unscheduled = entries.filter((entry) => !entry.span);
          const outcomeForecast = forecast.outcomes.find((outcome) => outcome.id === row.id);
          const footerCount = unscheduled.length + row.unavailablePrerequisiteIds.length;
          const footerHeight = footerCount * 32;
           const trackHeight = Math.max(height + (footerCount ? footerHeight + 5 : 0), labelHeights[row.id] ?? 0);
          const entryById = new Map(entries.map((entry) => [entry.project.id, entry]));
          const connectors = row.immediateEdges.flatMap((edge) => { const predecessor = entryById.get(edge.predecessorId), successor = entryById.get(edge.successorId);
            return predecessor?.span && successor?.span ? [{ edge, predecessor, successor, predecessorSpan: predecessor.span, successorSpan: successor.span }] : []; });
          const topOf = (entry: typeof entries[number]) => (entry.counted ? 14 : sharedTop) + entry.lane * 36;
          const markerId = `dependency-arrow-${row.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          return <tr key={row.id} data-timeline-outcome={row.id}>
              <th scope="row" className="timeline-project-heading">{renderOutcome && row.outcome ? <div className="timeline-outcome-controls-content" ref={(element) => { if (element) labelElements.current.set(row.id, element); else labelElements.current.delete(row.id); }}>{renderOutcome(row.id)}{outcomeForecast && <span title={outcomeForecast.reasons.join(" ") || undefined}>{outcomeStatus(outcomeForecast)}</span>}{outcomeLifecycleSummary(row.outcome.lifecycle) && <span>{outcomeLifecycleSummary(row.outcome.lifecycle)}</span>}</div> : <>{onOpenOutcome && row.outcome ? <button type="button" className="text-button timeline-outcome-title" onClick={(event) => onOpenOutcome(row.id, event.currentTarget)}>{row.title}</button> : <strong className="timeline-outcome-title">{row.title}</strong>}
                {outcomeForecast && <span title={outcomeForecast.reasons.join(" ") || undefined}>{outcomeStatus(outcomeForecast)}{outcomeForecast.status === "provisional" ? " · provisional" : ""}</span>}{row.outcome && outcomeLifecycleSummary(row.outcome.lifecycle) && <span>{outcomeLifecycleSummary(row.outcome.lifecycle)}</span>}</>}
            </th>
             <td colSpan={weeks.length} className="timeline-track-cell"><div className="timeline-track outcome-timeline-track" style={{ height: trackHeight }}>
              {weeks.map((week, index) => <span key={week.start} aria-hidden="true" data-week-band={week.start}
                className={`timeline-week-band ${week.availability < 1 ? "reduced-week" : ""} ${week.projected ? "projected-calendar" : ""} ${week.coverage === "none" ? "no-calendar" : week.coverage === "partial" ? "partial-calendar" : ""}`}
                 style={{ left: `${index / weeks.length * 100}%`, width: `${100 / weeks.length}%` }} />)}
              {!!connectors.length && <svg className="outcome-dependency-connectors" viewBox={`0 0 100 ${trackHeight}`} preserveAspectRatio="none" aria-hidden="true"><defs><marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" /></marker></defs>{connectors.map(({ edge, predecessor, successor, predecessorSpan, successorSpan }) => {
                const fromX = predecessorSpan.left + predecessorSpan.width, toX = successorSpan.left;
                const fromY = topOf(predecessor) + 14, toY = topOf(successor) + 14, middle = fromX + Math.max(.5, (toX - fromX) / 2);
                return <path key={`${edge.predecessorId}:${edge.successorId}`} data-dependency-from={edge.predecessorId} data-dependency-to={edge.successorId} d={`M ${fromX} ${fromY} C ${middle} ${fromY}, ${middle} ${toY}, ${Math.max(fromX, toX - .25)} ${toY}`} markerEnd={`url(#${markerId})`} />;
              })}</svg>}
              {entries.filter((entry) => entry.span).map((entry) => <button key={entry.project.id} type="button" data-timeline-project={entry.project.id} data-counted={entry.counted}
                data-finish-fraction={entry.projection?.finish ? entry.finishFraction : undefined}
                data-hit-edge={entry.span!.left < 1 ? "start" : entry.span!.left + entry.span!.width > 99 ? "end" : undefined}
                data-derived-prerequisite={entry.derived || undefined} className={`calendar-project-bar outcome-project-block${entry.counted ? " counted-project" : " shared-project"}${entry.derived ? " prerequisite-project" : ""}${entry.partial ? " continuing" : ""}${entry.projection?.provisional ? " provisional" : ""}${entry.projection?.calendarProjected ? " uses-projected-cycles" : ""}`}
                style={{ left: `${entry.span!.left}%`, width: `${entry.span!.width}%`, top: (entry.counted ? 14 : sharedTop) + entry.lane * 36 }}
                aria-label={entry.detail} title={entry.detail} onClick={() => onOpenProject(entry.project)}>
                <span>{codes.get(entry.project.id)}{entry.derived ? " · Prerequisite ↗" : entry.counted ? ` · ${entry.projection?.demand ?? 0} pts` : ` · ${entry.label} ↗`}{entry.projection?.calendarProjected ? " *" : ""}{entry.blockers.length ? ` ← ${sequencing.dependencies.filter((edge) => edge.successorId === entry.project.id).map((edge) => codes.get(edge.predecessorId) ?? "?").join(", ")}` : ""}{entry.optional ? " · opt" : entry.derived ? " · req" : ""}{entry.partial ? " · Continues →" : ""}</span>
              </button>)}
              {!entries.length && <span className="calendar-row-reason">No linked projects yet</span>}
                {!!footerCount && <div className="outcome-unscheduled">{unscheduled.map((entry) => <button key={entry.project.id} type="button" data-timeline-project={entry.project.id} data-counted={entry.counted} data-derived-prerequisite={entry.derived || undefined} className={`unscheduled-project${entry.counted ? "" : " shared-project"}${entry.derived ? " prerequisite-project" : ""}`} aria-label={entry.detail} title={entry.detail} onClick={() => onOpenProject(entry.project)}>
              <b>{codes.get(entry.project.id)}</b>{entry.counted ? "" : ` · ${entry.label}`}{entry.optional ? " · Optional" : ""}
            </button>)}{row.unavailablePrerequisiteIds.map((id) => { const successors = row.immediateEdges.filter((edge) => edge.predecessorId === id).map((edge) => projects.find((item) => item.id === edge.successorId)?.name ?? edge.successorId);
              const optional = !!row.outcome && !outcomeForecast?.requiredIds.includes(id);
              const detail = `Unavailable prerequisite ${id}: 0 pts here. Immediate prerequisite for ${successors.join(", ")}. ${optional ? "Optional context for this outcome" : "Required for delivery"}. No forecast date or project details are available.`;
              return <span key={id} className="unscheduled-project shared-project prerequisite-project" data-unavailable-prerequisite={id} aria-label={detail} title={detail}><b>{id}</b> · Prerequisite unavailable · 0 pts here · {optional ? "optional context" : "required"}</span>; })}</div>}
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="calendar-legend"><span className="calendar-legend-swatch counted-project" /> Counted
      <span className="calendar-legend-swatch shared-project" /> Reference
      {projectedCount > 0 && <><span className="calendar-legend-swatch projected-calendar" /> * Provisional</>}
      {hasMissing && <><span className="calendar-legend-swatch no-calendar" /> No capacity</>}
    </p>
  </div>;
}
