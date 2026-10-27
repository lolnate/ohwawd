"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Board, { type BoardState } from "./board";
import { apiRequest } from "./client-api";
import ScenarioPanel from "./scenario-panel";
import StatusFilter from "./status-filter";
import OutcomeCatalog, { focusOutcomeSection, type CatalogContext } from "./outcome-catalog";
import WorkspaceSettings, { type SettingsRequest, type SettingsTarget } from "./workspace-settings";
import OutcomeWorkspace, { type OutcomeRequest } from "./outcome-workspace";
import type { OutcomeMove } from "./outcome-board-controls";
import type { RoadmapConversion, StoredRoadmapFields } from "@/lib/roadmap-planning";
import type { OutcomeLifecycle } from "@/lib/outcome-completion";
import { mergeOutcomeSnapshot } from "./outcome-lifecycle-view";
import DismissibleMessage from "./dismissible-message";

type Team = { id: string; name: string; key: string };
type Project = Partial<StoredRoadmapFields> & { id: string; name: string; description: string; status: string; url: string; cross_team: boolean; needs_review: boolean; in_scope: boolean; package_id: string; stream_id: string | null; capacity_outcome_id: string | null; issue_count: number; unestimated_open_issues: number; estimated_open_points: number };
type OutcomeFields = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null };
type Outcome = OutcomeFields & { stream_id: string | null; stream_position?: number | null; created_at: string; lifecycle?: OutcomeLifecycle };
type Link = { outcome_id: string; project_id: string; requirement: "minimum" | "optional" };
type State = { connection: { viewer_name: string; team_id: string; team_name: string; last_imported_at: string } | null; projects: Project[]; outcomes: Outcome[]; links: Link[]; streams: { id: string; name: string }[]; timezone: string;
  roadmapPlanningMigrated?: boolean; roadmapConversionFeedback?: (RoadmapConversion & { packageId: string })[]; planningToken?: string };
type Preview = { id: string; name: string; status: string };
type ProjectSyncItem = { id: string; name: string; previousName?: string; changes: string[] };
type ImportResult = { imported: number; report: { newProjects: ProjectSyncItem[]; updatedProjects: ProjectSyncItem[]; newlyMissingProjects: ProjectSyncItem[]; unchangedProjects: number; stillMissingProjects: number } };

function isCurrentOrFutureProjectStatus(status: string): boolean {
  const normalized = status.trim().toLocaleLowerCase().replace(/[\s_-]+/g, " ");
  return ["backlog", "todo", "to do", "planned", "in progress", "started", "active"].includes(normalized);
}

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return apiRequest<T>(path, method, body);
}

function SyncReport({ report }: { report: ImportResult["report"] }) {
  return <section className="sync-report" aria-label="Linear sync changes">
    <div className="sync-summary"><span><strong>{report.newProjects.length}</strong> new</span><span><strong>{report.updatedProjects.length}</strong> updated</span><span><strong>{report.unchangedProjects}</strong> unchanged</span><span><strong>{report.newlyMissingProjects.length}</strong> newly missing</span></div>
    {report.newProjects.length > 0 && <details open><summary>New projects</summary><ul>{report.newProjects.map((project) => <li key={project.id}><span>{project.name}</span><code>{project.id}</code></li>)}</ul></details>}
    {report.updatedProjects.length > 0 && <details open><summary>Updated projects</summary><ul>{report.updatedProjects.map((project) => <li key={project.id}><span>{project.previousName ? `${project.previousName} → ${project.name}` : project.name}<small>{project.changes.join(", ")}</small></span><code>{project.id}</code></li>)}</ul></details>}
    {report.newlyMissingProjects.length > 0 && <details open><summary>Not found in this sync</summary><p>These projects were retained and marked for review, so their planning links remain intact.</p><ul>{report.newlyMissingProjects.map((project) => <li key={project.id}><span>{project.name}</span><code>{project.id}</code></li>)}</ul></details>}
    {report.stillMissingProjects > 0 && <p className="meta">{report.stillMissingProjects} previously missing {report.stillMissingProjects === 1 ? "project remains" : "projects remain"} marked for review.</p>}
  </section>;
}

