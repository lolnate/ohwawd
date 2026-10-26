import { inferOutcomePlanning } from "./outcome-planning";

export type RoadmapState = "candidate" | "included" | "deferred" | "dismissed";
export type RoadmapConversion = {
  reason: "inferred-owner" | "needs-owner" | "invalid-owner" | "cleared-deferred-context";
  previousStreamId: string | null;
  previousStreamName: string | null;
  candidateOutcomeIds: string[];
  message: string;
};
export type StoredRoadmapFields = { roadmap_state: RoadmapState | null; roadmap_conversion: RoadmapConversion | null };
export type RoadmapPackage = {
  id: string; project_id: string; name: string; stream_id: string | null; selected: boolean;
  capacity_outcome_id?: string | null; sequence_position?: number | null;
  roadmap_state?: RoadmapState | null; roadmap_conversion?: RoadmapConversion | null;
};
export type RankedOutcome = {
  id: string; title: string; stream_id?: string | null; stream_position?: number | null; created_at?: string | Date;
};
type Link = { outcome_id: string; project_id: string; requirement: "minimum" | "optional" };
type Stream = { id: string; name?: string; position?: number; active?: boolean };
const created = (outcome: RankedOutcome) => {
  const value = outcome.created_at ? new Date(outcome.created_at).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
};
const rank = (outcome: RankedOutcome) => Number.isSafeInteger(outcome.stream_position) && outcome.stream_position! > 0 ? outcome.stream_position! : Infinity;

/** Convert editable inputs only. Never infer an owner by arbitrary tie-break, move
 * dependencies, mutate caller inputs or recalculate a published snapshot. */
export function convertRoadmapPlanning<P extends RoadmapPackage, O extends RankedOutcome>(input: {
  packages: P[]; outcomes: O[]; links: Link[]; streams: Stream[];
}) {
  const activeStreams = input.streams.filter((stream) => stream.active !== false);
  const streamById = new Map(activeStreams.map((stream) => [stream.id, stream]));
  // Older snapshots may lack outcome placement too. Reuse only that inference;
  // its former earliest-owner tie-break must not erase raw owner ambiguity.
  const placed = inferOutcomePlanning(input.packages, input.outcomes, input.links, activeStreams).outcomes;
  const outcomes = placed.map((outcome) => ({ ...outcome, stream_id: outcome.stream_id && streamById.has(outcome.stream_id) ? outcome.stream_id : null, stream_position: outcome.stream_id && streamById.has(outcome.stream_id) ? outcome.stream_position ?? null : null }));
  for (const stream of activeStreams) {
    outcomes.filter((outcome) => outcome.stream_id === stream.id)
      .sort((left, right) => rank(left) - rank(right) || created(right) - created(left) || left.id.localeCompare(right.id))
      .forEach((outcome, index) => { outcome.stream_position = index + 1; });
  }
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const linkedOwners = new Map<string, Set<string>>();
  for (const link of input.links) {
    if (!linkedOwners.has(link.project_id)) linkedOwners.set(link.project_id, new Set());
    linkedOwners.get(link.project_id)!.add(link.outcome_id);
  }
  const packages = input.packages.map((item) => {
    const stream = item.stream_id ? streamById.get(item.stream_id) : undefined;
    const linked = linkedOwners.get(item.project_id) ?? new Set<string>();
    const owner = item.capacity_outcome_id ? outcomeById.get(item.capacity_outcome_id) : undefined;
    const validOwner = !!stream && !!owner && owner.stream_id === stream.id && linked.has(owner.id);
    const candidates = stream ? [...linked].filter((id) => outcomeById.get(id)?.stream_id === stream.id).sort() : [];
    let state: RoadmapState = item.roadmap_state ?? (item.selected ? "included" : "deferred");
    let ownerId: string | null = validOwner ? owner!.id : null;
    let streamId: string | null = validOwner ? stream!.id : null;
    let conversion = item.roadmap_conversion ?? null;
    function note(reason: RoadmapConversion["reason"], message: string) {
      conversion = { reason, previousStreamId: item.stream_id, previousStreamName: input.streams.find((entry) => entry.id === item.stream_id)?.name ?? null, candidateOutcomeIds: candidates, message };
    }
    if (state === "included" && !validOwner) {
      // Only legacy ownerless selection may be inferred. Invalid explicit owners
      // and broken current-v5 inputs require review rather than a guessed repair.
      if (!item.roadmap_state && !item.capacity_outcome_id && candidates.length === 1) {
        ownerId = candidates[0]; streamId = stream!.id;
        note("inferred-owner", `Assigned the only eligible linked outcome in ${stream!.name ?? stream!.id}.`);
      } else {
        state = "candidate";
        note(item.capacity_outcome_id ? "invalid-owner" : "needs-owner", `Needs assignment: choose a linked owning outcome${item.stream_id ? ` (previous stream: ${input.streams.find((entry) => entry.id === item.stream_id)?.name ?? item.stream_id})` : ""}. Future demand is excluded until included.`);
      }
    } else if (state === "deferred" && !validOwner && (item.stream_id || item.capacity_outcome_id)) {
      note("cleared-deferred-context", "Deferred work remains excluded. Choose a valid linked owning outcome before resuming.");
    }
    if (state === "candidate" || state === "dismissed") { streamId = null; ownerId = null; }
    return { ...item, stream_id: streamId, capacity_outcome_id: ownerId, selected: state === "included", roadmap_state: state, roadmap_conversion: conversion };
  });
  return { packages, outcomes };
}

export function roadmapConversionFeedback(packages: { id: string; roadmap_conversion: RoadmapConversion | null }[]) {
  return packages.flatMap((item) => item.roadmap_conversion ? [{ packageId: item.id, ...item.roadmap_conversion }] : []);
}
