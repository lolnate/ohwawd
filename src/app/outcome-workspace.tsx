"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiRequest } from "./client-api";
import OutcomeProjectFields, { type Requirement } from "./outcome-project-fields";
import type { CatalogContext } from "./outcome-catalog";
import type { OutcomeLifecycle } from "@/lib/outcome-completion";
import type { BoardState } from "./board";
import type { OutcomeMove } from "./outcome-board-controls";

export type OutcomeRecord = { id: string; title: string; description: string; owner: string; success_signal: string; needed_by: string | null; stream_id: string | null; stream_position?: number | null; created_at: string; lifecycle?: OutcomeLifecycle };
export type OutcomeLink = { outcome_id: string; project_id: string; requirement: "minimum" | "optional" };
export type OutcomeData = { outcomes: OutcomeRecord[]; links: OutcomeLink[]; projects: { id: string; name: string; status: string; in_scope: boolean; url?: string }[]; streams: { id: string; name: string }[]; planningToken?: string };
export type OutcomeRequest = { generation: number; id: string | null; opener: HTMLElement | null; fallback: "catalog" | "delivery"; fallbackId?: string; section?: "details" | "projects" };
type Details = { title: string; description: string; owner: string; successSignal: string; neededBy: string };
type LinkMap = Record<string, Requirement>;
type Submission = { kind: "details" | "links" | "create" | "delete"; outcome?: OutcomeRecord; details: Details; links: LinkMap; generation: number; planningToken?: string };
type Result = { status: "rejected"; error: string } | { status: "saved" | "refresh-failed"; outcome: OutcomeRecord };
const detailsOf = (outcome?: OutcomeRecord): Details => ({ title: outcome?.title ?? "", description: outcome?.description ?? "", owner: outcome?.owner ?? "", successSignal: outcome?.success_signal ?? "", neededBy: outcome?.needed_by?.slice(0, 10) ?? "" });
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Could not save outcome.";
const linksOf = (data: OutcomeData, id?: string): LinkMap => Object.fromEntries(data.links.filter((link) => link.outcome_id === id).map((link) => [link.project_id, link.requirement]));
const sameLinks = (left: LinkMap, right: LinkMap) => Object.keys(left).length === Object.keys(right).length && Object.keys(left).every((key) => left[key] === right[key]);