export default function App() {
  const [activeView, setActiveView] = useState<"board" | "outcomes" | "projects" | "scenarios">("board");
  const [settingsRequest, setSettingsRequest] = useState<SettingsRequest | null>(null);
  const settingsRequestId = useRef(0);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [stateError, setStateError] = useState("");
  const [boardVersion, setBoardVersion] = useState(0);
  const [deliveryBoard, setDeliveryBoard] = useState<BoardState | null>(null);
  const [boardUpdate, setBoardUpdate] = useState<BoardState | null>(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [boardFocus, setBoardFocus] = useState<{ id: string; request: number; inspect?: boolean } | null>(null);
  const [key, setKey] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [error, setError] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [activity, setActivity] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcomeRequest, setOutcomeRequest] = useState<OutcomeRequest | null>(null);
  const outcomeGeneration = useRef(0);
  const [catalogContext, setCatalogContext] = useState<CatalogContext>({ ids: [], clear: () => {} });
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatuses, setProjectStatuses] = useState<string[]>([]);
  const [candidateProjectStatuses, setCandidateProjectStatuses] = useState<string[] | null>(null);
  const [projectPreset, setProjectPreset] = useState<"needs" | "active" | "completed" | "hidden" | "all" | "dismissed">("needs");
  const [projectSort, setProjectSort] = useState<"planning" | "name" | "status" | "points">("planning");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [syncReport, setSyncReport] = useState<ImportResult["report"] | null>(null);
  const reloadGeneration = useRef(0);
  const handleBoardStateChange = useCallback((board: BoardState | null, error: string) => {
    setDeliveryBoard(board); setDeliveryError(error);
  }, []);

  function openSettings(target: SettingsTarget = { section: "capacity" }) {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSettingsRequest({ ...target, id: ++settingsRequestId.current, opener: target.opener === undefined ? active : target.opener });
  }

  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current;
    try {
      const data = await api<State>("/api/state");
      if (generation !== reloadGeneration.current) return;
      setError("");
      setStateError("");
      setState(data);
      setBoardVersion((version) => version + 1);
      if (data.connection) setTeamId(data.connection.team_id);
    } catch (failure) {
      if (generation === reloadGeneration.current) {
        setStateError(failure instanceof Error ? failure.message : "Workspace data is unavailable.");
        throw failure;
      }
    }
  }, []);

  const settingsChanged = useCallback(async (board: BoardState) => {
    setDeliveryBoard(board); setBoardUpdate(board);
    try { await reload(); }
    catch (reason) {
      // The planning write succeeded even if the separate workspace read failed.
      setBoardVersion((version) => version + 1);
      setError("Settings were saved, but workspace views could not be refreshed.");
      throw reason;
    }
  }, [reload]);

  const refreshOutcomes = useCallback(async () => {
    try { await reload(); }
    catch (reason) {
      // Outcome persistence also affects delivery even when definitions cannot
      // be read. Board keeps its own last-good data and refresh feedback.
      setBoardVersion((version) => version + 1);
      throw reason;
    }
  }, [reload]);

  useEffect(() => {
    api<{ authenticated: boolean }>("/api/session").then(async ({ authenticated }) => {
      setSignedIn(authenticated);
      if (authenticated) await reload();
    }).catch((reason) => setError(reason.message));
  }, [reload]);

  async function run(action: () => Promise<void>, progress = "", sourceAction = false) {
    setBusy(true); setError(""); setSourceError(""); setNotice(""); setActivity(progress);
    try { await action(); } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Something went wrong";
      if (sourceAction) setSourceError(message); else setError(message);
    }
    finally { setBusy(false); setActivity(""); }
  }

  function login(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await api("/api/session", "POST", { password });
      setPassword(""); setSignedIn(true); await reload();
    });
  }

  async function inspect(chosenTeamId?: string) {
    const data = await api<{ teams: Team[]; projects?: Preview[] }>(
      "/api/linear/inspect", "POST", { apiKey: key || undefined, teamId: chosenTeamId },
    );
    setTeams(data.teams);
    if (data.projects) setPreview(data.projects);
    else { setPreview(null); if (data.teams.length === 1) setTeamId(data.teams[0].id); }
  }

  function openOutcomeCatalog() {
    setActiveView("outcomes");
    window.requestAnimationFrame(() => {
      focusOutcomeSection("catalog");
    });
  }

  function openProjectNeedsAssignment() {
    setActiveView("outcomes");
    window.requestAnimationFrame(() => focusOutcomeSection("needs-assignment"));
  }

  function inspectProjectOnBoard(id: string) {
    setActiveView("board"); setBoardFocus((previous) => ({ id, request: (previous?.request ?? 0) + 1, inspect: true }));
  }
  function openBoardOutcome(id: string, opener: HTMLElement | null, fallbackId: string, section: "details" | "projects" = "details") {
    const generation = ++outcomeGeneration.current;
    const open = () => { if (generation === outcomeGeneration.current && !document.querySelector("dialog[open]")) setOutcomeRequest({ generation, id, opener, fallback: "catalog", fallbackId, section }); };
    if (state?.outcomes.some((outcome) => outcome.id === id)) open();
    else void reload().then(open).catch(() => setError("Could not load saved outcome definitions. Retry the workspace refresh before opening this outcome."));
  }

  function inspectOutcome(outcome: OutcomeFields, fallback: "catalog" | "delivery" = "catalog") {
    setOutcomeRequest({ generation: ++outcomeGeneration.current, id: outcome.id, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null, fallback });
  }

  function startAddingOutcome() {
    setOutcomeRequest({ generation: ++outcomeGeneration.current, id: null, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null, fallback: "catalog" });
  }

  async function setProjectScope(project: Project): Promise<void> {
    await api(`/api/projects/${encodeURIComponent(project.id)}/scope`, "PUT", { inScope: !project.in_scope });
    await reload();
    setNotice(project.in_scope ? "Project hidden from planning lists. Existing outcome links remain." : "Project restored to planning lists.");
  }

  async function setProjectsScope(projectIds: string[], inScope: boolean): Promise<void> {
    await api("/api/projects/scope", "PUT", { projectIds, inScope });
    setSelectedProjectIds([]);
    await reload();
    setNotice(`${projectIds.length} project${projectIds.length === 1 ? "" : "s"} ${inScope ? "restored to" : "hidden from"} planning lists.`);
  }

  async function moveOutcome(move: OutcomeMove): Promise<void> {
    if (!deliveryBoard) throw new Error("Board planning data is not available. Refresh the Board and try again.");
    try {
      const board = await api<BoardState>("/api/board", "PUT", { type: "outcomeAssignment", ...move, sequenceToken: deliveryBoard.sequenceToken, ownershipToken: deliveryBoard.ownershipToken, planningToken: deliveryBoard.planningToken });
      setDeliveryBoard(board); setBoardUpdate(board); await reload();
    } catch (reason) {
      try { const board = await api<BoardState>("/api/board"); setDeliveryBoard(board); setBoardUpdate(board); }
      catch { /* Retain the last good Board while reporting the original write failure. */ }
      throw reason;
    }
  }

  function acceptOutcome(outcome: Outcome, links?: Record<string, "minimum" | "optional">, planningToken?: string) {
    setState((current) => current && ({ ...current, planningToken: planningToken ?? current.planningToken,
      outcomes: current.outcomes.some((item) => item.id === outcome.id) ? current.outcomes.map((item) => item.id === outcome.id ? mergeOutcomeSnapshot(item, outcome) : item) : [...current.outcomes, outcome],
      links: links ? [...current.links.filter((link) => link.outcome_id !== outcome.id), ...Object.entries(links).map(([project_id, requirement]) => ({ outcome_id: outcome.id, project_id, requirement }))] : current.links }));
    if (outcome.lifecycle) setDeliveryBoard((current) => {
      if (!current?.outcomes.some((item) => item.id === outcome.id)) return current;
      const next = { ...current, outcomes: current.outcomes.map((item) => item.id === outcome.id ? { ...item, lifecycle: outcome.lifecycle } : item) };
      setBoardUpdate(next); return next;
    });
  }

  const statuses = [...new Set(state?.projects.map((project) => project.status) ?? [])].sort();
  const statusKey = statuses.join("\0");
  useEffect(() => {
    setProjectStatuses((current) => current.filter((status) => statuses.includes(status)));
  }, [statusKey]);
  const terminalProject = (project: Project) => /completed|done|finished|canceled|cancelled/i.test(project.status);
  const activeProject = (project: Project) => !terminalProject(project) && (!state?.roadmapPlanningMigrated || project.roadmap_state === "included") && (!!project.stream_id || /started|active|in progress/i.test(project.status));
  const needsPlanning = (project: Project) => project.in_scope && !terminalProject(project) && (!state?.roadmapPlanningMigrated || !["deferred", "dismissed"].includes(project.roadmap_state ?? "")) && (project.needs_review || !project.stream_id || project.unestimated_open_issues > 0);
  const presetMatches = (project: Project) => projectPreset === "needs" ? needsPlanning(project) : projectPreset === "active" ? project.in_scope && activeProject(project) : projectPreset === "completed" ? project.in_scope && terminalProject(project) : projectPreset === "hidden" ? !project.in_scope : projectPreset === "dismissed" ? project.in_scope && project.roadmap_state === "dismissed" : project.in_scope;
  const visibleProjects = (state?.projects.filter((project) =>
    presetMatches(project) &&
    (!projectStatuses.length || projectStatuses.includes(project.status)) &&
    project.name.toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase()),
  ) ?? []).sort((left, right) => projectSort === "name" ? left.name.localeCompare(right.name) : projectSort === "status" ? left.status.localeCompare(right.status) || left.name.localeCompare(right.name) : projectSort === "points" ? right.estimated_open_points - left.estimated_open_points || left.name.localeCompare(right.name) : Number(right.needs_review) - Number(left.needs_review) || right.unestimated_open_issues - left.unestimated_open_issues || Number(!right.stream_id) - Number(!left.stream_id) || left.name.localeCompare(right.name));
  const hiddenCount = state?.projects.filter((project) => !project.in_scope).length ?? 0;
  const candidateProjects = state?.roadmapPlanningMigrated ? state.projects.filter((project) => project.roadmap_state === "candidate").sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)) : [];
  const candidateStatuses = [...new Set(candidateProjects.map((project) => project.status))].sort();
  const candidateStatusKey = candidateStatuses.join("\0");
  useEffect(() => {
    setCandidateProjectStatuses((current) => current?.filter((status) => candidateStatuses.includes(status)) ?? null);
  }, [candidateStatusKey]);
  const selectedCandidateStatuses = candidateProjectStatuses ?? candidateStatuses.filter(isCurrentOrFutureProjectStatus);
  const visibleCandidateProjects = candidateProjects.filter((project) => selectedCandidateStatuses.includes(project.status));
  const presetCounts = { needs: state?.projects.filter(needsPlanning).length ?? 0, active: state?.projects.filter((project) => project.in_scope && activeProject(project)).length ?? 0, completed: state?.projects.filter((project) => project.in_scope && terminalProject(project)).length ?? 0, hidden: hiddenCount, all: state?.projects.filter((project) => project.in_scope).length ?? 0, dismissed: state?.projects.filter((project) => project.in_scope && project.roadmap_state === "dismissed").length ?? 0 };
  const allVisibleSelected = visibleProjects.length > 0 && visibleProjects.every((project) => selectedProjectIds.includes(project.id));

  if (signedIn === null) return <main className="shell"><p>Opening workspace…</p></main>;
  if (!signedIn) return <main className="shell auth"><div className="brand">Oh, WAWD!</div><h1>Your private planning space</h1><p>Sign in as the workspace owner.</p><form onSubmit={login}><label>Owner password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button disabled={busy}>Sign in</button></form>{error && <p className="error" role="alert">{error}</p>}</main>;

  return <main className="shell workspace-shell">
    <header className="app-header"><div className="app-brand"><div className="brand-mark">W</div><div><div className="brand">Oh, WAWD!</div><p>What are we doing, and when?</p></div></div><nav className="app-tabs" aria-label="Workspace views">{([['board','Board'],['outcomes','Outcomes'],['projects','Linear projects'],['scenarios','Scenarios']] as const).map(([id, label]) => <button key={id} className={activeView === id ? "app-tab active" : "app-tab"} aria-current={activeView === id ? "page" : undefined} onClick={() => setActiveView(id)}>{label}{id === "outcomes" && state?.outcomes.length ? <span>{state.outcomes.length}</span> : null}{id === "projects" && state?.projects.length ? <span>{state.projects.length}</span> : null}</button>)}</nav><div className="header-actions"><span className="source-freshness">{state?.connection ? `${state.connection.team_name} · ${new Date(state.connection.last_imported_at).toLocaleDateString()}` : "Linear not connected"}</span>
      <button id="workspace-settings-button" type="button" className="quiet workspace-settings-trigger" aria-label="Settings" title="Settings" aria-haspopup="dialog" onClick={() => openSettings()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9-2.1-.7-2 3.5L4 10.6v2.8L2.3 15l2 3.5 2.1-.7 2 .9L9 21h4l.6-2.3 2-.9 2.1.7 2-3.5-1.7-1.6v-2.8L19.7 9l-2-3.5-2.1.7-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/></svg>
      </button>
      <button className="quiet" onClick={() => void run(async () => { await api("/api/session", "DELETE"); setSignedIn(false); setState(null); })}>Sign out</button></div></header>
    <section className="view-heading"><div><p className="eyebrow">{activeView === "board" ? "Sequencing and forecast" : activeView === "outcomes" ? "Product intent" : activeView === "projects" ? "Execution source" : "Decision history"}</p><h1>{activeView === "board" ? "Sequencing board" : activeView === "outcomes" ? "Outcomes" : activeView === "projects" ? "Linear projects" : "Decision scenarios"}</h1><p>{activeView === "board" ? "See target risk, capacity, and parallel work without leaving the planning surface." : activeView === "outcomes" ? "Create, edit, and connect desired results to the work required for delivery." : activeView === "projects" ? "Import, search, review, and curate the Linear work available to planning." : "Save alternatives, publish decisions, and compare what changed the forecast."}</p></div>{activeView === "outcomes" && <button type="button" disabled={!state} onClick={startAddingOutcome}>Add outcome</button>}</section>
    {error && <DismissibleMessage kind="error" onDismiss={() => setError("")}>{error}</DismissibleMessage>}{notice && <DismissibleMessage kind="notice" onDismiss={() => setNotice("")}>{notice}</DismissibleMessage>}
    <section className="workspace-view" hidden={activeView !== "projects"}><details className="panel source-panel" open={!state?.connection}><summary><div><strong>Linear source</strong><small>{state?.connection ? `${state.connection.team_name} · connected as ${state.connection.viewer_name} · last imported ${new Date(state.connection.last_imported_at).toLocaleString()}` : "Connect an API key to preview one team."}</small></div><span className="tag">Read only</span></summary>
      <div className="connect-grid"><label>{state?.connection ? "Rotate key (optional)" : "Linear API key"}<input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder={state?.connection ? "Use saved key" : "lin_api_…"} /></label><button disabled={busy || (!key && !state?.connection)} onClick={() => void run(() => inspect(), "Checking Linear access…", true)}>Check access</button></div>
      {teams.length > 0 && <div className="connect-grid"><label>Team<select value={teamId} disabled={!!state?.connection} onChange={(event) => { setTeamId(event.target.value); setPreview(null); }}><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.key})</option>)}</select></label><button disabled={busy || !teamId} onClick={() => void run(() => inspect(teamId), "Loading the project list from Linear…", true)}>{busy && activity.includes("project list") ? "Loading projects…" : "Preview projects"}</button></div>}
      {state?.connection && teams.length === 0 && <button className="secondary" disabled={busy} onClick={() => void run(() => inspect(teamId), "Loading the project list from Linear…", true)}>Preview saved team again</button>}
      {activity && <p className="notice" role="status" aria-live="polite">{activity}</p>}
      {sourceError && <p className="error" role="alert">{sourceError}</p>}
      {preview && <div className="preview"><h3>Import preview · {preview.length} projects</h3><p>All project states are included. Issue estimates and cross-team work are checked during import.</p><div className="preview-list">{preview.map((project) => <div key={project.id}><span>{project.name}</span><small>{project.status}</small></div>)}</div><button disabled={busy} onClick={() => void run(async () => { setSyncReport(null); const result = await api<ImportResult>("/api/linear/import", "POST", { apiKey: key || undefined, teamId }); setKey(""); setPreview(null); setSyncReport(result.report); await reload(); setNotice(`${result.imported} projects imported. Existing outcome links were preserved.`); }, "Importing projects and issues from Linear…", true)}>Import these projects</button></div>}
    </details>
    <section className="panel projects-panel">
      <div className="section-head"><div><h2>Imported projects</h2><p>Linear project IDs stay stable when names and other fields change, preserving planning assignments.</p></div><div className="actions"><span className="count">{state?.projects.length ?? 0}</span><button className="secondary" disabled={busy || !state?.connection} onClick={() => void run(async () => { setSyncReport(null); const result = await api<ImportResult>("/api/linear/import", "POST", { teamId: state!.connection!.team_id }); setSyncReport(result.report); await reload(); setNotice(`${result.imported} projects synced from Linear. Local planning choices and outcome links were preserved.`); }, "Syncing projects, issues, dependencies, and cycles from Linear…")}>Sync Linear</button></div></div>
      {syncReport && <SyncReport report={syncReport} />}
      <div className="project-presets" role="group" aria-label="Project triage view">{([['needs','Needs planning'],['active','Active'],['completed','Completed'],['hidden','Hidden'],['all','All visible']] as const).map(([id, label]) => <button key={id} className={projectPreset === id ? "active" : ""} aria-pressed={projectPreset === id} onClick={() => { setProjectPreset(id); setSelectedProjectIds([]); }}>{label}<span>{presetCounts[id]}</span></button>)}{state?.roadmapPlanningMigrated && <button aria-pressed={projectPreset === "dismissed"} className={projectPreset === "dismissed" ? "active" : ""} onClick={() => { setProjectPreset("dismissed"); setSelectedProjectIds([]); }}>Dismissed<span>{presetCounts.dismissed}</span></button>}</div>
      <div className="project-filters">
        <label>Search<input type="search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Project name" /></label>
        <StatusFilter statuses={statuses} selected={projectStatuses} onChange={setProjectStatuses} />
        <label>Sort<select value={projectSort} onChange={(event) => setProjectSort(event.target.value as typeof projectSort)}><option value="planning">Planning attention</option><option value="name">Project name</option><option value="status">Linear status</option><option value="points">Open points</option></select></label>
      </div>
      <p className="meta project-result-summary"><strong>{visibleProjects.length} results</strong> · {projectPreset === "needs" ? "Needs planning" : projectPreset === "active" ? "Active" : projectPreset === "completed" ? "Completed or canceled" : projectPreset === "hidden" ? "Hidden" : projectPreset === "dismissed" ? "Dismissed from roadmap" : "All visible"}{projectStatuses.length ? ` · ${projectStatuses.length} status ${projectStatuses.length === 1 ? "filter" : "filters"}` : " · all statuses"}{projectSearch.trim() ? ` · search “${projectSearch.trim()}”` : ""}. Hide work without removing it from Linear or existing outcomes.{state?.roadmapPlanningMigrated ? " Plan on Board for explicit inclusion, deferral or off-roadmap dismissal." : ""}</p>
      <div className="project-bulk"><label><input type="checkbox" checked={allVisibleSelected} onChange={(event) => setSelectedProjectIds((current) => event.target.checked ? [...new Set([...current, ...visibleProjects.map((project) => project.id)])] : current.filter((id) => !visibleProjects.some((project) => project.id === id)))} />Select all {visibleProjects.length} results</label><span>{selectedProjectIds.length} selected</span><button className="secondary" disabled={busy || !selectedProjectIds.length} onClick={() => void run(() => setProjectsScope(selectedProjectIds, projectPreset === "hidden"))}>{projectPreset === "hidden" ? "Restore selected" : "Hide selected"}</button>{!!selectedProjectIds.length && <button className="quiet" disabled={busy} onClick={() => setSelectedProjectIds([])}>Clear</button>}</div>
      <div className="project-table-list">{visibleProjects.map((project) => <article className={`project-row${terminalProject(project) ? " terminal" : ""}${selectedProjectIds.includes(project.id) ? " selected" : ""}`} key={project.id}>
        <label className="project-select"><input type="checkbox" checked={selectedProjectIds.includes(project.id)} onChange={(event) => setSelectedProjectIds((current) => event.target.checked ? [...current, project.id] : current.filter((id) => id !== project.id))} /><span className="sr-only">Select {project.name}</span></label><div><a href={project.url} target="_blank" rel="noreferrer">{project.name} ↗</a><p>{project.issue_count} issues · {project.estimated_open_points} known open points{project.unestimated_open_issues ? ` · ${project.unestimated_open_issues} unestimated` : ""}{state?.roadmapPlanningMigrated ? ` · ${project.roadmap_state}` : project.stream_id ? " · stream assigned" : " · needs assignment"}</p>{project.cross_team && <span className="inline-warning">Cross-team</span>}{project.needs_review && <span className="inline-warning">Needs review</span>}</div><span className="tag">{project.status}</span>{state?.roadmapPlanningMigrated ? <div className="project-row-actions"><button className="text-button" onClick={() => inspectProjectOnBoard(project.package_id)}>Plan on Board</button><button className="text-button" disabled={busy} onClick={() => void run(() => setProjectScope(project))}>{project.in_scope ? "Hide" : "Restore"}</button></div> : <button className="text-button" disabled={busy} onClick={() => void run(() => setProjectScope(project))}>{project.in_scope ? "Hide" : "Restore"}</button>}
      </article>)}
      {!visibleProjects.length && <p className="empty">{state?.projects.length ? "No projects match these filters." : "Projects will appear here after import."}</p>}</div>
    </section></section>
    <section className="workspace-view" hidden={activeView !== "scenarios"}><ScenarioPanel onActivated={reload} onOpenBoard={() => setActiveView("board")} refreshKey={boardVersion} /></section>
    <section className="workspace-view" hidden={activeView !== "board"}><Board refreshKey={boardVersion} updatedState={boardUpdate} onChanged={() => void reload()} onOpenProjects={() => setActiveView("projects")} onOpenOutcome={openBoardOutcome}
      onOpenOutcomes={openOutcomeCatalog} onOpenNeedsAssignment={openProjectNeedsAssignment} onOpenSettings={openSettings} onStateChange={handleBoardStateChange} focusProject={boardFocus} /></section>
    <section className="workspace-view" hidden={activeView !== "outcomes"}>
      <nav className="outcome-section-nav" aria-label="Outcome sections"><a href="#outcome-catalog" onClick={(event) => { event.preventDefault(); focusOutcomeSection("catalog"); }}>Outcome catalog</a>{state?.roadmapPlanningMigrated && <a href="#outcome-needs-assignment" onClick={(event) => { event.preventDefault(); focusOutcomeSection("needs-assignment"); }}>Projects without outcomes</a>}</nav>
      <OutcomeCatalog data={state} error={stateError} forecast={deliveryBoard?.forecast ?? null} forecastError={deliveryError} busy={busy} onRetry={() => void run(reload)} onAdd={startAddingOutcome} onInspect={inspectOutcome} onContext={setCatalogContext} />
      {state?.roadmapPlanningMigrated && <section className="panel project-assignment-panel" id="outcome-needs-assignment" aria-labelledby="outcome-needs-assignment-title">
        <div className="section-head"><div><h2 id="outcome-needs-assignment-title" tabIndex={-1}>Projects without outcomes</h2><p>Candidate projects without an owning outcome are excluded from the roadmap until explicitly included.</p></div><span className="count">{visibleCandidateProjects.length}</span></div>
        <div className="project-assignment-controls"><StatusFilter label="Project status" statuses={candidateStatuses} selected={selectedCandidateStatuses} onChange={setCandidateProjectStatuses} emptyMeansAll={false} /><p className="meta" role="status">{visibleCandidateProjects.length} of {candidateProjects.length} projects · Change the status filter to review paused, completed, or other candidate work.</p></div>
        <ul className="project-assignment-list">{visibleCandidateProjects.map((project) => { const linkCount = state.links.filter((link) => link.project_id === project.id).length; return <li key={project.id}><article>
          <div><h3>{project.url ? <a href={project.url} target="_blank" rel="noreferrer">{project.name} ↗</a> : project.name}</h3><p>No owning outcome · {linkCount} linked outcome{linkCount === 1 ? "" : "s"}{!project.in_scope ? " · Hidden" : ""}{project.needs_review ? " · Needs review" : ""}</p></div>
          <span className="tag">{project.status}</span><button type="button" className="secondary" onClick={() => inspectProjectOnBoard(project.package_id)}>Assign outcome</button>
        </article></li>; })}</ul>
        {!candidateProjects.length ? <p className="empty">All candidate projects have an owning outcome.</p> : !visibleCandidateProjects.length && <p className="empty">No projects without outcomes match the selected statuses.</p>}
      </section>}
    </section>
    <WorkspaceSettings request={settingsRequest} onClose={() => setSettingsRequest(null)} onChanged={settingsChanged} />
    <OutcomeWorkspace request={outcomeRequest} data={state} planning={deliveryBoard} context={catalogContext} onMoveOutcome={moveOutcome} onInspectProject={inspectProjectOnBoard} onClose={() => setOutcomeRequest(null)} onView={(id) => setOutcomeRequest({ generation: ++outcomeGeneration.current, id, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null, fallback: "catalog" })} onRemoved={(id, generation) => {
      if (outcomeRequest?.generation === generation) {
        const index = catalogContext.ids.indexOf(id);
        const next = catalogContext.ids[index + 1] ?? catalogContext.ids[index - 1];
        outcomeRequest.opener = next ? document.getElementById(`outcome-${next}`)?.querySelector<HTMLElement>("button") ?? null : null;
        outcomeRequest.fallback = "catalog";
        setOutcomeRequest(null);
      }
      setState((current) => current && ({ ...current, outcomes: current.outcomes.filter((item) => item.id !== id), links: current.links.filter((link) => link.outcome_id !== id) }));
    }} onAccepted={acceptOutcome} onRefresh={refreshOutcomes} />
    <footer>Private decision proof · Linear stays read only · Published revisions are immutable.</footer>
  </main>;
}
