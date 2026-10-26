import type { OutcomeLifecycle } from "./outcome-completion";

export type CatalogOutcome = {
  id: string;
  title: string;
  description: string;
  owner: string;
  success_signal: string;
  needed_by: string | null;
  stream_id: string | null;
  created_at: string;
  lifecycle?: OutcomeLifecycle;
};

export type CatalogProject = { id: string; name: string; in_scope: boolean };
export type CatalogLink = { outcome_id: string; project_id: string; requirement: "minimum" | "optional" };
export type CatalogStream = { id: string; name: string };

export type CatalogFilters = {
  search: string;
  owner: "all" | "none" | `owner:${string}`;
  stream: "all" | "unassigned" | string;
  projects: "all" | "none" | "optional" | "required";
  targetDate: "all" | "past" | "next30" | "none";
};

export type CatalogSort = "name" | "neededBy" | "newest";

export type CatalogRow = CatalogOutcome & {
  requiredProjectCount: number;
  optionalProjectCount: number;
  projects: { id: string; name: string | null; inScope: boolean | null; requirement: CatalogLink["requirement"] }[];
};

export type CatalogIndex = {
  rows: CatalogRow[];
  owners: { value: `owner:${string}`; label: string }[];
  streams: CatalogStream[];
};

const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const dateOnly = (value: string | null) => value?.slice(0, 10) || null;

function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Builds immutable browse data from saved state; it never changes planning inputs. */
export function indexCatalog(input: { outcomes: CatalogOutcome[]; projects: CatalogProject[]; links: CatalogLink[]; streams: CatalogStream[] }): CatalogIndex {
  const projects = new Map(input.projects.map((project) => [project.id, project]));
  const links = new Map<string, CatalogLink[]>();
  for (const link of input.links) {
    const current = links.get(link.outcome_id) ?? [];
    current.push(link);
    links.set(link.outcome_id, current);
  }
  const ownerLabels = new Map<string, string>();
  const rows = input.outcomes.map((outcome) => {
    const owner = normalized(outcome.owner);
    if (owner && !ownerLabels.has(owner)) ownerLabels.set(owner, outcome.owner.trim().replace(/\s+/g, " "));
    const directLinks = links.get(outcome.id) ?? [];
    const projectDetails = directLinks.map((link) => {
      const project = projects.get(link.project_id);
      return { id: link.project_id, name: project?.name ?? null, inScope: project?.in_scope ?? null, requirement: link.requirement };
    });
    return {
      ...outcome,
      needed_by: dateOnly(outcome.needed_by),
      requiredProjectCount: directLinks.filter((link) => link.requirement === "minimum").length,
      optionalProjectCount: directLinks.filter((link) => link.requirement === "optional").length,
      projects: projectDetails,
    };
  });
  return {
    rows,
    owners: [...ownerLabels].map(([value, label]) => ({ value: `owner:${value}` as const, label })).sort((left, right) => left.label.localeCompare(right.label)),
    streams: [...input.streams].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
  };
}

export function queryCatalog(index: CatalogIndex, filters: CatalogFilters, sort: CatalogSort, today: string): CatalogRow[] {
  const terms = normalized(filters.search).split(" ").filter(Boolean);
  const next30End = addCalendarDays(today, 30);
  return [...index.rows].filter((row) => {
    const owner = normalized(row.owner);
    const searchable = normalized([row.title, row.description, row.success_signal, row.owner, ...row.projects.flatMap((project) => project.name ? [project.name] : [])].join(" "));
    const projectCoverage = row.requiredProjectCount > 0 ? "required" : row.optionalProjectCount > 0 ? "optional" : "none";
    const neededBy = dateOnly(row.needed_by);
    const matchesTarget = filters.targetDate === "all" ||
      (filters.targetDate === "none" && !neededBy) ||
      (filters.targetDate === "past" && !!neededBy && neededBy < today) ||
      (filters.targetDate === "next30" && !!neededBy && neededBy >= today && neededBy < next30End);
    return terms.every((term) => searchable.includes(term)) &&
      (filters.owner === "all" || (filters.owner === "none" ? !owner : `owner:${owner}` === filters.owner)) &&
      (filters.stream === "all" || (filters.stream === "unassigned" ? !row.stream_id : row.stream_id === filters.stream)) &&
      (filters.projects === "all" || projectCoverage === filters.projects) && matchesTarget;
  }).sort((left, right) => {
    const title = normalized(left.title).localeCompare(normalized(right.title)) || left.id.localeCompare(right.id);
    if (sort === "name") return title;
    if (sort === "neededBy") return (left.needed_by ?? "9999-12-31").localeCompare(right.needed_by ?? "9999-12-31") || title;
    return Date.parse(right.created_at) - Date.parse(left.created_at) || title;
  });
}
