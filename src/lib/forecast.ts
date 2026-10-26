import { linearCycleLabel, type PlanningCycle } from "./cycles";
import { orderConflicts } from "./sequencing";
import { cycleAvailability, holidayWeeksForRange, cycleLocalDates, type WeeklyAvailability } from "./planning-calendar";
import { effectivePredecessors, effectiveRequiredClosure, isActuallyComplete } from "./delivery-scope";
import { outcomeWaitTracker, type OutcomeWait, type PriorityBypass } from "./forecast-waiting";
import type { RoadmapState } from "./roadmap-planning";

export type ForecastPackage = {
  id: string; projectId: string; name: string; status: string; streamId: string | null;
  selected: boolean; sequence?: number | null; ownerOutcomeId?: string | null; roadmapState?: RoadmapState | null;
  known: number; openIssueCount: number; unknownIssueIds: string[]; crossTeam: boolean; needsReview: boolean; orderReview?: string | null; externalBlockers?: string[];
  extraScope?: { points: number; issueIds: string[] };
};
export type ForecastStream = { id: string; name: string; allocation: number; wip: number };
export type ForecastDependency = { predecessorId: string; successorId: string; source: "local" | "linear"; waived?: boolean };
export type ForecastOutcome = { id: string; title: string; neededBy: string | null; streamId?: string | null; rank?: number | null; links: { projectId: string; requirement: "minimum" | "optional" }[] };
export type LinearForecastCycle = PlanningCycle;
export type ForecastInput = {
  packages: ForecastPackage[]; streams: ForecastStream[]; dependencies: ForecastDependency[];
  outcomes: ForecastOutcome[]; baseline: number | null; reserve: number; linearCycles: LinearForecastCycle[];
  horizon: number; sourceAt: string; cycleAnchorAt?: string; timezone: string;
  adjustments?: { cycleId: string; availability: number; reserve: number | null }[];
  weeklyAdjustments?: WeeklyAvailability[]; holidaysEnabled?: boolean; holidayWeeks?: WeeklyAvailability[];
  schedulingMode?: "project" | "outcome";
};
export type PackageForecast = { id: string; demand: number; provisional: boolean; calendarProjected?: boolean; start: number | null; finish: number | null; reason: string | null; consumed: number[] };
export type CycleForecast = { id: string; number: number; name: string | null; projected?: boolean; index: number; start: string; end: string; available: number; availability?: number; streams: { id: string; budget: number; used: number; idle: number; active: string[] }[] };
export type OutcomeForecast = { id: string; status: "unplanned" | "setup_required" | "blocked" | "beyond_horizon" | "provisional" | "forecast"; calendarProjected?: boolean; finish: number | null; endDate: string | null; target: "no_target" | "met" | "missed" | "unknown"; gapCycles: number | null; reasons: string[]; requiredIds: string[]; waiting?: OutcomeWait[]; priorityBypass?: PriorityBypass[] };
export type ForecastResult = { ready: boolean; setup: string[]; cycles: CycleForecast[]; packages: PackageForecast[]; outcomes: OutcomeForecast[]; sourceAt: string; selectedKnown: number; selectedUnknown: number; unallocated: number; errors: string[] };

