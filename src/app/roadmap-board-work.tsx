"use client";

import { useState, type ReactNode } from "react";
import type { BoardState } from "./board";
import type { BoardProject } from "./project-plan-card";
import type { Placement } from "@/lib/sequencing";
import type { RoadmapState } from "@/lib/roadmap-planning";

type Card = (project: BoardProject) => ReactNode;
export type ProjectDrop = (streamId: string | null, selected: boolean, beforeId: string | null, label: string, outcomeId?: string, roadmapState?: RoadmapState) => ReactNode;

export function RoadmapOwnedWork({ streamId, state, busy, card, drop, onMove, onOpen }: {
  streamId: string; state: BoardState; busy: boolean; card: Card; drop: ProjectDrop; onMove: (placement: Placement) => Promise<void>; onOpen: (id: string) => void;
}) {
  const owners = state.outcomes.filter((outcome) => outcome.stream_id === streamId).sort((a, b) => (a.stream_position ?? Infinity) - (b.stream_position ?? Infinity));
  const members = state.packages.filter((item) => item.roadmap_state === "included" && item.stream_id === streamId);
  return <details className="lane-packages roadmap-owned-work" id={`stream-work-${streamId}`} ref={(element) => { if (element && state.sequenceConflicts.some((conflict) => conflict.streamId === streamId)) element.open = true; }}><summary>Manage work <span>{members.length}</span></summary>
    <p className="meta">Project order is scoped to its owner. Transferring to another linked owner moves the single charge; outcome priority controls order between owners.</p>
    {owners.map((outcome) => {
      const projects = members.filter((item) => item.capacity_outcome_id === outcome.id).sort((a, b) => (a.sequence_position ?? Infinity) - (b.sequence_position ?? Infinity) || a.id.localeCompare(b.id));
      return <section key={outcome.id} className="owning-outcome-work" data-owning-outcome={outcome.id} aria-label={`Owned work for ${outcome.title}`}>
        <h4><button type="button" className="text-button" aria-label={`Open ${outcome.title} outcome details`} onClick={() => onOpen(outcome.id)}>{outcome.title}</button> · priority {outcome.stream_position}</h4>
        {state.sequenceConflicts.filter((conflict) => conflict.ownerId === outcome.id).map((conflict) => <div className="sequence-conflict" key={conflict.key}><p>{conflict.message} Repair this owner's order to restore its unfinished forecasts.</p><button type="button" className="secondary" disabled={busy} onClick={() => void onMove({ packageId: conflict.predecessorId, streamId, selected: true, outcomeId: outcome.id, beforeId: conflict.successorId })}>Put blocker first</button></div>)}
        <ol className="project-queue" aria-label={`${outcome.title} owned project sequence`}>{projects.map((project) => <li key={project.id}>{drop(streamId, true, project.id, `Drop before ${project.name} within ${outcome.title}`, outcome.id)}{card(project)}</li>)}<li>{drop(streamId, true, null, `Drop into ${outcome.title} at its last valid position`, outcome.id)}</li></ol>
        {!projects.length && <p className="empty">No included work owned here. Include a linked project explicitly, or transfer an eligible linked project to this owner.</p>}
      </section>;
    })}
    {!owners.length && <p className="empty">Assign an outcome to this stream first.</p>}
  </details>;
}

export function RoadmapTriage({ state, card, drop }: { state: BoardState; card: Card; drop: ProjectDrop }) {
  const [search, setSearch] = useState(""); const [showHidden, setShowHidden] = useState(false);
  const filtered = state.packages.filter((item) => (showHidden || item.in_scope) && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section className="roadmap-triage" aria-labelledby="board-roadmap-triage-title"><h3 tabIndex={-1} id="board-roadmap-triage-title">Roadmap triage</h3>
    <p className="meta">Deferred work and dismissed Engineering work consume no individually scheduled capacity. Candidate projects that need an owning outcome are listed in Outcomes. Represent other off-roadmap work through reserve/capacity assumptions. Hide is source visibility only.</p>
    <div className="board-fields"><label>Search roadmap projects<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="board-check"><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />Show hidden source projects</label></div>
    {([['deferred', 'Deferred', 'deferred-work'], ['dismissed', 'Dismissed from roadmap', 'dismissed-work']] as const).map(([membership, title, id]) => {
      const all = state.packages.filter((item) => item.roadmap_state === membership), visible = filtered.filter((item) => item.roadmap_state === membership).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      return <div className="board-shelves" key={membership}>{drop(null, false, null, `Drop into ${title}`, undefined, membership)}<details id={id} className="stream-lane lane-packages"><summary>{title} <span className="count">{all.length}</span></summary>
        <p className="meta">{visible.length} of {all.length} projects shown. {membership === "dismissed" ? "Restore returns work to candidate in Outcomes; it does not include it automatically." : "Deferred work retains valid owner context for explicit resume. Pause execution separately in Linear."}</p>
        <ol className="project-queue shelf-projects" aria-label={`${title} roadmap projects`}>{visible.map((project) => <li key={project.id}>{card(project)}</li>)}</ol>{!visible.length && <p className="empty">No projects in this visible triage set.</p>}
      </details></div>;
    })}
  </section>;
}