// The controller survives dismissal. Captured submissions never act on another
// opening; only the dialog awaiting its own result changes its local draft.
export default function OutcomeWorkspace({ request, data, planning, context, onClose, onAccepted, onRefresh, onView, onRemoved, onMoveOutcome }: {
  request: OutcomeRequest | null; data: OutcomeData | null; onClose: () => void;
  onAccepted: (outcome: OutcomeRecord, links?: LinkMap, planningToken?: string) => void; onRefresh: () => Promise<void>; onView: (id: string) => void;
  context: CatalogContext; onRemoved: (id: string, generation: number) => void;
  planning: BoardState | null; onMoveOutcome: (move: OutcomeMove) => Promise<void>;
}) {
  const pending = useRef(false);
  const removed = useRef(onRemoved);
  removed.current = onRemoved;
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  async function submit(submission: Submission): Promise<Result> {
    if (pending.current) return { status: "rejected", error: "Wait for the submitted outcome change to finish." };
    pending.current = true; setSaving(true); setNotice(""); setCreatedId(null);
    try {
      const links = Object.entries(submission.links).map(([projectId, requirement]) => ({ projectId, requirement }));
      const { kind, details } = submission;
      let outcome = submission.outcome;
      let acceptedToken: string | undefined;
      let affectedCandidates: { id: string; name: string }[] = [];
      if (kind === "create") {
        const result = await apiRequest<{ id: string; planningToken?: string }>("/api/outcomes", "POST", { ...details, links });
        acceptedToken = result.planningToken;
        outcome = { id: result.id, title: details.title, description: details.description, owner: details.owner, success_signal: details.successSignal, needed_by: details.neededBy || null, stream_id: null, created_at: new Date().toISOString() };
        setCreatedId(result.id);
      } else if (kind === "delete") {
        const result = await apiRequest<{ affectedCandidates?: { id: string; name: string }[] }>(`/api/outcomes/${outcome!.id}`, "DELETE", { planningToken: submission.planningToken });
        affectedCandidates = result.affectedCandidates ?? [];
        removed.current(outcome!.id, submission.generation);
      } else if (kind === "links") {
        const result = await apiRequest<{ planningToken?: string; affectedCandidates?: { id: string; name: string }[] }>(`/api/outcomes/${outcome!.id}/links`, "PUT", { links, planningToken: submission.planningToken });
        acceptedToken = result.planningToken; affectedCandidates = result.affectedCandidates ?? [];
      }
      else {
        await apiRequest(`/api/outcomes/${outcome!.id}`, "PUT", details);
        outcome = { ...outcome!, title: details.title, description: details.description, owner: details.owner, success_signal: details.successSignal, needed_by: details.neededBy || null };
      }
      const accepted = outcome!;
      if (kind !== "delete") onAccepted(accepted, kind === "details" ? undefined : { ...submission.links }, acceptedToken);
      const impact = affectedCandidates.length ? ` Needs assignment: ${affectedCandidates.map((item) => item.name).join(", ")}. Their future demand is excluded until an owner is chosen.` : "";
      try { await onRefresh(); setRefreshFailed(false); setNotice((kind === "delete" ? "Outcome deleted." : kind === "create" ? "Outcome created." : kind === "links" ? "Outcome links saved." : "Outcome details saved.") + impact); return { status: "saved", outcome: accepted }; }
      catch { setRefreshFailed(true); setNotice("Outcome saved, but workspace views could not be refreshed." + impact); return { status: "refresh-failed", outcome: accepted }; }
    } catch (error) { setNotice(messageOf(error)); return { status: "rejected", error: messageOf(error) }; }
    finally { pending.current = false; setSaving(false); }
  }
  async function refresh() {
    try { await onRefresh(); setRefreshFailed(false); setNotice("Workspace refreshed."); }
    catch { setRefreshFailed(true); }
  }
  return <>
    {notice && <div className="notice" role="status">{notice}{createdId && <><button type="button" className="text-button" onClick={() => onView(createdId)}>View outcome</button>{!context.ids.includes(createdId) && <button type="button" className="text-button" onClick={context.clear}>Clear filters</button>}</>}{refreshFailed && <button type="button" className="text-button" onClick={() => void refresh()}>Retry workspace refresh</button>}</div>}
    {request && data && <OutcomeDialog key={request.generation} request={request} data={data} planning={planning} context={context} saving={saving} onSubmit={submit} onMoveOutcome={onMoveOutcome} onClose={onClose} onRefresh={refresh} refreshFailed={refreshFailed} onMissing={() => { setNotice("Outcome was removed from the workspace."); onClose(); }} />}
  </>;
}

function outside(dialog: HTMLDialogElement, x: number, y: number) {
  const rect = dialog.getBoundingClientRect();
  return x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom;
}

