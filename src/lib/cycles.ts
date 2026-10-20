export type CycleLabelSource = { number: number; name: string | null };
export type PlanningCycle = CycleLabelSource & { id: string; startsAt: string; endsAt: string; projected?: boolean; completedAt?: string | null };

export function linearCycleLabel(cycle: CycleLabelSource): string {
  return cycle.name?.trim() || `Cycle ${cycle.number}`;
}

export function shortLinearCycleLabel(cycle: CycleLabelSource): string {
  const name = cycle.name?.trim();
  if (!name) return `C${cycle.number}`;
  const numbered = /^cycle\s*#?\s*(\d+)$/i.exec(name);
  return numbered ? `C${numbered[1]}` : name;
}

export function planningCycleLabel(cycle: CycleLabelSource & { projected?: boolean }): string {
  return `${linearCycleLabel(cycle)}${cycle.projected ? " (projected)" : ""}`;
}

export function nextCycleName(name: string | null): string | null {
  const match = /^(.*?)(\d+)$/.exec(name?.trim() ?? "");
  if (!match) return null;
  return `${match[1]}${String(Number(match[2]) + 1).padStart(match[2].length, "0")}`;
}
