export type CycleLabelSource = { number: number; name: string | null };

export function linearCycleLabel(cycle: CycleLabelSource): string {
  return cycle.name?.trim() || `Cycle ${cycle.number}`;
}
