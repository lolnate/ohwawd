"use client";

import { useState } from "react";
import StatusFilter from "./status-filter";

export type Project = { id: string; name: string; status: string; in_scope: boolean };
export type Requirement = "minimum" | "optional";

export default function OutcomeProjectFields({ projects, saved, draft, onChange, autoFocusSearch = false }: {
  projects: Project[];
  saved: Record<string, Requirement>;
  draft: Record<string, Requirement>;
  onChange: (draft: Record<string, Requirement>) => void;
  autoFocusSearch?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const availableStatuses = [...new Set(projects.map((project) => project.status))].sort();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleProjects = projects.filter((project) =>
    (project.in_scope || !!saved[project.id] || !!draft[project.id]) &&
    (!statuses.length || statuses.includes(project.status)) &&
    project.name.toLocaleLowerCase().includes(normalizedSearch),
  );
  const selected = projects.filter((project) => !!draft[project.id]);
  const changes = projects.flatMap((project) => {
    const before = saved[project.id];
    const after = draft[project.id];
    if (before === after) return [];
    return [{ project, label: !before ? `added as ${after === "minimum" ? "required" : "optional"}` : !after ? "removed" : `${before === "minimum" ? "required" : "optional"} to ${after === "minimum" ? "required" : "optional"}` }];
  });
  const minimumCount = selected.filter((project) => draft[project.id] === "minimum").length;

  return <>
    <section className="project-picker-summary" aria-live="polite">
      <div><strong>{selected.length} selected</strong><span>{minimumCount} minimum required · {selected.length - minimumCount} optional</span></div>
      <div><strong>{changes.length} unsaved {changes.length === 1 ? "change" : "changes"}</strong><span>{selected.slice(0, 4).map((project) => project.name).join(", ")}{selected.length > 4 ? ` +${selected.length - 4} more` : selected.length ? "" : "No projects selected"}</span></div>
      {!!changes.length && <details><summary>Review changes</summary><ul>{changes.map(({ project, label }) => <li key={project.id}><strong>{project.name}</strong> · {label}</li>)}</ul></details>}
    </section>
    <div className="project-picker-filters">
      <label>Find a project<input autoFocus={autoFocusSearch} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search imported projects" /></label>
      <StatusFilter statuses={availableStatuses} selected={statuses} onChange={setStatuses} />
    </div>
    <p className="meta project-picker-count">Showing {visibleProjects.length} of {projects.filter((project) => project.in_scope || !!saved[project.id] || !!draft[project.id]).length} available projects.</p>
    <div className="project-picker-results">
      {visibleProjects.map((project) => {
        const before = saved[project.id];
        const after = draft[project.id];
        const state = before === after ? before ? "Saved" : "" : !before ? "New" : !after ? "Removed" : "Changed";
        return <div className={`project-picker-row${before !== after ? " changed" : ""}`} key={project.id}>
          <label><input type="checkbox" checked={!!after} onChange={(event) => { const next = { ...draft }; if (event.target.checked) next[project.id] = "minimum"; else delete next[project.id]; onChange(next); }} /><span><strong>{project.name}</strong><small>{project.status}{!project.in_scope ? " · hidden" : ""}</small></span></label>
          {after && <select aria-label={`${project.name} requirement`} value={after} onChange={(event) => onChange({ ...draft, [project.id]: event.target.value as Requirement })}><option value="minimum">Minimum required</option><option value="optional">Optional</option></select>}
          {state && <span className={`link-state ${state.toLocaleLowerCase()}`}>{state}</span>}
        </div>;
      })}
      {!visibleProjects.length && <p className="empty">{projects.length ? "No projects match these filters." : "Import projects to link them."}</p>}
    </div>
  </>;
}
