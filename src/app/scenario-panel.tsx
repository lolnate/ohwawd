"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import "./scenario.css";

type Revision = { id: string; scenarioId: string; revisionNumber: number; sourceAt: string; rationale: string; author: string; publishedAt: string; staleSourceConfirmed: boolean };
type Scenario = { id: string; name: string; editVersion: number; sourceAt: string; stale: boolean; archived: boolean; updatedAt: string; revisions: Revision[] };
type ScenarioList = { baselineRevisionId: string | null; activeScenarioId: string | null; activeDraftDirty: boolean; currentSourceAt: string; scenarios: Scenario[] };
type Change<T> = { id: string; name?: string; title?: string; from: T | null; to: T | null };
type Comparison = {
  left?: { label: string }; right?: { label: string }; sourceChanged: boolean;
  capacity: { from: { baseline: number | null; reserve: number; horizon: number }; to: { baseline: number | null; reserve: number; horizon: number } };
  packages: Change<{ selected: boolean; streamId: string | null; priority: number }>[];
  streams: Change<{ name: string; allocation: number; wip: number }>[];
  outcomes: Change<{ status: string; endDate: string | null; target: string; gapCycles: number | null; reasons: string[] }>[];
};

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Scenario request failed");
  return data as T;
}

export default function ScenarioPanel({ onActivated, refreshKey }: { onActivated: () => Promise<void>; refreshKey: number }) {
  const [data, setData] = useState<ScenarioList | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [rationale, setRationale] = useState("");
  const [author, setAuthor] = useState("Owner");
  const [confirmStale, setConfirmStale] = useState(false);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [pendingRebase, setPendingRebase] = useState<{ id: string; version: number; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const next = await request<ScenarioList>("/api/scenarios");
    setData(next);
    setSelectedId((current) => current && next.scenarios.some((item) => item.id === current) ? current : next.scenarios.find((item) => !item.archived)?.id || "");
  }, []);
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load, refreshKey]);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Scenario request failed"); }
    finally { setBusy(false); }
  }

  const selected = data?.scenarios.find((item) => item.id === selectedId) ?? null;
  const active = selected?.id === data?.activeScenarioId;
  const references = data?.scenarios.flatMap((scenario) => [
    { value: `draft:${scenario.id}`, label: `${scenario.name} draft` },
    ...scenario.revisions.map((revision) => ({ value: `revision:${revision.id}`, label: `${scenario.name} r${revision.revisionNumber}` })),
  ]) ?? [];

  function create(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const result = await request<{ scenario: Scenario }>("/api/scenarios", "POST", { name: newName });
      setNewName(""); await load(); setSelectedId(result.scenario.id);
    }, "Scenario draft created from the current board.");
  }

  return <section className="panel scenario-panel">
    <div className="section-head"><div><h2>Decision scenarios</h2><p>Save board assumptions as drafts, publish reviewed decisions, and compare what moved the forecast.</p></div><span className="tag">Slice 3</span></div>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="scenario-toolbar">
      <label>Selected draft<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setComparison(null); setPendingRebase(null); }}><option value="">Choose a scenario</option>{data?.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}{scenario.id === data.activeScenarioId ? " · on board" : ""}{scenario.stale ? " · source changed" : ""}{scenario.archived ? " · archived" : ""}</option>)}</select></label>
      <form onSubmit={create}><label>New scenario<input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={120} placeholder="January plan" required /></label><button disabled={busy}>Create from board</button></form>
    </div>
    {selected && <div className="scenario-draft">
      <div><h3>{selected.name}</h3><p className="meta">Draft v{selected.editVersion} · source {new Date(selected.sourceAt).toLocaleString()}{selected.stale ? " · newer Linear source available" : " · current source"}{active ? " · loaded on board" : " · not loaded"}</p></div>
      <div className="actions">
        {!active && <button className="secondary" disabled={busy} onClick={() => { if (window.confirm("Replace package choices, capacity, allowances, dependencies, this draft’s outcome links, and matching outcome titles, owners, success signals, notes, and targets on the live board? Save the current board to its active draft first if you need to keep unsaved changes. Linear source data and newer unrelated outcomes will not be deleted.")) void run(async () => { await request(`/api/scenarios/${selected.id}/activate`, "POST", { expectedVersion: selected.editVersion, confirmReplace: true }); setComparison(null); setPendingRebase(null); await load(); await onActivated(); }, "Draft loaded onto the board."); }}>Load draft</button>}
        <button disabled={busy || selected.stale || !active} title={!active ? "Load this draft before saving board changes." : undefined} onClick={() => void run(async () => { await request(`/api/scenarios/${selected.id}`, "PUT", { expectedVersion: selected.editVersion }); setComparison(null); setPendingRebase(null); await load(); }, "Current board saved to the active draft.")}>Save board</button>
        {selected.stale && active && <button className="secondary" disabled={busy} onClick={() => void run(async () => { const result = await request<{ comparison: Comparison; previewToken: string }>(`/api/scenarios/${selected.id}/rebase`, "POST", { expectedVersion: selected.editVersion, preview: true }); setComparison(result.comparison); setPendingRebase({ id: selected.id, version: selected.editVersion, token: result.previewToken }); }, "Rebase preview loaded. Review it below, then accept or cancel.")}>Preview rebase</button>}
        {selected.stale && !active && <span className="meta">Load this draft before rebasing it.</span>}
      </div>
      <div className="publish-box"><h4>Publish saved draft</h4><div className="scenario-fields"><label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={200} /></label><label>Decision rationale<input value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={4000} placeholder="Why this scope and allocation?" /></label></div>{active && <p className="meta">{data?.activeDraftDirty ? "The board has unsaved changes. Save them before publishing." : `Publication will freeze draft v${selected.editVersion}.`}</p>}{selected.stale && <label className="board-check"><input type="checkbox" checked={confirmStale} onChange={(event) => setConfirmStale(event.target.checked)} />Publish against the older source snapshot</label>}<button disabled={busy || !rationale.trim() || !author.trim() || (selected.stale && !confirmStale) || (active && data?.activeDraftDirty)} onClick={() => void run(async () => { await request(`/api/scenarios/${selected.id}/publish`, "POST", { expectedVersion: selected.editVersion, rationale, author, confirmStaleSource: confirmStale }); setRationale(""); setConfirmStale(false); setComparison(null); setPendingRebase(null); await load(); }, "Immutable revision published.")}>Publish revision</button></div>
      {!!selected.revisions.length && <div className="revision-list"><h4>Published revisions</h4>{selected.revisions.map((revision) => <div key={revision.id}><span><strong>r{revision.revisionNumber}</strong> · {revision.rationale} · {revision.author} · {new Date(revision.publishedAt).toLocaleString()}{revision.staleSourceConfirmed ? " · older source confirmed" : ""}</span>{data?.baselineRevisionId === revision.id ? <span className="tag">Baseline</span> : <button className="text-button" disabled={busy} onClick={() => void run(async () => { await request("/api/scenarios/baseline", "PUT", { revisionId: revision.id }); await load(); }, "Comparison baseline updated.")}>Set baseline</button>}</div>)}</div>}
    </div>}
    {references.length >= 2 && <div className="scenario-compare"><h3>Compare decisions</h3><div className="scenario-fields"><label>From<select value={left} onChange={(event) => setLeft(event.target.value)}><option value="">Choose draft or revision</option>{references.map((item) => <option key={`left:${item.value}`} value={item.value}>{item.label}</option>)}</select></label><label>To<select value={right} onChange={(event) => setRight(event.target.value)}><option value="">Choose draft or revision</option>{references.map((item) => <option key={`right:${item.value}`} value={item.value}>{item.label}</option>)}</select></label></div><button className="secondary" disabled={busy || !left || !right || left === right} onClick={() => void run(async () => setComparison(await request<Comparison>(`/api/scenarios/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`)), "Comparison loaded.")}>Compare</button></div>}
    {comparison && <div className="comparison"><h3>{comparison.left ? `${comparison.left.label} → ${comparison.right?.label}` : "Rebase preview"}</h3><p className="meta">Capacity: {comparison.capacity.from.baseline ?? "unset"} → {comparison.capacity.to.baseline ?? "unset"} pts/cycle · reserve {comparison.capacity.from.reserve} → {comparison.capacity.to.reserve} · horizon {comparison.capacity.from.horizon} → {comparison.capacity.to.horizon}{comparison.sourceChanged ? " · source snapshot changed" : ""}</p><div className="comparison-grid"><div><h4>Scope and placement</h4>{comparison.packages.map((change) => <p key={change.id}><strong>{change.name}</strong>: {change.from?.selected ? change.from.streamId || "unassigned" : "deferred"} (priority {change.from?.priority ?? "-"}) → {change.to?.selected ? change.to.streamId || "unassigned" : "deferred"} (priority {change.to?.priority ?? "-"})</p>)}{!comparison.packages.length && <p className="empty">No package changes.</p>}</div><div><h4>Streams</h4>{comparison.streams.map((change) => <p key={change.id}><strong>{change.from?.name || change.name}</strong>{change.from?.name !== change.to?.name ? ` → ${change.to?.name}` : ""}: {Math.round((change.from?.allocation || 0) * 100)}% / WIP {change.from?.wip ?? "-"} → {Math.round((change.to?.allocation || 0) * 100)}% / WIP {change.to?.wip ?? "-"}</p>)}{!comparison.streams.length && <p className="empty">No stream changes.</p>}</div><div><h4>Outcome forecast</h4>{comparison.outcomes.map((change) => <p key={change.id}><strong>{change.title}</strong>: {change.from?.endDate || change.from?.status || "absent"} ({change.from?.target || "-"}{change.from?.gapCycles ? `, ${change.from.gapCycles} cycle gap` : ""}) → {change.to?.endDate || change.to?.status || "absent"} ({change.to?.target || "-"}{change.to?.gapCycles ? `, ${change.to.gapCycles} cycle gap` : ""}){change.to?.reasons.length ? ` · ${change.to.reasons.join(" ")}` : ""}</p>)}{!comparison.outcomes.length && <p className="empty">No outcome changes.</p>}</div></div>{pendingRebase && <div className="actions"><button disabled={busy} onClick={() => void run(async () => { await request(`/api/scenarios/${pendingRebase.id}/rebase`, "POST", { expectedVersion: pendingRebase.version, confirm: true, previewToken: pendingRebase.token }); setPendingRebase(null); setComparison(null); await load(); await onActivated(); }, "Rebase accepted and draft version advanced.")}>Accept rebase</button><button className="quiet" disabled={busy} onClick={() => { setPendingRebase(null); setComparison(null); }}>Cancel</button></div>}</div>}
    {!data?.scenarios.length && <p className="empty">No scenarios yet. Configure the board, then save the first decision option.</p>}
  </section>;
}
