"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import type { ForecastResult, PackageForecast } from "@/lib/forecast";
import { planningCycleLabel as linearCycleLabel, type PlanningCycle } from "@/lib/cycles";
import type { CalendarProjection } from "@/lib/cycle-projection";
import CycleCalendar, { type CalendarCycle } from "./cycle-calendar";
import StreamManager from "./stream-manager";
import { readApiResponse } from "./client-api";
import ProjectPlanCard, { type BoardProject as Package } from "./project-plan-card";
import { placementError, type QueueState, type Placement, type OrderConflict } from "@/lib/sequencing";
import { teamLocalDate, millisecondsUntilNextTeamDate, type ExtraScope, type ScopeReadiness } from "@/lib/project-scope";
import { type WeeklyAvailability } from "@/lib/planning-calendar";
import StreamTimeline from "./stream-timeline";
import type { SettingsTarget } from "./workspace-settings";
import ProjectDrawer from "./project-drawer";
import type { RoadmapConversion } from "@/lib/roadmap-planning";
import type { OutcomeLifecycle } from "@/lib/outcome-completion";
import { outcomeLifecycleSummary } from "./outcome-lifecycle-view";
import OutcomeBoardControls, { OutcomeDrop, outcomeDragType, type OutcomeMove, type OpenBoardOutcome } from "./outcome-board-controls";
import { RoadmapOwnedWork, RoadmapTriage } from "./roadmap-board-work";
import type { RoadmapState } from "@/lib/roadmap-planning";
import DismissibleMessage from "./dismissible-message";

type Stream = { id: string; name: string; allocation: number; wip_limit: number };
type LinearCycle = PlanningCycle;
export type BoardOutcome = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null; stream_id: string | null; stream_position?: number | null; lifecycle?: OutcomeLifecycle };
export type BoardState = {
  connection: { team_name: string; cycles_enabled: boolean; cycle_duration: number | null; cycle_start_day: number | null; cycle_cooldown_time: number | null; upcoming_cycle_count: number | null } | null;
  packages: Package[]; streams: Stream[]; links: { outcome_id: string; project_id: string; requirement: "minimum" | "optional" }[];
  capacity: { baseline: number | null; baseline_reason: string; reserve: number; horizon: number; scoping_lead_days: number; holidays_enabled: boolean };
  observations: { linear_id: string; starts_at: string; ends_at: string; completed_points: number }[]; observedBaseline: number | null; effectiveBaseline: number | null;
  linearCycles: LinearCycle[]; currentCycleId: string | null; cycleAnchorAt: string; futureCycleIds: string[];
  planningCycles: LinearCycle[]; calendarProjection: CalendarProjection;
  adjustments: { linear_cycle_id: string; number: number; name: string | null; starts_at: string; ends_at: string; availability: number; reserve: number | null }[];
  legacyAdjustments: { cycle_number: number }[]; dependencies: { predecessor_id: string; successor_id: string; source: "local" | "linear"; waived: boolean; waiver_reason: string }[];
  issues: { linear_id: string; project_id: string; identifier: string; estimate: number | null; state_type: string }[];
  outcomes: BoardOutcome[]; timezone: string; forecast: ForecastResult; sequencing: QueueState; sequenceToken: string; ownershipToken: string; sequenceConflicts: OrderConflict[];
  extraScopes: ExtraScope[]; scoping: ScopeReadiness[]; evaluatedAt: string;
  weeklyAdjustments: WeeklyAvailability[]; holidayWeeks: WeeklyAvailability[];
  roadmapPlanningMigrated?: boolean; roadmapConversionFeedback?: (RoadmapConversion & { packageId: string })[]; planningToken?: string;
  affectedCandidates?: { id: string; name: string }[];
};
const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 });
const projectHome = (item: Package, active?: boolean) => active && item.roadmap_state !== "included" ? item.roadmap_state === "deferred" ? "deferred-work" : item.roadmap_state === "dismissed" ? "dismissed-work" : "board-roadmap-triage-title" : !item.selected ? "deferred-work" : item.stream_id ? `stream-work-${item.stream_id}` : "unassigned-work";