function OutcomeDialog({ request, data, planning, context, saving, onSubmit, onMoveOutcome, onClose, onRefresh, refreshFailed, onMissing }: {
  request: OutcomeRequest; data: OutcomeData; saving: boolean; onSubmit: (submission: Submission) => Promise<Result>;
  onClose: () => void; onRefresh: () => Promise<void>; refreshFailed: boolean;
  context: CatalogContext; onMissing: () => void; planning: BoardState | null; onMoveOutcome: (move: OutcomeMove) => Promise<void>;
}) {
  const [created, setCreated] = useState<OutcomeRecord | null>(null);
  // Accepted creations are inserted into workspace data before refresh. Once an
  // ID has been observed there, a later successful read can confirm its removal.
  const observed = useRef(!!request.id);
  const saved = data.outcomes.find((item) => item.id === (created?.id ?? request.id)) ?? created;
  const isNew = !saved;
  const [section, setSection] = useState<"details" | "projects">(request.section ?? "details");
  const [editing, setEditing] = useState(!request.id);
  const [draft, setDraft] = useState(() => detailsOf(saved ?? undefined));
  const [editingLinks, setEditingLinks] = useState(!request.id);
  const savedLinks = linksOf(data, saved?.id);
  const [links, setLinks] = useState<LinkMap>(() => linksOf(data, request.id ?? undefined));
  const [linkFeedback, setLinkFeedback] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkToken, setLinkToken] = useState(data.planningToken);
  const [reviewLinks, setReviewLinks] = useState(false);
  const reviewFrom = useRef<OutcomeData | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<Submission["kind"] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const backdrop = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(detailsOf(saved ?? undefined));
  const linksDirty = !sameLinks(links, savedLinks);
  const directProjectIds = new Set(planning?.links.filter((link) => link.outcome_id === saved?.id).map((link) => link.project_id) ?? []);
  const directPackages = planning?.packages.filter((item) => directProjectIds.has(item.project_id)) ?? [];
  const countedPoints = directPackages.filter((item) => item.selected && item.capacity_outcome_id === saved?.id && item.stream_id === saved?.stream_id)
    .reduce((sum, item) => sum + (planning?.forecast.packages.find((projection) => projection.id === item.id)?.demand ?? 0), 0);
  useEffect(() => { if (reviewLinks && data !== reviewFrom.current) { setLinkToken(data.planningToken); setReviewLinks(false); } }, [data, reviewLinks]);
  useEffect(() => { if (!editingLinks) setLinkToken(data.planningToken); }, [data.planningToken, editingLinks]);
  useEffect(() => {
    const id = created?.id ?? request.id;
    if (!id) return;
    if (data.outcomes.some((item) => item.id === id)) observed.current = true;
    else if (observed.current) onMissing();
  }, [data, created?.id, request.id, onMissing]);
  useEffect(() => { if (!editing) setDraft(detailsOf(saved ?? undefined)); }, [saved, editing]);
  useEffect(() => { if (!editingLinks) setLinks(linksOf(data, saved?.id)); }, [data, saved?.id, editingLinks]);
  useLayoutEffect(() => { if (editingLinks && saved?.id) dialog.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(); }, [editingLinks, saved?.id]);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    if (!request.id) title.current?.focus({ preventScroll: true }); else heading.current?.focus({ preventScroll: true });
    return () => {
      element?.close(); document.body.style.overflow = overflow;
      const opener = request.opener;
      const original = opener?.isConnected && opener.getClientRects().length ? opener : null;
      const target = original ?? document.getElementById(request.fallbackId ?? `outcome-${request.fallback}-title`) ?? (request.fallbackId ? document.getElementById("board-roadmap-triage-title") : null);
      target?.focus({ preventScroll: true });
      if (!original && target) { const rect = target.getBoundingClientRect(), header = document.querySelector(".app-header")?.getBoundingClientRect().bottom ?? 0; if (rect.top < header || rect.bottom > innerHeight) target.scrollIntoView({ block: "start", behavior: "instant" }); }
    };
  }, [request]);
  async function save(kind: Submission["kind"]) {
    if ((kind === "details" || kind === "create") && (!draft.title.trim() || !title.current?.validity.valid)) {
      setSection("details"); setError("Enter an outcome title.");
      requestAnimationFrame(() => { title.current?.focus(); title.current?.reportValidity(); }); return;
    }
    if (kind === "links") { setLinkError(""); setLinkFeedback(""); } else { setError(""); setFeedback(""); }
    setSubmitted(kind);
    const result = await onSubmit({ kind, outcome: saved ?? undefined, details: { ...draft }, links: { ...links }, generation: request.generation, planningToken: kind === "links" ? linkToken : data.planningToken });
    setSubmitted(null);
    if (result.status === "rejected") { if (kind === "links") setLinkError(result.error); else setError(result.error); }
    else if (kind === "links") { setEditingLinks(false); setLinkFeedback("Links saved."); }
    else {
      setDraft(detailsOf(result.outcome)); setEditing(false); setFeedback("Details saved.");
      if (kind === "create") { setCreated(result.outcome); setEditingLinks(false); setSection("details"); }
    }
  }
  return <dialog ref={dialog} className="outcome-workspace" aria-labelledby="outcome-workspace-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]")).filter((item) => item.getClientRects().length && !item.closest("fieldset:disabled"));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onPointerDown={(event) => { backdrop.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY); }}
    onPointerCancel={() => { backdrop.current = false; }}
    onClick={(event) => { const started = backdrop.current; backdrop.current = false; if (started && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY)) onClose(); }}>
    <header className="outcome-workspace-header"><div><p className="eyebrow">{isNew ? "New outcome" : "Outcome"}</p><h2 ref={heading} tabIndex={-1} id="outcome-workspace-title">{saved?.title ?? "New outcome"}</h2></div><button type="button" className="secondary" aria-label="Close outcome" onClick={onClose}>Close</button></header>
    <nav className="outcome-workspace-nav" aria-label="Outcome workspace sections">{(["details", "projects"] as const).map((item) => <button type="button" key={item} aria-current={section === item ? "true" : undefined} onClick={() => setSection(item)}>{item === "details" ? `Details${dirty ? " · unsaved" : ""}` : `Projects${linksDirty ? " · unsaved" : ""}`}</button>)}</nav>
    <div className="outcome-workspace-body">
      {saved && !context.ids.includes(saved.id) && <p className="notice">Outside current filters. <button type="button" className="text-button" onClick={context.clear}>Clear filters</button></p>}
      {(dirty || linksDirty) && <p className="meta">Changes stay while switching sections. Closing discards unsaved changes.</p>}
      {submitted && <p role="status">{submitted === "create" ? "Creating outcome…" : submitted === "links" ? "Saving links…" : "Saving details…"}</p>}
      {refreshFailed && <p role="alert">Outcome saved, but workspace views could not be refreshed. <button type="button" className="text-button" onClick={() => void onRefresh()}>Retry workspace refresh</button></p>}
      <section hidden={section !== "details"} aria-labelledby="outcome-details-title"><h3 id="outcome-details-title">Details</h3>
        {error && <p className="error" role="alert">{error}</p>}{feedback && <p className="notice" role="status">{feedback}</p>}
        {editing ? <form onSubmit={(event) => { event.preventDefault(); void save(isNew ? "create" : "details"); }}><fieldset className="outcome-form" disabled={submitted === "details" || submitted === "create"}>
          <label>Outcome title<input ref={title} autoFocus value={draft.title} required maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Success signal<input value={draft.successSignal} onChange={(event) => setDraft({ ...draft, successSignal: event.target.value })} /></label>
          <label>Owner<input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label>
          <label>Needed by<input type="date" value={draft.neededBy} onChange={(event) => setDraft({ ...draft, neededBy: event.target.value })} /></label>
          <label>Notes<textarea rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          {!isNew && <div className="actions"><button disabled={saving}>Save details</button><button type="button" className="quiet" onClick={() => { setDraft(detailsOf(saved ?? undefined)); setEditing(false); setError(""); }}>Cancel details</button></div>}
        </fieldset></form> : saved && <><dl className="outcome-saved-details"><dt>Title</dt><dd>{saved.title}</dd><dt>Notes</dt><dd>{saved.description || "No notes"}</dd><dt>Owner</dt><dd>{saved.owner || "No owner"}</dd><dt>Success signal</dt><dd>{saved.success_signal || "No success signal"}</dd><dt>Needed by</dt><dd>{saved.needed_by || "No target"}</dd>{planning && <><dt>Points counted</dt><dd>{countedPoints.toLocaleString()}</dd><dt>Direct projects</dt><dd>{directPackages.length.toLocaleString()}</dd></>}</dl><button type="button" className="secondary" onClick={() => { setDraft(detailsOf(saved)); setEditing(true); setError(""); }}>Edit details</button></>}
        {saved && planning?.roadmapPlanningMigrated && <OutcomePlacementControls outcome={saved} planning={planning} disabled={editing || editingLinks || dirty || linksDirty || saving || !!submitted} onMove={onMoveOutcome} />}
        {saved && !planning?.roadmapPlanningMigrated && <p className="meta">Stream: {data.streams.find((item) => item.id === saved.stream_id)?.name ?? "Needs assignment"}. Manage stream assignment on Board.</p>}
        {saved && <div className="outcome-delete"><button type="button" className="text-button danger-text" disabled={dirty || linksDirty || saving} onClick={() => { if (window.confirm(`Delete “${saved.title}” and its project links?`)) void save("delete"); }}>Delete outcome</button>{(dirty || linksDirty) && <p className="meta">Save or cancel unsaved changes before deleting.</p>}</div>}
      </section>
      <section hidden={section !== "projects"} aria-labelledby="outcome-projects-title"><h3 id="outcome-projects-title">Projects</h3>
        <p className="meta">Optional work does not determine first delivery.</p>
        {linkError && <><p className="error" role="alert">{linkError}</p><button type="button" className="secondary" onClick={() => { reviewFrom.current = data; setReviewLinks(true); void onRefresh(); }}>Review latest planning context</button></>}{linkFeedback && <p className="notice" role="status">{linkFeedback}</p>}
        <div hidden={!editingLinks}><fieldset disabled={submitted === "links" || submitted === "create"}><OutcomeProjectFields projects={data.projects} saved={savedLinks} draft={links} onChange={setLinks} />
          {!isNew && <div className="actions"><button type="button" disabled={saving} onClick={() => void save("links")}>Save links</button><button type="button" className="quiet" onClick={() => { setLinks(linksOf(data, saved?.id)); setEditingLinks(false); setLinkError(""); }}>Cancel links</button></div>}
        </fieldset></div>
        {!editingLinks && <><ul className="outcome-saved-projects">{data.links.filter((link) => link.outcome_id === saved?.id).map((link) => { const project = data.projects.find((item) => item.id === link.project_id); return <li key={link.project_id}>{project?.url ? <a href={project.url} target="_blank" rel="noreferrer">{project.name} ↗</a> : project?.name ?? "Unavailable project"} · {link.requirement === "minimum" ? "Required" : "Optional"}{project && !project.in_scope ? " · Hidden" : ""}</li>; })}</ul>{!Object.keys(savedLinks).length && <p>No projects</p>}<button type="button" className="secondary" onClick={() => { setLinks(savedLinks); setEditingLinks(true); setLinkError(""); }}>Manage projects</button></>}
      </section>
    </div>
    {isNew && <footer className="outcome-workspace-footer"><span>{Object.keys(links).length} projects selected</span><button type="button" disabled={saving} onClick={() => void save("create")}>Create outcome</button></footer>}
  </dialog>;
}

