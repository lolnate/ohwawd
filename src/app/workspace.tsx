"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Board from "./board";

type Team = { id: string; name: string; key: string };
type Project = { id: string; name: string; description: string; status: string; url: string; cross_team: boolean; needs_review: boolean; in_scope: boolean; issue_count: number; unestimated_open_issues: number; estimated_open_points: number };
type Outcome = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null };
type Link = { outcome_id: string; project_id: string; requirement: "minimum" | "optional" };
type State = { connection: { viewer_name: string; team_id: string; team_name: string; last_imported_at: string } | null; projects: Project[]; outcomes: Outcome[]; links: Link[]; streams: { id: string; name: string }[] };
type Preview = { id: string; name: string; status: string };

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export default function App() {
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
  const [editing, setEditing] = useState<string | null>(null);
  const [draftLinks, setDraftLinks] = useState<Record<string, "minimum" | "optional">>({});
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");

  const reload = useCallback(async () => {
    const data = await api<State>("/api/state");
    setState(data);
    setBoardVersion((version) => version + 1);
    if (data.connection) setTeamId(data.connection.team_id);
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
      await reload(); setNotice("Outcome created. Link the Linear work it needs.");
    });
  }

  function startLinking(outcome: Outcome) {
    const draft: Record<string, "minimum" | "optional"> = {};
    for (const link of state?.links ?? []) if (link.outcome_id === outcome.id) draft[link.project_id] = link.requirement;
    setDraftLinks(draft); setLinkSearch(""); setEditing(outcome.id);
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
  const visibleProjects = state?.projects.filter((project) =>
    (showHidden || project.in_scope) &&
    (!projectStatus || project.status === projectStatus) &&
    project.name.toLocaleLowerCase().includes(projectSearch.trim().toLocaleLowerCase()),
  ) ?? [];
  const linkableProjects = state?.projects.filter((project) =>
    (project.in_scope || !!draftLinks[project.id]) &&
    project.name.toLocaleLowerCase().includes(linkSearch.trim().toLocaleLowerCase()),
  ) ?? [];
  const hiddenCount = state?.projects.filter((project) => !project.in_scope).length ?? 0;

  if (signedIn === null) return <main className="shell"><p>Opening workspace…</p></main>;
  if (!signedIn) return <main className="shell auth"><div className="brand">Oh, WAWD!</div><h1>Your private planning space</h1><p>Sign in as the workspace owner.</p><form onSubmit={login}><label>Owner password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button disabled={busy}>Sign in</button></form>{error && <p className="error" role="alert">{error}</p>}</main>;

  return <main className="shell">
    <header className="top"><div><div className="brand">Oh, WAWD!</div><p className="eyebrow">Private product proof · Source, outcome, and sequencing</p></div><button className="quiet" onClick={() => void run(async () => { await api("/api/session", "DELETE"); setSignedIn(false); setState(null); })}>Sign out</button></header>
    <section className="hero"><div><h1>What are we doing, and when can we do it?</h1><p>Connect Linear work to outcomes, assign five planning streams, and explain the cycle forecast.</p></div><span className="phase">Slice 2 of 3</span></section>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <section className="panel"><div className="section-head"><div><h2>Linear source</h2><p>{state?.connection ? `${state.connection.team_name} · connected as ${state.connection.viewer_name} · last imported ${new Date(state.connection.last_imported_at).toLocaleString()}` : "Connect an API key to preview one team. The key is encrypted on the server when you import."}</p></div><span className="tag">Read only</span></div>
      <div className="connect-grid"><label>{state?.connection ? "Rotate key (optional)" : "Linear API key"}<input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder={state?.connection ? "Use saved key" : "lin_api_…"} /></label><button disabled={busy || (!key && !state?.connection)} onClick={() => void run(() => inspect(), "Checking Linear access…", true)}>Check access</button></div>
      {teams.length > 0 && <div className="connect-grid"><label>Team<select value={teamId} disabled={!!state?.connection} onChange={(event) => { setTeamId(event.target.value); setPreview(null); }}><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.key})</option>)}</select></label><button disabled={busy || !teamId} onClick={() => void run(() => inspect(teamId), "Loading the project list from Linear…", true)}>{busy && activity.includes("project list") ? "Loading projects…" : "Preview projects"}</button></div>}
      {state?.connection && teams.length === 0 && <button className="secondary" disabled={busy} onClick={() => void run(() => inspect(teamId), "Loading the project list from Linear…", true)}>Preview saved team again</button>}
      {activity && <p className="notice" role="status" aria-live="polite">{activity}</p>}
      {sourceError && <p className="error" role="alert">{sourceError}</p>}
      {preview && <div className="preview"><h3>Import preview · {preview.length} projects</h3><p>All project states are included. Issue estimates and cross-team work are checked during import.</p><div className="preview-list">{preview.map((project) => <div key={project.id}><span>{project.name}</span><small>{project.status}</small></div>)}</div><button disabled={busy} onClick={() => void run(async () => { const result = await api<{ imported: number }>("/api/linear/import", "POST", { apiKey: key || undefined, teamId }); setKey(""); setPreview(null); await reload(); setNotice(`${result.imported} projects imported. Existing outcome links were preserved.`); }, "Importing projects and issues from Linear…", true)}>Import these projects</button></div>}
    </section>
    <Board refreshKey={boardVersion} />
    <div className="columns"><section className="panel"><div className="section-head"><div><h2>Outcomes</h2><p>Describe the change you need, even before there is a Linear project.</p></div><span className="count">{state?.outcomes.length ?? 0}</span></div>
      <form className="outcome-form" onSubmit={createOutcome}><label>Outcome title<input value={newOutcome.title} onChange={(event) => setNewOutcome({ ...newOutcome, title: event.target.value })} maxLength={200} required placeholder="Customers can complete onboarding" /></label><label>Success signal<input value={newOutcome.successSignal} onChange={(event) => setNewOutcome({ ...newOutcome, successSignal: event.target.value })} placeholder="e.g. 80% finish without support" /></label><div className="form-row"><label>Owner<input value={newOutcome.owner} onChange={(event) => setNewOutcome({ ...newOutcome, owner: event.target.value })} /></label><label>Needed by<input type="date" value={newOutcome.neededBy} onChange={(event) => setNewOutcome({ ...newOutcome, neededBy: event.target.value })} /></label></div><label>Notes<textarea value={newOutcome.description} onChange={(event) => setNewOutcome({ ...newOutcome, description: event.target.value })} rows={2} /></label><button disabled={busy}>Add outcome</button></form>
      <div className="card-list">{state?.outcomes.map((outcome) => { const links = state.links.filter((link) => link.outcome_id === outcome.id); const minimum = links.filter((link) => link.requirement === "minimum"); return <article className="outcome-card" key={outcome.id}><div className="card-title"><h3>{outcome.title}</h3><span className={minimum.length ? "tag" : "tag unplanned"}>{minimum.length ? `${minimum.length} required` : "Unplanned"}</span></div>{outcome.description && <p>{outcome.description}</p>}<p className="meta">{outcome.owner || "No owner"}{outcome.needed_by ? ` · Needed by ${outcome.needed_by.slice(0, 10)}` : " · No target"}{outcome.success_signal ? ` · ${outcome.success_signal}` : ""}</p>{links.length > 0 && <ul className="linked">{links.map((link) => <li key={link.project_id}>{state.projects.find((project) => project.id === link.project_id)?.name || "Unavailable project"} <small>· {link.requirement}</small></li>)}</ul>}
      {editing === outcome.id ? <div className="link-editor">
        <p>Select a project and whether it is needed for the first delivery. Hidden projects already linked to this outcome remain available here.</p>
        <label>Find a project<input type="search" value={linkSearch} onChange={(event) => setLinkSearch(event.target.value)} placeholder="Search imported projects" /></label>
        {linkableProjects.map((project) => <div className="link-row" key={project.id}>
          <label><input type="checkbox" checked={!!draftLinks[project.id]} onChange={(event) => setDraftLinks((current) => { const next = { ...current }; if (event.target.checked) next[project.id] = "minimum"; else delete next[project.id]; return next; })} />{project.name}{!project.in_scope && <small> · hidden</small>}</label>
          {draftLinks[project.id] && <select aria-label={`${project.name} requirement`} value={draftLinks[project.id]} onChange={(event) => setDraftLinks({ ...draftLinks, [project.id]: event.target.value as "minimum" | "optional" })}><option value="minimum">Minimum required</option><option value="optional">Optional</option></select>}
        </div>)}
        {!linkableProjects.length && <p className="empty">{state.projects.length ? "No matching projects in the planning list." : "Import projects to link them."}</p>}
        <div className="actions"><button disabled={busy} onClick={() => void run(() => saveLinks(outcome.id))}>Save links</button><button className="quiet" onClick={() => setEditing(null)}>Cancel</button></div>
      </div> : <button className="text-button" onClick={() => startLinking(outcome)}>Manage project links →</button>}</article>; })}{!state?.outcomes.length && <p className="empty">No outcomes yet. Add one to start the plan.</p>}</div>
    </section><section className="panel">
      <div className="section-head"><div><h2>Imported projects</h2><p>Each project has one stable work package. Links to multiple outcomes reuse that package.</p></div><span className="count">{state?.projects.length ?? 0}</span></div>
      <div className="project-filters">
        <label>Search<input type="search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Project name" /></label>
        <label>Status<select value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label className="show-hidden"><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />Show hidden{hiddenCount ? ` (${hiddenCount})` : ""}</label>
      </div>
      <p className="meta">Showing {visibleProjects.length} of {state?.projects.length ?? 0} imported projects. Hide irrelevant work from planning lists without removing it from Linear or existing outcomes.</p>
      <div className="card-list">{visibleProjects.map((project) => <article className="project-card" key={project.id}>
        <div className="card-title"><a href={project.url} target="_blank" rel="noreferrer">{project.name} ↗</a><span className="tag">{project.status}</span></div>
        <p className="meta">{project.issue_count} issues · {project.estimated_open_points} known open points{project.unestimated_open_issues ? ` · ${project.unestimated_open_issues} unestimated` : ""}</p>
        {project.cross_team && <p className="warning">Cross-team work: later decomposition required before forecasting.</p>}
        {project.needs_review && <p className="warning">Missing from latest import; review in Linear.</p>}
        <button className="text-button" disabled={busy} onClick={() => void run(() => setProjectScope(project))}>{project.in_scope ? "Hide from planning lists" : "Restore to planning lists"}</button>
      </article>)}
      {!visibleProjects.length && <p className="empty">{state?.projects.length ? "No projects match these filters." : "Projects will appear here after import."}</p>}</div>
    </section></div>
    <footer>Next: save scenarios, publish a baseline, and compare decisions.</footer>
  </main>;
}
