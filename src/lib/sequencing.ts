// Shared by the scheduler, server mutations, and client-side move previews.
import type { RoadmapState } from "./roadmap-planning";
export type QueuePackage = { id: string; name: string; streamId: string | null; selected: boolean; position: number | null; complete: boolean; ownerId?: string | null; roadmapState?: RoadmapState };
export type QueueEdge = { predecessorId: string; successorId: string; waived?: boolean };
export type QueueState = { packages: QueuePackage[]; dependencies: QueueEdge[]; streamIds: string[]; outcomeScoped?: boolean; sourceAt?: string | null;
  outcomes?: { id: string; streamId: string | null; position: number | null }[]; links?: { packageId: string; outcomeId: string }[] };
export type OrderConflict = { key: string; streamId: string; predecessorId: string; successorId: string; path: string[]; message: string; ownerId?: string | null };
export type Placement = { packageId: string; streamId: string | null; selected: boolean; beforeId?: string | null; outcomeId?: string | null; roadmapState?: RoadmapState };

export const queueOrder = (a: QueuePackage, b: QueuePackage) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);

export function dependencyPaths(edges: QueueEdge[]): Map<string, Map<string, string[]>> {
  const graph = new Map<string, string[]>();
  for (const edge of edges) if (!edge.waived) graph.set(edge.predecessorId, [...(graph.get(edge.predecessorId) ?? []), edge.successorId]);
  const paths = new Map<string, Map<string, string[]>>();
  for (const start of graph.keys()) {
    const reached = new Map<string, string[]>();
    const pending = [[start]];
    while (pending.length) {
      const path = pending.shift()!;
      for (const next of graph.get(path.at(-1)!) ?? []) if (!reached.has(next)) {
        const nextPath = [...path, next];
        reached.set(next, nextPath);
        if (!path.includes(next)) pending.push(nextPath);
      }
    }
    paths.set(start, reached);
  }
  return paths;
}

export function orderConflicts(state: QueueState): OrderConflict[] {
  const paths = dependencyPaths(state.dependencies);
  const names = new Map(state.packages.map((item) => [item.id, item.name]));
  const conflicts: OrderConflict[] = [];
  for (const streamId of state.streamIds) {
    const lane = state.packages.filter((item) => item.selected && !item.complete && item.streamId === streamId).sort(queueOrder);
    for (let index = 0; index < lane.length; index++) for (let prior = 0; prior < index; prior++) {
      if (state.outcomeScoped && lane[index].ownerId !== lane[prior].ownerId) continue;
      const path = paths.get(lane[index].id)?.get(lane[prior].id);
      if (path) conflicts.push({ key: `${streamId}:${lane[index].id}:${lane[prior].id}`, streamId,
        predecessorId: lane[index].id, successorId: lane[prior].id, path, ...(state.outcomeScoped ? { ownerId: lane[index].ownerId } : {}),
        message: `${lane[index].name} must precede ${lane[prior].name}: ${path.map((id) => names.get(id) ?? id).join(" → ")}.` });
    }
  }
  return conflicts;
}

/** Stable topological preference; cycles retain stable order and are reported by forecasting. */
export function dependencyOrder(items: QueuePackage[], edges: QueueEdge[]): QueuePackage[] {
  const remaining = [...items].sort(queueOrder);
  const paths = dependencyPaths(edges);
  const result: QueuePackage[] = [];
  while (remaining.length) {
    const index = remaining.findIndex((item) => !remaining.some((other) => other.id !== item.id && !other.complete && paths.get(other.id)?.has(item.id)));
    result.push(...remaining.splice(index < 0 ? 0 : index, 1));
  }
  return result;
}

export function planPlacements(state: QueueState, placements: Placement[]): QueuePackage[] {
  if (state.outcomeScoped) return planScopedPlacements(state, placements);
  if (new Set(placements.map((item) => item.packageId)).size !== placements.length) throw new Error("Choose each project exactly once.");
  const packages = state.packages.map((item) => ({ ...item }));
  const originalConflicts = orderConflicts(state);
  const originalKeys = new Set(originalConflicts.map((item) => item.key));
  const changes = placements.filter((placement) => {
    const current = packages.find((item) => item.id === placement.packageId);
    if (!current) throw new Error("Project not found.");
    if (placement.streamId !== null && !state.streamIds.includes(placement.streamId)) throw new Error("Choose an active stream.");
    return placement.beforeId !== undefined || current.streamId !== placement.streamId || current.selected !== placement.selected;
  });
  const movingIds = new Set(changes.map((item) => item.packageId));
  for (const item of packages) if (movingIds.has(item.id)) { item.streamId = null; item.position = null; }
  const incoming = dependencyOrder(changes.map((change) => state.packages.find((item) => item.id === change.packageId)!), state.dependencies);
  const conflictsFor = () => orderConflicts({ ...state, packages });
  for (const entry of incoming) {
    const placement = changes.find((item) => item.packageId === entry.id)!;
    const item = packages.find((candidate) => candidate.id === entry.id)!;
    item.selected = placement.selected;
    item.streamId = placement.selected ? placement.streamId : null;
    if (!item.selected || !item.streamId) continue;
    const lane = packages.filter((candidate) => candidate.id !== item.id && candidate.selected && candidate.streamId === item.streamId).sort(queueOrder);
    const write = (index: number) => { const ordered = [...lane.slice(0, index), item, ...lane.slice(index)]; ordered.forEach((candidate, position) => { candidate.position = position + 1; }); };
    if (placement.beforeId !== undefined) {
      const index = placement.beforeId === null ? lane.length : lane.findIndex((candidate) => candidate.id === placement.beforeId);
      if (index < 0) throw new Error("The insertion project is no longer in that stream. Refresh the board.");
      write(index);
    } else {
      // Append as late as possible without introducing a new precedence violation.
      let valid = false;
      for (let index = lane.length; index >= 0; index--) {
        write(index);
        if (conflictsFor().every((conflict) => originalKeys.has(conflict.key))) { valid = true; break; }
      }
      if (!valid) throw new Error(conflictsFor().find((conflict) => !originalKeys.has(conflict.key))?.message ?? "No dependency-valid position is available.");
    }
  }
  const after = conflictsFor();
  const introduced = after.find((item) => !originalKeys.has(item.key));
  if (introduced) throw new Error(introduced.message);
  const affected = new Set(changes.flatMap((item) => [item.streamId, state.packages.find((candidate) => candidate.id === item.packageId)?.streamId]));
  const beforeAffected = originalConflicts.filter((item) => affected.has(item.streamId));
  if (changes.length && beforeAffected.length && after.filter((item) => affected.has(item.streamId)).length >= beforeAffected.length) {
    throw new Error(`Repair the existing dependency order first. ${beforeAffected[0].message}`);
  }
  for (const streamId of state.streamIds) packages.filter((item) => item.selected && item.streamId === streamId).sort(queueOrder)
    .forEach((item, index) => { item.position = index + 1; });
  return packages;
}

