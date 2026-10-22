"use client";

import { useEffect, useRef, useState } from "react";
import OutcomeProjectFields, { type Project, type Requirement } from "./outcome-project-fields";
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
  const changeCount = projects.filter((project) => saved[project.id] !== draft[project.id]).length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} className="project-picker" aria-labelledby="project-picker-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <header className="project-picker-head">
      <div><p className="eyebrow">Outcome project links</p><h2 id="project-picker-title">{outcomeTitle}</h2><p>Choose the work needed for first delivery. Optional work stays visible without determining the delivery date.</p></div>
      <button type="button" className="quiet" disabled={busy} onClick={onCancel} aria-label="Close project picker">Close</button>
    </header>
    <OutcomeProjectFields projects={projects} saved={saved} draft={draft} onChange={setDraft} autoFocusSearch />
    <footer className="project-picker-actions"><span>{changeCount ? `${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}` : "No unsaved changes"}</span><div className="actions"><button type="button" className="quiet" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" disabled={busy || !changeCount} onClick={() => onSave(draft)}>Save links</button></div></footer>
  </dialog>;
}
