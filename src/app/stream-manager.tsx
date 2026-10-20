"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "./client-api";
import "./stream-manager.css";

type Stream = { id: string; name: string; position: number; wip_limit: number; allocation: number; active: boolean; retired_at: string | null; retirement_reason: string; package_count: number };
type StreamData = {
  streams: Stream[];
  activeScenario: { id: string; editVersion: number } | null;
  events: { id: string; stream_id: string | null; action: string; actor: string; rationale: string; created_at: string }[];
};
type Migration = { packageId: string; targetStreamId: string | null };
type RetirementPreview = {
  retiring: Stream;
  activeStreams: Stream[];
  packages: { id: string; project_id: string; name: string; status: string; selected: boolean; in_scope: boolean }[];
  migrations: Migration[];
  outcomes: { id: string; title: string }[];
  dependencies: { predecessor_id: string; successor_id: string; source: string }[];
  draftReferences: { id: string; name: string; active: boolean }[];
  revisionReferences: { id: string; name: string; revisionNumber: number }[];
  previewToken: string;
  comparison: { outcomes: { id: string; title: string; from: { status: string; endDate: string | null } | null; to: { status: string; endDate: string | null; reasons: string[] } | null }[] };
};

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return apiRequest<T>(path, method, body, "Stream request failed");
}

