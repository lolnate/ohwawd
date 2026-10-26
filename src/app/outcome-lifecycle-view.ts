import type { OutcomeLifecycle } from "@/lib/outcome-completion";

export function outcomeLifecycleSummary(lifecycle?: OutcomeLifecycle, includeOpen = false): string | null {
  if (!lifecycle) return null;
  if (lifecycle.completedAt) return `Completed ${new Date(lifecycle.completedAt).toLocaleString()}${lifecycle.reviewNeeded ? " · Review completion needed" : ""}`;
  if (!includeOpen) return null;
  if (lifecycle.ready) return "Open · Ready to mark complete";
  return lifecycle.directRequiredIds.length ? "Open · Required work not complete" : "Open · Unplanned";
}

export function mergeOutcomeSnapshot<T extends { lifecycle?: OutcomeLifecycle }>(current: T, accepted: T): T {
  return { ...accepted, lifecycle: accepted.lifecycle ?? current.lifecycle };
}
