"use client";

import { useEffect, useState } from "react";
import type { BoardOutcome } from "./board";
import type { BoardProject } from "./project-plan-card";
import { placementError, type QueueState } from "@/lib/sequencing";

export default function ProjectRoadmapControls({ item, outcomes, streams, links, sequencing, busy, onSave, onOpenOutcome }: {
  item: BoardProject; outcomes: BoardOutcome[]; links: { outcome_id: string; project_id: string }[]; sequencing: QueueState; busy: boolean;
  streams: { id: string; name: string }[];
  onSave: (change: Record<string, unknown>, message: string) => Promise<boolean>; onOpenOutcome?: (id: string, section?: "details" | "projects") => void;
}) {
  const [owner, setOwner] = useState(item.capacity_outcome_id ?? "");
  const [before, setBefore] = useState("auto");
  const [reason, setReason] = useState(item.pause_reason);
  const [linkTarget, setLinkTarget] = useState("");
  useEffect(() => { setOwner(item.capacity_outcome_id ?? ""); setBefore("auto"); setReason(item.pause_reason); }, [item.id, item.capacity_outcome_id, item.roadmap_state, item.sequence_position, item.pause_reason]);
  const eligible = outcomes.filter((outcome) => outcome.stream_id && sequencing.streamIds.includes(outcome.stream_id) && links.some((link) => link.outcome_id === outcome.id && link.project_id === item.project_id));
  const selectedOwner = eligible.find((outcome) => outcome.id === owner);
  const membership = item.roadmap_state;
  const problem = selectedOwner ? placementError(sequencing, { packageId: item.id, streamId: selectedOwner.stream_id, selected: true, outcomeId: owner, beforeId: before === "auto" ? undefined : before || null }) : "Choose a linked owning outcome assigned to an active stream.";
  const action = membership === "included" ? "Save project placement" : membership === "deferred" ? "Resume on roadmap" : "Include on roadmap";
  const exclude = (action: string, message: string) => void onSave({ type: "roadmapMembership", packageId: item.id, action, reason }, `${item.name}: ${message}`);
  return <div className="project-roadmap-controls"><p className="meta">Roadmap: <strong>{membership === "candidate" ? "Needs assignment · candidate" : membership}</strong>{!item.in_scope ? " · Hidden from source view" : ""}</p>
    {item.roadmap_conversion && <p className="warning">{item.roadmap_conversion.message}</p>}
    {membership !== "dismissed" ? <form onSubmit={(event) => { event.preventDefault(); if (!selectedOwner || problem) return;
      const position = before === "auto" ? {} : { beforeId: before || null };
      if (membership === "included") void onSave({ type: "ownership", packageId: item.id, outcomeId: owner, ...position }, `${item.name} capacity owner / scoped position saved in ${selectedOwner.title}.`);
      else void onSave({ type: "roadmapMembership", packageId: item.id, action: membership === "deferred" ? "resume" : "include", outcomeId: owner, reason, ...position }, `${item.name} included once in ${selectedOwner.title}.`);
    }}><fieldset disabled={busy}><label>Owning outcome<select aria-label={`Owning outcome for ${item.name}`} value={owner} onChange={(event) => { setOwner(event.target.value); setBefore("auto"); }}><option value="">Choose owning outcome…</option>{eligible.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title} · {streams.find((stream) => stream.id === outcome.stream_id)?.name ?? "Needs assignment"}</option>)}</select></label>
      {selectedOwner && <label>Place before<select aria-label={`Place before within ${item.name} owner`} value={before} onChange={(event) => setBefore(event.target.value)}><option value="auto">Last valid position / keep current</option>{sequencing.packages.filter((project) => project.id !== item.id && project.selected && project.ownerId === owner).sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}<option value="">End of owning outcome</option></select></label>}
      {problem && <p className="meta">{problem}</p>}<button disabled={!!problem}>{membership === "included" && owner !== item.capacity_outcome_id ? "Transfer capacity owner" : action}</button>
    </fieldset></form> : <><p className="meta">Off-roadmap demand is excluded. Restore to candidate before choosing an owner and including it.</p><button type="button" className="secondary" disabled={busy} onClick={() => exclude("restore", "restored to Needs assignment, still excluded until explicitly included.")}>Restore candidate</button></>}
    {membership === "deferred" && <><label>Pause rationale (optional)<input value={reason} maxLength={1000} disabled={busy} onChange={(event) => setReason(event.target.value)} /></label><button type="button" className="quiet" disabled={busy} onClick={() => exclude("defer", "pause note saved.")}>Save pause note</button></>}
    <div className="actions">{membership === "included" && <button type="button" className="secondary" disabled={busy} onClick={() => exclude("defer", "deferred; future demand excluded. Pause execution in Linear separately.")}>Defer project</button>}{(membership === "included" || membership === "deferred") && <button type="button" className="quiet" disabled={busy} onClick={() => exclude("candidate", "moved to Needs assignment; future demand excluded.")}>Move to Needs assignment</button>}{membership !== "dismissed" && <button type="button" className="quiet" disabled={busy} onClick={() => exclude("dismiss", "dismissed from roadmap; future demand excluded.")}>Dismiss from roadmap</button>}</div>
    {onOpenOutcome && <details className="roadmap-link-guidance" open={eligible.length === 0}><summary>Link an outcome explicitly</summary><p className="meta">Link this project in the outcome's Projects section, then return here to choose its owner. Inspection creates no links or demand.</p><label>Outcome for project linking<select aria-label={`Outcome for linking ${item.name}`} value={linkTarget} disabled={busy} onChange={(event) => setLinkTarget(event.target.value)}><option value="">Choose outcome…</option>{outcomes.filter((outcome) => outcome.stream_id).map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title}</option>)}</select></label><button type="button" className="secondary" disabled={busy || !outcomes.some((outcome) => outcome.id === linkTarget && outcome.stream_id)} onClick={() => onOpenOutcome(linkTarget, "projects")}>Open outcome Projects for linking</button>{!outcomes.some((outcome) => outcome.stream_id) && <p className="meta">Create or assign an outcome to a stream first.</p>}</details>}
  </div>;
}