function OutcomePlacementControls({ outcome, planning, disabled, onMove }: { outcome: OutcomeRecord; planning: BoardState; disabled: boolean; onMove: (move: OutcomeMove) => Promise<void> }) {
  const [destination, setDestination] = useState(outcome.stream_id ?? "");
  const [relation, setRelation] = useState<"end" | "before" | "after">("end");
  const [target, setTarget] = useState("");
  const [moving, setMoving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const apply = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDestination(outcome.stream_id ?? ""); setRelation("end"); setTarget(""); }, [outcome.stream_id, outcome.stream_position]);
  const targets = planning.outcomes.filter((item) => item.id !== outcome.id && item.stream_id === destination)
    .sort((left, right) => (left.stream_position ?? Infinity) - (right.stream_position ?? Infinity) || left.id.localeCompare(right.id));
  async function move() {
    setMoving(true); setFeedback(""); setError("");
    try {
      await onMove({ outcomeId: outcome.id, streamId: destination || null, ...(destination && relation !== "end" ? relation === "before" ? { beforeOutcomeId: target } : { afterOutcomeId: target } : {}) });
      setFeedback(destination ? `${outcome.title} placement saved.` : `${outcome.title} moved to Needs assignment.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not move outcome."); requestAnimationFrame(() => apply.current?.focus()); }
    finally { setMoving(false); }
  }
  const currentStream = planning.streams.find((item) => item.id === outcome.stream_id)?.name ?? "Needs assignment";
  return <section className="outcome-placement" aria-labelledby="outcome-placement-title">
    <h4 id="outcome-placement-title">Board placement</h4>
    <p className="meta">Currently in {currentStream}. Drag the Board row or use these equivalent controls.</p>
    {disabled && <p className="meta">Save or cancel sidebar changes before moving this outcome.</p>}
    {error && <p className="error" role="alert">{error}</p>}{feedback && <p className="notice" role="status">{feedback}</p>}
    <form onSubmit={(event) => { event.preventDefault(); void move(); }}><fieldset disabled={disabled || moving}>
      <label>Destination stream<select aria-label={`Destination stream for ${outcome.title}`} value={destination} onChange={(event) => { setDestination(event.target.value); setRelation("end"); setTarget(""); }}><option value="">Needs assignment</option>{planning.streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}</select></label>
      {destination && <><label>Position<select aria-label={`Position for ${outcome.title}`} value={relation} onChange={(event) => { setRelation(event.target.value as typeof relation); setTarget(""); }}><option value="end">At end of stream</option><option value="before">Move before</option><option value="after">Move after</option></select></label>
        {relation !== "end" && <label>{relation === "before" ? "Move before outcome" : "Move after outcome"}<select aria-label={`${relation === "before" ? "Move before" : "Move after"} outcome for ${outcome.title}`} value={target} required onChange={(event) => setTarget(event.target.value)}><option value="">Choose outcome…</option>{targets.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}</>}
      <button ref={apply} type="submit" className="secondary" disabled={moving || (!!destination && relation !== "end" && !targets.some((item) => item.id === target))}>{moving ? "Moving outcome…" : "Apply Board placement"}</button>
    </fieldset></form>
  </section>;
}
