import { linearCycleLabel } from "./cycles";
import { orderConflicts } from "./sequencing";
import { cycleAvailability, holidayWeeksForRange, cycleLocalDates, type WeeklyAvailability } from "./planning-calendar";

export type ForecastPackage = {
  id: string; projectId: string; name: string; status: string; streamId: string | null;
  selected: boolean; sequence?: number | null;
  known: number; openIssueCount: number; unknownIssueIds: string[]; crossTeam: boolean; needsReview: boolean; orderReview?: string | null; externalBlockers?: string[];
  extraScope?: { points: number; issueIds: string[] };
};
export type ForecastStream = { id: string; name: string; allocation: number; wip: number };
export type ForecastDependency = { predecessorId: string; successorId: string; source: "local" | "linear"; waived?: boolean };
export type ForecastOutcome = { id: string; title: string; neededBy: string | null; links: { projectId: string; requirement: "minimum" | "optional" }[] };
export type LinearForecastCycle = { id: string; number: number; name: string | null; startsAt: string; endsAt: string };
export type ForecastInput = {
  packages: ForecastPackage[]; streams: ForecastStream[]; dependencies: ForecastDependency[];
  outcomes: ForecastOutcome[]; baseline: number | null; reserve: number; linearCycles: LinearForecastCycle[];
  horizon: number; sourceAt: string; cycleAnchorAt?: string; timezone: string;
  adjustments?: { cycleId: string; availability: number; reserve: number | null }[];
  weeklyAdjustments?: WeeklyAvailability[]; holidaysEnabled?: boolean; holidayWeeks?: WeeklyAvailability[];
};
export type PackageForecast = { id: string; demand: number; provisional: boolean; start: number | null; finish: number | null; reason: string | null; consumed: number[] };
export type CycleForecast = { id: string; number: number; name: string | null; index: number; start: string; end: string; available: number; availability?: number; streams: { id: string; budget: number; used: number; idle: number; active: string[] }[] };
export type OutcomeForecast = { id: string; status: "unplanned" | "setup_required" | "blocked" | "beyond_horizon" | "provisional" | "forecast"; finish: number | null; endDate: string | null; target: "no_target" | "met" | "missed" | "unknown"; gapCycles: number | null; reasons: string[]; requiredIds: string[] };
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
  const futureCycles = input.linearCycles.filter((cycle) => new Date(cycle.startsAt).getTime() > new Date(cycleAnchorAt).getTime())
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
  const sequenceConflicts = orderConflicts({ streamIds: input.streams.map((stream) => stream.id), dependencies: input.dependencies,
    packages: input.packages.map((item) => ({ id: item.id, name: item.name, selected: item.selected, streamId: item.streamId, position: item.sequence ?? null,
      complete: /completed/i.test(item.status) && !item.openIssueCount && !item.extraScope && !item.needsReview && !item.crossTeam && !item.externalBlockers?.length })) });
  let selectedKnown = 0;
  let selectedUnknown = 0;
  for (const item of input.packages) {
    const covered = new Set(item.extraScope?.issueIds || []);
    const uncovered = item.unknownIssueIds.filter((id) => !covered.has(id));
    const demand = item.known + (item.extraScope?.points || 0);
    const complete = /completed/i.test(item.status) && item.openIssueCount === 0 && !item.extraScope && !item.needsReview && !item.crossTeam && !item.externalBlockers?.length;
    let reason: string | null = null;
    if (complete) reason = null;
    else if (!item.selected) reason = "Deferred; future demand is excluded. Pause execution in Linear separately if work is in progress.";
    else if (item.crossTeam) reason = "Cross-team project needs package decomposition.";
    else if (item.externalBlockers?.length) reason = `Blocked by ${item.externalBlockers.length} project${item.externalBlockers.length === 1 ? "" : "s"} outside the imported team.`;
    else if (item.needsReview) reason = "Missing from the latest Linear import; review source scope.";
    else if (item.orderReview || sequenceConflicts.some((conflict) => conflict.streamId === item.streamId)) reason = `Resolve stream sequence: ${item.orderReview ?? sequenceConflicts.find((conflict) => conflict.streamId === item.streamId)!.message}`;
    else if (/completed/i.test(item.status) && (item.openIssueCount > 0 || item.extraScope)) reason = "Linear marks this complete but open issues or extra scope remain; reconcile scope.";
    else if (uncovered.length) reason = `${uncovered.length} open issue${uncovered.length === 1 ? " has" : "s have"} no estimate or Extra scope coverage.`;
    else if (!item.streamId || !streamIds.has(item.streamId)) reason = "Needs assignment to an active stream.";
    else if (!item.openIssueCount && !item.extraScope) reason = "No issue estimate or Extra scope.";
    const result: PackageForecast = { id: item.id, demand, provisional: !!item.extraScope, start: null, finish: null, reason, consumed: [] };
    if (item.selected) { selectedKnown += demand; selectedUnknown += uncovered.length; }
    if (complete) result.finish = 0;
    else if (!reason) remaining.set(item.id, milli(demand));
    packages.set(item.id, result);
  }
  const cycles: CycleForecast[] = [];
  const holidayWeeks = input.holidaysEnabled ? input.holidayWeeks ?? (futureCycles.length ? holidayWeeksForRange(cycleLocalDates(futureCycles[0], input.timezone).start,
    cycleLocalDates(futureCycles.at(-1)!, input.timezone).end) : []) : [];
  if (ready) for (let cycle = 1; cycle <= futureCycles.length; cycle++) {
    const linearCycle = futureCycles[cycle - 1];
    const adjustment = input.adjustments?.find((item) => item.cycleId === linearCycle.id);
    const availability = cycleAvailability(linearCycle, input.timezone, adjustment?.availability ?? 1, input.weeklyAdjustments ?? [], holidayWeeks);
    const available = Math.max(0, milli((input.baseline || 0) * availability - (adjustment?.reserve ?? input.reserve)));
    const row: CycleForecast = { id: linearCycle.id, number: linearCycle.number, name: linearCycle.name, index: cycle,
      start: localDate(linearCycle.startsAt, input.timezone), end: localDate(new Date(Date.parse(linearCycle.endsAt) - 1).toISOString(), input.timezone),
      available: points(available), availability, streams: [] };
    for (const stream of [...input.streams].sort((a, b) => a.id.localeCompare(b.id))) {
      const budget = Math.floor(available * stream.allocation + 1e-9);
      const carried = input.packages.filter((item) => item.streamId === stream.id && remaining.has(item.id) && packages.get(item.id)!.start !== null);
      const slots = Math.max(0, stream.wip - carried.length);
      const eligible = input.packages.filter((item) => item.streamId === stream.id && remaining.has(item.id) && packages.get(item.id)!.start === null &&
        input.dependencies.filter((edge) => !edge.waived && edge.successorId === item.id).every((edge) => { const prior = packages.get(edge.predecessorId); return prior && prior.finish !== null && prior.finish < cycle; }));
      eligible.sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
      const active = [...carried, ...eligible.slice(0, slots)];
      for (const item of active) if (packages.get(item.id)!.start === null) packages.get(item.id)!.start = cycle;
      let left = budget;
      let unfinished = active.filter((item) => remaining.get(item.id)! > 0);
      while (left > 0 && unfinished.length) {
        const share = Math.max(1, Math.floor(left / unfinished.length));
        let spent = 0;
        for (const item of unfinished) {
          const use = Math.min(share, remaining.get(item.id)!, left - spent);
          remaining.set(item.id, remaining.get(item.id)! - use);
          const result = packages.get(item.id)!;
          result.consumed[cycle - 1] = points(milli(result.consumed[cycle - 1] || 0) + use);
          spent += use;
        }
        left -= spent;
        unfinished = unfinished.filter((item) => remaining.get(item.id)! > 0);
      }
      for (const item of active) if (remaining.get(item.id) === 0) { packages.get(item.id)!.finish = cycle; remaining.delete(item.id); }
      row.streams.push({ id: stream.id, budget: points(budget), used: points(budget - left), idle: points(left), active: active.map((item) => item.id) });
    }
    cycles.push(row);
    if (remaining.size === 0) break;
  }
  for (const [id, result] of packages) if (remaining.has(id)) {
    const blockers = input.dependencies.filter((edge) => !edge.waived && edge.successorId === id && (packages.get(edge.predecessorId)?.finish ?? null) === null);
    result.reason = blockers.length ? `Waiting for ${blockers.map((edge) => source.get(edge.predecessorId)?.name || edge.predecessorId).join(", ")}.` :
      !futureCycles.length ? "No upcoming Linear cycles were imported for this team." :
        futureCycles.length < input.horizon ? `Beyond imported Linear calendar after ${linearCycleLabel(futureCycles.at(-1)!)}; add upcoming cycles in Linear.` :
          "Beyond horizon at current capacity, allocation, and WIP.";
  }
  const endFor = (cycle: number) => cycle === 0 ? localDate(input.sourceAt, input.timezone) : cycles[cycle - 1]?.end || null;
  const outcomes: OutcomeForecast[] = input.outcomes.map((outcome) => {
    const required = new Set(outcome.links.filter((link) => link.requirement === "minimum").map((link) => `linear:${link.projectId}`));
    const direct = required.size;
    const visit = (id: string) => {
      for (const edge of input.dependencies) if (!edge.waived && edge.successorId === id && !required.has(edge.predecessorId)) { required.add(edge.predecessorId); visit(edge.predecessorId); }
    };
    for (const id of [...required]) visit(id);
    const reasons = [...required].flatMap((id) => { const result = packages.get(id); return !result ? [`${id} is unavailable.`] : result.reason ? [`${source.get(id)?.name || id}: ${result.reason}`] : []; });
    const finishes = [...required].map((id) => packages.get(id)?.finish ?? null);
    const finish = reasons.length || finishes.some((value) => value === null) ? null : Math.max(...finishes as number[]);
    const onlyHorizon = reasons.length > 0 && reasons.every((reason) => /Beyond horizon|beyond the horizon|Beyond imported Linear/.test(reason));
    const status: OutcomeForecast["status"] = !direct ? "unplanned" : !ready ? "setup_required" : onlyHorizon || finish === null && !reasons.length ? "beyond_horizon" : reasons.length ? "blocked" : [...required].some((id) => packages.get(id)?.provisional) ? "provisional" : "forecast";
    const endDate = finish === null ? null : endFor(finish);
    let target: OutcomeForecast["target"] = !outcome.neededBy ? "no_target" : endDate ? endDate <= outcome.neededBy ? "met" : "missed" : "unknown";
    if (!ready && outcome.neededBy) target = "unknown";
    const gapCycles = target === "missed" && finish !== null && outcome.neededBy ? cycles.filter((row) => row.end > outcome.neededBy! && row.index <= finish).length : null;
    return { id: outcome.id, status, finish, endDate, target, gapCycles, reasons: !ready && direct ? [...setup, ...errors, ...reasons] : reasons, requiredIds: [...required] };
  });
  return { ready, setup, cycles, packages: [...packages.values()], outcomes, sourceAt: input.sourceAt, selectedKnown, selectedUnknown, unallocated: Math.max(0, 1 - allocated), errors };
}
