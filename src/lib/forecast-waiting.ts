import type { ForecastInput, ForecastPackage, PackageForecast } from "./forecast";
import type { RoadmapState } from "./roadmap-planning";

export type OutcomeWait = {
  prerequisiteId: string; prerequisiteName: string;
  ownerOutcomeId: string | null; ownerOutcomeTitle: string | null;
  streamId: string | null; streamName: string | null;
  roadmapState: RoadmapState | "unavailable" | "unconverted";
  successorIds: string[]; requiredForDelivery: boolean;
  firstCycle: number | null; lastCycle: number | null;
  forecastFinish: number | null; reason: string | null;
  action: "include_on_roadmap" | "resume" | "review_source" | "inspect";
};
export type PriorityBypass = {
  cycle: number; selectedPackageId: string; selectedOutcomeId: string;
  blockedPackageIds: string[]; prerequisiteIds: string[];
};

/** Aggregate simulated dependency waits separately from finite forecast results.
 * A finite prerequisite finish is still a prediction, not actual completion. */
export function outcomeWaitTracker(input: ForecastInput, requiredByOutcome: ReadonlyMap<string, ReadonlySet<string>>,
  predecessors: ReadonlyMap<string, readonly string[]>, projections: ReadonlyMap<string, PackageForecast>) {
  const source = new Map(input.packages.map((item) => [item.id, item]));
  const owners = new Map(input.outcomes.map((item) => [item.id, item]));
  const streams = new Map(input.streams.map((item) => [item.id, item]));
  const waits = new Map<string, Map<string, OutcomeWait>>();
  const bypasses = new Map<string, PriorityBypass[]>();
  function unsatisfied(itemId: string, cycle: number | null) {
    return (predecessors.get(itemId) ?? []).filter((id) => {
      const finish = projections.get(id)?.finish;
      return finish === undefined || finish === null || (cycle === null ? finish !== 0 : finish >= cycle);
    });
  }
  function record(cycle: number | null) {
    for (const outcome of input.outcomes) {
      const required = requiredByOutcome.get(outcome.id)!;
      const scope = new Set([...outcome.links.map((link) => `linear:${link.projectId}`), ...required]);
      if (!waits.has(outcome.id)) waits.set(outcome.id, new Map());
      const entries = waits.get(outcome.id)!;
      for (const successorId of [...scope].sort()) for (const prerequisiteId of unsatisfied(successorId, cycle)) {
        let entry = entries.get(prerequisiteId);
        if (!entry) {
          const project = source.get(prerequisiteId);
          const owner = project?.ownerOutcomeId ? owners.get(project.ownerOutcomeId) : undefined;
          const stream = project?.streamId ? streams.get(project.streamId) : undefined;
          const membership = project?.roadmapState ?? (project ? "unconverted" : "unavailable");
          const validOwner = !!owner && !!stream && owner.streamId === stream.id && Number.isSafeInteger(owner.rank) && owner.rank! > 0 && owner.links.some((link) => link.projectId === project!.projectId);
          entry = { prerequisiteId, prerequisiteName: project?.name ?? "Unavailable project", ownerOutcomeId: owner?.id ?? null, ownerOutcomeTitle: owner?.title ?? null,
            streamId: stream?.id ?? null, streamName: stream?.name ?? null, roadmapState: membership,
            successorIds: [], requiredForDelivery: false, firstCycle: cycle, lastCycle: cycle, forecastFinish: null, reason: null,
            action: !project ? "review_source" : membership === "deferred" ? "resume" : membership !== "included" || !validOwner ? "include_on_roadmap" : "inspect" };
          entries.set(prerequisiteId, entry);
        }
        entry.lastCycle = cycle;
        entry.requiredForDelivery ||= required.has(successorId);
        if (!entry.successorIds.includes(successorId)) entry.successorIds.push(successorId);
      }
    }
  }
  function bypass(cycle: number, selected: ForecastPackage, blocked: ForecastPackage[]) {
    if (!selected.ownerOutcomeId) return;
    for (const outcomeId of [...new Set(blocked.map((item) => item.ownerOutcomeId!))].sort()) {
      const projects = blocked.filter((item) => item.ownerOutcomeId === outcomeId);
      const prerequisiteIds = [...new Set(projects.flatMap((item) => unsatisfied(item.id, cycle)))].sort();
      if (!prerequisiteIds.length) continue;
      if (!bypasses.has(outcomeId)) bypasses.set(outcomeId, []);
      bypasses.get(outcomeId)!.push({ cycle, selectedPackageId: selected.id, selectedOutcomeId: selected.ownerOutcomeId,
        blockedPackageIds: projects.map((item) => item.id).sort(), prerequisiteIds });
    }
  }
  function result(outcomeId: string) {
    return { waiting: [...(waits.get(outcomeId)?.values() ?? [])].sort((a, b) => a.prerequisiteId.localeCompare(b.prerequisiteId)).map((entry) => ({ ...entry,
      successorIds: [...entry.successorIds].sort(), forecastFinish: projections.get(entry.prerequisiteId)?.finish ?? null,
      reason: projections.get(entry.prerequisiteId)?.reason ?? (source.has(entry.prerequisiteId) ? null : "Prerequisite is unavailable in the imported source.") })),
      priorityBypass: bypasses.get(outcomeId) ?? [] };
  }
  return { record, bypass, result };
}
