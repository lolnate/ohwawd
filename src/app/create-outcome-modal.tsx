"use client";

import { useEffect, useRef, useState } from "react";
import OutcomeProjectFields, { type Project, type Requirement } from "./outcome-project-fields";

export type OutcomeDraft = { title: string; description: string; owner: string; successSignal: string; neededBy: string };

export default function CreateOutcomeModal({ draft, projects, busy, onChange, onSave, onCancel }: {
  draft: OutcomeDraft;
  projects: Project[];
  busy: boolean;
  onChange: (draft: OutcomeDraft) => void;
  onSave: (links: Record<string, Requirement>) => Promise<void>;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [links, setLinks] = useState<Record<string, Requirement>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    titleRef.current?.focus();
    return () => {
      dialog?.close();
      if (opener?.isConnected && opener.getClientRects().length) opener.focus();
      else document.querySelector<HTMLElement>("#outcome-delivery-title")?.focus();
    };
  }, []);

  function submit() {
    if (!titleRef.current?.reportValidity()) return;
    void onSave(links);
  }

  return <dialog ref={dialogRef} className="project-picker create-outcome-modal" aria-labelledby="create-outcome-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <header className="project-picker-head">
      <div><p className="eyebrow">New outcome</p><h2 id="create-outcome-title">Add outcome</h2><p>Describe the result, then select the Linear projects needed to deliver it.</p></div>
      <button type="button" className="quiet" disabled={busy} onClick={onCancel} aria-label="Close outcome creator">Close</button>
    </header>
    <div className="create-outcome-body">
      <section className="outcome-form create-outcome-fields">
        <label>Outcome title<input ref={titleRef} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} maxLength={200} required placeholder="Customers can complete onboarding" /></label>
        <label>Success signal<input value={draft.successSignal} onChange={(event) => onChange({ ...draft, successSignal: event.target.value })} placeholder="e.g. 80% finish without support" /></label>
        <div className="form-row"><label>Owner<input value={draft.owner} onChange={(event) => onChange({ ...draft, owner: event.target.value })} /></label><label>Needed by<input type="date" value={draft.neededBy} onChange={(event) => onChange({ ...draft, neededBy: event.target.value })} /></label></div>
        <label>Notes<textarea value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} rows={2} /></label>
      </section>
      <OutcomeProjectFields projects={projects} saved={{}} draft={links} onChange={setLinks} />
    </div>
    <footer className="project-picker-actions"><span>{Object.keys(links).length ? `${Object.keys(links).length} project${Object.keys(links).length === 1 ? "" : "s"} will be linked` : "No projects selected"}</span><div className="actions"><button type="button" className="quiet" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" disabled={busy} onClick={submit}>Create outcome</button></div></footer>
  </dialog>;
}
