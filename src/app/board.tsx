"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ForecastResult, PackageForecast, OutcomeForecast } from "@/lib/forecast";
import CycleCalendar, { type CalendarCycle } from "./cycle-calendar";
import "./board.css";

type Package = { id: string; project_id: string; name: string; status: string; url: string; stream_id: string | null; selected: boolean; must_include: boolean; priority_rank: number; earliest_cycle: number | null; preferred_cycle: number | null; earliest_linear_cycle_id: string | null; preferred_linear_cycle_id: string | null; pause_reason: string; cross_team: boolean; needs_review: boolean; in_scope: boolean };
type Stream = { id: string; name: string; allocation: number; wip_limit: number };
type LinearCycle = { id: string; number: number; name: string | null; startsAt: string; endsAt: string };
type BoardState = { connection: { team_name: string; cycles_enabled: boolean; cycle_duration: number | null; cycle_start_day: number | null; cycle_cooldown_time: number | null; upcoming_cycle_count: number | null } | null; packages: Package[]; streams: Stream[]; capacity: { baseline: number | null; baseline_reason: string; reserve: number; horizon: number }; observations: { linear_id: string; starts_at: string; ends_at: string; completed_points: number }[]; observedBaseline: number | null; effectiveBaseline: number | null; linearCycles: LinearCycle[]; futureCycleIds: string[]; adjustments: { linear_cycle_id: string; number: number; name: string | null; starts_at: string; ends_at: string; availability: number; reserve: number | null }[]; legacyAdjustments: { cycle_number: number }[]; dependencies: { predecessor_id: string; successor_id: string; source: "local" | "linear"; waived: boolean; waiver_reason: string }[]; allowances: { package_id: string; kind: string; points: number; issue_ids: string[]; owner: string; review_date: string; rationale: string }[]; issues: { linear_id: string; project_id: string; identifier: string; estimate: number | null; state_type: string }[]; outcomes: { id: string; title: string; needed_by: string | null }[]; timezone: string; forecast: ForecastResult };
type PackageDraft = { streamId: string; selected: boolean; mustInclude: boolean; priority: number; earliest: string; preferred: string; reason: string };
const draftFor = (item: Package): PackageDraft => ({ streamId: item.stream_id || "", selected: item.selected, mustInclude: item.must_include, priority: item.priority_rank, earliest: item.earliest_linear_cycle_id || "", preferred: item.preferred_linear_cycle_id || "", reason: item.pause_reason });
const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function Board({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<BoardState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({});
  const [capacity, setCapacity] = useState({ baseline: "", reserve: "0", horizon: 26, reason: "" });
  const [streamDrafts, setStreamDrafts] = useState<Record<string, { allocation: string; wip: number }>>({});
  const [adjustment, setAdjustment] = useState({ selectedCycleIds: [] as string[], availability: "100", reserve: "" });
  const [dependency, setDependency] = useState({ predecessorId: "", successorId: "" });
  const [allowance, setAllowance] = useState<Record<string, { kind: "unestimated" | "discovery"; points: string; owner: string; reviewDate: string; rationale: string }>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/board", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load board");
    setState(data);
    setDrafts(Object.fromEntries(data.packages.map((item: Package) => { const draft = draftFor(item); return [item.id, {
      ...draft, earliest: data.futureCycleIds.includes(draft.earliest) ? draft.earliest : "",
      preferred: data.futureCycleIds.includes(draft.preferred) ? draft.preferred : "",
    }]; })));
    setAdjustment((old) => ({ ...old, selectedCycleIds: [] }));
    setCapacity({ baseline: data.capacity.baseline?.toString() || "", reserve: data.capacity.reserve.toString(), horizon: data.capacity.horizon, reason: data.capacity.baseline_reason });
    setStreamDrafts(Object.fromEntries(data.streams.map((item: Stream) => [item.id, { allocation: (item.allocation * 100).toString(), wip: item.wip_limit }])));
  }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load, refreshKey]);
  async function save(change: unknown, message: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/board", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save board");
      setState(data); setNotice(message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save board"); }
    finally { setBusy(false); }
  }
  async function refreshCycles() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/linear/cycles", { method: "POST", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not refresh Linear cycles");
      await load();
      setNotice(`${data.refreshed} team cycles refreshed from Linear.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not refresh Linear cycles"); }
    finally { setBusy(false); }
  }
  if (!state) return <section className="panel" id="sequencing-board"><h2>Sequencing board</h2><p>{error || "Loading board…"}</p></section>;
  const result = state.forecast;
  const futureCycles = state.linearCycles.filter((cycle) => state.futureCycleIds.includes(cycle.id));
  const cycleText = (index: number | null | undefined) => index === 0 ? "Complete before next cycle" : index ? `Cycle ${futureCycles[index - 1]?.number ?? "?"}` : "Unscheduled";
  const cycleOption = (cycle: LinearCycle) => `Cycle ${cycle.number}${cycle.name ? ` · ${cycle.name}` : ""} · ${new Intl.DateTimeFormat("en-US", { timeZone: state.timezone, month: "short", day: "numeric" }).format(new Date(cycle.startsAt))}`;
  const calendarCycles: CalendarCycle[] = state.linearCycles.filter((cycle) => state.futureCycleIds.includes(cycle.id) ||
    (Date.parse(cycle.startsAt) <= Date.parse(result.sourceAt) && Date.parse(cycle.endsAt) > Date.parse(result.sourceAt)))
    .map((cycle) => ({ ...cycle, selectable: state.futureCycleIds.includes(cycle.id), adjusted: state.adjustments.some((item) => item.linear_cycle_id === cycle.id) }));
  const currentCycle = calendarCycles.find((cycle) => !cycle.selectable);
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
  const selected = state.packages.filter((item) => item.selected);
  const unassigned = selected.filter((item) => !item.stream_id);
  const deferred = state.packages.filter((item) => !item.selected);
  const totalAllocation = state.streams.reduce((sum, item) => sum + item.allocation, 0);
  const shownCycles = Math.min(state.capacity.horizon, futureCycles.length, 12);
  return <section className="panel sequencing-board" id="sequencing-board">
    <div className="section-head"><div><h2>Sequencing board</h2><p>Five focus streams share one team’s cycle capacity. Dates are cycle-end forecasts.</p></div><span className="tag">Slice 2</span></div>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="board-summary"><div><strong>{fmt(result.selectedKnown)} pts</strong><small>selected known + allowances</small></div><div><strong>{result.selectedUnknown}</strong><small>uncovered issues</small></div><div><strong>{Math.round(totalAllocation * 100)}%</strong><small>allocated · {Math.round(result.unallocated * 100)}% headroom</small></div><div><strong>{result.ready ? `${result.cycles.length} cycles` : "Setup needed"}</strong><small>forecast horizon used</small></div></div>
    {result.setup.map((message) => <p className="warning" key={message}>{message}</p>)}{result.errors.map((message) => <p className="error" key={message}>{message}</p>)}
    <section className="board-settings" aria-label="Linear cycle calendar"><div className="section-head"><h3>Linear cycle calendar</h3><button type="button" className="secondary" disabled={busy || !state.connection} onClick={() => void refreshCycles()}>Refresh Linear cycles</button></div>
      <p>{state.connection?.team_name || "Connected team"} · {state.connection?.cycles_enabled ? `${state.connection.cycle_duration ?? "?"} week cycle${state.connection.cycle_duration === 1 ? "" : "s"}` : "Cycles are not enabled in Linear"} · {currentCycle ? `currently Cycle ${currentCycle.number} · ` : ""}{futureCycles.length} upcoming imported{state.connection?.upcoming_cycle_count ? ` (Linear configured for ${state.connection.upcoming_cycle_count})` : ""}</p>
      {!!calendarCycles.length ? <CycleCalendar cycles={calendarCycles} timezone={state.timezone} sourceAt={result.sourceAt} selectedIds={adjustment.selectedCycleIds} onToggle={(id) => setAdjustment((old) => ({ ...old, selectedCycleIds: old.selectedCycleIds.includes(id) ? old.selectedCycleIds.filter((value) => value !== id) : [...old.selectedCycleIds, id] }))} /> : <p className="warning">No current or upcoming cycles were imported. Configure cycles for this team in Linear and import again.</p>}
      <div className="board-subform"><h3>Cycle exception</h3><p>Select a date above to choose its Linear cycle. Select more than one cycle to apply the same availability and reserve to each.</p>
        <div className="calendar-selection">{adjustment.selectedCycleIds.map((id) => <span key={id}>Cycle {state.linearCycles.find((cycle) => cycle.id === id)?.number ?? "?"}</span>)}{!adjustment.selectedCycleIds.length && <span>No cycles selected</span>}</div>
        <div className="board-fields"><label>Availability %<input type="number" min="0" max="100" value={adjustment.availability} onChange={(event) => setAdjustment({ ...adjustment, availability: event.target.value })} /></label><label>Reserve override<input type="number" min="0" step="0.001" value={adjustment.reserve} onChange={(event) => setAdjustment({ ...adjustment, reserve: event.target.value })} placeholder="Base reserve" /></label></div>
        <div className="actions"><button type="button" className="secondary" disabled={busy || !adjustment.selectedCycleIds.length} onClick={() => void save({ type: "adjustment", cycleIds: adjustment.selectedCycleIds, availability: Number(adjustment.availability) / 100, reserve: adjustment.reserve === "" ? null : Number(adjustment.reserve) }, "Cycle exception saved.")}>Apply to selected cycles</button><button type="button" className="quiet" disabled={busy || !adjustment.selectedCycleIds.length} onClick={() => void save({ type: "adjustment", action: "clear", cycleIds: adjustment.selectedCycleIds }, "Cycle exceptions cleared.")}>Clear selected exceptions</button></div>
        {state.adjustments.filter((item) => state.futureCycleIds.includes(item.linear_cycle_id)).map((item) => <p className="meta" key={item.linear_cycle_id}>Cycle {item.number} · {new Date(item.starts_at).toLocaleDateString("en-US", { timeZone: state.timezone })}: {Math.round(item.availability * 100)}% availability · reserve {item.reserve ?? "base"}</p>)}
        {!!state.adjustments.filter((item) => !state.futureCycleIds.includes(item.linear_cycle_id)).length && <p className="warning">Some saved exceptions refer to cycles no longer upcoming in Linear. They remain saved but are excluded from the forecast.</p>}
        {!!state.legacyAdjustments.length && <p className="warning">{state.legacyAdjustments.length} old relative-cycle exception{state.legacyAdjustments.length === 1 ? "" : "s"} could not be matched to a Linear cycle. Select the intended weeks above to reapply them.</p>}
      </div>
    </section>
    <details className="board-settings"><summary>Capacity assumptions</summary><form onSubmit={(event: FormEvent) => { event.preventDefault(); void save({ type: "capacity", baseline: capacity.baseline === "" ? null : Number(capacity.baseline), reserve: Number(capacity.reserve), horizon: capacity.horizon, reason: capacity.reason }, "Capacity profile saved."); }}>
      <p>Cycle dates and numbers come from Linear. Leave the baseline blank to use the median of at least three comparable completed cycles.</p>
      <p className="meta">{state.observedBaseline === null ? `${state.observations.length} comparable completed cycles; a provisional manual baseline is required.` : `Observed median: ${fmt(state.observedBaseline)} points/cycle from ${state.observations.length} cycles.`} Effective baseline: {state.effectiveBaseline === null ? "unset" : `${fmt(state.effectiveBaseline)} points/cycle`}{state.capacity.baseline !== null ? " · manual override" : " · Linear observations"}</p>
      {state.observations.map((item) => <p className="meta" key={item.linear_id}>{item.starts_at.slice(0, 10)} – {item.ends_at.slice(0, 10)}: {fmt(item.completed_points)} completed points</p>)}
      <div className="board-fields"><label>Manual baseline (optional)<input type="number" min="0" step="0.001" value={capacity.baseline} onChange={(event) => setCapacity({ ...capacity, baseline: event.target.value })} placeholder={state.observedBaseline === null ? "Required" : `Median ${fmt(state.observedBaseline)}`} /></label><label>Reserve points/cycle<input type="number" min="0" step="0.001" required value={capacity.reserve} onChange={(event) => setCapacity({ ...capacity, reserve: event.target.value })} /></label><label>Forecast horizon (Linear cycles)<input type="number" min="1" max="104" required value={capacity.horizon} onChange={(event) => setCapacity({ ...capacity, horizon: Number(event.target.value) })} /></label></div>
      <label>Manual baseline source / override reason<input value={capacity.reason} onChange={(event) => setCapacity({ ...capacity, reason: event.target.value })} placeholder="Required when entering a manual baseline" /></label><button disabled={busy}>Save capacity</button></form>
      {futureCycles.length < state.capacity.horizon && <p className="warning">Linear currently has {futureCycles.length} upcoming cycles. The forecast stops at Cycle {futureCycles.at(-1)?.number ?? "?"}; increase upcoming cycles in Linear to extend it.</p>}
    </details>
    <div className="outcome-forecast"><h3>Outcome delivery</h3>{state.outcomes.map((outcome) => { const projected = outcomeForecast.get(outcome.id) as OutcomeForecast | undefined; return <div className="outcome-forecast-row" key={outcome.id}><div><strong>{outcome.title}</strong><small>Target {outcome.needed_by || "not set"} · {projected?.requiredIds.length || 0} required including blockers</small></div><div><span className={`forecast-pill ${projected?.target || "unknown"}`}>{projected?.status.replace("_", " ") || "unknown"}{projected?.endDate ? ` · ${projected.endDate}` : ""}</span><small>{projected?.target === "missed" ? `${projected.gapCycles} cycle gap` : projected?.target === "met" ? "Target met" : projected?.target === "unknown" ? "Target unknown" : ""}</small></div>{!!projected?.reasons.length && <p>{projected.reasons.join(" ")}</p>}</div>; })}{!state.outcomes.length && <p className="empty">Add an outcome and mark its minimum-required projects below.</p>}</div>
    <div className="stream-list">{state.streams.map((stream) => { const plan = streamDrafts[stream.id] || { allocation: (stream.allocation * 100).toString(), wip: stream.wip_limit }; const members = selected.filter((item) => item.stream_id === stream.id); return <div className="stream-lane" key={stream.id}><div className="stream-heading"><div><h3>{stream.name}</h3><p>{members.length} selected · {Math.round(stream.allocation * 100)}% capacity · WIP {stream.wip_limit}</p></div><div className="stream-controls"><label>Allocation %<input type="number" min="0" max="100" step="0.1" value={plan.allocation} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, allocation: event.target.value } }))} /></label><label>WIP<input type="number" min="1" max="50" value={plan.wip} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, wip: Number(event.target.value) } }))} /></label><button className="secondary" disabled={busy} onClick={() => void save({ type: "stream", id: stream.id, allocation: Number(plan.allocation) / 100, wip: plan.wip }, `${stream.name} updated.`)}>Apply</button></div></div>
      {result.ready && members.length > 0 && <div className="timeline-scroll"><div className="lane-timeline" style={{ gridTemplateColumns: `160px repeat(${shownCycles}, minmax(58px, 1fr))` }}><div className="timeline-label">Package</div>{Array.from({ length: shownCycles }, (_, index) => <div className="timeline-tick" key={index}>#{futureCycles[index].number}<small>{result.cycles[index]?.end?.slice(5) || ""}</small></div>)}{members.map((item, index) => { const projected = packageForecast.get(item.id); const start = projected?.start; const finish = projected?.finish; return <div className="timeline-row" key={item.id} style={{ gridColumn: `1 / ${shownCycles + 2}`, gridRow: index + 2, gridTemplateColumns: `160px repeat(${shownCycles}, minmax(58px, 1fr))` }}><span className="timeline-name" title={item.name}>{item.name}</span>{start !== null && start !== undefined && finish !== null && finish !== undefined && start <= shownCycles ? <span className="timeline-bar" style={{ gridColumn: `${start + 1} / ${Math.min(finish, shownCycles) + 2}` }} title={`${cycleText(start)}–${cycleText(finish)} · ${item.name}`}>{start === finish ? `#${futureCycles[finish - 1]?.number}` : `#${futureCycles[start - 1]?.number}–#${futureCycles[finish - 1]?.number}`}</span> : <span className="timeline-undated" style={{ gridColumn: `2 / ${shownCycles + 2}` }}>{finish === 0 ? "Complete before next cycle" : start && start > shownCycles ? `Starts ${cycleText(start)}; beyond visible timeline` : projected?.reason || "No cycle date"}</span>}</div>; })}</div>{state.capacity.horizon > shownCycles && <p className="meta">Showing first {shownCycles} imported cycles; see the cycle table for later work.</p>}</div>}
      <div className="board-cards">{members.map(card)}{!members.length && <p className="empty">No selected work in this stream.</p>}</div></div>; })}</div>
    <div className="board-shelves"><div className="stream-lane"><h3>Needs assignment <span className="count">{unassigned.length}</span></h3><p>Selected demand stays visible; a required outcome has no credible date until assigned.</p><div className="board-cards">{unassigned.map(card)}{!unassigned.length && <p className="empty">No selected work waiting for a stream.</p>}</div></div><div className="stream-lane deferred"><h3>Deferred <span className="count">{deferred.length}</span></h3><p>Paused work consumes no future capacity. In-progress work must also be paused in Linear separately.</p><div className="board-cards">{deferred.map(card)}{!deferred.length && <p className="empty">No deferred work.</p>}</div></div></div>
    <details className="board-settings"><summary>Dependencies</summary><p>“Blocked by” means the predecessor must finish in a previous cycle. Local links stay in Oh, WAWD!.</p><div className="board-fields"><label>Blocking package<select value={dependency.predecessorId} onChange={(event) => setDependency({ ...dependency, predecessorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Blocked package<select value={dependency.successorId} onChange={(event) => setDependency({ ...dependency, successorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><button disabled={busy || !dependency.predecessorId || !dependency.successorId} onClick={() => void save({ type: "dependency", action: "add", ...dependency }, "Dependency saved.")}>Add dependency</button><ul className="dependency-list">{state.dependencies.map((edge) => <li key={`${edge.source}:${edge.predecessor_id}:${edge.successor_id}`}><span>{state.packages.find((item) => item.id === edge.predecessor_id)?.name || edge.predecessor_id} → {state.packages.find((item) => item.id === edge.successor_id)?.name || edge.successor_id} · {edge.source}{edge.waived ? ` · waived: ${edge.waiver_reason}` : ""}</span>{edge.source === "local" && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "remove", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Dependency removed.")}>Remove</button>}{edge.source === "linear" && !edge.waived && <button className="text-button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for waiving this Linear dependency in the forecast?"); if (reason) void save({ type: "dependency", action: "waive", predecessorId: edge.predecessor_id, successorId: edge.successor_id, reason }, "Linear dependency waived in this plan."); }}>Waive</button>}{edge.source === "linear" && edge.waived && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "restore", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Linear dependency restored.")}>Restore</button>}</li>)}</ul></details>
    <details className="board-settings"><summary>Cycle-by-cycle explanation</summary><p>Source as of {new Date(result.sourceAt).toLocaleString()} · dates in {state.timezone}. Unused stream budget does not move to another stream.</p><div className="cycle-table-wrap"><table className="cycle-table"><thead><tr><th>Linear cycle</th><th>Team available</th>{state.streams.map((item) => <th key={item.id}>{item.name}</th>)}</tr></thead><tbody>{result.cycles.map((cycle) => <tr key={cycle.id}><th>Cycle {cycle.number}<small>{cycle.start} – {cycle.end}</small></th><td>{fmt(cycle.available)} pts</td>{state.streams.map((stream) => { const usage = cycle.streams.find((item) => item.id === stream.id); return <td key={stream.id}>{fmt(usage?.used || 0)} / {fmt(usage?.budget || 0)} pts<small>{usage?.active.map((id) => state.packages.find((item) => item.id === id)?.name || id).join(", ") || "Idle"}</small></td>; })}</tr>)}</tbody></table></div></details>
  </section>;
}
