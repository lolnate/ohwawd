import { createHash } from "node:crypto";
import { effectivePredecessors, effectiveRequiredClosure, isActuallyComplete, type CompletionFacts, type EffectiveEdge } from "./delivery-scope";

export type CompletionProject = CompletionFacts & {
  id: string; name: string;
  openIssues: { id: string; stateType: string; estimate: number | null }[];
  extraScope?: { points: number; issueIds: string[] } | null;
};
export type CompletionBlocker = { packageId: string | null; code: "no_required_scope" | "dependency_cycle" | "missing_project" | "unfinished_project" | "open_issues" | "remaining_extra_scope" | "source_review" | "cross_team" | "external_blockers"; message: string };
export type CompletionEvidence = { ready: boolean; reasons: string[]; blockers: CompletionBlocker[]; directRequiredIds: string[]; requiredIds: string[]; scopeSignature: string; evidenceSignature: string };
export type OutcomeLifecycle = Omit<CompletionEvidence, "evidenceSignature"> & {
  outcomeId: string; completedAt: string | null; lifecycleVersion: number; completedScopeSignature: string | null;
  reviewNeeded: boolean; reviewReasons: string[]; eligibilityToken: string;
};
export const evidenceHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function hasRequiredCycle(required: ReadonlySet<string>, predecessors: ReadonlyMap<string, readonly string[]>) {
  const degrees = new Map<string, number>(); const successors = new Map<string, string[]>();
  for (const id of required) {
    const prior = (predecessors.get(id) ?? []).filter((entry) => required.has(entry)); degrees.set(id, prior.length);
    for (const predecessor of prior) successors.set(predecessor, [...(successors.get(predecessor) ?? []), id]);
  }
  const pending = [...required].filter((id) => degrees.get(id) === 0);
  for (let index = 0; index < pending.length; index++) for (const id of successors.get(pending[index]) ?? []) {
    degrees.set(id, degrees.get(id)! - 1); if (degrees.get(id) === 0) pending.push(id);
  }
  return pending.length !== required.size;
}

/** Current actual evidence only: no placement, capacity, clock, forecast or
 * lifecycle marker participates in readiness or the delivery-scope signature. */
export function completionEvidence(links: readonly { projectId: string; requirement: "minimum" | "optional" }[], projects: ReadonlyMap<string, CompletionProject>, dependencies: readonly EffectiveEdge[]): CompletionEvidence {
  const directRequiredIds = [...new Set(links.filter((link) => link.requirement === "minimum").map((link) => `linear:${link.projectId}`))].sort();
  const predecessors = effectivePredecessors(dependencies);
  const required = effectiveRequiredClosure(directRequiredIds, predecessors); const requiredIds = [...required];
  const edges = requiredIds.flatMap((successorId) => (predecessors.get(successorId) ?? []).map((predecessorId) => [predecessorId, successorId]));
  const scopeSignature = evidenceHash({ directRequiredIds, requiredIds, edges });
  const blockers: CompletionBlocker[] = [];
  if (!directRequiredIds.length) blockers.push({ packageId: null, code: "no_required_scope", message: "Unplanned: define at least one minimum-required project before marking complete." });
  if (hasRequiredCycle(required, predecessors)) blockers.push({ packageId: null, code: "dependency_cycle", message: "Required dependencies contain a cycle; resolve it before marking complete." });
  const facts = requiredIds.map((id) => {
    const item = projects.get(id);
    if (!item) { blockers.push({ packageId: id, code: "missing_project", message: `${id}: required project is unavailable in the imported source.` }); return { id, available: false }; }
    const add = (code: CompletionBlocker["code"], message: string) => blockers.push({ packageId: id, code, message: `${item.name}: ${message}` });
    if (!isActuallyComplete(item)) {
      if (!/completed/i.test(item.status)) add("unfinished_project", "source execution is not completed; a canceled status or forecast date is insufficient.");
      if (item.openIssueCount) add("open_issues", `${item.openIssueCount} open issue${item.openIssueCount === 1 ? " remains" : "s remain"}.`);
      if (item.extraScope) add("remaining_extra_scope", "remaining Extra scope must be reconciled.");
      if (item.needsReview) add("source_review", "missing-source review must be resolved.");
      if (item.crossTeam) add("cross_team", "cross-team work needs decomposition/reconciliation.");
      if (item.externalBlockers?.length) add("external_blockers", "prerequisites outside the imported team remain unresolved.");
    }
    return { id, available: true, status: item.status.trim().toLowerCase(), openIssueCount: item.openIssueCount,
      openIssues: [...item.openIssues].sort((a, b) => a.id.localeCompare(b.id)).map((issue) => ({ id: issue.id, stateType: issue.stateType, estimate: issue.estimate })),
      extraScope: item.extraScope ? { points: item.extraScope.points, issueIds: [...item.extraScope.issueIds].sort() } : null,
      needsReview: item.needsReview, crossTeam: item.crossTeam, externalBlockers: [...(item.externalBlockers ?? [])].sort() };
  });
  return { ready: blockers.length === 0, reasons: blockers.map((item) => item.message), blockers, directRequiredIds, requiredIds, scopeSignature, evidenceSignature: evidenceHash(facts) };
}
