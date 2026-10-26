"use client";

import type { DragEvent } from "react";
import type { BoardOutcome } from "./board";

export type OutcomeMove = { outcomeId: string; streamId: string | null; beforeOutcomeId?: string; afterOutcomeId?: string };
export type OpenBoardOutcome = (id: string, opener: HTMLElement | null, fallbackId: string, section?: "details" | "projects") => void;
export const outcomeDragType = "application/x-ohwawd-outcome";

export function OutcomeDrop({ streamId, targetId, after = false, dragging, busy, onMove, onEnd }: {
  streamId: string | null; targetId?: string; after?: boolean; dragging: string | null; busy: boolean;
  onMove: (move: OutcomeMove) => Promise<void>; onEnd: () => void;
}) {
  return <div className={`outcome-drop-target${dragging ? " drag-active" : ""}`} data-drop-outcome-stream={streamId ?? "unassigned"} data-drop-outcome-target={targetId ?? ""} data-drop-outcome-side={after ? "after" : "before"}
    aria-hidden={!dragging} onDragOver={(event) => { if (dragging && dragging !== targetId && !busy) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; } }}
    onDrop={(event) => { const id = event.dataTransfer.getData(outcomeDragType); if (!id) return; event.preventDefault(); event.stopPropagation(); onEnd();
      if (!busy && id !== targetId) void onMove({ outcomeId: id, streamId, ...(targetId ? after ? { afterOutcomeId: targetId } : { beforeOutcomeId: targetId } : {}) }); }}>
    {targetId ? `Drop ${after ? "after" : "before"} outcome` : streamId ? "Drop outcome at end of stream" : "Drop outcome into Needs assignment"}
  </div>;
}

export default function OutcomeBoardControls({ outcome, busy, dragging, onDrag, onEnd, onMove, onOpen }: {
  outcome: BoardOutcome; busy: boolean; dragging: string | null;
  onDrag: (event: DragEvent, id: string) => void; onEnd: () => void; onMove: (move: OutcomeMove) => Promise<void>;
  onOpen: OpenBoardOutcome;
}) {
  const fallback = outcome.stream_id ? `board-stream-title-${outcome.stream_id}` : "board-unassigned-outcomes-title";
  return <div className="outcome-board-controls" data-outcome-controls={outcome.id}>
    <OutcomeDrop streamId={outcome.stream_id} targetId={outcome.stream_id ? outcome.id : undefined} dragging={dragging} busy={busy} onMove={onMove} onEnd={onEnd} />
    <div className="outcome-priority-head"><button type="button" className="quiet outcome-drag-handle" draggable={!busy} disabled={busy} aria-label={`Drag outcome ${outcome.title}`} aria-describedby="queue-instructions"
      onDragStart={(event) => onDrag(event, outcome.id)} onDragEnd={onEnd}>⠿</button>
      <button type="button" id={`board-outcome-title-${outcome.id}`} className="text-button timeline-outcome-title" onClick={(event) => onOpen(outcome.id, event.currentTarget, fallback)}>{outcome.title}</button></div>
    <OutcomeDrop streamId={outcome.stream_id} targetId={outcome.stream_id ? outcome.id : undefined} after dragging={dragging} busy={busy} onMove={onMove} onEnd={onEnd} />
  </div>;
}
