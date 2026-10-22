"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { BoardState } from "./board";
import type { BoardProject } from "./project-plan-card";
import { projectCodes } from "@/lib/outcome-planning";

function outsideDialog(dialog: HTMLDialogElement, x: number, y: number): boolean {
  const bounds = dialog.getBoundingClientRect();
  return x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom;
}

export default function ProjectDrawer({ project, state, busy, error, notice, children, onSave, onOpenProject, onClose }: {
  project: BoardProject; state: BoardState; busy: boolean; error: string; notice: string; children: ReactNode;
  onSave: (change: Record<string, unknown>, message: string) => Promise<boolean>;
  onOpenProject: (project: BoardProject) => void; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected && opener.getClientRects().length) opener.focus();
      else document.querySelector<HTMLElement>("#project-streams h3")?.focus();
    };
  }, []);
  useEffect(() => { titleRef.current?.focus(); if (dialogRef.current) dialogRef.current.scrollTop = 0; }, [project.id]);
  const linked = state.outcomes.filter((outcome) => state.links.some((link) => link.outcome_id === outcome.id && link.project_id === project.project_id));
  const owner = linked.find((outcome) => outcome.id === project.capacity_outcome_id);
  const stream = state.streams.find((stream) => stream.id === project.stream_id);
  const projection = state.forecast.packages.find((item) => item.id === project.id);
  const extra = state.extraScopes.find((item) => item.package_id === project.id);
  const issues = state.issues.filter((issue) => issue.project_id === project.project_id && !["completed", "canceled"].includes(issue.state_type));
  const unknown = issues.filter((issue) => issue.estimate === null);
  const estimated = issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
  const codes = projectCodes(state.packages);
  const dependencies = state.dependencies.filter((edge) => edge.predecessor_id === project.id || edge.successor_id === project.id);
  return <dialog ref={dialogRef} className="project-drawer" aria-labelledby="project-drawer-title" onCancel={(event) => { event.preventDefault(); onClose(); }}
    onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget && outsideDialog(event.currentTarget, event.clientX, event.clientY); }}
    onPointerCancel={() => { backdropPress.current = false; }}
    onClick={(event) => {
      const startedOutside = backdropPress.current;
      backdropPress.current = false;
      if (startedOutside && event.target === event.currentTarget && outsideDialog(event.currentTarget, event.clientX, event.clientY)) onClose();
    }}>
    <header className="project-drawer-header"><div><p className="eyebrow">Linear project · {codes.get(project.id)}</p><h2 id="project-drawer-title" ref={titleRef} tabIndex={-1}>{project.name}</h2><p>{project.status}{!project.in_scope ? " · hidden from source view" : ""}</p></div><button type="button" className="secondary" onClick={onClose} aria-label="Close project details">Close</button></header>
    <div className="project-drawer-body">
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      <section className="capacity-owner-panel"><h3>Capacity owner</h3>
        <p className="capacity-owner-location">{project.selected ? <><strong>{projection?.demand ?? 0} pts</strong> counted once in <strong>{owner?.title ?? "Other selected work"}</strong> · {stream?.name ?? "Needs assignment"}</> : "Deferred · no future capacity counted"}</p>
        <label>Count points toward outcome / stream<select disabled={busy || !project.selected} value={project.capacity_outcome_id ?? ""} onChange={(event) => void onSave({ type: "ownership", packageId: project.id, outcomeId: event.target.value || null }, `${project.name} capacity owner updated. All linked outcomes use the same project forecast.`)}>
          <option value="">Other selected work · {stream?.name ?? "Needs assignment"}</option>
          {linked.filter((outcome) => outcome.stream_id && state.streams.some((stream) => stream.id === outcome.stream_id)).map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title} · {state.streams.find((stream) => stream.id === outcome.stream_id)?.name}</option>)}
        </select></label>
        <p className="meta">Choosing an owner moves this project's single capacity charge to that outcome's stream. Every other appearance stays linked as a shared reference with 0 points counted there.</p>
        {!project.selected && <p className="meta">Select the project through Location below before choosing its capacity owner.</p>}
      </section>
      <section><h3>Scope</h3><p className="project-description">{project.description || "No project description imported from Linear."}</p></section>
      <section><h3>Estimate basis</h3><p><strong>{projection?.demand ?? estimated + (extra?.points ?? 0)} modeled points</strong> from {estimated} open estimated Linear points{extra ? ` + ${extra.points} extra scope points` : ""}.</p><p>{issues.length} open issues · {unknown.length} unestimated{unknown.length ? `: ${unknown.map((issue) => issue.identifier).join(", ")}` : " · all current issues estimated"}. {projection?.provisional ? "Scope is provisional." : ""} {projection?.calendarProjected ? "Dates use provisional projected cycles." : ""}</p></section>
      <section><h3>Linked outcomes</h3><ul className="drawer-outcome-list">{linked.map((outcome) => <li key={outcome.id}><strong>{outcome.title}</strong><small>{state.streams.find((stream) => stream.id === outcome.stream_id)?.name ?? "Outcome needs stream assignment"} · {state.links.find((link) => link.outcome_id === outcome.id && link.project_id === project.project_id)?.requirement === "optional" ? "optional" : "minimum required"} · {owner?.id === outcome.id && project.selected ? "Points count here" : "Shared · 0 pts here"}</small></li>)}</ul>{!linked.length && <p>No linked outcomes yet.</p>}</section>
      <section><h3>Dependencies</h3>{dependencies.length ? <ul className="drawer-dependency-list">{dependencies.map((edge) => {
        const predecessor = edge.successor_id === project.id;
        const other = state.packages.find((item) => item.id === (predecessor ? edge.predecessor_id : edge.successor_id));
        return <li key={`${edge.source}:${edge.predecessor_id}:${edge.successor_id}`}><span>{predecessor ? "← Blocked by" : "→ Unlocks"} </span>{other ? <button type="button" className="text-button" onClick={() => onOpenProject(other)}>{codes.get(other.id)} · {other.name}</button> : "Unavailable project"}<small>{edge.source}{edge.waived ? ` · waived: ${edge.waiver_reason}` : " · must finish in a previous cycle"}</small></li>;
      })}</ul> : <p>No project dependencies.</p>}</section>
      <section><h3>Project planning</h3>{children}</section>
      <a href={project.url} target="_blank" rel="noreferrer">Open in Linear ↗</a>
    </div>
  </dialog>;
}
