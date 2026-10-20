"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ForecastResult, PackageForecast, OutcomeForecast } from "@/lib/forecast";
import { linearCycleLabel } from "@/lib/cycles";
import CycleCalendar, { type CalendarCycle } from "./cycle-calendar";
import StreamManager from "./stream-manager";
import { readApiResponse } from "./client-api";
import "./board.css";
import "./board-compact.css";
import "./stream-controls.css";

type Package = { id: string; project_id: string; name: string; status: string; url: string; stream_id: string | null; selected: boolean; must_include: boolean; priority_rank: number; earliest_cycle: number | null; preferred_cycle: number | null; earliest_linear_cycle_id: string | null; preferred_linear_cycle_id: string | null; pause_reason: string; cross_team: boolean; needs_review: boolean; in_scope: boolean };
type Stream = { id: string; name: string; allocation: number; wip_limit: number };
type LinearCycle = { id: string; number: number; name: string | null; startsAt: string; endsAt: string };
type BoardOutcome = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null };
type BoardState = { connection: { team_name: string; cycles_enabled: boolean; cycle_duration: number | null; cycle_start_day: number | null; cycle_cooldown_time: number | null; upcoming_cycle_count: number | null } | null; packages: Package[]; streams: Stream[]; links: { outcome_id: string; project_id: string; requirement: "minimum" | "optional" }[]; capacity: { baseline: number | null; baseline_reason: string; reserve: number; horizon: number }; observations: { linear_id: string; starts_at: string; ends_at: string; completed_points: number }[]; observedBaseline: number | null; effectiveBaseline: number | null; linearCycles: LinearCycle[]; currentCycleId: string | null; cycleAnchorAt: string; futureCycleIds: string[]; adjustments: { linear_cycle_id: string; number: number; name: string | null; starts_at: string; ends_at: string; availability: number; reserve: number | null }[]; legacyAdjustments: { cycle_number: number }[]; dependencies: { predecessor_id: string; successor_id: string; source: "local" | "linear"; waived: boolean; waiver_reason: string }[]; allowances: { package_id: string; kind: string; points: number; issue_ids: string[]; owner: string; review_date: string; rationale: string }[]; issues: { linear_id: string; project_id: string; identifier: string; estimate: number | null; state_type: string }[]; outcomes: BoardOutcome[]; timezone: string; forecast: ForecastResult };
type PackageDraft = { streamId: string; selected: boolean; mustInclude: boolean; priority: number; earliest: string; preferred: string; reason: string };
const draftFor = (item: Package): PackageDraft => ({ streamId: item.stream_id || "", selected: item.selected, mustInclude: item.must_include, priority: item.priority_rank, earliest: item.earliest_linear_cycle_id || "", preferred: item.preferred_linear_cycle_id || "", reason: item.pause_reason });
const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function Board({ refreshKey, onChanged, onAddOutcome, onManageOutcome }: { refreshKey: number; onChanged?: () => void; onAddOutcome?: () => void; onManageOutcome?: (id: string) => void }) {
  const [state, setState] = useState<BoardState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({});
  const [capacity, setCapacity] = useState({ baseline: "", reserve: "0", horizon: 26, reason: "" });
  const [streamDrafts, setStreamDrafts] = useState<Record<string, { name: string; allocation: string; wip: number }>>({});
  const [adjustment, setAdjustment] = useState({ selectedCycleIds: [] as string[], availability: "100", reserve: "" });
  const [dependency, setDependency] = useState({ predecessorId: "", successorId: "" });
  const [allowance, setAllowance] = useState<Record<string, { kind: "unestimated" | "discovery"; points: string; owner: string; reviewDate: string; rationale: string }>>({});
  const [outcomeDraft, setOutcomeDraft] = useState<BoardOutcome | null>(null);
  const [renamingStreamId, setRenamingStreamId] = useState<string | null>(null);
  const [assignmentSearches, setAssignmentSearches] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const loadGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      const data = await readApiResponse<BoardState>(response, "Could not load board");
      if (generation !== loadGeneration.current) return;
      setError("");
      setState(data);
      setDrafts(Object.fromEntries(data.packages.map((item: Package) => { const draft = draftFor(item); return [item.id, {
        ...draft, earliest: data.futureCycleIds.includes(draft.earliest) ? draft.earliest : "",
        preferred: data.futureCycleIds.includes(draft.preferred) ? draft.preferred : "",
      }]; })));
      setAdjustment((old) => ({ ...old, selectedCycleIds: [] }));
      setCapacity({ baseline: data.capacity.baseline?.toString() || "", reserve: data.capacity.reserve.toString(), horizon: data.capacity.horizon, reason: data.capacity.baseline_reason });
      setStreamDrafts(Object.fromEntries(data.streams.map((item: Stream) => [item.id, { name: item.name, allocation: (item.allocation * 100).toString(), wip: item.wip_limit }])));
    } catch (failure) {
      if (generation === loadGeneration.current) throw failure;
    }
  }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load, refreshKey]);
  async function save(change: unknown, message: string): Promise<boolean> {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/board", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const data = await readApiResponse<BoardState>(response, "Could not save board");
      setState(data); setNotice(message); onChanged?.();
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save board"); return false; }
    finally { setBusy(false); }
  }
  async function refreshCycles() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/linear/cycles", { method: "POST", credentials: "same-origin" });
      const data = await readApiResponse<{ refreshed: number }>(response, "Could not refresh Linear cycles");
      await load();
      onChanged?.();
      setNotice(`${data.refreshed} team cycles refreshed from Linear.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not refresh Linear cycles"); }
    finally { setBusy(false); }
  }
  async function updateOutcome(event: FormEvent) {
    event.preventDefault();
    if (!outcomeDraft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/outcomes/${outcomeDraft.id}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: outcomeDraft.title, description: outcomeDraft.description, owner: outcomeDraft.owner,
        successSignal: outcomeDraft.success_signal, neededBy: outcomeDraft.needed_by?.slice(0, 10) || "",
      }) });
      await readApiResponse<unknown>(response, "Could not update outcome");
      setOutcomeDraft(null); await load(); onChanged?.(); setNotice("Outcome updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update outcome"); }
    finally { setBusy(false); }
  }
  async function deleteOutcome(outcome: BoardOutcome) {
    if (!window.confirm(`Delete “${outcome.title}” and its project links?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/outcomes/${outcome.id}`, { method: "DELETE", credentials: "same-origin" });
      await readApiResponse<unknown>(response, "Could not delete outcome");
      if (outcomeDraft?.id === outcome.id) setOutcomeDraft(null);
      await load(); onChanged?.(); setNotice("Outcome deleted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete outcome"); }
    finally { setBusy(false); }
  }
  if (!state) return <section className="panel" id="sequencing-board"><h2>Sequencing board</h2><p>{error || "Loading board…"}</p></section>;
  const result = state.forecast;
  const futureCycles = state.linearCycles.filter((cycle) => state.futureCycleIds.includes(cycle.id));
  const cycleDate = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: state.timezone, month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  const cycleRange = (cycle: LinearCycle) => `${cycleDate(cycle.startsAt)} – ${cycleDate(new Date(Date.parse(cycle.endsAt) - 1).toISOString())}`;
  const cycleText = (index: number | null | undefined) => index === 0 ? "Complete before next cycle" : index ? linearCycleLabel(futureCycles[index - 1] || { number: 0, name: "Unknown cycle" }) : "Unscheduled";
  const cycleOption = (cycle: LinearCycle) => `${linearCycleLabel(cycle)} · ${cycleRange(cycle)}`;
  const calendarCycles: CalendarCycle[] = state.linearCycles.filter((cycle) => state.futureCycleIds.includes(cycle.id) ||
    cycle.id === state.currentCycleId)
    .map((cycle) => ({ ...cycle, selectable: state.futureCycleIds.includes(cycle.id), adjusted: state.adjustments.some((item) => item.linear_cycle_id === cycle.id) }));
  const currentCycle = state.linearCycles.find((cycle) => cycle.id === state.currentCycleId);
  const packageForecast = new Map(result.packages.map((item) => [item.id, item]));
  const outcomeForecast = new Map(result.outcomes.map((item) => [item.id, item]));
  const card = (item: Package) => {
    const draft = drafts[item.id] || draftFor(item);
    const projection = packageForecast.get(item.id) as PackageForecast | undefined;
    const unknown = state.issues.filter((issue) => issue.project_id === item.project_id && issue.estimate === null && !["completed", "canceled"].includes(issue.state_type));
    const savedAllowance = state.allowances.filter((entry) => entry.package_id === item.id);
    const allowanceDraft = allowance[item.id] || { kind: "unestimated" as const, points: "", owner: "", reviewDate: "", rationale: "" };
    const update = (change: Partial<PackageDraft>) => setDrafts((old) => ({ ...old, [item.id]: { ...draft, ...change } }));
    return <article className="board-card" key={item.id}>
      <div className="card-title"><a href={item.url} target="_blank" rel="noreferrer">{item.name} ↗</a><span className="tag">{item.status}</span></div>
      <p className="meta">{projection ? `${fmt(projection.demand)} known/allowed points` : ""}{projection?.provisional ? " · provisional allowance" : ""}{unknown.length ? ` · ${unknown.length} unestimated issues` : ""}</p>
      {projection?.finish !== null && projection?.finish !== undefined ? <p className="forecast-success">Forecast: {cycleText(projection.finish)}{projection.finish ? " end" : ""} · starts {projection.start === null ? "before next cycle" : cycleText(projection.start)}</p> : <p className="warning">{projection?.reason || "No finite date yet."}</p>}
      {item.cross_team && <p className="warning">Cross-team work needs later decomposition.</p>}
      {item.needs_review && <p className="warning">Missing from latest import.</p>}
      <details><summary>Plan this package</summary>
        <div className="board-fields"><label>Location<select value={draft.selected ? draft.streamId : "deferred"} onChange={(event) => update(event.target.value === "deferred" ? { selected: false } : { selected: true, streamId: event.target.value })}><option value="">Needs assignment</option>{state.streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}<option value="deferred">Deferred</option></select></label>
          <label>Priority rank<input type="number" min="0" value={draft.priority} onChange={(event) => update({ priority: Number(event.target.value) })} /></label>
          <label>Preferred start<select value={draft.preferred} onChange={(event) => update({ preferred: event.target.value })}><option value="">Any upcoming cycle</option>{futureCycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycleOption(cycle)}</option>)}</select></label>
          <label>Hard not-before<select value={draft.earliest} onChange={(event) => update({ earliest: event.target.value })}><option value="">Any upcoming cycle</option>{futureCycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycleOption(cycle)}</option>)}</select></label></div>
        {((item.earliest_cycle && !item.earliest_linear_cycle_id) || (item.preferred_cycle && !item.preferred_linear_cycle_id) ||
          (item.earliest_linear_cycle_id && !state.futureCycleIds.includes(item.earliest_linear_cycle_id)) ||
          (item.preferred_linear_cycle_id && !state.futureCycleIds.includes(item.preferred_linear_cycle_id))) &&
          <p className="warning">A previous start setting is no longer an upcoming Linear cycle. Choose a cycle above or clear it, then save.</p>}
        <label className="board-check"><input type="checkbox" checked={draft.mustInclude} onChange={(event) => update({ mustInclude: event.target.checked })} />Must include</label>
        {!draft.selected && <label>Pause rationale<input value={draft.reason} onChange={(event) => update({ reason: event.target.value })} placeholder="Required for must-include or in-progress work" /></label>}
        <button disabled={busy} onClick={() => void save({ type: "package", id: item.id, streamId: draft.streamId || null, selected: draft.selected, mustInclude: draft.mustInclude, priority: draft.priority, earliestCycleId: draft.earliest || null, preferredCycleId: draft.preferred || null, reason: draft.reason }, "Package plan saved.")}>Save package</button>
        {savedAllowance.map((entry) => <p className="meta" key={entry.kind}>{entry.kind}: {fmt(entry.points)} points · {entry.owner} · review {entry.review_date} <button className="text-button" disabled={busy} onClick={() => void save({ type: "allowance", packageId: item.id, kind: entry.kind, remove: true }, "Allowance removed.")}>Remove</button></p>)}
        <div className="allowance-editor"><h4>Scope allowance</h4><p>Cover missing issue estimates or separate discovery work. Allowances make dates provisional.</p>
          <div className="board-fields"><label>Kind<select value={allowanceDraft.kind} onChange={(event) => setAllowance((old) => ({ ...old, [item.id]: { ...allowanceDraft, kind: event.target.value as "unestimated" | "discovery" } }))}><option value="unestimated">Unestimated issues</option><option value="discovery">Discovery</option></select></label>
            <label>Points<input type="number" min="0.001" step="0.001" value={allowanceDraft.points} onChange={(event) => setAllowance((old) => ({ ...old, [item.id]: { ...allowanceDraft, points: event.target.value } }))} /></label>
            <label>Owner<input value={allowanceDraft.owner} onChange={(event) => setAllowance((old) => ({ ...old, [item.id]: { ...allowanceDraft, owner: event.target.value } }))} /></label>
            <label>Review date<input type="date" value={allowanceDraft.reviewDate} onChange={(event) => setAllowance((old) => ({ ...old, [item.id]: { ...allowanceDraft, reviewDate: event.target.value } }))} /></label></div>
          <label>Rationale<input value={allowanceDraft.rationale} onChange={(event) => setAllowance((old) => ({ ...old, [item.id]: { ...allowanceDraft, rationale: event.target.value } }))} /></label>
          {allowanceDraft.kind === "unestimated" && <p className="meta">Covers all {unknown.length} currently unestimated open issue{unknown.length === 1 ? "" : "s"}: {unknown.map((issue) => issue.identifier).join(", ") || "none"}</p>}
          <button className="secondary" disabled={busy || (allowanceDraft.kind === "unestimated" && !unknown.length)} onClick={() => void save({ type: "allowance", packageId: item.id, kind: allowanceDraft.kind, points: Number(allowanceDraft.points), owner: allowanceDraft.owner, reviewDate: allowanceDraft.reviewDate, rationale: allowanceDraft.rationale, issueIds: allowanceDraft.kind === "unestimated" ? unknown.map((issue) => issue.linear_id) : [] }, "Allowance saved.")}>Save allowance</button>
        </div>
      </details>
    </article>;
  };
  const planningPackages = state.packages.filter((item) => item.in_scope);
  const selected = planningPackages.filter((item) => item.selected);
  const unassigned = selected.filter((item) => !item.stream_id);
  const deferred = planningPackages.filter((item) => !item.selected);
  const totalAllocation = state.streams.reduce((sum, item) => sum + item.allocation, 0);
  const shownCycles = Math.min(state.capacity.horizon, futureCycles.length, 12);
  return <section className="panel sequencing-board" id="sequencing-board">
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="board-summary"><div><strong>{fmt(result.selectedKnown)} pts</strong><small>selected known + allowances</small></div><div><strong>{result.selectedUnknown}</strong><small>uncovered issues</small></div><div><strong>{Math.round(totalAllocation * 100)}%</strong><small>allocated · {Math.round(result.unallocated * 100)}% headroom</small></div><div><strong>{result.ready ? `${result.cycles.length} cycles` : "Setup needed"}</strong><small>forecast horizon used</small></div></div>
    {state.packages.some((item) => !item.in_scope && item.selected) && <p className="meta">Hidden selected packages remain included in forecast totals. Restore them in Imported projects to change their plan.</p>}
    {result.setup.map((message) => <p className="warning" key={message}>{message}</p>)}{result.errors.map((message) => <p className="error" key={message}>{message}</p>)}
    <div className="outcome-forecast"><div className="compact-section-head"><h3>Outcome delivery</h3><button className="text-button" onClick={onAddOutcome}>Add outcome</button></div>{state.outcomes.map((outcome) => { const projected = outcomeForecast.get(outcome.id) as OutcomeForecast | undefined; return <div className="outcome-forecast-row" key={outcome.id}><div><strong>{outcome.title}</strong><small>{outcome.owner || "No owner"} · Target {outcome.needed_by || "not set"} · {projected?.requiredIds.length || 0} required including blockers</small></div><div className="outcome-status"><span className={`forecast-pill ${projected?.target || "unknown"}`}>{projected?.status.replace("_", " ") || "unknown"}{projected?.endDate ? ` · ${projected.endDate}` : ""}</span><small>{projected?.target === "missed" ? `${projected.gapCycles} cycle gap` : projected?.target === "met" ? "Target met" : projected?.target === "unknown" ? "Target unknown" : ""}</small></div><div className="row-actions"><button className="text-button" disabled={busy} onClick={() => setOutcomeDraft({ ...outcome })}>Edit</button><button className="text-button" disabled={busy} onClick={() => onManageOutcome?.(outcome.id)}>Links</button><button className="text-button danger-text" disabled={busy} onClick={() => void deleteOutcome(outcome)}>Delete</button></div>{!!projected?.reasons.length && <p>{projected.reasons.join(" ")}</p>}{outcomeDraft?.id === outcome.id && <form className="inline-outcome-editor" onSubmit={updateOutcome}><label>Title<input value={outcomeDraft.title} maxLength={200} required onChange={(event) => setOutcomeDraft({ ...outcomeDraft, title: event.target.value })} /></label><label>Owner<input value={outcomeDraft.owner} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, owner: event.target.value })} /></label><label>Needed by<input type="date" value={outcomeDraft.needed_by?.slice(0, 10) || ""} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, needed_by: event.target.value || null })} /></label><label>Success signal<input value={outcomeDraft.success_signal} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, success_signal: event.target.value })} /></label><label className="wide-field">Notes<textarea rows={2} value={outcomeDraft.description} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, description: event.target.value })} /></label><div className="actions wide-field"><button disabled={busy}>Save</button><button type="button" className="quiet" disabled={busy} onClick={() => setOutcomeDraft(null)}>Cancel</button></div></form>}</div>; })}{!state.outcomes.length && <p className="empty">Add an outcome, then link its minimum-required projects.</p>}</div>
    <div className="board-config-row"><details className="board-settings" aria-label="Linear cycle calendar"><summary>Cycle calendar and exceptions <span>{futureCycles.length} upcoming</span></summary><div className="section-head"><h3>Linear cycle calendar</h3><button type="button" className="secondary" disabled={busy || !state.connection} onClick={() => void refreshCycles()}>Refresh Linear cycles</button></div>
      <p>{state.connection?.team_name || "Connected team"} · {state.connection?.cycles_enabled ? `${state.connection.cycle_duration ?? "?"} week cycle${state.connection.cycle_duration === 1 ? "" : "s"}` : "Cycles are not enabled in Linear"} · {currentCycle ? `currently ${linearCycleLabel(currentCycle)} (${cycleRange(currentCycle)}) · ` : "between cycles · "}{futureCycles.length} upcoming imported{state.connection?.upcoming_cycle_count ? ` (Linear configured for ${state.connection.upcoming_cycle_count})` : ""}</p>
      {!!calendarCycles.length ? <CycleCalendar cycles={calendarCycles} timezone={state.timezone} sourceAt={state.cycleAnchorAt} selectedIds={adjustment.selectedCycleIds} onToggle={(id) => setAdjustment((old) => ({ ...old, selectedCycleIds: old.selectedCycleIds.includes(id) ? old.selectedCycleIds.filter((value) => value !== id) : [...old.selectedCycleIds, id] }))} /> : <p className="warning">No current or upcoming cycles were imported. Configure cycles for this team in Linear and import again.</p>}
      <div className="board-subform"><h3>Cycle exception</h3><p>Select a date above to choose its Linear cycle. Select more than one cycle to apply the same availability and reserve to each.</p>
        <div className="calendar-selection">{adjustment.selectedCycleIds.map((id) => { const cycle = state.linearCycles.find((item) => item.id === id); return <span key={id}>{cycle ? linearCycleLabel(cycle) : "Unknown cycle"}</span>; })}{!adjustment.selectedCycleIds.length && <span>No cycles selected</span>}</div>
        <div className="board-fields"><label>Availability %<input type="number" min="0" max="100" value={adjustment.availability} onChange={(event) => setAdjustment({ ...adjustment, availability: event.target.value })} /></label><label>Reserve override<input type="number" min="0" step="0.001" value={adjustment.reserve} onChange={(event) => setAdjustment({ ...adjustment, reserve: event.target.value })} placeholder="Base reserve" /></label></div>
        <div className="actions"><button type="button" className="secondary" disabled={busy || !adjustment.selectedCycleIds.length} onClick={() => void save({ type: "adjustment", cycleIds: adjustment.selectedCycleIds, availability: Number(adjustment.availability) / 100, reserve: adjustment.reserve === "" ? null : Number(adjustment.reserve) }, "Cycle exception saved.")}>Apply to selected cycles</button><button type="button" className="quiet" disabled={busy || !adjustment.selectedCycleIds.length} onClick={() => void save({ type: "adjustment", action: "clear", cycleIds: adjustment.selectedCycleIds }, "Cycle exceptions cleared.")}>Clear selected exceptions</button></div>
        {state.adjustments.filter((item) => state.futureCycleIds.includes(item.linear_cycle_id)).map((item) => <p className="meta" key={item.linear_cycle_id}>{linearCycleLabel(item)} · {cycleRange({ id: item.linear_cycle_id, number: item.number, name: item.name, startsAt: item.starts_at, endsAt: item.ends_at })}: {Math.round(item.availability * 100)}% availability · reserve {item.reserve ?? "base"}</p>)}
        {!!state.adjustments.filter((item) => !state.futureCycleIds.includes(item.linear_cycle_id)).length && <p className="warning">Some saved exceptions refer to cycles no longer upcoming in Linear. They remain saved but are excluded from the forecast.</p>}
        {!!state.legacyAdjustments.length && <p className="warning">{state.legacyAdjustments.length} old relative-cycle exception{state.legacyAdjustments.length === 1 ? "" : "s"} could not be matched to a Linear cycle. Select the intended weeks above to reapply them.</p>}
      </div>
    </details>
    <details className="board-settings"><summary>Capacity assumptions</summary><form onSubmit={(event: FormEvent) => { event.preventDefault(); void save({ type: "capacity", baseline: capacity.baseline === "" ? null : Number(capacity.baseline), reserve: Number(capacity.reserve), horizon: capacity.horizon, reason: capacity.reason }, "Capacity profile saved."); }}>
      <p>Cycle dates and numbers come from Linear. Leave the baseline blank to use the median of at least three comparable completed cycles.</p>
      <p className="meta">{state.observedBaseline === null ? `${state.observations.length} comparable completed cycles; a provisional manual baseline is required.` : `Observed median: ${fmt(state.observedBaseline)} points/cycle from ${state.observations.length} cycles.`} Effective baseline: {state.effectiveBaseline === null ? "unset" : `${fmt(state.effectiveBaseline)} points/cycle`}{state.capacity.baseline !== null ? " · manual override" : " · Linear observations"}</p>
      {state.observations.map((item) => <p className="meta" key={item.linear_id}>{item.starts_at.slice(0, 10)} – {item.ends_at.slice(0, 10)}: {fmt(item.completed_points)} completed points</p>)}
      <div className="board-fields"><label>Manual baseline (optional)<input type="number" min="0" step="0.001" value={capacity.baseline} onChange={(event) => setCapacity({ ...capacity, baseline: event.target.value })} placeholder={state.observedBaseline === null ? "Required" : `Median ${fmt(state.observedBaseline)}`} /></label><label>Reserve points/cycle<input type="number" min="0" step="0.001" required value={capacity.reserve} onChange={(event) => setCapacity({ ...capacity, reserve: event.target.value })} /></label><label>Forecast horizon (Linear cycles)<input type="number" min="1" max="104" required value={capacity.horizon} onChange={(event) => setCapacity({ ...capacity, horizon: Number(event.target.value) })} /></label></div>
      <label>Manual baseline source / override reason<input value={capacity.reason} onChange={(event) => setCapacity({ ...capacity, reason: event.target.value })} placeholder="Required when entering a manual baseline" /></label><button disabled={busy}>Save capacity</button></form>
      {futureCycles.length < state.capacity.horizon && <p className="warning">Linear currently has {futureCycles.length} upcoming cycles. The forecast stops at {futureCycles.length ? linearCycleLabel(futureCycles.at(-1)!) : "the current cycle"}; increase upcoming cycles in Linear to extend it.</p>}
    </details></div>
    <StreamManager refreshKey={refreshKey} onChanged={() => { void load(); onChanged?.(); }} />
    <div className="stream-list">{state.streams.map((stream) => {
      const plan = streamDrafts[stream.id] || { name: stream.name, allocation: (stream.allocation * 100).toString(), wip: stream.wip_limit };
      const members = selected.filter((item) => item.stream_id === stream.id);
      const search = assignmentSearches[stream.id]?.trim().toLocaleLowerCase() || "";
      const matchingPackages = planningPackages.filter((item) => !search || item.name.toLocaleLowerCase().includes(search));
      const locationFor = (item: Package) => !item.selected ? "Deferred" : item.stream_id ? state.streams.find((candidate) => candidate.id === item.stream_id)?.name || "Another stream" : "Needs assignment";
      return <div className="stream-lane" key={stream.id}><div className="stream-heading"><div className="stream-title">
        {renamingStreamId === stream.id ? <div className="stream-title-editor"><label>Stream name<input autoFocus maxLength={80} value={plan.name} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, name: event.target.value } }))} /></label><div className="actions"><button className="secondary" disabled={busy || !plan.name.trim()} onClick={() => void save({ type: "stream", id: stream.id, name: plan.name, allocation: Number(plan.allocation) / 100, wip: plan.wip }, `${plan.name.trim()} updated.`).then((saved) => { if (saved) setRenamingStreamId(null); })}>Save name</button><button className="quiet" disabled={busy} onClick={() => { setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, name: stream.name } })); setRenamingStreamId(null); }}>Cancel</button></div></div> : <div className="stream-title-row"><h3>{stream.name}</h3><button className="text-button" disabled={busy} onClick={() => setRenamingStreamId(stream.id)}>Rename</button></div>}
        <p>{members.length} selected · {Math.round(stream.allocation * 100)}% capacity · WIP {stream.wip_limit}</p>
      </div><div className="stream-controls"><label>Allocation %<input type="number" min="0" max="100" step="0.1" value={plan.allocation} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, allocation: event.target.value } }))} /></label><label>WIP<input type="number" min="1" max="50" value={plan.wip} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, wip: Number(event.target.value) } }))} /></label><button className="secondary" disabled={busy || !plan.name.trim()} onClick={() => void save({ type: "stream", id: stream.id, name: plan.name, allocation: Number(plan.allocation) / 100, wip: plan.wip }, `${stream.name} settings updated.`)}>Save settings</button></div></div>
      {result.ready && members.length > 0 && <div className="timeline-scroll"><div className="lane-timeline" style={{ gridTemplateColumns: `160px repeat(${shownCycles}, minmax(150px, 1fr))` }}><div className="timeline-label">Package</div>{Array.from({ length: shownCycles }, (_, index) => <div className="timeline-tick" key={futureCycles[index].id}>{linearCycleLabel(futureCycles[index])}<small>{cycleRange(futureCycles[index])}</small></div>)}{members.map((item, index) => { const projected = packageForecast.get(item.id); const start = projected?.start; const finish = projected?.finish; return <div className="timeline-row" key={item.id} style={{ gridColumn: `1 / ${shownCycles + 2}`, gridRow: index + 2, gridTemplateColumns: `160px repeat(${shownCycles}, minmax(150px, 1fr))` }}><span className="timeline-name" title={item.name}>{item.name}</span>{start !== null && start !== undefined && finish !== null && finish !== undefined && start <= shownCycles ? <span className="timeline-bar" style={{ gridColumn: `${start + 1} / ${Math.min(finish, shownCycles) + 2}` }} title={`${cycleText(start)}–${cycleText(finish)} · ${item.name}`}>{start === finish ? cycleText(finish) : `${cycleText(start)}–${cycleText(finish)}`}</span> : <span className="timeline-undated" style={{ gridColumn: `2 / ${shownCycles + 2}` }}>{finish === 0 ? "Complete before next cycle" : start && start > shownCycles ? `Starts ${cycleText(start)}; beyond visible timeline` : projected?.reason || "No cycle date"}</span>}</div>; })}</div>{state.capacity.horizon > shownCycles && <p className="meta">Showing first {shownCycles} imported cycles; see the cycle table for later work.</p>}</div>}
      <details className="lane-packages"><summary>Manage work <span>{members.length}</span></summary><div className="stream-assignment"><div className="assignment-intro"><h4>Assign work to {stream.name}</h4><p>Assign every project linked to an outcome, or move one project at a time. A project can belong to only one stream; assigning it here moves it from its current stream.</p></div><div className="assignment-columns"><section><h5>By outcome</h5><div className="assignment-list">{state.outcomes.map((outcome) => {
        const outcomeProjectIds = new Set(state.links.filter((link) => link.outcome_id === outcome.id).map((link) => link.project_id));
        const packages = state.packages.filter((item) => outcomeProjectIds.has(item.project_id));
        const hidden = packages.filter((item) => !item.in_scope);
        const allAssigned = packages.length > 0 && packages.every((item) => item.selected && item.stream_id === stream.id);
        return <div className="assignment-group" key={outcome.id}><div><strong>{outcome.title}</strong><small>{packages.length ? packages.map((item) => `${item.name} · ${locationFor(item)}${item.in_scope ? "" : " · hidden"}`).join("\n") : "No linked projects"}</small></div><button className={allAssigned ? "quiet" : "secondary"} disabled={busy || !packages.length || allAssigned} onClick={() => { if (hidden.length && !window.confirm(`This outcome includes ${hidden.length} hidden project${hidden.length === 1 ? "" : "s"}. Assign and select all linked projects anyway?`)) return; void save({ type: "assignment", streamId: stream.id, packageIds: packages.map((item) => item.id) }, `${packages.length} project${packages.length === 1 ? "" : "s"} from ${outcome.title} assigned to ${stream.name}.`); }}>{allAssigned ? "Assigned" : `Assign all ${packages.length}`}</button></div>;
      })}{!state.outcomes.length && <p className="empty">Create an outcome and link projects to assign them together.</p>}</div></section><section><h5>By individual project</h5><label className="assignment-search">Find project<input type="search" value={assignmentSearches[stream.id] || ""} onChange={(event) => setAssignmentSearches((old) => ({ ...old, [stream.id]: event.target.value }))} placeholder="Search project names" /></label><div className="assignment-list project-assignment-list">{matchingPackages.map((item) => {
        const assignedHere = item.selected && item.stream_id === stream.id;
        return <div className="assignment-group" key={item.id}><div><strong>{item.name}</strong><small>{locationFor(item)}</small></div><button className={assignedHere ? "quiet" : "secondary"} disabled={busy || assignedHere} onClick={() => void save({ type: "assignment", streamId: stream.id, packageIds: [item.id] }, `${item.name} assigned to ${stream.name}.`)}>{assignedHere ? "Assigned" : item.stream_id && item.selected ? "Move here" : "Assign"}</button></div>;
      })}{!matchingPackages.length && <p className="empty">No projects match this search.</p>}</div></section></div></div><div className="assigned-packages"><h4>Packages currently in {stream.name}</h4><div className="board-cards">{members.map(card)}{!members.length && <p className="empty">No selected work in this stream yet.</p>}</div></div></details></div>;
    })}</div>
    <div className="board-shelves"><details className="stream-lane lane-packages"><summary>Needs assignment <span className="count">{unassigned.length}</span></summary><p>Selected demand stays visible; a required outcome has no credible date until assigned.</p><div className="board-cards">{unassigned.map(card)}{!unassigned.length && <p className="empty">No selected work waiting for a stream.</p>}</div></details><details className="stream-lane deferred lane-packages"><summary>Deferred <span className="count">{deferred.length}</span></summary><p>Paused work consumes no future capacity. In-progress work must also be paused in Linear separately.</p><div className="board-cards">{deferred.map(card)}{!deferred.length && <p className="empty">No deferred work.</p>}</div></details></div>
    <details className="board-settings"><summary>Dependencies</summary><p>“Blocked by” means the predecessor must finish in a previous cycle. Local links stay in Oh, WAWD!.</p><div className="board-fields"><label>Blocking package<select value={dependency.predecessorId} onChange={(event) => setDependency({ ...dependency, predecessorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Blocked package<select value={dependency.successorId} onChange={(event) => setDependency({ ...dependency, successorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><button disabled={busy || !dependency.predecessorId || !dependency.successorId} onClick={() => void save({ type: "dependency", action: "add", ...dependency }, "Dependency saved.")}>Add dependency</button><ul className="dependency-list">{state.dependencies.map((edge) => <li key={`${edge.source}:${edge.predecessor_id}:${edge.successor_id}`}><span>{state.packages.find((item) => item.id === edge.predecessor_id)?.name || edge.predecessor_id} → {state.packages.find((item) => item.id === edge.successor_id)?.name || edge.successor_id} · {edge.source}{edge.waived ? ` · waived: ${edge.waiver_reason}` : ""}</span>{edge.source === "local" && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "remove", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Dependency removed.")}>Remove</button>}{edge.source === "linear" && !edge.waived && <button className="text-button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for waiving this Linear dependency in the forecast?"); if (reason) void save({ type: "dependency", action: "waive", predecessorId: edge.predecessor_id, successorId: edge.successor_id, reason }, "Linear dependency waived in this plan."); }}>Waive</button>}{edge.source === "linear" && edge.waived && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "restore", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Linear dependency restored.")}>Restore</button>}</li>)}</ul></details>
    <details className="board-settings"><summary>Cycle-by-cycle explanation</summary><p>Linear source as of {new Date(result.sourceAt).toLocaleString()} · cycle position checked {new Date(state.cycleAnchorAt).toLocaleString()} · dates in {state.timezone}. Unused stream budget does not move to another stream.</p><div className="cycle-table-wrap"><table className="cycle-table"><thead><tr><th>Linear cycle</th><th>Team available</th>{state.streams.map((item) => <th key={item.id}>{item.name}</th>)}</tr></thead><tbody>{result.cycles.map((cycle) => <tr key={cycle.id}><th>{linearCycleLabel(cycle)}<small>{cycle.start} – {cycle.end}</small></th><td>{fmt(cycle.available)} pts</td>{state.streams.map((stream) => { const usage = cycle.streams.find((item) => item.id === stream.id); return <td key={stream.id}>{fmt(usage?.used || 0)} / {fmt(usage?.budget || 0)} pts<small>{usage?.active.map((id) => state.packages.find((item) => item.id === id)?.name || id).join(", ") || "Idle"}</small></td>; })}</tr>)}</tbody></table></div></details>
  </section>;
}