export default function StreamManager({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [data, setData] = useState<StreamData | null>(null);
  const [newStream, setNewStream] = useState({ name: "", wip: 1 });
  const [restoreNames, setRestoreNames] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<RetirementPreview | null>(null);
  const [migrations, setMigrations] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [previewCurrent, setPreviewCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const result = await request<StreamData>("/api/streams");
      if (generation !== loadGeneration.current) return;
      setError("");
      setData(result);
      setRestoreNames((current) => Object.fromEntries(result.streams.filter((stream) => !stream.active)
        .map((stream) => [stream.id, current[stream.id] ?? stream.name])));
    } catch (failure) {
      if (generation === loadGeneration.current) throw failure;
    }
  }, []);
  useEffect(() => {
    setPreview(null); setPreviewCurrent(false); setReason("");
    setNotice((current) => current.startsWith("Retirement preview") ? "" : current);
    void load().catch((failure) => setError(failure.message));
  }, [load, refreshKey]);

  async function run(action: () => Promise<void>, message: string, changed = true) {
    setBusy(true); setError(""); setNotice("");
    try {
      await action();
      if (changed) onChanged();
      await load();
      setNotice(message);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Stream request failed"); }
    finally { setBusy(false); }
  }

  const expectedScenarioVersion = data?.activeScenario?.editVersion;
  const active = data?.streams.filter((stream) => stream.active) ?? [];
  const retired = data?.streams.filter((stream) => !stream.active) ?? [];
  const blockedDrafts = preview?.draftReferences.filter((scenario) => !scenario.active) ?? [];

  function add(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await request("/api/streams", "POST", { ...newStream, actor: "Owner", expectedScenarioVersion });
      setNewStream({ name: "", wip: 1 });
    }, "Stream added with 0% allocation.");
  }

  function reorder(index: number, offset: number) {
    const next = [...active];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(() => request("/api/streams", "PUT", { streamIds: next.map((stream) => stream.id), actor: "Owner", expectedScenarioVersion }), "Stream order updated.");
  }

  function previewRetirement(stream: Stream, nextMigrations?: Migration[]) {
    void run(async () => {
      const result = await request<RetirementPreview>(`/api/streams/${encodeURIComponent(stream.id)}`, "POST", {
        action: "preview-retirement", migrations: nextMigrations,
      });
      setPreview(result);
      setMigrations(Object.fromEntries(result.migrations.map((migration) => [migration.packageId, migration.targetStreamId || ""])));
      setPreviewCurrent(true);
    }, `Retirement preview ready for ${stream.name}.`, false);
  }

  const migrationList = preview?.packages.map((item) => ({ packageId: item.id, targetStreamId: migrations[item.id] || null })) ?? [];

  return <details className="board-settings stream-manager">
    <summary>Manage streams <span>{active.length} active · {retired.length} retired</span></summary>
    <p>Add focus lanes, change their display order, or retire one with an explicit package migration preview. Published revisions remain unchanged.</p>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="stream-manager-grid"><section><h3>Active streams</h3><div className="stream-registry-list">{active.map((stream, index) => <div className="stream-registry-row" key={stream.id}><div><strong>{stream.name}</strong><small>{Math.round(stream.allocation * 100)}% allocation · WIP {stream.wip_limit} · {stream.package_count} package{stream.package_count === 1 ? "" : "s"}</small></div><div className="actions"><button type="button" className="quiet" aria-label={`Move ${stream.name} up`} disabled={busy || index === 0} onClick={() => reorder(index, -1)}>↑</button><button type="button" className="quiet" aria-label={`Move ${stream.name} down`} disabled={busy || index === active.length - 1} onClick={() => reorder(index, 1)}>↓</button><button type="button" className="text-button danger-text" disabled={busy || active.length <= 1} onClick={() => previewRetirement(stream)}>Retire</button></div></div>)}</div></section>
      <section><h3>Add stream</h3><form className="stream-add-form" onSubmit={add}><label>Name<input required maxLength={80} value={newStream.name} onChange={(event) => setNewStream({ ...newStream, name: event.target.value })} placeholder="New focus stream" /></label><label>WIP limit<input required type="number" min="1" max="50" value={newStream.wip} onChange={(event) => setNewStream({ ...newStream, wip: Number(event.target.value) })} /></label><button disabled={busy || !newStream.name.trim()}>Add at 0%</button></form>
      {!!retired.length && <><h3>Retired streams</h3><div className="stream-registry-list">{retired.map((stream) => <div className="stream-registry-row" key={stream.id}><label>Restore name<input maxLength={80} value={restoreNames[stream.id] ?? stream.name} onChange={(event) => setRestoreNames((current) => ({ ...current, [stream.id]: event.target.value }))} /></label><div><small>{stream.retirement_reason || "No retirement reason recorded"}</small><button type="button" className="secondary" disabled={busy || !(restoreNames[stream.id] ?? stream.name).trim()} onClick={() => void run(() => request(`/api/streams/${encodeURIComponent(stream.id)}`, "POST", { action: "restore", name: restoreNames[stream.id] ?? stream.name, actor: "Owner", expectedScenarioVersion }), `${restoreNames[stream.id] ?? stream.name} restored at 0% allocation.`)}>Restore</button></div></div>)}</div></>}</section></div>
    {preview && <section className="retirement-preview"><div className="section-head"><div><h3>Retire {preview.retiring.name}</h3><p>{Math.round(preview.retiring.allocation * 100)}% allocation returns to headroom. Selected and deferred state is preserved.</p></div><button type="button" className="quiet" disabled={busy} onClick={() => { setPreview(null); setReason(""); setNotice(""); }}>Cancel</button></div>
      <div className="retirement-impact"><span><strong>{preview.packages.length}</strong> packages</span><span><strong>{preview.outcomes.length}</strong> linked outcomes</span><span><strong>{preview.dependencies.length}</strong> dependency edges</span><span><strong>{preview.draftReferences.length}</strong> affected drafts</span></div>
      <div className="migration-list">{preview.packages.map((item) => <label key={item.id}><span><strong>{item.name}</strong><small>{item.selected ? "Selected" : "Deferred"}{!item.in_scope ? " · hidden" : ""} · {item.status}</small></span><select value={migrations[item.id] || ""} onChange={(event) => { setMigrations((current) => ({ ...current, [item.id]: event.target.value })); setPreviewCurrent(false); setNotice(""); }}><option value="">Needs assignment</option>{preview.activeStreams.filter((stream) => stream.id !== preview.retiring.id).map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}</select></label>)}{!preview.packages.length && <p className="empty">This stream has no assigned packages.</p>}</div>
      {!!preview.outcomes.length && <p className="meta"><strong>Linked outcomes:</strong> {preview.outcomes.map((outcome) => outcome.title).join(", ")}</p>}
      {preview.draftReferences.some((scenario) => scenario.active) && <p className="meta">The active draft is updated atomically with this retirement.</p>}
      {!!blockedDrafts.length && <p className="warning">Other drafts that retain this stream require reconciliation and are blocked from loading or publishing: {blockedDrafts.map((scenario) => scenario.name).join(", ")}.</p>}
      {!!preview.revisionReferences.length && <p className="meta">Published history remains frozen: {preview.revisionReferences.map((revision) => `${revision.name} r${revision.revisionNumber}`).join(", ")}.</p>}
      {!!preview.comparison.outcomes.length && <div className="retirement-forecast"><h4>Outcome forecast changes</h4>{preview.comparison.outcomes.map((change) => <p key={change.id}><strong>{change.title}</strong>: {change.from?.endDate || change.from?.status || "absent"} → {change.to?.endDate || change.to?.status || "absent"}{change.to?.reasons.length ? ` · ${change.to.reasons.join(" ")}` : ""}</p>)}</div>}
      <label>Retirement reason<input value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Why this focus lane is being retired" /></label>
      <div className="actions">{!previewCurrent && <button type="button" className="secondary" disabled={busy} onClick={() => previewRetirement(preview.retiring, migrationList)}>Refresh forecast preview</button>}<button type="button" disabled={busy || !previewCurrent || !reason.trim()} onClick={() => void run(async () => { await request(`/api/streams/${encodeURIComponent(preview.retiring.id)}`, "POST", { action: "retire", migrations: migrationList, previewToken: preview.previewToken, reason, actor: "Owner", expectedScenarioVersion }); setPreview(null); setReason(""); }, `${preview.retiring.name} retired and package migrations applied.`)}>Apply retirement</button></div>
    </section>}
    {!!data?.events.length && <details className="stream-history"><summary>Recent stream history</summary>{data.events.map((event) => <p className="meta" key={event.id}>{new Date(event.created_at).toLocaleString()} · {event.action} · {event.actor}{event.rationale ? ` · ${event.rationale}` : ""}</p>)}</details>}
  </details>;
}