const milli = (value: number) => Math.round(value * 1000);
const points = (value: number) => value / 1000;
export function historicalBaseline(observations: number[]): number | null {
  if (observations.length < 3) return null;
  const sorted = observations.slice(0, 6).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function localDate(timestamp: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}
function cycleEdges(edges: ForecastDependency[], ids: Set<string>): string[] {
  const graph = new Map<string, string[]>();
  for (const edge of edges) if (!edge.waived && ids.has(edge.predecessorId) && ids.has(edge.successorId)) {
    graph.set(edge.predecessorId, [...(graph.get(edge.predecessorId) || []), edge.successorId]);
  }
  const color = new Map<string, number>();
  const loops: string[] = [];
  function visit(id: string): void {
    if (color.get(id) === 1) { loops.push(id); return; }
    if (color.get(id) === 2) return;
    color.set(id, 1);
    for (const next of graph.get(id) || []) visit(next);
    color.set(id, 2);
  }
  for (const id of ids) visit(id);
  return loops;
}

export function forecast(input: ForecastInput): ForecastResult {
  const setup: string[] = [];
  if (input.baseline === null || !Number.isFinite(input.baseline) || input.baseline < 0) setup.push("Set a provisional baseline in points per cycle.");
  const cycleAnchorAt = input.cycleAnchorAt ?? input.sourceAt;
  const futureCycles = input.linearCycles.filter((cycle) => !cycle.completedAt && new Date(cycle.startsAt).getTime() > new Date(cycleAnchorAt).getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, input.horizon);
  if (!futureCycles.length) setup.push("No upcoming Linear cycles were imported for this team. Configure upcoming cycles in Linear, then import again.");
  const allocated = input.streams.reduce((sum, stream) => sum + stream.allocation, 0);
  if (allocated <= 0) setup.push("Confirm stream allocations.");
  if (allocated > 1.000001) setup.push("Stream allocations exceed 100%.");
  const ids = new Set(input.packages.map((item) => item.id));
  const loops = cycleEdges(input.dependencies, ids);
  const errors = loops.length ? [`Dependency cycle involving ${loops.join(", ")}.`] : [];
  const ready = setup.length === 0 && errors.length === 0;
  const packages = new Map<string, PackageForecast>();
  const source = new Map(input.packages.map((item) => [item.id, item]));
  const streamIds = new Set(input.streams.map((item) => item.id));
  const remaining = new Map<string, number>();
  const outcomeMode = input.schedulingMode === "outcome";
  const owners = new Map(input.outcomes.map((outcome) => [outcome.id, outcome]));
  const predecessors = effectivePredecessors(input.dependencies);
  const requiredByOutcome = new Map(input.outcomes.map((outcome) => [outcome.id,
    effectiveRequiredClosure(outcome.links.filter((link) => link.requirement === "minimum").map((link) => `linear:${link.projectId}`), predecessors)]));
  const requiredTier = new Set([...requiredByOutcome.values()].flatMap((required) => [...required]));
  function validOwner(item: ForecastPackage) {
    const owner = item.ownerOutcomeId ? owners.get(item.ownerOutcomeId) : undefined;
    return !!owner && !!item.streamId && streamIds.has(item.streamId) && owner.streamId === item.streamId && Number.isSafeInteger(owner.rank) && owner.rank! > 0 && owner.links.some((link) => link.projectId === item.projectId);
  }
  const included = (item: ForecastPackage) => outcomeMode ? item.roadmapState === "included" && validOwner(item) : item.selected;
  const rank = (item: ForecastPackage) => owners.get(item.ownerOutcomeId!)?.rank ?? Number.MAX_SAFE_INTEGER;
  const preference = (a: ForecastPackage, b: ForecastPackage) =>
    (outcomeMode ? Number(!requiredTier.has(a.id)) - Number(!requiredTier.has(b.id)) || rank(a) - rank(b) : 0) ||
    (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
  const sequenceConflicts = orderConflicts({ streamIds: input.streams.map((stream) => stream.id), dependencies: input.dependencies,
    outcomeScoped: outcomeMode,
    packages: input.packages.map((item) => ({ id: item.id, name: item.name, selected: included(item), streamId: item.streamId, position: item.sequence ?? null,
      ownerId: item.ownerOutcomeId, complete: isActuallyComplete(item) })) });
  let selectedKnown = 0;
  let selectedUnknown = 0;
  for (const item of input.packages) {
    const covered = new Set(item.extraScope?.issueIds || []);
    const uncovered = item.unknownIssueIds.filter((id) => !covered.has(id));
    const demand = item.known + (item.extraScope?.points || 0);
    const complete = isActuallyComplete(item);
    const conflict = sequenceConflicts.find((conflict) => outcomeMode ? conflict.ownerId === item.ownerOutcomeId : conflict.streamId === item.streamId);
    let reason: string | null = null;
    if (complete) reason = null;
    else if (outcomeMode && item.roadmapState !== "included") reason = item.roadmapState === "deferred" ? "Deferred; future demand is excluded. Resume with a valid owning outcome to obtain a forecast." :
      `${item.roadmapState === "dismissed" ? "Dismissed from roadmap" : item.roadmapState === "candidate" ? "Needs assignment" : "Roadmap membership needs conversion"}; future demand is excluded. Include on roadmap and choose an owning outcome to obtain a dependent forecast.`;
    else if (outcomeMode && !validOwner(item)) reason = "Needs assignment: choose a linked owning outcome with a rank in the same active stream.";
    else if (!outcomeMode && !item.selected) reason = "Deferred; future demand is excluded. Pause execution in Linear separately if work is in progress.";
    else if (item.crossTeam) reason = "Cross-team project needs package decomposition.";
    else if (item.externalBlockers?.length) reason = `Blocked by ${item.externalBlockers.length} project${item.externalBlockers.length === 1 ? "" : "s"} outside the imported team.`;
    else if (item.needsReview) reason = "Missing from the latest Linear import; review source scope.";
    else if (item.orderReview || conflict) reason = `Resolve ${outcomeMode ? "owning outcome project order" : "stream sequence"}: ${item.orderReview ?? conflict!.message}`;
    else if (/completed/i.test(item.status) && (item.openIssueCount > 0 || item.extraScope)) reason = "Linear marks this complete but open issues or extra scope remain; reconcile scope.";
    else if (uncovered.length) reason = `${uncovered.length} open issue${uncovered.length === 1 ? " has" : "s have"} no estimate or Extra scope coverage.`;
    else if (!item.streamId || !streamIds.has(item.streamId)) reason = "Needs assignment to an active stream.";
    else if (!item.openIssueCount && !item.extraScope) reason = "No issue estimate or Extra scope.";
    const result: PackageForecast = { id: item.id, demand, provisional: !!item.extraScope, start: null, finish: null, reason, consumed: [] };
    if (included(item)) { selectedKnown += demand; selectedUnknown += uncovered.length; }
    if (complete) result.finish = 0;
    else if (!reason) remaining.set(item.id, milli(demand));
    packages.set(item.id, result);
  }
  const cycles: CycleForecast[] = [];
  const waiting = outcomeMode ? outcomeWaitTracker(input, requiredByOutcome, predecessors, packages) : null;
  if (!ready) waiting?.record(null);
  const holidayWeeks = input.holidaysEnabled ? input.holidayWeeks ?? (futureCycles.length ? holidayWeeksForRange(cycleLocalDates(futureCycles[0], input.timezone).start,
    cycleLocalDates(futureCycles.at(-1)!, input.timezone).end) : []) : [];
  if (ready) for (let cycle = 1; cycle <= futureCycles.length; cycle++) {
    waiting?.record(cycle);
    const linearCycle = futureCycles[cycle - 1];
    const adjustment = input.adjustments?.find((item) => item.cycleId === linearCycle.id);
    const availability = cycleAvailability(linearCycle, input.timezone, adjustment?.availability ?? 1, input.weeklyAdjustments ?? [], holidayWeeks);
    const available = Math.max(0, milli((input.baseline || 0) * availability - (adjustment?.reserve ?? input.reserve)));
    const row: CycleForecast = { id: linearCycle.id, number: linearCycle.number, name: linearCycle.name, projected: linearCycle.projected ?? false, index: cycle,
      start: localDate(linearCycle.startsAt, input.timezone), end: localDate(new Date(Date.parse(linearCycle.endsAt) - 1).toISOString(), input.timezone),
      available: points(available), availability, streams: [] };
    for (const stream of [...input.streams].sort((a, b) => a.id.localeCompare(b.id))) {
      const budget = Math.floor(available * stream.allocation + 1e-9);
      const carried = input.packages.filter((item) => item.streamId === stream.id && remaining.has(item.id) && packages.get(item.id)!.start !== null);
      const pending = input.packages.filter((item) => item.streamId === stream.id && remaining.has(item.id) && packages.get(item.id)!.start === null);
      const unblocked = (item: ForecastPackage) => (predecessors.get(item.id) ?? []).every((id) => { const prior = packages.get(id); return prior && prior.finish !== null && prior.finish < cycle; });
      const eligible = pending.filter((item) => unblocked(item) && (!outcomeMode || budget > 0 || remaining.get(item.id) === 0));
      eligible.sort(preference);
      // A stream has one execution slot, including when a saved legacy WIP limit is higher.
      // A finish in this cycle does not open the slot until the next cycle.
      const active = carried.length ? carried.slice(0, 1) : eligible.slice(0, 1);
      if (outcomeMode && !carried.length && active[0]) waiting!.bypass(cycle, active[0], pending.filter((item) =>
        (budget > 0 || remaining.get(item.id) === 0) && item.ownerOutcomeId !== active[0].ownerOutcomeId && rank(item) < rank(active[0]) && preference(item, active[0]) < 0 && !unblocked(item)));
      if (linearCycle.projected) for (const item of active) {
        packages.get(item.id)!.calendarProjected = true;
        packages.get(item.id)!.provisional = true;
      }
      for (const item of active) if (packages.get(item.id)!.start === null) packages.get(item.id)!.start = cycle;
      const item = active[0];
      const used = item ? Math.min(budget, remaining.get(item.id)!) : 0;
      if (item) {
        remaining.set(item.id, remaining.get(item.id)! - used);
        packages.get(item.id)!.consumed[cycle - 1] = points(used);
      }
      for (const item of active) if (remaining.get(item.id) === 0) { packages.get(item.id)!.finish = cycle; remaining.delete(item.id); }
      row.streams.push({ id: stream.id, budget: points(budget), used: points(used), idle: points(budget - used), active: active.map((item) => item.id) });
    }
    cycles.push(row);
    if (remaining.size === 0) break;
  }
  for (const [id, result] of packages) if (remaining.has(id)) {
    const blockers = (predecessors.get(id) ?? []).filter((predecessorId) => (packages.get(predecessorId)?.finish ?? null) === null);
    result.reason = blockers.length ? `Waiting for ${blockers.map((predecessorId) => source.get(predecessorId)?.name || predecessorId).join(", ")}.` :
      !futureCycles.length ? "No upcoming Linear cycles were imported for this team." :
        futureCycles.length < input.horizon ? `Beyond imported Linear calendar after ${linearCycleLabel(futureCycles.at(-1)!)}; add upcoming cycles in Linear.` :
          "Beyond horizon at current capacity, allocation, and stream sequence.";
  }
  const endFor = (cycle: number) => cycle === 0 ? localDate(input.sourceAt, input.timezone) : cycles[cycle - 1]?.end || null;
  const outcomes: OutcomeForecast[] = input.outcomes.map((outcome) => {
    const required = requiredByOutcome.get(outcome.id)!;
    const direct = outcome.links.filter((link) => link.requirement === "minimum").length;
    const reasons = [...required].flatMap((id) => { const result = packages.get(id); return !result ? [`${id} is unavailable.`] : result.reason ? [`${source.get(id)?.name || id}: ${result.reason}`] : []; });
    const finishes = [...required].map((id) => packages.get(id)?.finish ?? null);
    const finish = !direct || reasons.length || finishes.some((value) => value === null) ? null : Math.max(...finishes as number[]);
    const onlyHorizon = reasons.length > 0 && reasons.every((reason) => /Beyond horizon|beyond the horizon|Beyond imported Linear/.test(reason));
    const status: OutcomeForecast["status"] = !direct ? "unplanned" : !ready ? "setup_required" : onlyHorizon || finish === null && !reasons.length ? "beyond_horizon" : reasons.length ? "blocked" : [...required].some((id) => packages.get(id)?.provisional) ? "provisional" : "forecast";
    const endDate = finish === null ? null : endFor(finish);
    let target: OutcomeForecast["target"] = !outcome.neededBy ? "no_target" : endDate ? endDate <= outcome.neededBy ? "met" : "missed" : "unknown";
    if (!ready && outcome.neededBy) target = "unknown";
    const gapCycles = target === "missed" && finish !== null && outcome.neededBy ? cycles.filter((row) => row.end > outcome.neededBy! && row.index <= finish).length : null;
    return { id: outcome.id, status, calendarProjected: [...required].some((id) => packages.get(id)?.calendarProjected), finish, endDate, target, gapCycles, reasons: !ready && direct ? [...setup, ...errors, ...reasons] : reasons, requiredIds: [...required], ...(waiting ? waiting.result(outcome.id) : {}) };
  });
  return { ready, setup, cycles, packages: [...packages.values()], outcomes, sourceAt: input.sourceAt, selectedKnown, selectedUnknown, unallocated: Math.max(0, 1 - allocated), errors };
}
