import type { getBoard } from "./board";
import { dependencyOrder, type QueuePackage } from "./sequencing";
import { issueBaseline, type ExtraScope } from "./project-scope";
import { inferOutcomePlanning } from "./outcome-planning";

type BoardSnapshot = Awaited<ReturnType<typeof getBoard>>;
type LegacyAllowance = { package_id: string; kind: string; points: number; issue_ids: string[]; rationale: string };

/** Adapt planning inputs only; never recompute or write a published revision's result. */
export function adaptLegacyPlanning(original: BoardSnapshot): BoardSnapshot {
  const snapshot = adaptScopePlanning(original);
  const inferred = inferOutcomePlanning(snapshot.packages, snapshot.outcomes, snapshot.links, snapshot.streams);
  return { ...snapshot, ...inferred };
}

function adaptScopePlanning(original: BoardSnapshot): BoardSnapshot {
  if (original.calculationVersion === "v3" && original.extraScopes) return original;
  const snapshot = structuredClone(original);
  snapshot.weeklyAdjustments ??= [];
  snapshot.holidayWeeks ??= [];
  snapshot.capacity.holidays_enabled ??= false;
  if (original.extraScopes) { snapshot.calculationVersion = "v3"; return snapshot; }
  const legacy = original as BoardSnapshot & { allowances?: LegacyAllowance[] };
  const edges = snapshot.dependencies.map((edge) => ({ predecessorId: edge.predecessor_id, successorId: edge.successor_id, waived: edge.waived }));
  const queues: QueuePackage[] = snapshot.packages.map((item) => ({ id: item.id, name: item.name, streamId: item.stream_id, selected: item.selected,
    position: item.priority_rank ?? 1000, complete: snapshot.forecast.packages.find((projection) => projection.id === item.id)?.finish === 0 }));
  for (const stream of snapshot.streams) dependencyOrder(queues.filter((item) => item.selected && item.streamId === stream.id), edges)
    .forEach((item, index) => { snapshot.packages.find((candidate) => candidate.id === item.id)!.sequence_position = index + 1; });
  snapshot.extraScopes = snapshot.packages.flatMap((item): ExtraScope[] => {
    const allowances = (legacy.allowances ?? []).filter((entry) => entry.package_id === item.id);
    const unestimated = allowances.find((entry) => entry.kind === "unestimated");
    const discovery = allowances.find((entry) => entry.kind === "discovery");
    const issues = snapshot.issues.filter((issue) => issue.project_id === item.project_id);
    const estimated = issues.filter((issue) => unestimated?.issue_ids.includes(issue.linear_id)).reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
    const points = Math.round((Math.max(0, (unestimated?.points ?? 0) - estimated) + (discovery?.points ?? 0)) * 1000) / 1000;
    if (!points) return [];
    return [{ package_id: item.id, points, notes: allowances.filter((entry) => entry.rationale).map((entry) => `${entry.kind}: ${entry.rationale}`).join("\n"),
      issue_ids: unestimated?.issue_ids ?? [], issue_baseline: issueBaseline(issues),
      legacy_review: snapshot.reconciliationWarnings?.find((warning) => warning.packageId === item.id)?.message ?? null }];
  });
  snapshot.capacity.scoping_lead_days ??= 14;
  snapshot.evaluatedAt ??= snapshot.forecast.sourceAt;
  snapshot.scoping ??= [];
  snapshot.calculationVersion = "v3";
  for (const item of snapshot.packages) {
    item.linear_priority ??= null;
    if (!item.selected) { item.stream_id = null; item.sequence_position = null; }
    for (const key of ["priority_rank", "must_include", "earliest_cycle", "preferred_cycle", "earliest_linear_cycle_id", "preferred_linear_cycle_id"]) delete item[key];
  }
  return snapshot;
}
