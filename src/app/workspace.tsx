"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Board from "./board";
import { apiRequest } from "./client-api";
import ScenarioPanel from "./scenario-panel";
import StatusFilter from "./status-filter";

type Team = { id: string; name: string; key: string };
type Project = { id: string; name: string; description: string; status: string; url: string; cross_team: boolean; needs_review: boolean; in_scope: boolean; issue_count: number; unestimated_open_issues: number; estimated_open_points: number };
type Outcome = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null };
type Link = { outcome_id: string; project_id: string; requirement: "minimum" | "optional" };
type State = { connection: { viewer_name: string; team_id: string; team_name: string; last_imported_at: string } | null; projects: Project[]; outcomes: Outcome[]; links: Link[]; streams: { id: string; name: string }[] };
type Preview = { id: string; name: string; status: string };
type ProjectSyncItem = { id: string; name: string; previousName?: string; changes: string[] };
type ImportResult = { imported: number; report: { newProjects: ProjectSyncItem[]; updatedProjects: ProjectSyncItem[]; newlyMissingProjects: ProjectSyncItem[]; unchangedProjects: number; stillMissingProjects: number } };

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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [boardVersion, setBoardVersion] = useState(0);
  const [key, setKey] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [error, setError] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [activity, setActivity] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [newOutcome, setNewOutcome] = useState({ title: "", description: "", owner: "", successSignal: "", neededBy: "" });
  const [showCreateOutcome, setShowCreateOutcome] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<Outcome | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftLinks, setDraftLinks] = useState<Record<string, "minimum" | "optional">>({});
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatuses, setProjectStatuses] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkStatuses, setLinkStatuses] = useState<string[]>([]);
  const [syncReport, setSyncReport] = useState<ImportResult["report"] | null>(null);
  const reloadGeneration = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current;
    try {
      const data = await api<State>("/api/state");
      if (generation !== reloadGeneration.current) return;
      setError("");
      setState(data);
      setBoardVersion((version) => version + 1);
      if (data.connection) setTeamId(data.connection.team_id);
    } catch (failure) {
      if (generation === reloadGeneration.current) throw failure;
    }
  }, []);

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

  function createOutcome(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await api("/api/outcomes", "POST", newOutcome);
      setNewOutcome({ title: "", description: "", owner: "", successSignal: "", neededBy: "" });
      setShowCreateOutcome(false);
      await reload(); setNotice("Outcome created. Link the Linear work it needs.");
    });
  }

  function startLinking(outcome: Outcome) {
    const draft: Record<string, "minimum" | "optional"> = {};
    for (const link of state?.links ?? []) if (link.outcome_id === outcome.id) draft[link.project_id] = link.requirement;
    setDraftLinks(draft); setLinkSearch(""); setLinkStatuses([]); setEditingOutcome(null); setEditing(outcome.id);
  }

  function saveOutcome(event: FormEvent) {
    event.preventDefault();
    if (!editingOutcome) return;
    void run(async () => {
      await api(`/api/outcomes/${editingOutcome.id}`, "PUT", {
        title: editingOutcome.title,
        description: editingOutcome.description,
        owner: editingOutcome.owner,
        successSignal: editingOutcome.success_signal,
        neededBy: editingOutcome.needed_by?.slice(0, 10) || "",
      });
      setEditingOutcome(null);
      await reload();
      setNotice("Outcome updated.");
    });
  }

  function deleteOutcome(outcome: Outcome) {
    if (!window.confirm(`Delete “${outcome.title}” and its project links?`)) return;
    void run(async () => {
      await api(`/api/outcomes/${outcome.id}`, "DELETE");
      if (editing === outcome.id) setEditing(null);
      if (editingOutcome?.id === outcome.id) setEditingOutcome(null);
      await reload();
      setNotice("Outcome deleted.");
    });
  }

  async function saveLinks(outcomeId: string) {
    await api(`/api/outcomes/${outcomeId}/links`, "PUT", {
      links: Object.entries(draftLinks).map(([projectId, requirement]) => ({ projectId, requirement })),
    });
    setEditing(null); await reload(); setNotice("Outcome links saved.");
  }

  async function setProjectScope(project: Project): Promise<void> {
    await api(`/api/projects/${encodeURIComponent(project.id)}/scope`, "PUT", { inScope: !project.in_scope });
    await reload();
    setNotice(project.in_scope ? "Project hidden from planning lists. Existing outcome links remain." : "Project restored to planning lists.");
  }

  const statuses = [...new Set(state?.projects.map((project) => project.status) ?? [])].sort();
  const statusKey = statuses.join("\0");
  useEffect(() => {
    setProjectStatuses((current) => current.filter((status) => statuses.includes(status)));
    setLinkStatuses((current) => current.filter((status) => statuses.includes(status)));
  }, [statusKey]);
  const visibleProjects = state?.projects.filter((project) =>
    (showHidden || project.in_scope) &&
    (!projectStatuses.length || projectStatuses.includes(project.status)) &&
    project.name.toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase()),
  ) ?? [];
  const linkableProjects = state?.projects.filter((project) =>
    (project.in_scope || !!draftLinks[project.id]) &&
    (!linkStatuses.length || linkStatuses.includes(project.status) || !!draftLinks[project.id]) &&
    project.name.toLocaleLowerCase().includes(linkSearch.trim().toLocaleLowerCase()),
  ) ?? [];
  const hiddenCount = state?.projects.filter((project) => !project.in_scope).length ?? 0;

  if (signedIn === null) return <main className="shell"><p>Opening workspace…</p></main>;
  if (!signedIn) return <main className="shell auth"><div className="brand">Oh, WAWD!</div><h1>Your private planning space</h1><p>Sign in as the workspace owner.</p><form onSubmit={login}><label>Owner password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button disabled={busy}>Sign in</button></form>{error && <p className="error" role="alert">{error}</p>}</main>;

  return <main className="shell workspace-shell">
    <header className="app-header"><div className="app-brand"><div className="brand-mark">W</div><div><div className="brand">Oh, WAWD!</div><p>What are we doing, and when?</p></div></div><nav className="app-tabs" aria-label="Workspace views">{([['board','Board'],['outcomes','Outcomes'],['projects','Linear projects'],['scenarios','Scenarios']] as const).map(([id, label]) => <button key={id} className={activeView === id ? "app-tab active" : "app-tab"} aria-current={activeView === id ? "page" : undefined} onClick={() => setActiveView(id)}>{label}{id === "outcomes" && state?.outcomes.length ? <span>{state.outcomes.length}</span> : null}{id === "projects" && state?.projects.length ? <span>{state.projects.length}</span> : null}</button>)}</nav><div className="header-actions"><span className="source-freshness">{state?.connection ? `${state.connection.team_name} · ${new Date(state.connection.last_imported_at).toLocaleDateString()}` : "Linear not connected"}</span><button className="quiet" onClick={() => void run(async () => { await api("/api/session", "DELETE"); setSignedIn(false); setState(null); })}>Sign out</button></div></header>
    <section className="view-heading"><div><p className="eyebrow">{activeView === "board" ? "Sequencing and forecast" : activeView === "outcomes" ? "Product intent" : activeView === "projects" ? "Execution source" : "Decision history"}</p><h1>{activeView === "board" ? "Sequencing board" : activeView === "outcomes" ? "Outcomes" : activeView === "projects" ? "Linear projects" : "Decision scenarios"}</h1><p>{activeView === "board" ? "See target risk, capacity, and parallel work without leaving the planning surface." : activeView === "outcomes" ? "Create, edit, and connect desired results to the work required for delivery." : activeView === "projects" ? "Import, search, review, and curate the Linear work available to planning." : "Save alternatives, publish decisions, and compare what changed the forecast."}</p></div><span className="phase">Decision proof</span></section>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
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
      <div className="project-filters">
        <label>Search<input type="search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Project name" /></label>
        <StatusFilter statuses={statuses} selected={projectStatuses} onChange={setProjectStatuses} />
        <label className="show-hidden"><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />Show hidden{hiddenCount ? ` (${hiddenCount})` : ""}</label>
      </div>
      <p className="meta">Showing {visibleProjects.length} of {state?.projects.length ?? 0} imported projects. Hide irrelevant work from planning lists without removing it from Linear or existing outcomes.</p>
      <div className="project-table-list">{visibleProjects.map((project) => <article className="project-row" key={project.id}>
        <div><a href={project.url} target="_blank" rel="noreferrer">{project.name} ↗</a><p>{project.issue_count} issues · {project.estimated_open_points} known open points{project.unestimated_open_issues ? ` · ${project.unestimated_open_issues} unestimated` : ""}</p>{project.cross_team && <span className="inline-warning">Cross-team</span>}{project.needs_review && <span className="inline-warning">Needs review</span>}</div><span className="tag">{project.status}</span><button className="text-button" disabled={busy} onClick={() => void run(() => setProjectScope(project))}>{project.in_scope ? "Hide" : "Restore"}</button>
      </article>)}
      {!visibleProjects.length && <p className="empty">{state?.projects.length ? "No projects match these filters." : "Projects will appear here after import."}</p>}</div>
    </section></section>
    <section className="workspace-view" hidden={activeView !== "scenarios"}><ScenarioPanel onActivated={reload} refreshKey={boardVersion} /></section>
    <section className="workspace-view" hidden={activeView !== "board"}><Board refreshKey={boardVersion} onChanged={() => void reload()} onAddOutcome={() => { setShowCreateOutcome(true); setActiveView("outcomes"); }} onManageOutcome={(id) => { const outcome = state?.outcomes.find((item) => item.id === id); if (outcome) startLinking(outcome); setActiveView("outcomes"); }} /></section>
    <section className="workspace-view" hidden={activeView !== "outcomes"}><section className="panel outcomes-panel"><div className="section-head"><div><h2>Outcome catalog</h2><p>Describe the change you need, even before there is a Linear project.</p></div><span className="count">{state?.outcomes.length ?? 0}</span></div>
      <details className="create-outcome" open={showCreateOutcome} onToggle={(event) => setShowCreateOutcome(event.currentTarget.open)}><summary>Add outcome</summary><form className="outcome-form" onSubmit={createOutcome}><label>Outcome title<input value={newOutcome.title} onChange={(event) => setNewOutcome({ ...newOutcome, title: event.target.value })} maxLength={200} required placeholder="Customers can complete onboarding" /></label><label>Success signal<input value={newOutcome.successSignal} onChange={(event) => setNewOutcome({ ...newOutcome, successSignal: event.target.value })} placeholder="e.g. 80% finish without support" /></label><div className="form-row"><label>Owner<input value={newOutcome.owner} onChange={(event) => setNewOutcome({ ...newOutcome, owner: event.target.value })} /></label><label>Needed by<input type="date" value={newOutcome.neededBy} onChange={(event) => setNewOutcome({ ...newOutcome, neededBy: event.target.value })} /></label></div><label>Notes<textarea value={newOutcome.description} onChange={(event) => setNewOutcome({ ...newOutcome, description: event.target.value })} rows={2} /></label><button disabled={busy}>Create outcome</button></form></details>
      <div className="card-list">{state?.outcomes.map((outcome) => { const links = state.links.filter((link) => link.outcome_id === outcome.id); const minimum = links.filter((link) => link.requirement === "minimum"); return <article className="outcome-card" key={outcome.id}>
        {editingOutcome?.id === outcome.id ? <form className="outcome-form" onSubmit={saveOutcome}>
          <label>Outcome title<input value={editingOutcome.title} onChange={(event) => setEditingOutcome({ ...editingOutcome, title: event.target.value })} maxLength={200} required /></label>
          <label>Success signal<input value={editingOutcome.success_signal} onChange={(event) => setEditingOutcome({ ...editingOutcome, success_signal: event.target.value })} /></label>
          <div className="form-row"><label>Owner<input value={editingOutcome.owner} onChange={(event) => setEditingOutcome({ ...editingOutcome, owner: event.target.value })} /></label><label>Needed by<input type="date" value={editingOutcome.needed_by?.slice(0, 10) || ""} onChange={(event) => setEditingOutcome({ ...editingOutcome, needed_by: event.target.value || null })} /></label></div>
          <label>Notes<textarea value={editingOutcome.description} onChange={(event) => setEditingOutcome({ ...editingOutcome, description: event.target.value })} rows={2} /></label>
          <div className="actions"><button disabled={busy}>Save outcome</button><button type="button" className="quiet" disabled={busy} onClick={() => setEditingOutcome(null)}>Cancel</button></div>
        </form> : <><div className="card-title"><h3>{outcome.title}</h3><span className={minimum.length ? "tag" : "tag unplanned"}>{minimum.length ? `${minimum.length} required` : "Unplanned"}</span></div>{outcome.description && <p>{outcome.description}</p>}<p className="meta">{outcome.owner || "No owner"}{outcome.needed_by ? ` · Needed by ${outcome.needed_by.slice(0, 10)}` : " · No target"}{outcome.success_signal ? ` · ${outcome.success_signal}` : ""}</p>{links.length > 0 && <ul className="linked">{links.map((link) => <li key={link.project_id}>{state.projects.find((project) => project.id === link.project_id)?.name || "Unavailable project"} <small>· {link.requirement}</small></li>)}</ul>}<div className="actions"><button className="text-button" disabled={busy} onClick={() => { setEditing(null); setEditingOutcome({ ...outcome }); }}>Edit outcome</button><button className="text-button" disabled={busy} onClick={() => deleteOutcome(outcome)}>Delete</button></div></>}
      {editing === outcome.id ? <div className="link-editor">
        <p>Select a project and whether it is needed for the first delivery. Hidden projects already linked to this outcome remain available here.</p>
        <div className="link-filters"><label>Find a project<input type="search" value={linkSearch} onChange={(event) => setLinkSearch(event.target.value)} placeholder="Search imported projects" /></label><StatusFilter statuses={statuses} selected={linkStatuses} onChange={setLinkStatuses} /></div>
        {linkableProjects.map((project) => <div className="link-row" key={project.id}>
          <label><input type="checkbox" checked={!!draftLinks[project.id]} onChange={(event) => setDraftLinks((current) => { const next = { ...current }; if (event.target.checked) next[project.id] = "minimum"; else delete next[project.id]; return next; })} />{project.name}{!project.in_scope && <small> · hidden</small>}</label>
          {draftLinks[project.id] && <select aria-label={`${project.name} requirement`} value={draftLinks[project.id]} onChange={(event) => setDraftLinks({ ...draftLinks, [project.id]: event.target.value as "minimum" | "optional" })}><option value="minimum">Minimum required</option><option value="optional">Optional</option></select>}
        </div>)}
        {!linkableProjects.length && <p className="empty">{state.projects.length ? "No matching projects in the planning list." : "Import projects to link them."}</p>}
        <div className="actions"><button disabled={busy} onClick={() => void run(() => saveLinks(outcome.id))}>Save links</button><button className="quiet" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
      </div> : <button className="text-button" disabled={busy} onClick={() => startLinking(outcome)}>Manage project links →</button>}</article>; })}{!state?.outcomes.length && <p className="empty">No outcomes yet. Add one to start the plan.</p>}</div>
    </section></section>
    <footer>Private decision proof · Linear stays read only · Published revisions are immutable.</footer>
  </main>;
}