function planScopedPlacements(state: QueueState, placements: Placement[]): QueuePackage[] {
  if (new Set(placements.map((item) => item.packageId)).size !== placements.length) throw new Error("Choose each project exactly once.");
  const packages = state.packages.map((item) => ({ ...item }));
  const before = orderConflicts(state);
  const known = new Set(before.map((item) => item.key));
  const moving = new Set(placements.map((item) => item.packageId));
  const affectedOwners = new Set<string | null | undefined>();
  for (const placement of placements) {
    const item = packages.find((entry) => entry.id === placement.packageId);
    if (!item) throw new Error("Project not found.");
    affectedOwners.add(item.ownerId);
    const membership = placement.roadmapState ?? (!placement.selected ? "deferred" : placement.streamId === null ? "candidate" : "included");
    if (!["included", "candidate", "deferred", "dismissed"].includes(membership)) throw new Error("Choose a valid roadmap state.");
    if (membership === "included") {
      const ownerId = placement.outcomeId === undefined ? item.ownerId : placement.outcomeId;
      const owner = state.outcomes?.find((outcome) => outcome.id === ownerId);
      if (!owner?.streamId || !state.streamIds.includes(owner.streamId) || !state.links?.some((link) => link.packageId === item.id && link.outcomeId === ownerId)) throw new Error("Choose a linked owning outcome assigned to an active stream.");
      if (placement.streamId !== owner.streamId) throw new Error("Choose an owning outcome in the destination stream; an independent stream move cannot clear ownership.");
      const unchanged = item.selected && item.ownerId === ownerId && item.streamId === owner.streamId;
      item.ownerId = ownerId; item.streamId = owner.streamId;
      if (!unchanged || placement.beforeId !== undefined) item.position = null;
    } else if (membership !== "deferred") { item.ownerId = null; item.streamId = null; item.position = null; }
    else item.position = null;
    item.selected = membership === "included"; item.roadmapState = membership;
    affectedOwners.add(item.ownerId);
  }
  const conflicts = () => orderConflicts({ ...state, packages });
  const incoming = dependencyOrder(packages.filter((item) => moving.has(item.id) && item.selected && item.position === null), state.dependencies);
  for (const item of incoming) {
    const placement = placements.find((entry) => entry.packageId === item.id)!;
    const lane = packages.filter((other) => other.id !== item.id && other.selected && other.ownerId === item.ownerId && other.position !== null).sort(queueOrder);
    const write = (index: number) => [...lane.slice(0, index), item, ...lane.slice(index)].forEach((entry, position) => { entry.position = position + 1; });
    if (placement.beforeId !== undefined) {
      const index = placement.beforeId === null ? lane.length : lane.findIndex((entry) => entry.id === placement.beforeId);
      if (index < 0) throw new Error("Choose an insertion project within the destination owning outcome.");
      write(index);
    } else {
      let valid = false;
      for (let index = lane.length; index >= 0; index--) { write(index); if (conflicts().every((entry) => known.has(entry.key))) { valid = true; break; } }
      if (!valid) throw new Error("No dependency-valid position exists within the owning outcome.");
    }
  }
  const after = conflicts();
  const introduced = after.find((entry) => !known.has(entry.key));
  if (introduced) throw new Error(introduced.message);
  const priorAffected = before.filter((entry) => affectedOwners.has(entry.ownerId));
  const changed = packages.some((item, index) => JSON.stringify(item) !== JSON.stringify(state.packages[index]));
  if (!changed) return packages;
  if (changed && priorAffected.length && after.filter((entry) => affectedOwners.has(entry.ownerId)).length >= priorAffected.length) throw new Error(`Repair the existing dependency order first. ${priorAffected[0].message}`);
  for (const ownerId of affectedOwners) packages.filter((item) => item.selected && item.ownerId === ownerId).sort(queueOrder).forEach((item, index) => { item.position = index + 1; });
  return packages;
}

export function placementError(state: QueueState, placement: Placement): string | null {
  try { planPlacements(state, [placement]); return null; }
  catch (error) { return error instanceof Error ? error.message : "Invalid project move."; }
}
