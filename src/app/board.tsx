"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type DragEvent } from "react";
import type { ForecastResult, PackageForecast, OutcomeForecast } from "@/lib/forecast";
import { linearCycleLabel } from "@/lib/cycles";
import CycleCalendar, { type CalendarCycle } from "./cycle-calendar";
import StreamManager from "./stream-manager";
import { readApiResponse } from "./client-api";
import ProjectPlanCard, { type BoardProject as Package } from "./project-plan-card";
import { placementError, type QueueState, type Placement, type OrderConflict } from "@/lib/sequencing";
import { teamLocalDate, millisecondsUntilNextTeamDate, type ExtraScope, type ScopeReadiness } from "@/lib/project-scope";
import { type WeeklyAvailability, type PlanningWeek } from "@/lib/planning-calendar";
import StreamTimeline from "./stream-timeline";
import CalendarAvailability from "./calendar-availability";

type Stream = { id: string; name: string; allocation: number; wip_limit: number };
type LinearCycle = { id: string; number: number; name: string | null; startsAt: string; endsAt: string };
type BoardOutcome = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null };
type BoardState = {
  connection: { team_name: string; cycles_enabled: boolean; cycle_duration: number | null; cycle_start_day: number | null; cycle_cooldown_time: number | null; upcoming_cycle_count: number | null } | null;
  packages: Package[]; streams: Stream[]; links: { outcome_id: string; project_id: string; requirement: "minimum" | "optional" }[];
  capacity: { baseline: number | null; baseline_reason: string; reserve: number; horizon: number; scoping_lead_days: number; holidays_enabled: boolean };
  observations: { linear_id: string; starts_at: string; ends_at: string; completed_points: number }[]; observedBaseline: number | null; effectiveBaseline: number | null;
  linearCycles: LinearCycle[]; currentCycleId: string | null; cycleAnchorAt: string; futureCycleIds: string[];
  adjustments: { linear_cycle_id: string; number: number; name: string | null; starts_at: string; ends_at: string; availability: number; reserve: number | null }[];
  legacyAdjustments: { cycle_number: number }[]; dependencies: { predecessor_id: string; successor_id: string; source: "local" | "linear"; waived: boolean; waiver_reason: string }[];
  issues: { linear_id: string; project_id: string; identifier: string; estimate: number | null; state_type: string }[];
  outcomes: BoardOutcome[]; timezone: string; forecast: ForecastResult; sequencing: QueueState; sequenceToken: string; sequenceConflicts: OrderConflict[];
  extraScopes: ExtraScope[]; scoping: ScopeReadiness[]; evaluatedAt: string;
  weeklyAdjustments: WeeklyAvailability[]; holidayWeeks: WeeklyAvailability[];
};
const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function Board({ refreshKey, onChanged, onAddOutcome, onManageOutcome, onOpenProjects }: { refreshKey: number; onChanged?: () => void; onAddOutcome?: () => void; onManageOutcome?: (id: string) => void; onOpenProjects?: () => void }) {
  const [state, setState] = useState<BoardState | null>(null);
  const [capacity, setCapacity] = useState({ baseline: "", reserve: "0", horizon: 26, reason: "" });
  const [streamDrafts, setStreamDrafts] = useState<Record<string, { name: string; allocation: string; wip: number }>>({});
  const [adjustment, setAdjustment] = useState({ selectedCycleIds: [] as string[], availability: "100", reserve: "" });
  const [dependency, setDependency] = useState({ predecessorId: "", successorId: "" });
  const [leadDays, setLeadDays] = useState(14);
  const [dragging, setDragging] = useState<string | null>(null);
  const [editingWeek, setEditingWeek] = useState<PlanningWeek | null>(null);
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
      setLeadDays(data.capacity.scoping_lead_days ?? 14);
      setAdjustment((old) => ({ ...old, selectedCycleIds: [] }));
      setCapacity({ baseline: data.capacity.baseline?.toString() || "", reserve: data.capacity.reserve.toString(), horizon: data.capacity.horizon, reason: data.capacity.baseline_reason });
      setStreamDrafts(Object.fromEntries(data.streams.map((item: Stream) => [item.id, { name: item.name, allocation: (item.allocation * 100).toString(), wip: item.wip_limit }])));
    } catch (failure) {
      if (generation === loadGeneration.current) throw failure;
    }
  }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load, refreshKey]);
  useEffect(() => {
    if (!state?.timezone) return;
    let cancelled = false;
    const timezone = state.timezone;
    const refreshReadiness = async () => {
      const generation = loadGeneration.current;
      try {
        const response = await fetch("/api/board", { cache: "no-store" });
        const data = await readApiResponse<BoardState>(response, "Could not refresh scope readiness");
        if (!cancelled && generation === loadGeneration.current) setState(data);
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : "Could not refresh scope readiness"); }
    };
    const timer = window.setTimeout(() => void refreshReadiness(), millisecondsUntilNextTeamDate(new Date(), timezone) + 50);
    const onVisible = () => { if (document.visibilityState === "visible" && teamLocalDate(new Date(), timezone) !== teamLocalDate(state.evaluatedAt, timezone)) void refreshReadiness(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [state?.timezone, state?.evaluatedAt]);
  async function save(change: Record<string, unknown>, message: string): Promise<boolean> {
    ++loadGeneration.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/board", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...change, sequenceToken: state?.sequenceToken }) });
      const data = await readApiResponse<BoardState>(response, "Could not save board");
      setState(data); setNotice(message); onChanged?.();
      return true;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not save board";
      // Reload saved order after a rejected drop, preserving the failure explanation.
      try { const response = await fetch("/api/board", { cache: "no-store" }); setState(await readApiResponse<BoardState>(response, "Could not refresh board")); } catch { /* Keep the last saved state if offline. */ }
      setError(message); return false;
    }
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
  async function moveProject(placement: Placement, reason?: string) {
    const item = state?.packages.find((candidate) => candidate.id === placement.packageId);
    if (!item) return;
    const destination = !placement.selected ? "Deferred" : placement.streamId ? state!.streams.find((stream) => stream.id === placement.streamId)?.name ?? "stream" : "Needs assignment";
    const saved = await save({ type: "package", id: placement.packageId, streamId: placement.streamId, selected: placement.selected,
      ...(reason !== undefined ? { reason } : {}), ...(placement.beforeId !== undefined ? { beforeId: placement.beforeId } : {}) }, `${item.name} moved to ${destination}${placement.beforeId ? ` before ${state?.packages.find((candidate) => candidate.id === placement.beforeId)?.name ?? "project"}` : placement.beforeId === null ? " at end of stream" : ""}.`);
    window.requestAnimationFrame(() => {
      if (saved) {
        const shelf = document.getElementById(!placement.selected ? "deferred-work" : !placement.streamId ? "unassigned-work" : "");
        if (shelf instanceof HTMLDetailsElement) shelf.open = true;
      }
      const card = document.getElementById(`board-package-${item.id}`);
      card?.querySelector<HTMLElement>(".drag-handle")?.focus();
      if (saved) card?.scrollIntoView({ block: "nearest" });
    });
  }
  function startDrag(event: DragEvent, id: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDragging(id);
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
  const calendarCycles: CalendarCycle[] = state.linearCycles.filter((cycle) => state.futureCycleIds.includes(cycle.id) ||
    cycle.id === state.currentCycleId)
    .map((cycle) => ({ ...cycle, selectable: state.futureCycleIds.includes(cycle.id), adjusted: state.adjustments.some((item) => item.linear_cycle_id === cycle.id) }));
  const currentCycle = state.linearCycles.find((cycle) => cycle.id === state.currentCycleId);
  const packageForecast = new Map(result.packages.map((item) => [item.id, item]));
  const outcomeForecast = new Map(result.outcomes.map((item) => [item.id, item]));
  const openPanel = (id: string) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    const details = panel instanceof HTMLDetailsElement ? panel : panel.nextElementSibling instanceof HTMLDetailsElement ? panel.nextElementSibling : null;
    if (details) details.open = true;
    (details || panel).scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => (details || panel).querySelector<HTMLElement>("summary, button, input, select")?.focus(), 350);
  };
  const revealPackage = (item: Package, scope = false) => {
    const parentId = !item.selected ? "deferred-work" : item.stream_id ? `stream-work-${item.stream_id}` : "unassigned-work";
    const parent = document.getElementById(parentId);
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    window.setTimeout(() => {
      const project = document.getElementById(`board-package-${item.id}`);
      const controls = project?.querySelector("details");
      if (controls instanceof HTMLDetailsElement) controls.open = true;
      project?.scrollIntoView({ behavior: "smooth", block: "center" });
      project?.querySelector<HTMLElement>(scope ? ".extra-scope-editor input" : "summary, button, input, select")?.focus();
    });
  };
  const packageResolution = (item: Package, projection?: PackageForecast) => {
    const reason = projection?.reason || "";
    if (!item.in_scope || item.needs_review || item.cross_team || /source scope|outside the imported team/i.test(reason)) return { label: "Review in Linear projects", run: () => onOpenProjects?.() };
    if (!item.selected) return { label: "Review deferred plan", run: () => revealPackage(item) };
    if (!item.stream_id || /assignment/i.test(reason)) return { label: "Assign to a stream", run: () => openPanel("unassigned-work") };
    if (/cycle|calendar/i.test(reason)) return { label: "Review cycle calendar", run: () => openPanel("cycle-calendar-settings") };
    if (/sequence|precede/i.test(reason)) return { label: "Review stream order", run: () => revealPackage(item) };
    if (/Waiting for|dependency/i.test(reason)) return { label: "Review dependencies", run: () => openPanel("dependency-settings") };
    if (/estimate|allowance|scope/i.test(reason)) return { label: "Review extra scope", run: () => revealPackage(item, true) };
    return { label: "Review capacity and WIP", run: () => openPanel("capacity-settings") };
  };
  const card = (item: Package) => {
    const projection = packageForecast.get(item.id) as PackageForecast | undefined;
    const unknown = state.issues.filter((issue) => issue.project_id === item.project_id && issue.estimate === null && !["completed", "canceled"].includes(issue.state_type));
    return <ProjectPlanCard key={item.id} item={item} streams={state.streams} sequencing={state.sequencing} projection={projection}
      extra={state.extraScopes.find((entry) => entry.package_id === item.id)} readiness={state.scoping.find((entry) => entry.packageId === item.id)}
      unknown={unknown.map((issue) => issue.identifier)} busy={busy} cycleText={cycleText} resolution={packageResolution(item, projection)}
      onOpenProjects={onOpenProjects} onSave={save} onMove={moveProject} onDragStart={startDrag} onDragEnd={() => setDragging(null)} />;
  };
  const dropTarget = (streamId: string | null, selected: boolean, beforeId: string | null, label: string) => {
    const problem = dragging ? placementError(state.sequencing, { packageId: dragging, streamId, selected, ...(streamId ? { beforeId } : {}) }) : null;
    return <div className={`project-drop-target${dragging ? " drag-active" : ""}${problem ? " invalid" : ""}`}
      data-drop-stream={streamId ?? (selected ? "unassigned" : "deferred")} data-before={beforeId ?? ""} aria-hidden={!dragging} title={problem || label}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = problem || busy ? "none" : "move"; }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); setDragging(null);
        if (!busy && state.packages.some((item) => item.id === id)) void moveProject({ packageId: id, streamId, selected, ...(streamId ? { beforeId } : {}) });
      }}>{problem || label}</div>;
  };
  const queue = (items: Package[], streamId: string | null, selected: boolean) => {
    const ordered = [...items].sort(streamId ? (a, b) => (a.sequence_position ?? Infinity) - (b.sequence_position ?? Infinity) || a.id.localeCompare(b.id) : (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return <ol className={`project-queue${streamId ? "" : " shelf-projects"}`} aria-label={streamId ? `${state.streams.find((item) => item.id === streamId)?.name} project sequence` : selected ? "Needs assignment projects" : "Deferred projects"}>
      {ordered.map((item) => <li key={item.id}>{streamId && dropTarget(streamId, selected, item.id, `Drop before ${item.name}`)}{card(item)}</li>)}
      <li>{dropTarget(streamId, selected, null, streamId ? "Drop at end of stream" : selected ? "Drop into Needs assignment" : "Drop into Deferred")}</li>
    </ol>;
  };
  const planningPackages = state.packages.filter((item) => item.in_scope);
  const selected = planningPackages.filter((item) => item.selected);
  const unassigned = selected.filter((item) => !item.stream_id);
  const deferred = planningPackages.filter((item) => !item.selected);
  const totalAllocation = state.streams.reduce((sum, item) => sum + item.allocation, 0);
  const blockedOutcomes = result.outcomes.filter((outcome) => ["blocked", "setup_required", "beyond_horizon"].includes(outcome.status));
  const scopeAttention = state.scoping.filter((entry) => (entry.status === "needs_scoping" || !!entry.review) && selected.some((item) => item.id === entry.packageId));
  const setupAction = (message: string) => /baseline/i.test(message) ? { label: "Set capacity baseline", target: "capacity-settings" } : /cycle/i.test(message) ? { label: "Review Linear cycles", target: "cycle-calendar-settings" } : { label: "Review stream allocation", target: `stream-settings-${state.streams[0]?.id || ""}` };
  return <section className="panel sequencing-board" id="sequencing-board">
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="board-summary"><div><strong>{fmt(result.selectedKnown)} pts</strong><small>selected estimates + extra scope</small></div><div><strong>{result.selectedUnknown}</strong><small>uncovered issues</small></div><div><strong>{Math.round(totalAllocation * 100)}%</strong><small>allocated · {Math.round(result.unallocated * 100)}% headroom</small></div><div><strong>{result.ready ? `${result.cycles.length} cycles` : "Setup needed"}</strong><small>forecast horizon used</small></div></div>
    <p className="queue-instructions" id="queue-instructions">Drag projects into stream order, or use the arrow buttons and Location / Place before controls. Alt + ↑ / ↓ reorders a focused drag handle. Dependencies still apply; WIP can allow overlapping work.</p>
    {state.packages.some((item) => !item.in_scope && item.selected) && <div className="blocker-line"><p className="meta">Hidden selected packages remain included in forecast totals.</p><button className="text-button" onClick={onOpenProjects}>Review hidden projects</button></div>}
    <section className={`action-center${result.ready && !unassigned.length && !blockedOutcomes.length && !scopeAttention.length && !state.sequenceConflicts.length ? " ready" : ""}`} aria-labelledby="next-actions-title"><div className="compact-section-head"><div><p className="eyebrow">Planning attention</p><h3 id="next-actions-title">{unassigned.length ? `Assign ${unassigned.length} selected project${unassigned.length === 1 ? "" : "s"}` : result.setup.length || result.errors.length ? "Finish forecast setup" : state.sequenceConflicts.length ? "Resolve stream order" : blockedOutcomes.length ? `Resolve ${blockedOutcomes.length} blocked outcome${blockedOutcomes.length === 1 ? "" : "s"}` : scopeAttention.length ? "Review upcoming project scope" : "Plan is ready to review"}</h3></div><span>{result.setup.length + result.errors.length + unassigned.length + blockedOutcomes.length + scopeAttention.length + state.sequenceConflicts.length} open</span></div>
      <div className="action-list">
        {!!unassigned.length && <button className="action-item" onClick={() => openPanel("unassigned-work")}><span><strong>Needs assignment</strong><small>Selected work cannot receive a credible date until it has a stream.</small></span><b>{unassigned.length} waiting</b></button>}
        {result.setup.map((message) => { const action = setupAction(message); return <button className="action-item" key={message} onClick={() => openPanel(action.target)}><span><strong>{message}</strong><small>{action.label}</small></span><b>Configure</b></button>; })}
        {result.errors.map((message) => <button className="action-item error-action" key={message} onClick={() => openPanel("dependency-settings")}><span><strong>{message}</strong><small>Review dependency constraints.</small></span><b>Resolve</b></button>)}
        {state.sequenceConflicts.map((conflict) => <button className="action-item error-action" key={conflict.key} onClick={() => document.getElementById(`stream-${conflict.streamId}`)?.scrollIntoView({ block: "center", behavior: "smooth" })}><span><strong>Resolve stream order</strong><small>{conflict.message}</small></span><b>Reorder</b></button>)}
        {scopeAttention.map((entry) => { const item = state.packages.find((candidate) => candidate.id === entry.packageId)!;
          return <button className="action-item scope-action" key={`scope:${entry.packageId}`} onClick={() => revealPackage(item, true)}><span><strong>{entry.status === "needs_scoping" ? "Needs scoping" : "Review extra scope"} · {item.name}</strong><small>{entry.review || (entry.dueDate ? `Scope due ${entry.dueDate}. Provisional forecast remains available.` : "Work is already in progress.")}</small></span><b>Review scope</b></button>;
        })}
        {!result.setup.length && !result.errors.length && !unassigned.length && !!blockedOutcomes.length && <button className="action-item" onClick={() => openPanel("outcome-delivery")}><span><strong>Forecast blockers remain</strong><small>Review affected outcomes and open the package that needs attention.</small></span><b>{blockedOutcomes.length} outcomes</b></button>}
        {result.ready && !unassigned.length && !blockedOutcomes.length && !scopeAttention.length && !state.sequenceConflicts.length && <p className="action-ready">No setup or assignment blockers. Review outcome targets, then save a decision scenario.</p>}
      </div>
    </section>
    <div className="board-shelves priority-shelf"><div>{dropTarget(null, true, null, "Drop into Needs assignment")}
      <details id="unassigned-work" className="stream-lane lane-packages" open={unassigned.length > 0}><summary>Needs assignment <span className="count">{unassigned.length}</span></summary><p>Selected demand stays visible; a required outcome has no credible date until assigned.</p>{queue(unassigned, null, true)}{!unassigned.length && <p className="empty">No selected work waiting for a stream.</p>}</details></div></div>
    <div className="outcome-forecast" id="outcome-delivery">
      <div className="compact-section-head"><h3>Outcome delivery</h3><button className="text-button" onClick={onAddOutcome}>Add outcome</button></div>
      {state.outcomes.map((outcome) => {
        const projected = outcomeForecast.get(outcome.id) as OutcomeForecast | undefined;
        const blockedPackage = projected?.requiredIds.map((id) => state.packages.find((item) => item.id === id)).find((item) => item && packageForecast.get(item.id)?.reason);
        return <div className="outcome-forecast-row" key={outcome.id}>
          <div><strong>{outcome.title}</strong><small>{outcome.owner || "No owner"} · Target {outcome.needed_by || "not set"} · {projected?.requiredIds.length || 0} required including blockers</small></div>
          <div className="outcome-status">
            <span className={`forecast-pill status-${projected?.status || "unknown"}`}>{projected?.status.replace("_", " ") || "unknown"}{projected?.endDate ? ` · ${projected.endDate}` : ""}</span>
            <span className={`target-status ${projected?.target || "unknown"}`}>{projected?.target === "missed" ? `Target missed · ${projected.gapCycles} cycle gap` : projected?.target === "met" ? "Target met" : projected?.target === "unknown" ? `Cannot assess target · ${projected.status === "blocked" ? "blocked work" : "forecast setup incomplete"}` : "No target set"}</span>
          </div>
          <div className="row-actions"><button className="text-button" disabled={busy} onClick={() => setOutcomeDraft({ ...outcome })}>Edit</button><button className="text-button" disabled={busy} onClick={() => onManageOutcome?.(outcome.id)}>Links</button><button className="text-button danger-text" disabled={busy} onClick={() => void deleteOutcome(outcome)}>Delete</button></div>
          {!!projected?.reasons.length && <div className="outcome-blocker"><p>{projected.reasons.join(" ")}</p>{blockedPackage && <button className="text-button" onClick={() => packageResolution(blockedPackage, packageForecast.get(blockedPackage.id)).run()}>Resolve blocker</button>}</div>}
          {outcomeDraft?.id === outcome.id && <form className="inline-outcome-editor" onSubmit={updateOutcome}><label>Title<input value={outcomeDraft.title} maxLength={200} required onChange={(event) => setOutcomeDraft({ ...outcomeDraft, title: event.target.value })} /></label><label>Owner<input value={outcomeDraft.owner} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, owner: event.target.value })} /></label><label>Needed by<input type="date" value={outcomeDraft.needed_by?.slice(0, 10) || ""} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, needed_by: event.target.value || null })} /></label><label>Success signal<input value={outcomeDraft.success_signal} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, success_signal: event.target.value })} /></label><label className="wide-field">Notes<textarea rows={2} value={outcomeDraft.description} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, description: event.target.value })} /></label><div className="actions wide-field"><button disabled={busy}>Save</button><button type="button" className="quiet" disabled={busy} onClick={() => setOutcomeDraft(null)}>Cancel</button></div></form>}
        </div>;
      })}
      {!state.outcomes.length && <p className="empty">Add an outcome, then link its minimum-required projects.</p>}
    </div>
    <div className="board-config-row"><details id="cycle-calendar-settings" className="board-settings" aria-label="Linear cycle calendar"><summary>Cycle calendar and exceptions <span>{futureCycles.length} upcoming</span></summary><div className="section-head"><h3>Linear cycle calendar</h3><button type="button" className="secondary" disabled={busy || !state.connection} onClick={() => void refreshCycles()}>Refresh Linear cycles</button></div>
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
    <details id="capacity-settings" className="board-settings"><summary>Capacity assumptions</summary><form onSubmit={(event: FormEvent) => { event.preventDefault(); void save({ type: "capacity", baseline: capacity.baseline === "" ? null : Number(capacity.baseline), reserve: Number(capacity.reserve), horizon: capacity.horizon, reason: capacity.reason }, "Capacity profile saved."); }}>
      <p>Cycle dates and numbers come from Linear. Leave the baseline blank to use the median of at least three comparable completed cycles.</p>
      <p className="meta">{state.observedBaseline === null ? `${state.observations.length} comparable completed cycles; a provisional manual baseline is required.` : `Observed median: ${fmt(state.observedBaseline)} points/cycle from ${state.observations.length} cycles.`} Effective baseline: {state.effectiveBaseline === null ? "unset" : `${fmt(state.effectiveBaseline)} points/cycle`}{state.capacity.baseline !== null ? " · manual override" : " · Linear observations"}</p>
      {state.observations.map((item) => <p className="meta" key={item.linear_id}>{item.starts_at.slice(0, 10)} – {item.ends_at.slice(0, 10)}: {fmt(item.completed_points)} completed points</p>)}
      <div className="board-fields"><label>Manual baseline (optional)<input type="number" min="0" step="0.001" value={capacity.baseline} onChange={(event) => setCapacity({ ...capacity, baseline: event.target.value })} placeholder={state.observedBaseline === null ? "Required" : `Median ${fmt(state.observedBaseline)}`} /></label><label>Reserve points/cycle<input type="number" min="0" step="0.001" required value={capacity.reserve} onChange={(event) => setCapacity({ ...capacity, reserve: event.target.value })} /></label><label>Forecast horizon (Linear cycles)<input type="number" min="1" max="104" required value={capacity.horizon} onChange={(event) => setCapacity({ ...capacity, horizon: Number(event.target.value) })} /></label></div>
      <label>Manual baseline source / override reason<input value={capacity.reason} onChange={(event) => setCapacity({ ...capacity, reason: event.target.value })} placeholder="Required when entering a manual baseline" /></label><button disabled={busy}>Save capacity</button></form>
      {futureCycles.length < state.capacity.horizon && <p className="warning">Linear currently has {futureCycles.length} upcoming cycles. The forecast stops at {futureCycles.length ? linearCycleLabel(futureCycles.at(-1)!) : "the current cycle"}; increase upcoming cycles in Linear to extend it.</p>}
    </details></div>
    <details className="board-settings" id="scoping-settings"><summary>Scope readiness</summary><form className="scope-window" onSubmit={(event) => { event.preventDefault(); void save({ type: "scoping", leadDays }, "Scoping window saved."); }}>
      <label>Scope projects (days before start)<input type="number" min="0" max="365" step="1" required value={leadDays} onChange={(event) => setLeadDays(Number(event.target.value))} /></label>
      <button className="secondary" disabled={busy}>Save scoping window</button>
    </form><p>Default: 14 calendar days before forecast start. Needs scoping is a reminder; provisional forecasts remain available.</p></details>
    <CalendarAvailability enabled={state.capacity.holidays_enabled ?? true} overrides={state.weeklyAdjustments ?? []} holidays={state.holidayWeeks ?? []}
      selectedWeek={editingWeek} busy={busy} onSave={save} />
    <StreamManager refreshKey={refreshKey} onChanged={() => { void load(); onChanged?.(); }} />
    <div className="stream-list">{state.streams.map((stream) => {
      const plan = streamDrafts[stream.id] || { name: stream.name, allocation: (stream.allocation * 100).toString(), wip: stream.wip_limit };
      const members = selected.filter((item) => item.stream_id === stream.id).sort((a, b) => (a.sequence_position ?? Infinity) - (b.sequence_position ?? Infinity) || a.id.localeCompare(b.id));
      const search = assignmentSearches[stream.id]?.trim().toLocaleLowerCase() || "";
      const matchingPackages = planningPackages.filter((item) => !search || item.name.toLocaleLowerCase().includes(search));
      const locationFor = (item: Package) => !item.selected ? "Deferred" : item.stream_id ? state.streams.find((candidate) => candidate.id === item.stream_id)?.name || "Another stream" : "Needs assignment";
      return <div className="stream-lane" id={`stream-${stream.id}`} key={stream.id}><div className="stream-heading"><div className="stream-title">
        {renamingStreamId === stream.id ? <div className="stream-title-editor"><label>Stream name<input autoFocus maxLength={80} value={plan.name} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, name: event.target.value } }))} /></label><div className="actions"><button className="secondary" disabled={busy || !plan.name.trim()} onClick={() => void save({ type: "stream", id: stream.id, name: plan.name, allocation: Number(plan.allocation) / 100, wip: plan.wip }, `${plan.name.trim()} updated.`).then((saved) => { if (saved) setRenamingStreamId(null); })}>Save name</button><button className="quiet" disabled={busy} onClick={() => { setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, name: stream.name } })); setRenamingStreamId(null); }}>Cancel</button></div></div> : <div className="stream-title-row"><h3>{stream.name}</h3><button className="text-button" disabled={busy} onClick={() => setRenamingStreamId(stream.id)}>Rename</button></div>}
        <p>{members.length} selected · {Math.round(stream.allocation * 100)}% capacity · WIP {stream.wip_limit}</p>
      </div><details id={`stream-settings-${stream.id}`} className="stream-settings"><summary>Stream settings</summary><div className="stream-controls"><label>Allocation %<input type="number" min="0" max="100" step="0.1" value={plan.allocation} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, allocation: event.target.value } }))} /></label><label>WIP<input type="number" min="1" max="50" value={plan.wip} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, wip: Number(event.target.value) } }))} /></label><button className="secondary" disabled={busy || !plan.name.trim()} onClick={() => void save({ type: "stream", id: stream.id, name: plan.name, allocation: Number(plan.allocation) / 100, wip: plan.wip }, `${stream.name} settings updated.`)}>Save settings</button></div></details></div>
      {members.length > 0 && <StreamTimeline name={stream.name} projects={members} forecast={result} cycles={futureCycles.slice(0, state.capacity.horizon)} timezone={state.timezone}
        anchorDate={teamLocalDate(futureCycles[0]?.startsAt ?? state.evaluatedAt, state.timezone)} weeklyAdjustments={state.weeklyAdjustments ?? []} holidays={state.holidayWeeks ?? []}
        cycleAdjustments={state.adjustments.map((item) => ({ cycleId: item.linear_cycle_id, availability: item.availability }))} sequencing={state.sequencing}
        onEditWeek={setEditingWeek} onOpenProject={revealPackage} />}
      <details className="lane-packages" id={`stream-work-${stream.id}`}><summary>Manage work <span>{members.length}</span></summary><div className="stream-assignment"><div className="assignment-intro"><h4>Assign work to {stream.name}</h4><p>Assign every project linked to an outcome, or move one project at a time. A project can belong to only one stream; assigning it here moves it from its current stream.</p></div><div className="assignment-columns"><section><h5>By outcome</h5><div className="assignment-list">{state.outcomes.map((outcome) => {
        const outcomeProjectIds = new Set(state.links.filter((link) => link.outcome_id === outcome.id).map((link) => link.project_id));
        const packages = state.packages.filter((item) => outcomeProjectIds.has(item.project_id));
        const hidden = packages.filter((item) => !item.in_scope);
        const allAssigned = packages.length > 0 && packages.every((item) => item.selected && item.stream_id === stream.id);
        return <div className="assignment-group" key={outcome.id}><div><strong>{outcome.title}</strong><small>{packages.length ? packages.map((item) => `${item.name} · ${locationFor(item)}${item.in_scope ? "" : " · hidden"}`).join("\n") : "No linked projects"}</small></div><button className={allAssigned ? "quiet" : "secondary"} disabled={busy || !packages.length || allAssigned} onClick={() => { if (hidden.length && !window.confirm(`This outcome includes ${hidden.length} hidden project${hidden.length === 1 ? "" : "s"}. Assign and select all linked projects anyway?`)) return; void save({ type: "assignment", streamId: stream.id, packageIds: packages.map((item) => item.id) }, `${packages.length} project${packages.length === 1 ? "" : "s"} from ${outcome.title} assigned to ${stream.name}.`); }}>{allAssigned ? "Assigned" : `Assign all ${packages.length}`}</button></div>;
      })}{!state.outcomes.length && <p className="empty">Create an outcome and link projects to assign them together.</p>}</div></section><section><h5>By individual project</h5><label className="assignment-search">Find project<input type="search" value={assignmentSearches[stream.id] || ""} onChange={(event) => setAssignmentSearches((old) => ({ ...old, [stream.id]: event.target.value }))} placeholder="Search project names" /></label><div className="assignment-list project-assignment-list">{matchingPackages.map((item) => {
        const assignedHere = item.selected && item.stream_id === stream.id;
        return <div className="assignment-group" key={item.id}><div><strong>{item.name}</strong><small>{locationFor(item)}</small></div><button className={assignedHere ? "quiet" : "secondary"} disabled={busy || assignedHere} onClick={() => void save({ type: "assignment", streamId: stream.id, packageIds: [item.id] }, `${item.name} assigned to ${stream.name}.`)}>{assignedHere ? "Assigned" : item.stream_id && item.selected ? "Move here" : "Assign"}</button></div>;
      })}{!matchingPackages.length && <p className="empty">No projects match this search.</p>}</div></section></div></div></details>
      <div className="assigned-packages"><h4>Project sequence</h4>
        {state.sequenceConflicts.filter((conflict) => conflict.streamId === stream.id).map((conflict) => {
          const placement = { packageId: conflict.predecessorId, streamId: stream.id, selected: true, beforeId: conflict.successorId };
          const problem = placementError(state.sequencing, placement);
          return <div className="sequence-conflict" key={conflict.key}><p>{conflict.message} Put the blocker first to restore this stream’s forecast.</p>
            <button className="secondary" disabled={busy || !!problem} title={problem || undefined} onClick={() => void moveProject(placement)}>Put blocker first</button></div>;
        })}
        {queue(members, stream.id, true)}{!members.length && <p className="empty">Drop a project here or assign work to this stream.</p>}</div></div>;
    })}</div>
    <div className="board-shelves"><div>{dropTarget(null, false, null, "Drop into Deferred")}<details id="deferred-work" className="stream-lane deferred lane-packages"><summary>Deferred <span className="count">{deferred.length}</span></summary><p>Paused work consumes no future capacity. In-progress work must also be paused in Linear separately.</p>{queue(deferred, null, false)}{!deferred.length && <p className="empty">No deferred work.</p>}</details></div></div>
    <span id="dependency-settings" className="anchor-target" />
    <details className="board-settings"><summary>Dependencies</summary><p>“Blocked by” means the predecessor must finish in a previous cycle. Local links stay in Oh, WAWD!.</p><div className="board-fields"><label>Blocking package<select value={dependency.predecessorId} onChange={(event) => setDependency({ ...dependency, predecessorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Blocked package<select value={dependency.successorId} onChange={(event) => setDependency({ ...dependency, successorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><button disabled={busy || !dependency.predecessorId || !dependency.successorId} onClick={() => void save({ type: "dependency", action: "add", ...dependency }, "Dependency saved.")}>Add dependency</button><ul className="dependency-list">{state.dependencies.map((edge) => <li key={`${edge.source}:${edge.predecessor_id}:${edge.successor_id}`}><span>{state.packages.find((item) => item.id === edge.predecessor_id)?.name || edge.predecessor_id} → {state.packages.find((item) => item.id === edge.successor_id)?.name || edge.successor_id} · {edge.source}{edge.waived ? ` · waived: ${edge.waiver_reason}` : ""}</span>{edge.source === "local" && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "remove", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Dependency removed.")}>Remove</button>}{edge.source === "linear" && !edge.waived && <button className="text-button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for waiving this Linear dependency in the forecast?"); if (reason) void save({ type: "dependency", action: "waive", predecessorId: edge.predecessor_id, successorId: edge.successor_id, reason }, "Linear dependency waived in this plan."); }}>Waive</button>}{edge.source === "linear" && edge.waived && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "restore", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Linear dependency restored.")}>Restore</button>}</li>)}</ul></details>
    <details className="board-settings"><summary>Cycle-by-cycle explanation</summary><p>Linear source as of {new Date(result.sourceAt).toLocaleString()} · cycle position checked {new Date(state.cycleAnchorAt).toLocaleString()} · dates in {state.timezone}. Unused stream budget does not move to another stream.</p><div className="cycle-table-wrap" role="region" aria-label="Cycle capacity details. Scroll horizontally to view every stream." tabIndex={0}><table className="cycle-table"><thead><tr><th>Linear cycle</th><th>Team available</th>{state.streams.map((item) => <th key={item.id}>{item.name}</th>)}</tr></thead><tbody>{result.cycles.map((cycle) => <tr key={cycle.id}><th>{linearCycleLabel(cycle)}<small>{cycle.start} – {cycle.end}</small></th><td>{fmt(cycle.available)} pts</td>{state.streams.map((stream) => { const usage = cycle.streams.find((item) => item.id === stream.id); return <td key={stream.id}>{fmt(usage?.used || 0)} / {fmt(usage?.budget || 0)} pts<small>{usage?.active.map((id) => state.packages.find((item) => item.id === id)?.name || id).join(", ") || "Idle"}</small></td>; })}</tr>)}</tbody></table></div></details>
  </section>;
}
