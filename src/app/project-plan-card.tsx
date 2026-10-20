"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { PackageForecast } from "@/lib/forecast";
import { linearPriorityLabel, type ExtraScope, type ScopeReadiness } from "@/lib/project-scope";
import { placementError, type QueueState, type Placement } from "@/lib/sequencing";

export type BoardProject = { id: string; project_id: string; name: string; status: string; url: string; stream_id: string | null;
  selected: boolean; sequence_position: number | null; linear_priority: number | null; pause_reason: string;
  cross_team: boolean; needs_review: boolean; in_scope: boolean };

type Props = { item: BoardProject; streams: { id: string; name: string }[]; sequencing: QueueState; projection?: PackageForecast;
  extra?: ExtraScope; readiness?: ScopeReadiness; unknown: string[]; busy: boolean; cycleText: (index: number | null | undefined) => string;
  resolution: { label: string; run: () => void }; onOpenProjects?: () => void;
  onSave: (change: Record<string, unknown>, message: string) => Promise<boolean>;
  onMove: (placement: Placement, reason?: string) => Promise<void>; onDragStart: (event: DragEvent, id: string) => void; onDragEnd: () => void };

const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function ProjectPlanCard({ item, streams, sequencing, projection, extra, readiness, unknown, busy, cycleText, resolution,
  onOpenProjects, onSave, onMove, onDragStart, onDragEnd }: Props) {
  const [location, setLocation] = useState(!item.selected ? "deferred" : item.stream_id || "");
  const [beforeId, setBeforeId] = useState("auto");
  const [reason, setReason] = useState(item.pause_reason);
  const [points, setPoints] = useState(extra?.points.toString() || "");
  const [notes, setNotes] = useState(extra?.notes || "");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { setLocation(!item.selected ? "deferred" : item.stream_id || ""); setBeforeId("auto"); setReason(item.pause_reason); }, [item.selected, item.stream_id, item.pause_reason, item.sequence_position]);
  useEffect(() => { setPoints(extra?.points.toString() || ""); setNotes(extra?.notes || ""); }, [extra?.points, extra?.notes]);
  const placement: Placement = { packageId: item.id, streamId: location && location !== "deferred" ? location : null, selected: location !== "deferred",
    ...(location && location !== "deferred" && beforeId !== "auto" ? { beforeId: beforeId || null } : {}) };
  const error = placementError(sequencing, placement);
  const lane = sequencing.packages.filter((candidate) => candidate.selected && candidate.streamId === item.stream_id).sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.id.localeCompare(b.id));
  const index = lane.findIndex((candidate) => candidate.id === item.id);
  const up: Placement = { packageId: item.id, streamId: item.stream_id, selected: true, beforeId: lane[index - 1]?.id };
  const down: Placement = { packageId: item.id, streamId: item.stream_id, selected: true, beforeId: lane[index + 2]?.id ?? null };
  const canUp = item.selected && !!item.stream_id && index > 0 && !placementError(sequencing, up);
  const canDown = item.selected && !!item.stream_id && index < lane.length - 1 && !placementError(sequencing, down);
  const dependencies = sequencing.dependencies.filter((edge) => edge.predecessorId === item.id || edge.successorId === item.id);
  return <article className="board-card project-plan-card" id={`board-package-${item.id}`} data-project-id={item.id}>
    <div className="project-queue-head">
      <button className="drag-handle quiet" type="button" draggable={!busy} disabled={busy} aria-label={`Drag ${item.name}`} aria-describedby="queue-instructions"
        onDragStart={(event) => onDragStart(event, item.id)} onDragEnd={onDragEnd}
        onKeyDown={(event) => { if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault(); if (event.key === "ArrowUp" && canUp) void onMove(up); if (event.key === "ArrowDown" && canDown) void onMove(down);
        } }}>⠿</button>
      <div className="project-queue-title"><div className="card-title"><a href={item.url} target="_blank" rel="noreferrer">{item.name} ↗</a><span className="tag">{item.status}</span></div>
        <p className="meta">Linear priority: {linearPriorityLabel(item.linear_priority)}{item.selected && item.stream_id ? ` · position ${item.sequence_position ?? index + 1}` : ""}</p>
      </div>
      {item.selected && item.stream_id && <div className="queue-step-controls">
        <button type="button" className="quiet" aria-label={`Move ${item.name} up`} disabled={busy || !canUp} onClick={() => void onMove(up)}>↑</button>
        <button type="button" className="quiet" aria-label={`Move ${item.name} down`} disabled={busy || !canDown} onClick={() => void onMove(down)}>↓</button>
      </div>}
    </div>
    <p className="meta">{projection ? `${fmt(Math.max(0, projection.demand - (extra?.points ?? 0)))} estimated points${extra ? ` + ${fmt(extra.points)} extra` : ""}` : ""}{projection?.provisional ? " · provisional" : ""}{projection?.calendarProjected ? " · projected cycle dates" : ""}{unknown.length ? ` · ${unknown.length} unestimated issues` : ""}</p>
    {projection?.finish !== null && projection?.finish !== undefined
      ? <p className="forecast-success">Forecast: {cycleText(projection.finish)}{projection.finish ? " end" : ""} · starts {projection.start === null ? "before next cycle" : cycleText(projection.start)}</p>
      : <div className="blocker-line"><p className="warning">{projection?.reason || "No finite date yet."}</p><button className="text-button" onClick={resolution.run}>{resolution.label}</button></div>}
    {dependencies.length > 0 && <p className={`meta dependency-context${dependencies.some((edge) => edge.successorId === item.id) ? " has-blocker" : ""}`}>
      {dependencies.map((edge) => `${edge.successorId === item.id ? "After / blocked by" : "Blocks"} ${sequencing.packages.find((candidate) => candidate.id === (edge.successorId === item.id ? edge.predecessorId : edge.successorId))?.name ?? "unavailable project"}`).join(" · ")}
      {dependencies.some((edge) => edge.successorId === item.id) && " · Starts only after its blockers finish."}
    </p>}
    {readiness?.status === "needs_scoping" && <p className="scope-reminder">Needs scoping{readiness.dueDate ? ` · due ${readiness.dueDate}` : " · already in progress"}</p>}
    {readiness?.status === "scheduled" && <p className="meta">Scope by {readiness.dueDate}</p>}
    {readiness?.status === "date_unavailable" && <p className="meta">Scoping date unavailable</p>}
    {readiness?.review && <p className="scope-reminder">Review extra scope: {readiness.review}</p>}
    {(readiness?.status === "needs_scoping" || readiness?.review) && <button className="text-button" onClick={() => {
      if (detailsRef.current) { detailsRef.current.open = true; detailsRef.current.querySelector<HTMLElement>(".extra-scope-editor input")?.focus(); }
    }}>Review scope</button>}
    {(item.cross_team || item.needs_review) && <div className="blocker-line"><p className="warning">{item.cross_team ? "Cross-team work needs decomposition." : "Missing from latest import."}</p><button className="text-button" onClick={onOpenProjects}>Review source</button></div>}
    <details className="project-plan-details" ref={detailsRef}><summary>Plan this project</summary>
      <form onSubmit={(event) => { event.preventDefault(); void onMove(placement, reason); }}>
        <div className="board-fields"><label>Location<select aria-label="Location" value={location} onChange={(event) => { setLocation(event.target.value); setBeforeId("auto"); }}>
          <option value="">Needs assignment</option>{streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}<option value="deferred">Deferred</option>
        </select></label>
          {location && location !== "deferred" && <label>Place before<select aria-label="Place before" value={beforeId} onChange={(event) => setBeforeId(event.target.value)}>
            <option value="auto">Last valid position / keep current</option>
            {sequencing.packages.filter((candidate) => candidate.id !== item.id && candidate.selected && candidate.streamId === location).sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            <option value="">End of stream</option>
          </select></label>}
        </div>
        {location === "deferred" && <label>Pause rationale (optional)<input value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></label>}
        {error && <p className="warning">{error}</p>}
        <button disabled={busy || !!error}>Move / save placement</button>
      </form>
      <form className="extra-scope-editor" onSubmit={(event) => { event.preventDefault(); void onSave({ type: "extraScope", packageId: item.id, points: points === "" ? 0 : Number(points), notes }, `${item.name} extra scope saved.`); }}>
        <h4>Extra scope</h4><p>Remaining work beyond estimated Linear issues. A positive budget covers the current unestimated issues and keeps the forecast provisional.</p>
        <div className="board-fields"><label>Extra scope points<input type="number" min="0" max="100000" step="0.001" value={points} onChange={(event) => setPoints(event.target.value)} placeholder="No extra scope" /></label>
          <label>Notes (optional)<input value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} /></label></div>
        {unknown.length > 0 && <p className="meta">Saving a positive budget acknowledges these {unknown.length} unestimated issues: {unknown.join(", ")}.</p>}
        <p className="meta">When Linear scope changes, review the remaining points here. New estimates do not automatically reduce this budget. Clear or enter zero to remove it.</p>
        <button className="secondary" disabled={busy}>Save extra scope</button>
      </form>
    </details>
  </article>;
}
