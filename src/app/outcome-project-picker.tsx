"use client";

import { useEffect, useRef, useState } from "react";
import StatusFilter from "./status-filter";

type Project = {
  id: string;
  name: string;
  status: string;
  in_scope: boolean;
};

type Requirement = "minimum" | "optional";
type Link = { project_id: string; requirement: Requirement };

export default function OutcomeProjectPicker({ outcomeTitle, projects, links, busy, onSave, onCancel }: {
  outcomeTitle: string;
  projects: Project[];
  links: Link[];
  busy: boolean;
  onSave: (links: Record<string, Requirement>) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const saved = Object.fromEntries(links.map((link) => [link.project_id, link.requirement])) as Record<string, Requirement>;
  const [draft, setDraft] = useState<Record<string, Requirement>>(saved);
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

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

  return <dialog ref={dialogRef} className="project-picker" aria-labelledby="project-picker-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <header className="project-picker-head">
      <div><p className="eyebrow">Outcome project links</p><h2 id="project-picker-title">{outcomeTitle}</h2><p>Choose the work needed for first delivery. Optional work stays visible without determining the delivery date.</p></div>
      <button type="button" className="quiet" disabled={busy} onClick={onCancel} aria-label="Close project picker">Close</button>
    </header>
    <section className="project-picker-summary" aria-live="polite">
      <div><strong>{selected.length} selected</strong><span>{minimumCount} minimum required · {selected.length - minimumCount} optional</span></div>
      <div><strong>{changes.length} unsaved {changes.length === 1 ? "change" : "changes"}</strong><span>{selected.slice(0, 4).map((project) => project.name).join(", ")}{selected.length > 4 ? ` +${selected.length - 4} more` : selected.length ? "" : "No projects selected"}</span></div>
      {!!changes.length && <details><summary>Review changes</summary><ul>{changes.map(({ project, label }) => <li key={project.id}><strong>{project.name}</strong> · {label}</li>)}</ul></details>}
    </section>
    <div className="project-picker-filters">
      <label>Find a project<input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search imported projects" /></label>
      <StatusFilter statuses={availableStatuses} selected={statuses} onChange={setStatuses} />
    </div>
    <p className="meta project-picker-count">Showing {visibleProjects.length} of {projects.filter((project) => project.in_scope || !!saved[project.id] || !!draft[project.id]).length} available projects.</p>
    <div className="project-picker-results">
      {visibleProjects.map((project) => {
        const before = saved[project.id];
        const after = draft[project.id];
        const state = before === after ? before ? "Saved" : "" : !before ? "New" : !after ? "Removed" : "Changed";
        return <div className={`project-picker-row${before !== after ? " changed" : ""}`} key={project.id}>
          <label><input type="checkbox" checked={!!after} onChange={(event) => setDraft((current) => { const next = { ...current }; if (event.target.checked) next[project.id] = "minimum"; else delete next[project.id]; return next; })} /><span><strong>{project.name}</strong><small>{project.status}{!project.in_scope ? " · hidden" : ""}</small></span></label>
          {after && <select aria-label={`${project.name} requirement`} value={after} onChange={(event) => setDraft((current) => ({ ...current, [project.id]: event.target.value as Requirement }))}><option value="minimum">Minimum required</option><option value="optional">Optional</option></select>}
          {state && <span className={`link-state ${state.toLocaleLowerCase()}`}>{state}</span>}
        </div>;
      })}
      {!visibleProjects.length && <p className="empty">{projects.length ? "No projects match these filters." : "Import projects to link them."}</p>}
    </div>
    <footer className="project-picker-actions"><span>{changes.length ? `${changes.length} unsaved ${changes.length === 1 ? "change" : "changes"}` : "No unsaved changes"}</span><div className="actions"><button type="button" className="quiet" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" disabled={busy || !changes.length} onClick={() => onSave(draft)}>Save links</button></div></footer>
  </dialog>;
}
