export type OutcomePlacement = { id: string; title: string; stream_id?: string | null; created_at?: string | Date };
export type OutcomeProjectLink = { outcome_id: string; project_id: string; requirement: "minimum" | "optional" };
export type OwnedProject = { id: string; project_id: string; name: string; stream_id: string | null; selected: boolean; capacity_outcome_id?: string | null; sequence_position?: number | null };

/** Only infer absent legacy fields. Explicit null is a planner's saved choice. */
export function inferOutcomePlanning<P extends OwnedProject, O extends OutcomePlacement>(packages: P[], outcomes: O[], links: OutcomeProjectLink[], streams: { id: string; position?: number }[]) {
  const streamOrder = new Map(streams.map((stream, index) => [stream.id, stream.position ?? index + 1]));
  const placed = outcomes.map((outcome) => {
    if (outcome.stream_id !== undefined) return { ...outcome, stream_id: outcome.stream_id };
    const projectIds = new Set(links.filter((link) => link.outcome_id === outcome.id).map((link) => link.project_id));
    const counts = new Map<string, number>();
    for (const item of packages) if (item.selected && item.stream_id && streamOrder.has(item.stream_id) && projectIds.has(item.project_id)) counts.set(item.stream_id, (counts.get(item.stream_id) ?? 0) + 1);
    const streamId = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || streamOrder.get(a)! - streamOrder.get(b)! || a.localeCompare(b))[0] ?? null;
    return { ...outcome, stream_id: streamId };
  });
  const owned = packages.map((item) => {
    if (item.capacity_outcome_id !== undefined) return { ...item, capacity_outcome_id: item.capacity_outcome_id };
    const candidates = placed.filter((outcome) => item.selected && item.stream_id && outcome.stream_id === item.stream_id && links.some((link) => link.outcome_id === outcome.id && link.project_id === item.project_id));
    candidates.sort((a, b) => (a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0) || a.id.localeCompare(b.id));
    return { ...item, capacity_outcome_id: candidates[0]?.id ?? null };
  });
  return { packages: owned, outcomes: placed };
}

/** Stable workspace-wide mnemonic codes, including deterministic collision suffixes. */
export function projectCodes(projects: { id: string; name: string }[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const project of [...projects].sort((a, b) => a.id.localeCompare(b.id))) {
    const words = project.name.match(/[\p{L}\p{N}]+/gu) ?? ["Project"];
    const code = (words.length === 1 ? words[0].slice(0, 4) : words.slice(0, 4).map((word) => word[0]).join("")).toLocaleUpperCase();
    groups.set(code, [...(groups.get(code) ?? []), project.id]);
  }
  return new Map([...groups].flatMap(([code, ids]) => ids.map((id, index) => [id, ids.length > 1 ? `${code}-${index + 1}` : code] as [string, string])));
}

export function outcomeRows<P extends OwnedProject, O extends OutcomePlacement>(streamId: string, packages: P[], outcomes: O[], links: OutcomeProjectLink[]) {
  const order = (a: P, b: P) => (a.sequence_position ?? Infinity) - (b.sequence_position ?? Infinity) || a.id.localeCompare(b.id);
  const rows: { id: string; title: string; outcome: O | null; projects: P[] }[] = outcomes.filter((outcome) => outcome.stream_id === streamId).map((outcome) => ({ id: outcome.id, title: outcome.title, outcome,
    projects: packages.filter((item) => links.some((link) => link.outcome_id === outcome.id && link.project_id === item.project_id)).sort(order) }));
  const other = packages.filter((item) => item.selected && item.stream_id === streamId && !outcomes.some((outcome) => outcome.id === item.capacity_outcome_id && outcome.stream_id === streamId)).sort(order);
  if (other.length) rows.push({ id: `other:${streamId}`, title: "Other selected work", outcome: null, projects: other });
  return rows;
}
