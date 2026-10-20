// Shared by the scheduler, server mutations, and client-side move previews.
export type QueuePackage = { id: string; name: string; streamId: string | null; selected: boolean; position: number | null; complete: boolean };
export type QueueEdge = { predecessorId: string; successorId: string; waived?: boolean };
export type QueueState = { packages: QueuePackage[]; dependencies: QueueEdge[]; streamIds: string[] };
export type OrderConflict = { key: string; streamId: string; predecessorId: string; successorId: string; path: string[]; message: string };
export type Placement = { packageId: string; streamId: string | null; selected: boolean; beforeId?: string | null };

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
      const path = paths.get(lane[index].id)?.get(lane[prior].id);
      if (path) conflicts.push({ key: `${streamId}:${lane[index].id}:${lane[prior].id}`, streamId,
        predecessorId: lane[index].id, successorId: lane[prior].id, path,
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

export function placementError(state: QueueState, placement: Placement): string | null {
  try { planPlacements(state, [placement]); return null; }
  catch (error) { return error instanceof Error ? error.message : "Invalid project move."; }
}
