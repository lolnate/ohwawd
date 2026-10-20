"use client";

import type { BoardState, BoardOutcome } from "./board";

type Props = { board: BoardState | null; error: string; busy: boolean; onAdd: () => void; onEdit: (outcome: BoardOutcome) => void;
  onManageLinks: (outcome: BoardOutcome) => void; onDelete: (outcome: BoardOutcome) => void; onResolveProject: (id: string) => void };

export default function OutcomeDelivery({ board, error, busy, onAdd, onEdit, onManageLinks, onDelete, onResolveProject }: Props) {
  const forecasts = new Map(board?.forecast.outcomes.map((item) => [item.id, item]));
  const packageForecasts = new Map(board?.forecast.packages.map((item) => [item.id, item]));
  return <section className="panel outcome-delivery-panel" id="outcome-delivery" aria-labelledby="outcome-delivery-title">
    <div className="section-head"><div><h2 id="outcome-delivery-title" tabIndex={-1}>Outcome delivery</h2><p>Review delivery forecasts, target fit, and the projects that need attention.</p></div>
      <button className="text-button" onClick={onAdd}>Add outcome</button>
    </div>
    {!board ? error ? <p className="error" role="alert">Delivery forecasts unavailable: {error}</p> : <p className="meta">Loading delivery forecasts…</p> : board.outcomes.map((outcome) => {
      const projected = forecasts.get(outcome.id);
      const blockedPackage = projected?.requiredIds.map((id) => board.packages.find((item) => item.id === id))
        .find((item) => item && packageForecasts.get(item.id)?.reason);
      return <div className="outcome-forecast-row" key={outcome.id}>
        <div><strong>{outcome.title}</strong><small>{outcome.owner || "No owner"} · Target {outcome.needed_by || "not set"} · {projected?.requiredIds.length || 0} required including blockers</small></div>
        <div className="outcome-status">
          <span className={`forecast-pill status-${projected?.status || "unknown"}`}>{projected?.status.replaceAll("_", " ") || "unknown"}{projected?.endDate ? ` · ${projected.endDate}` : ""}{projected?.calendarProjected ? " · projected cycles" : ""}</span>
          <span className={`target-status ${projected?.target || "unknown"}`}>{projected?.target === "missed" ? `Target missed · ${projected.gapCycles} cycle gap` : projected?.target === "met" ? "Target met" : projected?.target === "unknown" ? `Cannot assess target · ${projected.status === "blocked" ? "blocked work" : "forecast setup incomplete"}` : "No target set"}</span>
        </div>
        <div className="row-actions"><button className="text-button" disabled={busy} onClick={() => onEdit(outcome)}>Edit</button>
          <button className="text-button" disabled={busy} onClick={() => onManageLinks(outcome)}>Links</button>
          <button className="text-button danger-text" disabled={busy} onClick={() => onDelete(outcome)}>Delete</button>
        </div>
        {!!projected?.reasons.length && <div className="outcome-blocker"><p>{projected.reasons.join(" ")}</p>
          {blockedPackage && <button className="text-button" onClick={() => onResolveProject(blockedPackage.id)}>Resolve blocker</button>}
        </div>}
      </div>;
    })}
    {board && !board.outcomes.length && <p className="empty">Add an outcome, then link its minimum-required projects.</p>}
  </section>;
}