export default function Board({ refreshKey, updatedState, onChanged, onOpenOutcomes, onOpenNeedsAssignment, onOpenProjects, onOpenSettings, onStateChange, focusProject, onOpenOutcome }: {
  refreshKey: number; onChanged?: () => void; onOpenOutcomes?: () => void; onOpenNeedsAssignment?: () => void; onOpenProjects?: () => void;
  onStateChange?: (state: BoardState | null, error: string) => void; focusProject?: { id: string; request: number; inspect?: boolean } | null;
  onOpenOutcome: OpenBoardOutcome;
  onOpenSettings: (target: SettingsTarget) => void;
  updatedState?: BoardState | null;
}) {
  const [state, setState] = useState<BoardState | null>(null);
  const [streamDrafts, setStreamDrafts] = useState<Record<string, { name: string; allocation: string }>>({});
  const [adjustment, setAdjustment] = useState({ selectedCycleIds: [] as string[], availability: "100", reserve: "" });
  const [dependency, setDependency] = useState({ predecessorId: "", successorId: "" });
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingOutcome, setDraggingOutcome] = useState<string | null>(null);
  const [outcomeFocus, setOutcomeFocus] = useState<{ id: string; streamId: string | null; opener: HTMLElement | null } | null>(null);
  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null);
  const [placementFocus, setPlacementFocus] = useState<{ id: string; saved: boolean } | null>(null);
  const [renamingStreamId, setRenamingStreamId] = useState<string | null>(null);
  const [assignmentSearches, setAssignmentSearches] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const loadGeneration = useRef(0);
  const writePending = useRef(false);
  const invalidProjectDrop = useRef<string | null>(null);
  const handledFocusRequest = useRef(0);
  useEffect(() => {
    if (!placementFocus || busy || !state) return;
    // Wait for the saved/reloaded cards to commit and become enabled before restoring focus.
    if (!drawerProjectId && !document.querySelector("dialog[open]")) {
      const item = state.packages.find((candidate) => candidate.id === placementFocus.id);
      if (item) {
        const container = document.getElementById(projectHome(item, state.roadmapPlanningMigrated));
        if (container instanceof HTMLDetailsElement) container.open = true;
        const card = document.getElementById(`board-package-${item.id}`);
        (card?.querySelector<HTMLElement>(".drag-handle") ?? document.getElementById("board-roadmap-triage-title"))?.focus({ preventScroll: true });
        if (placementFocus.saved) card?.scrollIntoView({ block: "nearest" });
      }
    }
    setPlacementFocus(null);
  }, [placementFocus, busy, state, drawerProjectId]);
  useEffect(() => {
    if (!outcomeFocus || busy || !state) return;
    if (!document.querySelector("dialog[open]")) {
      const opener = outcomeFocus.opener;
      const target = opener?.isConnected && opener.getClientRects().length && !opener.matches(":disabled") ? opener : document.getElementById(`board-outcome-title-${outcomeFocus.id}`) ?? document.getElementById(outcomeFocus.streamId ? `board-stream-title-${outcomeFocus.streamId}` : "board-unassigned-outcomes-title");
      target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    setOutcomeFocus(null);
  }, [outcomeFocus, busy, state]);
  useEffect(() => { onStateChange?.(state, state ? "" : error); }, [state, error, onStateChange]);
  useEffect(() => {
    if (!updatedState) return;
    // The successful settings response is authoritative even when a later read fails.
    ++loadGeneration.current;
    setState(updatedState); setError("");
  }, [updatedState]);
  useEffect(() => {
    if (!state || !focusProject || handledFocusRequest.current === focusProject.request) return;
    handledFocusRequest.current = focusProject.request;
    const item = state.packages.find((candidate) => candidate.id === focusProject.id);
    if (item) { if (focusProject.inspect) setDrawerProjectId(item.id); else packageResolution(item, state.forecast.packages.find((projection) => projection.id === item.id)).run(); }
  }, [state, focusProject]);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      const data = await readApiResponse<BoardState>(response, "Could not load board");
      if (generation !== loadGeneration.current) return;
      setError("");
      setState(data);
      setAdjustment((old) => ({ ...old, selectedCycleIds: [] }));
      setStreamDrafts(Object.fromEntries(data.streams.map((item: Stream) => [item.id, { name: item.name, allocation: (item.allocation * 100).toString() }])));
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
  async function save(change: Record<string, unknown>, message: string | ((data: BoardState) => string)): Promise<boolean> {
    if (writePending.current) return false;
    writePending.current = true;
    const generation = ++loadGeneration.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/board", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...change, sequenceToken: state?.sequenceToken, ownershipToken: state?.ownershipToken, planningToken: state?.planningToken }) });
      const data = await readApiResponse<BoardState>(response, "Could not save board");
      if (generation === loadGeneration.current) setState(data); else void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh saved planning data."));
      const impact = data.affectedCandidates?.length ? ` Needs assignment: ${data.affectedCandidates.map((item) => item.name).join(", ")}; future demand excluded until an owner is chosen.` : "";
      setNotice((typeof message === "function" ? message(data) : message) + impact); onChanged?.();
      return true;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not save board";
      // Reload saved order after a rejected drop, preserving the failure explanation.
      try { await load(); } catch { /* Keep the last saved state if offline. */ }
      setError(message); return false;
    }
    finally { writePending.current = false; setBusy(false); }
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
    if (state?.roadmapPlanningMigrated && placement.roadmapState && placement.roadmapState !== "included") {
      const action = placement.roadmapState === "candidate" ? "candidate" : placement.roadmapState === "dismissed" ? "dismiss" : "defer";
      const saved = await save({ type: "roadmapMembership", packageId: item.id, action, reason }, `${item.name} moved to ${placement.roadmapState}; future demand excluded.`);
      setPlacementFocus({ id: item.id, saved }); return;
    }
    const destination = !placement.selected ? "Deferred" : placement.streamId ? state!.streams.find((stream) => stream.id === placement.streamId)?.name ?? "stream" : "Needs assignment";
    const saved = await save({ type: "package", id: placement.packageId, streamId: placement.streamId, selected: placement.selected,
      ...(placement.outcomeId !== undefined ? { outcomeId: placement.outcomeId } : {}), ...(reason !== undefined ? { reason } : {}), ...(placement.beforeId !== undefined ? { beforeId: placement.beforeId } : {}) }, `${item.name} moved to ${destination}${placement.outcomeId ? ` · owner ${state?.outcomes.find((outcome) => outcome.id === placement.outcomeId)?.title}` : ""}${placement.beforeId ? ` before ${state?.packages.find((candidate) => candidate.id === placement.beforeId)?.name ?? "project"}` : placement.beforeId === null ? " at end of owning queue" : ""}.`);
    setPlacementFocus({ id: item.id, saved });
  }
  function startDrag(event: DragEvent, id: string) {
    invalidProjectDrop.current = null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDragging(id);
  }
  function endProjectDrag() {
    if (invalidProjectDrop.current && dragging) { setError(invalidProjectDrop.current); setPlacementFocus({ id: dragging, saved: false }); }
    invalidProjectDrop.current = null; setDragging(null);
  }
  async function moveOutcome(move: OutcomeMove) {
    const current = state?.outcomes.find((item) => item.id === move.outcomeId); if (!current) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = focused?.closest("[data-outcome-controls]")?.getAttribute("data-outcome-controls") === move.outcomeId ? focused : null;
    await save({ type: "outcomeAssignment", ...move }, (data) => { const moved = data.outcomes.find((item) => item.id === move.outcomeId); return moved?.stream_id ? `${moved.title} placement saved: ${data.streams.find((stream) => stream.id === moved.stream_id)?.name}, priority ${moved.stream_position}.` : `${current.title} moved to Needs assignment.`; });
    setOutcomeFocus({ id: move.outcomeId, streamId: current.stream_id, opener });
  }
  const openFromProject = (item: Package, id: string, section: "details" | "projects" = "details") => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallback = item.stream_id ? `board-stream-title-${item.stream_id}` : "board-roadmap-triage-title";
    if (drawerProjectId) { setDrawerProjectId(null); requestAnimationFrame(() => onOpenOutcome(id, opener, fallback, section)); }
    else onOpenOutcome(id, opener, fallback, section);
  };
  if (!state) return <section className="panel" id="sequencing-board"><h2>Sequencing board</h2><p>{error || "Loading board…"}</p></section>;
  const result = state.forecast;
  const futureCycles = state.linearCycles.filter((cycle) => state.futureCycleIds.includes(cycle.id));
  const planningCycles = (state.planningCycles ?? state.linearCycles).filter((cycle) => !cycle.completedAt && Date.parse(cycle.startsAt) > Date.parse(state.cycleAnchorAt));
  const projectedCount = planningCycles.filter((cycle) => cycle.projected).length;
  const cycleDate = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: state.timezone, month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  const cycleRange = (cycle: LinearCycle) => `${cycleDate(cycle.startsAt)} – ${cycleDate(new Date(Date.parse(cycle.endsAt) - 1).toISOString())}`;
  const cycleText = (index: number | null | undefined) => index === 0 ? "Complete before next cycle" : index ? linearCycleLabel(planningCycles[index - 1] || { number: 0, name: "Unknown cycle" }) : "Unscheduled";
  const calendarCycles: CalendarCycle[] = [...state.linearCycles.filter((cycle) => state.futureCycleIds.includes(cycle.id) || cycle.id === state.currentCycleId),
    ...planningCycles.filter((cycle) => cycle.projected)].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((cycle) => ({ ...cycle, selectable: !cycle.projected && state.futureCycleIds.includes(cycle.id), adjusted: state.adjustments.some((item) => item.linear_cycle_id === cycle.id) }));
  const currentCycle = state.linearCycles.find((cycle) => cycle.id === state.currentCycleId);
  const packageForecast = new Map(result.packages.map((item) => [item.id, item]));
  const openPanel = (id: string) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    const details = panel instanceof HTMLDetailsElement ? panel : panel.nextElementSibling instanceof HTMLDetailsElement ? panel.nextElementSibling : null;
    if (details) details.open = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (details || panel).scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "center" });
    window.setTimeout(() => ((details || panel).querySelector<HTMLElement>("summary, button, input, select") ?? ((details || panel).matches("[tabindex]") ? details || panel : null))?.focus(), reduced ? 0 : 350);
  };
  const revealPackage = (item: Package, scope = false) => {
    const parentId = projectHome(item, state.roadmapPlanningMigrated);
    const parent = document.getElementById(parentId);
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    window.setTimeout(() => {
      const project = document.getElementById(`board-package-${item.id}`);
      const controls = project?.querySelector("details");
      if (controls instanceof HTMLDetailsElement) controls.open = true;
      project?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
      project?.querySelector<HTMLElement>(scope ? ".extra-scope-editor input" : "summary, button, input, select")?.focus();
    });
  };
  const packageResolution = (item: Package, projection?: PackageForecast): { label: string; run: (opener?: HTMLElement) => void } => {
    const reason = projection?.reason || "";
    const capacityResolution = { label: "Review stream capacity", run: (opener?: HTMLElement) => onOpenSettings({ section: "capacity", focusField: true, opener }) };
    if (state.roadmapPlanningMigrated && item.roadmap_state !== "included" && !item.cross_team && !item.needs_review) return { label: item.roadmap_state === "dismissed" ? "Restore off-roadmap prerequisite" : item.roadmap_state === "deferred" ? "Resume with an owning outcome" : "Include with an owning outcome", run: () => setDrawerProjectId(item.id) };
    if (state.roadmapPlanningMigrated && /Waiting for|dependency/i.test(reason)) return { label: "Inspect prerequisite dependencies", run: () => setDrawerProjectId(item.id) };
    if (!item.in_scope || item.needs_review || item.cross_team || /source scope|outside the imported team/i.test(reason)) return { label: "Review in Linear projects", run: () => onOpenProjects?.() };
    if (!item.selected) return { label: "Review deferred plan", run: () => revealPackage(item) };
    if (!item.stream_id || /assignment/i.test(reason)) return { label: "Assign to a stream", run: () => openPanel("unassigned-work") };
    if (/capacity|baseline/i.test(reason)) return capacityResolution;
    if (/cycle|calendar/i.test(reason)) return { label: "Review cycle calendar", run: () => openPanel("cycle-calendar-settings") };
    if (/sequence|precede/i.test(reason)) return { label: "Review stream order", run: () => revealPackage(item) };
    if (/Waiting for|dependency/i.test(reason)) return { label: "Review dependencies", run: () => openPanel("dependency-settings") };
    if (/estimate|allowance|scope/i.test(reason)) return { label: "Review extra scope", run: () => revealPackage(item, true) };
    return capacityResolution;
  };
  const card = (item: Package, embedded = false) => {
    const projection = packageForecast.get(item.id) as PackageForecast | undefined;
    const unknown = state.issues.filter((issue) => issue.project_id === item.project_id && issue.estimate === null && !["completed", "canceled"].includes(issue.state_type));
    const resolution = packageResolution(item, projection);
    return <ProjectPlanCard key={item.id} item={item} embedded={embedded} streams={state.streams} sequencing={state.sequencing} projection={projection}
      outcomes={state.outcomes} links={state.links} onOpenOutcome={(id, section) => openFromProject(item, id, section)}
      extra={state.extraScopes.find((entry) => entry.package_id === item.id)} readiness={state.scoping.find((entry) => entry.packageId === item.id)}
      unknown={unknown.map((issue) => issue.identifier)} busy={busy} cycleText={cycleText} resolution={embedded ? { label: resolution.label, run: () => {
        if (state.roadmapPlanningMigrated && (/^(Include with|Resume with|Restore off-roadmap|Inspect prerequisite)/.test(resolution.label))) {
          const dialog = document.querySelector("dialog.project-drawer[open]");
          const eligible = state.outcomes.some((outcome) => outcome.stream_id && state.links.some((link) => link.outcome_id === outcome.id && link.project_id === item.project_id));
          const selector = resolution.label.startsWith("Inspect prerequisite") ? ".drawer-dependency-list button, #project-drawer-dependencies-title" : item.roadmap_state === "dismissed" ? ".project-roadmap-controls button" : eligible ? '.project-roadmap-controls select' : '.project-roadmap-controls select[aria-label^="Outcome for linking"]';
          const target = dialog?.querySelector<HTMLElement>(selector); target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "center", behavior: "instant" }); return;
        }
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; setDrawerProjectId(null); window.requestAnimationFrame(() => resolution.run(opener));
      } } : resolution}
      onOpenProjects={embedded ? () => { setDrawerProjectId(null); onOpenProjects?.(); } : onOpenProjects} onSave={async (change, message) => { const saved = await save(change, message); if (state.roadmapPlanningMigrated && !embedded && ["roadmapMembership", "ownership"].includes(String(change.type))) setPlacementFocus({ id: item.id, saved }); return saved; }} onMove={moveProject} onDragStart={startDrag} onDragEnd={endProjectDrag} />;
  };
  const dropTarget = (streamId: string | null, selected: boolean, beforeId: string | null, label: string, outcomeId?: string, roadmapState?: RoadmapState) => {
    const placement = { streamId, selected, ...(streamId ? { beforeId } : {}), ...(outcomeId ? { outcomeId } : {}), ...(roadmapState ? { roadmapState } : {}) };
    const problem = dragging ? placementError(state.sequencing, { packageId: dragging, ...placement }) : null;
    return <div className={`project-drop-target${dragging ? " drag-active" : ""}${problem ? " invalid" : ""}`}
      data-drop-stream={streamId ?? (roadmapState ?? (selected ? "unassigned" : "deferred"))} data-drop-owner={outcomeId ?? ""} data-before={beforeId ?? ""} aria-hidden={!dragging} title={problem || label}
      onDragOver={(event) => { event.preventDefault(); if (dragging && state.roadmapPlanningMigrated) invalidProjectDrop.current = problem; event.dataTransfer.dropEffect = problem || busy ? "none" : "move"; }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); invalidProjectDrop.current = null; setDragging(null);
        if (!busy && state.packages.some((item) => item.id === id)) { if (problem && state.roadmapPlanningMigrated) { setError(problem); setPlacementFocus({ id, saved: false }); } else void moveProject({ packageId: id, ...placement }); }
      }}>{problem || label}</div>;
  };
  const queue = (items: Package[], streamId: string | null, selected: boolean) => {
    const ordered = [...items].sort(streamId ? (a, b) => (a.sequence_position ?? Infinity) - (b.sequence_position ?? Infinity) || a.id.localeCompare(b.id) : (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return <ol className={`project-queue${streamId ? "" : " shelf-projects"}`} aria-label={streamId ? `${state.streams.find((item) => item.id === streamId)?.name} project sequence` : selected ? "Needs assignment projects" : "Deferred projects"}>
      {ordered.map((item) => <li key={item.id}>{streamId && dropTarget(streamId, selected, item.id, `Drop before ${item.name}`)}{card(item)}</li>)}
      <li>{dropTarget(streamId, selected, null, streamId ? "Drop at end of stream" : selected ? "Drop into Needs assignment" : "Drop into Deferred")}</li>
    </ol>;
  };
  const planningPackages = state.packages.filter((item) => state.roadmapPlanningMigrated || item.in_scope);
  const selected = planningPackages.filter((item) => item.selected);
  const unassigned = state.roadmapPlanningMigrated ? planningPackages.filter((item) => item.roadmap_state === "candidate") : selected.filter((item) => !item.stream_id);
  const unassignedOutcomes = state.outcomes.filter((outcome) => !outcome.stream_id);
  const deferred = planningPackages.filter((item) => !item.selected);
  const totalAllocation = state.streams.reduce((sum, item) => sum + item.allocation, 0);
  const blockedOutcomes = result.outcomes.filter((outcome) => ["blocked", "setup_required", "beyond_horizon"].includes(outcome.status));
  const scopeAttention = state.scoping.filter((entry) => (entry.status === "needs_scoping" || !!entry.review) && selected.some((item) => item.id === entry.packageId));
  const setupAction = (message: string) => /baseline/i.test(message) ? { label: "Set capacity baseline", run: () => onOpenSettings({ section: "capacity", focusField: true }) } : /cycle/i.test(message) ? { label: "Review Linear cycles", run: () => openPanel("cycle-calendar-settings") } : { label: "Review stream allocation", run: () => openPanel(`stream-settings-${state.streams[0]?.id || ""}`) };
  const streamSection = <div className="stream-list" id="project-streams">{state.streams.map((stream) => {
    const plan = streamDrafts[stream.id] || { name: stream.name, allocation: (stream.allocation * 100).toString() };
    const members = selected.filter((item) => item.stream_id === stream.id).sort((a, b) => (a.sequence_position ?? Infinity) - (b.sequence_position ?? Infinity) || a.id.localeCompare(b.id));
    const countedMembers = state.packages.filter((item) => item.selected && item.stream_id === stream.id);
    const search = assignmentSearches[stream.id]?.trim().toLocaleLowerCase() || "";
    const matchingPackages = planningPackages.filter((item) => !search || item.name.toLocaleLowerCase().includes(search));
    const locationFor = (item: Package) => !item.selected ? "Deferred" : item.stream_id ? state.streams.find((candidate) => candidate.id === item.stream_id)?.name || "Another stream" : "Needs assignment";
    return <div className="stream-lane" id={`stream-${stream.id}`} key={stream.id}><div className="stream-heading"><div className="stream-title">
      {renamingStreamId === stream.id ? <div className="stream-title-editor"><label>Stream name<input autoFocus maxLength={80} value={plan.name} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, name: event.target.value } }))} /></label><div className="actions"><button className="secondary" disabled={busy || !plan.name.trim()} onClick={() => void save({ type: "stream", id: stream.id, name: plan.name, allocation: Number(plan.allocation) / 100 }, `${plan.name.trim()} updated.`).then((saved) => { if (saved) setRenamingStreamId(null); })}>Save name</button><button className="quiet" disabled={busy} onClick={() => { setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, name: stream.name } })); setRenamingStreamId(null); }}>Cancel</button></div></div> : <div className="stream-title-row"><h3 id={`board-stream-title-${stream.id}`} tabIndex={-1}>{stream.name}</h3><button className="text-button" disabled={busy} onClick={() => setRenamingStreamId(stream.id)}>Rename</button></div>}
      <p>{state.outcomes.filter((outcome) => outcome.stream_id === stream.id).length} outcomes · {countedMembers.length} selected projects · {fmt(result.packages.filter((projection) => countedMembers.some((item) => item.id === projection.id)).reduce((sum, projection) => sum + projection.demand, 0))} pts counted · {Math.round(stream.allocation * 100)}% capacity · 1 project at a time</p>
    </div><details id={`stream-settings-${stream.id}`} className="stream-settings"><summary>Stream settings</summary><div className="stream-controls"><label>Allocation %<input type="number" min="0" max="100" step="0.1" value={plan.allocation} onChange={(event) => setStreamDrafts((old) => ({ ...old, [stream.id]: { ...plan, allocation: event.target.value } }))} /></label><button className="secondary" disabled={busy || !plan.name.trim()} onClick={() => void save({ type: "stream", id: stream.id, name: plan.name, allocation: Number(plan.allocation) / 100 }, `${stream.name} settings updated.`)}>Save settings</button></div></details></div>
    {(countedMembers.length > 0 || state.outcomes.some((outcome) => outcome.stream_id === stream.id)) && <StreamTimeline name={stream.name} streamId={stream.id} projects={state.packages} outcomes={state.outcomes} links={state.links} streams={state.streams} forecast={result} cycles={planningCycles} timezone={state.timezone}
      anchorDate={teamLocalDate(planningCycles[0]?.startsAt ?? state.evaluatedAt, state.timezone)} weeklyAdjustments={state.weeklyAdjustments ?? []} holidays={state.holidayWeeks ?? []}
      calendarProjection={state.calendarProjection}
      cycleAdjustments={state.adjustments.map((item) => ({ cycleId: item.linear_cycle_id, availability: item.availability }))} sequencing={state.sequencing}
      onOpenOutcome={(id, opener) => onOpenOutcome(id, opener, `board-stream-title-${stream.id}`)}
      renderOutcome={state.roadmapPlanningMigrated ? (id) => <OutcomeBoardControls outcome={state.outcomes.find((item) => item.id === id)!} busy={busy} dragging={draggingOutcome} onDrag={(event, id) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(outcomeDragType, id); setDraggingOutcome(id); }} onEnd={() => setDraggingOutcome(null)} onMove={moveOutcome} onOpen={onOpenOutcome} /> : undefined}
      onEditWeek={(week) => onOpenSettings({ section: "availability", week, focusField: true })} onOpenProject={(project) => setDrawerProjectId(project.id)} />}
    {state.roadmapPlanningMigrated ? <><OutcomeDrop streamId={stream.id} dragging={draggingOutcome} busy={busy} onMove={moveOutcome} onEnd={() => setDraggingOutcome(null)} /><RoadmapOwnedWork streamId={stream.id} state={state} busy={busy} card={card} drop={dropTarget} onMove={moveProject} onOpen={(id) => onOpenOutcome(id, document.activeElement instanceof HTMLElement ? document.activeElement : null, `board-stream-title-${stream.id}`)} /></> : <details className="lane-packages" id={`stream-work-${stream.id}`} ref={(element) => { if (element && state.sequenceConflicts.some((conflict) => conflict.streamId === stream.id)) element.open = true; }}><summary>Manage work <span>{members.length}</span></summary><div className="stream-assignment"><div className="assignment-intro"><h4>Assign work to {stream.name}</h4><p>Assign outcomes to show their project sequences. Shared projects stay counted under their current owner until you explicitly change ownership in project details. Individual project moves change their capacity stream.</p></div><div className="assignment-columns"><section><h5>By outcome</h5><div className="assignment-list">{state.outcomes.map((outcome) => {
      const outcomeProjectIds = new Set(state.links.filter((link) => link.outcome_id === outcome.id).map((link) => link.project_id));
      const packages = state.packages.filter((item) => outcomeProjectIds.has(item.project_id));
      const hidden = packages.filter((item) => !item.in_scope);
      const allAssigned = outcome.stream_id === stream.id;
      return <div className="assignment-group" key={outcome.id}><div><strong>{outcome.title}</strong><small>{state.streams.find((candidate) => candidate.id === outcome.stream_id)?.name ?? "Outcome needs assignment"}{hidden.length ? ` · ${hidden.length} hidden projects` : ""}{packages.length ? ` · ${packages.length} linked projects` : " · No linked projects"}</small></div><button className={allAssigned ? "quiet" : "secondary"} disabled={busy || allAssigned} onClick={() => void save({ type: "outcomeAssignment", streamId: stream.id, outcomeId: outcome.id }, `${outcome.title} assigned to ${stream.name}. Shared project owners preserved.`)}>{allAssigned ? "Assigned" : "Assign outcome"}</button>{allAssigned && <button className="text-button" disabled={busy} onClick={() => void save({ type: "outcomeAssignment", streamId: null, outcomeId: outcome.id }, `${outcome.title} moved to Needs assignment. Project stream charges preserved.`)}>Unassign outcome</button>}</div>;
    })}{!state.outcomes.length && <p className="empty">Create an outcome and link projects to assign them together.</p>}</div></section><section><h5>By individual project</h5><label className="assignment-search">Find project<input type="search" value={assignmentSearches[stream.id] || ""} onChange={(event) => setAssignmentSearches((old) => ({ ...old, [stream.id]: event.target.value }))} placeholder="Search project names" /></label><div className="assignment-list project-assignment-list">{matchingPackages.map((item) => {
      const assignedHere = item.selected && item.stream_id === stream.id;
      return <div className="assignment-group" key={item.id}><div><strong>{item.name}</strong><small>{locationFor(item)}</small></div><button className={assignedHere ? "quiet" : "secondary"} disabled={busy || assignedHere} onClick={() => void save({ type: "assignment", streamId: stream.id, packageIds: [item.id] }, `${item.name} assigned to ${stream.name}.`)}>{assignedHere ? "Assigned" : item.stream_id && item.selected ? "Move here" : "Assign"}</button></div>;
    })}{!matchingPackages.length && <p className="empty">No projects match this search.</p>}</div></section></div></div>
    <div className="assigned-packages"><h4>Project sequence</h4>
      {state.sequenceConflicts.filter((conflict) => conflict.streamId === stream.id).map((conflict) => {
        const placement = { packageId: conflict.predecessorId, streamId: stream.id, selected: true, beforeId: conflict.successorId };
        const problem = placementError(state.sequencing, placement);
        return <div className="sequence-conflict" key={conflict.key}><p>{conflict.message} Put the blocker first to restore this stream’s forecast.</p>
          <button className="secondary" disabled={busy || !!problem} title={problem || undefined} onClick={() => void moveProject(placement)}>Put blocker first</button></div>;
      })}
      {queue(members, stream.id, true)}{!members.length && <p className="empty">Drop a project here or assign work to this stream.</p>}</div></details>}</div>;
  })}</div>;
  return <section className="panel sequencing-board" id="sequencing-board">
    {drawerProjectId && state.packages.find((item) => item.id === drawerProjectId) && <ProjectDrawer project={state.packages.find((item) => item.id === drawerProjectId)!} state={state} busy={busy} error={error} notice={notice} onSave={save} onOpenProject={(project) => setDrawerProjectId(project.id)} onOpenOutcome={(id) => openFromProject(state.packages.find((item) => item.id === drawerProjectId)!, id)} onClose={() => setDrawerProjectId(null)}>{card(state.packages.find((item) => item.id === drawerProjectId)!, true)}</ProjectDrawer>}
    {error && <DismissibleMessage kind="error" onDismiss={() => setError("")}>{error}</DismissibleMessage>}{notice && <DismissibleMessage kind="notice" onDismiss={() => setNotice("")}>{notice}</DismissibleMessage>}
    <div className="board-summary"><div><strong>{fmt(result.selectedKnown)} pts</strong><small>selected estimates + extra scope</small></div><div><strong>{result.selectedUnknown}</strong><small>uncovered issues</small></div><div><strong>{Math.round(totalAllocation * 100)}%</strong><small>allocated · {Math.round(result.unallocated * 100)}% headroom</small></div><div><strong>{result.ready ? `${result.cycles.length} cycles` : "Setup needed"}</strong><small>forecast horizon used</small></div></div>
    <p className="queue-instructions" id="queue-instructions">{state.roadmapPlanningMigrated ? "Drag an outcome by its handle, or open its title for destination and before/after placement. Required work precedes optional work; blocked higher priorities yield to eligible work. Project order stays within its owner; transfers require an existing link. Each stream runs one project at a time." : "Select a project block to inspect its details or change where its points count. Open Manage work to assign outcomes and reorder projects using drag, arrow buttons, or Location / Place before. Alt + ↑ / ↓ reorders a focused drag handle. Dependencies apply; each stream runs one project at a time."}</p>
    {state.roadmapPlanningMigrated && !!state.roadmapConversionFeedback?.length && <details className="roadmap-conversion-context"><summary>Roadmap conversion / ownership context · {state.roadmapConversionFeedback.length} project(s)</summary><ul>{state.roadmapConversionFeedback.map((entry) => <li key={entry.packageId}><strong>{state.packages.find((project) => project.id === entry.packageId)?.name ?? entry.packageId}</strong> · {entry.message} <button type="button" className="text-button" onClick={() => setDrawerProjectId(entry.packageId)}>Inspect project context</button></li>)}</ul></details>}
    {state.packages.some((item) => !item.in_scope && item.selected) && <div className="blocker-line"><p className="meta">Hidden selected packages remain included in forecast totals.</p><button className="text-button" onClick={onOpenProjects}>Review hidden projects</button></div>}
    <section className={`action-center${result.ready && !unassigned.length && !unassignedOutcomes.length && !blockedOutcomes.length && !scopeAttention.length && !state.sequenceConflicts.length ? " ready" : ""}`} aria-labelledby="next-actions-title"><div className="compact-section-head"><div><p className="eyebrow">Planning attention</p><h3 id="next-actions-title">{unassignedOutcomes.length ? `Assign ${unassignedOutcomes.length} outcome${unassignedOutcomes.length === 1 ? "" : "s"} to streams` : unassigned.length ? state.roadmapPlanningMigrated ? `Assign outcomes to ${unassigned.length} candidate project${unassigned.length === 1 ? "" : "s"}` : `Assign ${unassigned.length} selected project${unassigned.length === 1 ? "" : "s"}` : result.setup.length || result.errors.length ? "Finish forecast setup" : state.sequenceConflicts.length ? "Resolve project order" : blockedOutcomes.length ? `Resolve ${blockedOutcomes.length} blocked outcome${blockedOutcomes.length === 1 ? "" : "s"}` : scopeAttention.length ? "Review upcoming project scope" : "Plan is ready to review"}</h3></div><span>{result.setup.length + result.errors.length + unassigned.length + unassignedOutcomes.length + blockedOutcomes.length + scopeAttention.length + state.sequenceConflicts.length} open</span></div>
      <div className="action-list">
        {!!unassignedOutcomes.length && <button className="action-item" onClick={() => openPanel("board-unassigned-outcomes-title")}><span><strong>Needs Assignment</strong><small>Outcomes need a stream before they can be sequenced on the roadmap.</small></span><b>{unassignedOutcomes.length} outcomes</b></button>}
        {!!unassigned.length && <button className="action-item" onClick={() => state.roadmapPlanningMigrated ? onOpenNeedsAssignment?.() : openPanel("unassigned-work")}><span><strong>{state.roadmapPlanningMigrated ? "Projects need outcomes" : "Needs assignment"}</strong><small>{state.roadmapPlanningMigrated ? "Review candidate projects in Outcomes and choose an owning outcome." : "Selected work cannot receive a credible date until it has a stream."}</small></span><b>{unassigned.length} waiting</b></button>}
        {result.setup.map((message) => { const action = setupAction(message); return <button className="action-item" key={message} onClick={action.run}><span><strong>{message}</strong><small>{action.label}</small></span><b>Configure</b></button>; })}
        {result.errors.map((message) => <button className="action-item error-action" key={message} onClick={() => openPanel("dependency-settings")}><span><strong>{message}</strong><small>Review dependency constraints.</small></span><b>Resolve</b></button>)}
        {state.sequenceConflicts.map((conflict) => <button className="action-item error-action" key={conflict.key} onClick={() => openPanel(`stream-work-${conflict.streamId}`)}><span><strong>Resolve project order</strong><small>{conflict.message}</small></span><b>Reorder</b></button>)}
        {scopeAttention.map((entry) => { const item = state.packages.find((candidate) => candidate.id === entry.packageId)!;
          return <button className="action-item scope-action" key={`scope:${entry.packageId}`} onClick={() => revealPackage(item, true)}><span><strong>{entry.status === "needs_scoping" ? "Needs scoping" : "Review extra scope"} · {item.name}</strong><small>{entry.review || (entry.dueDate ? `Scope due ${entry.dueDate}. Provisional forecast remains available.` : "Work is already in progress.")}</small></span><b>Review scope</b></button>;
        })}
        {!result.setup.length && !result.errors.length && !unassigned.length && !unassignedOutcomes.length && !!blockedOutcomes.length && <button className="action-item" onClick={onOpenOutcomes}><span><strong>Forecast blockers remain</strong><small>Review affected outcome health in the Outcomes catalog.</small></span><b>{blockedOutcomes.length} outcomes</b></button>}
        {result.ready && !unassigned.length && !unassignedOutcomes.length && !blockedOutcomes.length && !scopeAttention.length && !state.sequenceConflicts.length && <p className="action-ready">No setup or assignment blockers. Review outcome targets, then save a decision scenario.</p>}
      </div>
    </section>
    {streamSection}
    {(state.roadmapPlanningMigrated || unassignedOutcomes.length > 0) && <div className="unassigned-outcomes"><h3 id="board-unassigned-outcomes-title" tabIndex={-1}>Needs Assignment</h3><p>Outcomes listed here need a stream. Open an outcome to choose its placement; existing shared capacity owners are preserved.</p>{state.roadmapPlanningMigrated && <OutcomeDrop streamId={null} dragging={draggingOutcome} busy={busy} onMove={moveOutcome} onEnd={() => setDraggingOutcome(null)} />}{unassignedOutcomes.map((outcome) => state.roadmapPlanningMigrated ? <div className="unassigned-outcome-controls" key={outcome.id}><OutcomeBoardControls outcome={outcome} busy={busy} dragging={draggingOutcome} onDrag={(event, id) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(outcomeDragType, id); setDraggingOutcome(id); }} onEnd={() => setDraggingOutcome(null)} onMove={moveOutcome} onOpen={onOpenOutcome} />{outcomeLifecycleSummary(outcome.lifecycle) && <small className="outcome-lifecycle-summary">{outcomeLifecycleSummary(outcome.lifecycle)}</small>}</div> : <label key={outcome.id}>{outcome.title}{outcomeLifecycleSummary(outcome.lifecycle) && <small className="outcome-lifecycle-summary">{outcomeLifecycleSummary(outcome.lifecycle)}</small>}<select disabled={busy} value="" aria-label={`Assign ${outcome.title} to stream`} onChange={(event) => void save({ type: "outcomeAssignment", outcomeId: outcome.id, streamId: event.target.value }, `${outcome.title} assigned to ${state.streams.find((stream) => stream.id === event.target.value)?.name}.`)}><option value="">Choose stream…</option>{state.streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}</select></label>)}{!unassignedOutcomes.length && <p className="empty">All outcomes are assigned to streams.</p>}</div>}
    <StreamManager refreshKey={refreshKey} onChanged={() => { void load(); onChanged?.(); }} />
    {state.roadmapPlanningMigrated ? <RoadmapTriage state={state} card={card} drop={dropTarget} /> : <div className="board-shelves priority-shelf"><div>{dropTarget(null, true, null, "Drop into Needs assignment")}
      <details id="unassigned-work" className="stream-lane lane-packages" open={unassigned.length > 0}><summary>Needs assignment <span className="count">{unassigned.length}</span></summary><p>Selected demand stays visible; a required outcome has no credible date until assigned.</p>{queue(unassigned, null, true)}{!unassigned.length && <p className="empty">No selected work waiting for a stream.</p>}</details></div></div>}
    <div className="board-config-row"><details id="cycle-calendar-settings" className="board-settings" aria-label="Linear cycle calendar"><summary>Linear cycles and cycle-wide overrides <span>{futureCycles.length} imported · {projectedCount} projected</span></summary><div className="section-head"><h3>Linear cycle calendar</h3><button type="button" className="secondary" disabled={busy || !state.connection} onClick={() => void refreshCycles()}>Refresh Linear cycles</button></div>
      <p>View the cycle dates imported from Linear and override availability or reserve for entire cycles. For holidays or changes to specific weeks, use <button className="text-button" onClick={() => onOpenSettings({ section: "availability", focusField: true })}>Weekly availability and holidays</button> in Settings. Week settings take precedence over cycle availability on overlapping dates.</p>
      <p>{state.connection?.team_name || "Connected team"} · {state.connection?.cycles_enabled ? `${state.connection.cycle_duration ?? "?"} week cycle${state.connection.cycle_duration === 1 ? "" : "s"}` : "Cycles are not enabled in Linear"} · {currentCycle ? `currently ${linearCycleLabel(currentCycle)} (${cycleRange(currentCycle)}) · ` : "between cycles · "}{futureCycles.length} upcoming imported{state.connection?.upcoming_cycle_count ? ` (Linear configured for ${state.connection.upcoming_cycle_count})` : ""}</p>
      {state.calendarProjection?.reason && <p className="warning">{state.calendarProjection.reason}</p>}
      {!!calendarCycles.length ? <CycleCalendar cycles={calendarCycles} timezone={state.timezone} sourceAt={state.cycleAnchorAt} selectedIds={adjustment.selectedCycleIds} onToggle={(id) => setAdjustment((old) => ({ ...old, selectedCycleIds: old.selectedCycleIds.includes(id) ? old.selectedCycleIds.filter((value) => value !== id) : [...old.selectedCycleIds, id] }))} /> : <p className="warning">No dated cycles are available. Sync the Linear calendar and cycle configuration.</p>}
      <div className="board-subform"><h3>Whole-cycle capacity override</h3><p>Select a date above to choose its entire Linear cycle. Select more than one cycle to apply the same availability and reserve to each.</p>
        <div className="calendar-selection">{adjustment.selectedCycleIds.map((id) => { const cycle = state.linearCycles.find((item) => item.id === id); return <span key={id}>{cycle ? linearCycleLabel(cycle) : "Unknown cycle"}</span>; })}{!adjustment.selectedCycleIds.length && <span>No cycles selected</span>}</div>
        <div className="board-fields"><label>Availability %<input type="number" min="0" max="100" value={adjustment.availability} onChange={(event) => setAdjustment({ ...adjustment, availability: event.target.value })} /></label><label>Reserve override<input type="number" min="0" step="0.001" value={adjustment.reserve} onChange={(event) => setAdjustment({ ...adjustment, reserve: event.target.value })} placeholder="Base reserve" /></label></div>
        <div className="actions"><button type="button" className="secondary" disabled={busy || !adjustment.selectedCycleIds.length} onClick={() => void save({ type: "adjustment", cycleIds: adjustment.selectedCycleIds, availability: Number(adjustment.availability) / 100, reserve: adjustment.reserve === "" ? null : Number(adjustment.reserve) }, "Cycle exception saved.")}>Apply to selected cycles</button><button type="button" className="quiet" disabled={busy || !adjustment.selectedCycleIds.length} onClick={() => void save({ type: "adjustment", action: "clear", cycleIds: adjustment.selectedCycleIds }, "Cycle exceptions cleared.")}>Clear selected exceptions</button></div>
        {state.adjustments.filter((item) => state.futureCycleIds.includes(item.linear_cycle_id)).map((item) => <p className="meta" key={item.linear_cycle_id}>{linearCycleLabel(item)} · {cycleRange({ id: item.linear_cycle_id, number: item.number, name: item.name, startsAt: item.starts_at, endsAt: item.ends_at })}: {Math.round(item.availability * 100)}% availability · reserve {item.reserve ?? "base"}</p>)}
        {!!state.adjustments.filter((item) => !state.futureCycleIds.includes(item.linear_cycle_id)).length && <p className="warning">Some saved exceptions refer to cycles no longer upcoming in Linear. They remain saved but are excluded from the forecast.</p>}
        {!!state.legacyAdjustments.length && <p className="warning">{state.legacyAdjustments.length} old relative-cycle exception{state.legacyAdjustments.length === 1 ? "" : "s"} could not be matched to a Linear cycle. Select the intended weeks above to reapply them.</p>}
      </div>
    </details></div>
    {!state.roadmapPlanningMigrated && <div className="board-shelves"><div>{dropTarget(null, false, null, "Drop into Deferred")}<details id="deferred-work" className="stream-lane deferred lane-packages"><summary>Deferred <span className="count">{deferred.length}</span></summary><p>Paused work consumes no future capacity. In-progress work must also be paused in Linear separately.</p>{queue(deferred, null, false)}{!deferred.length && <p className="empty">No deferred work.</p>}</details></div></div>}
    <span id="dependency-settings" className="anchor-target" />
    <details className="board-settings"><summary>Dependencies</summary><p>“Blocked by” means the predecessor must finish in a previous cycle. Local links stay in Oh, WAWD!.</p><div className="board-fields"><label>Blocking package<select value={dependency.predecessorId} onChange={(event) => setDependency({ ...dependency, predecessorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Blocked package<select value={dependency.successorId} onChange={(event) => setDependency({ ...dependency, successorId: event.target.value })}><option value="">Choose…</option>{state.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><button disabled={busy || !dependency.predecessorId || !dependency.successorId} onClick={() => void save({ type: "dependency", action: "add", ...dependency }, "Dependency saved.")}>Add dependency</button><ul className="dependency-list">{state.dependencies.map((edge) => <li key={`${edge.source}:${edge.predecessor_id}:${edge.successor_id}`}><span>{state.packages.find((item) => item.id === edge.predecessor_id)?.name || edge.predecessor_id} → {state.packages.find((item) => item.id === edge.successor_id)?.name || edge.successor_id} · {edge.source}{edge.waived ? ` · waived: ${edge.waiver_reason}` : ""}</span>{edge.source === "local" && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "remove", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Dependency removed.")}>Remove</button>}{edge.source === "linear" && !edge.waived && <button className="text-button" disabled={busy} onClick={() => { const reason = window.prompt("Reason for waiving this Linear dependency in the forecast?"); if (reason) void save({ type: "dependency", action: "waive", predecessorId: edge.predecessor_id, successorId: edge.successor_id, reason }, "Linear dependency waived in this plan."); }}>Waive</button>}{edge.source === "linear" && edge.waived && <button className="text-button" disabled={busy} onClick={() => void save({ type: "dependency", action: "restore", predecessorId: edge.predecessor_id, successorId: edge.successor_id }, "Linear dependency restored.")}>Restore</button>}</li>)}</ul></details>
    <details className="board-settings"><summary>Cycle-by-cycle explanation</summary><p>Linear source as of {new Date(result.sourceAt).toLocaleString()} · cycle position checked {new Date(state.cycleAnchorAt).toLocaleString()} · dates in {state.timezone}. Unused stream budget does not move to another stream.</p><div className="cycle-table-wrap" role="region" aria-label="Cycle capacity details. Scroll horizontally to view every stream." tabIndex={0}><table className="cycle-table"><thead><tr><th>Linear cycle</th><th>Team available</th>{state.streams.map((item) => <th key={item.id}>{item.name}</th>)}</tr></thead><tbody>{result.cycles.map((cycle) => <tr key={cycle.id}><th>{linearCycleLabel(cycle)}<small>{cycle.start} – {cycle.end}</small></th><td>{fmt(cycle.available)} pts</td>{state.streams.map((stream) => { const usage = cycle.streams.find((item) => item.id === stream.id); return <td key={stream.id}>{fmt(usage?.used || 0)} / {fmt(usage?.budget || 0)} pts<small>{usage?.active.map((id) => state.packages.find((item) => item.id === id)?.name || id).join(", ") || "Idle"}</small></td>; })}</tr>)}</tbody></table></div></details>
  </section>;
}
