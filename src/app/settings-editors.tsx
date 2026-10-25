"use client";

import type { BoardState } from "./board";

export type CapacityDraft = { baseline: string; reserve: string; horizon: string; reason: string };
export const capacityDraft = (board: BoardState): CapacityDraft => ({ baseline: board.capacity.baseline?.toString() ?? "", reserve: String(board.capacity.reserve), horizon: String(board.capacity.horizon), reason: board.capacity.baseline_reason });
const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 });

export function CapacitySettings({ board, draft, onChange, onSave }: {
  board: BoardState; draft: CapacityDraft; onChange: (draft: CapacityDraft) => void; onSave: () => void;
}) {
  const planning = (board.planningCycles ?? board.linearCycles).filter((cycle) => !cycle.completedAt && Date.parse(cycle.startsAt) > Date.parse(board.cycleAnchorAt));
  const projected = planning.filter((cycle) => cycle.projected).length;
  return <div id="capacity-settings">
    <p>Cycle dates and numbers come from Linear. Leave the baseline blank to use the median of at least three comparable completed cycles.</p>
    {!board.connection && <p className="warning">Linear is not connected. Imported capacity evidence is not available.</p>}
    <div className="settings-evidence">
      <p>{board.observedBaseline === null ? `${board.observations.length} comparable completed cycles; a provisional manual baseline is required.` : `Observed median: ${fmt(board.observedBaseline)} points/cycle from ${board.observations.length} cycles.`}</p>
      <p><strong>Effective baseline: {board.effectiveBaseline === null ? "unset" : `${fmt(board.effectiveBaseline)} points/cycle`}</strong>{board.capacity.baseline !== null ? " · manual override" : " · Linear observations"}</p>
      {board.observations.length > 0 && <details><summary>Comparable completed cycles</summary>{board.observations.map((item) => <p className="meta" key={item.linear_id}>{item.starts_at.slice(0, 10)} – {item.ends_at.slice(0, 10)}: {fmt(item.completed_points)} completed points</p>)}</details>}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="board-fields">
        <label>Manual baseline (optional)<input id="settings-baseline" type="number" min="0" max="100000" step="0.001" value={draft.baseline} onChange={(event) => onChange({ ...draft, baseline: event.target.value })} placeholder={board.observedBaseline === null ? "Required" : `Median ${fmt(board.observedBaseline)}`} /></label>
        <label>Reserve points/cycle<input type="number" min="0" max="100000" step="0.001" required value={draft.reserve} onChange={(event) => onChange({ ...draft, reserve: event.target.value })} /></label>
        <label>Forecast horizon (cycles)<input type="number" min="1" max="104" step="1" required value={draft.horizon} onChange={(event) => onChange({ ...draft, horizon: event.target.value })} /></label>
      </div>
      <label>Manual baseline source / override reason<input maxLength={1000} value={draft.reason} onChange={(event) => onChange({ ...draft, reason: event.target.value })} placeholder="Required when entering a manual baseline" /></label>
      <button>Save capacity</button>
    </form>
    <p className="meta">Forecast horizon: {board.capacity.horizon} cycles. {board.futureCycleIds.length} upcoming cycles are synced from Linear; {projected} projected cycles extend the planning calendar. Dates using projected capacity are provisional.</p>
    {planning.length < board.capacity.horizon && <p className="warning">Only {planning.length} forecast cycles are available. {board.calendarProjection?.reason || "Sync the Linear cycle configuration to extend the calendar."}</p>}
  </div>;
}

export function ScopeReadinessSettings({ leadDays, onChange, onSave }: { leadDays: string; onChange: (value: string) => void; onSave: () => void }) {
  return <div id="scoping-settings"><form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
    <label>Scope projects (days before start)<input id="settings-lead-days" type="number" min="0" max="365" step="1" required value={leadDays} onChange={(event) => onChange(event.target.value)} /></label>
    <button className="secondary">Save scoping window</button>
  </form><p>Default: 14 calendar days before forecast start. Needs scoping is a reminder; provisional forecasts remain available. Project Extra scope and readiness reminders are on the Board.</p></div>;
}
