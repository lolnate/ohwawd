export type CompletionFacts = {
  status: string; openIssueCount: number; extraScope?: unknown;
  needsReview: boolean; crossTeam: boolean; externalBlockers?: readonly string[];
};
export type EffectiveEdge = { predecessorId: string; successorId: string; waived?: boolean };

/** Source reconciliation, not a forecast date or manual business marker. */
export function isActuallyComplete(item: CompletionFacts): boolean {
  return /completed/i.test(item.status) && item.openIssueCount === 0 && !item.extraScope && !item.needsReview && !item.crossTeam && !item.externalBlockers?.length;
}

export function effectivePredecessors(edges: readonly EffectiveEdge[]): Map<string, string[]> {
  const bySuccessor = new Map<string, Set<string>>();
  for (const edge of edges) if (!edge.waived) {
    if (!bySuccessor.has(edge.successorId)) bySuccessor.set(edge.successorId, new Set());
    bySuccessor.get(edge.successorId)!.add(edge.predecessorId);
  }
  return new Map([...bySuccessor].map(([id, predecessors]) => [id, [...predecessors].sort()]));
}

/** Retain missing nodes as unresolved required scope; cycles terminate safely.
 * The result is stable and never mutates links, edges or the supplied roots. */
export function effectiveRequiredClosure(directIds: Iterable<string>, predecessors: ReadonlyMap<string, readonly string[]>): Set<string> {
  const required = new Set(directIds);
  const pending = [...required];
  for (let index = 0; index < pending.length; index++) for (const id of predecessors.get(pending[index]) ?? []) {
    if (!required.has(id)) { required.add(id); pending.push(id); }
  }
  return new Set([...required].sort());
}
