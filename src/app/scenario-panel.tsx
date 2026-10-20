"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "./client-api";
import { linearPriorityLabel } from "@/lib/project-scope";

type Revision = { id: string; scenarioId: string; revisionNumber: number; sourceAt: string; rationale: string; author: string; publishedAt: string; staleSourceConfirmed: boolean };
type Scenario = { id: string; name: string; editVersion: number; sourceAt: string; stale: boolean; archived: boolean; updatedAt: string; conversionNotice: string | null; streamConflicts: { id: string; name: string }[]; revisions: Revision[] };
type ScenarioList = { baselineRevisionId: string | null; activeScenarioId: string | null; activeDraftDirty: boolean; currentSourceAt: string; creationReadiness: { ready: boolean; blockers: string[]; warnings: string[] }; scenarios: Scenario[] };
type Change<T> = { id: string; name?: string; title?: string; from: T | null; to: T | null };
type AssumptionChange = { id: string; name: string; from: Record<string, unknown> | null; to: Record<string, unknown> | null };
type Comparison = {
  left?: { label: string }; right?: { label: string }; sourceChanged: boolean;
  calculationVersions: { from: string; to: string };
  capacity: { from: { baseline: number | null; configuredBaseline: number | null; reserve: number; horizon: number; baselineReason: string; cycleAnchor: string | null; cycleDays: number | null; scopingLeadDays: number; holidaysEnabled: boolean }; to: { baseline: number | null; configuredBaseline: number | null; reserve: number; horizon: number; baselineReason: string; cycleAnchor: string | null; cycleDays: number | null; scopingLeadDays: number; holidaysEnabled: boolean } };
  packages: Change<{ selected: boolean; streamId: string | null; sequence: number | null; pauseReason: string }>[];
  streams: Change<{ name: string; position: number; allocation: number; wip: number }>[];
  streamLifecycle: Change<{ name: string; position: number; allocation: number; wip: number }>[];
  outcomes: Change<{ status: string; calendarProjected?: boolean; endDate: string | null; target: string; gapCycles: number | null; reasons: string[]; title: string | null; description: string; owner: string; successSignal: string; neededBy: string | null }>[];
  adjustments: AssumptionChange[]; extraScopes: AssumptionChange[]; priorities: AssumptionChange[]; dependencies: AssumptionChange[]; links: AssumptionChange[];
  linearCycles: AssumptionChange[]; weeklyAvailability: AssumptionChange[];
};

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return apiRequest<T>(path, method, body, "Scenario request failed");
}

function assumptionSummary(kind: string, value: Record<string, unknown> | null): string {
  if (!value) return "absent";
  if (kind === "Cycle exceptions") return `${Math.round(Number(value.availability) * 100)}% availability, reserve ${value.reserve ?? "base"}`;
  if (kind === "Weekly availability") return `${Math.round(Number(value.availability) * 100)}%${value.label ? ` · ${value.label}` : ""}`;
  if (kind === "Extra scope") return `${value.points} points${value.notes ? ` · ${value.notes}` : ""}`;
  if (kind === "Linear priority") return linearPriorityLabel(value.priority as number | null);
  if (kind === "Dependencies and waivers") return `${value.source} dependency, ${value.waived ? `waived: ${value.waiverReason || "no reason"}` : "active"}`;
  if (kind === "Outcome links") return String(value.requirement || "absent");
  return "changed";
}

export default function ScenarioPanel({ onActivated, onOpenBoard, refreshKey }: { onActivated: () => Promise<void>; onOpenBoard: () => void; refreshKey: number }) {
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
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const next = await request<ScenarioList>("/api/scenarios");
      if (generation !== loadGeneration.current) return;
      setError("");
      setData(next);
      setSelectedId((current) => current && next.scenarios.some((item) => item.id === current) ? current : next.scenarios.find((item) => !item.archived)?.id || "");
    } catch (failure) {
      if (generation === loadGeneration.current) throw failure;
    }
  }, []);
  useEffect(() => {
    setConfirmStale(false); setPendingRebase(null); setComparison(null);
    void load().catch((reason) => setError(reason.message));
  }, [load, refreshKey]);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); }
    catch (reason) { setConfirmStale(false); setPendingRebase(null); setComparison(null); setError(reason instanceof Error ? reason.message : "Scenario request failed"); }
    finally { setBusy(false); }
  }

  const selected = data?.scenarios.find((item) => item.id === selectedId) ?? null;
  const active = selected?.id === data?.activeScenarioId;
  const selectedSignature = selected ? `${selected.id}:${selected.editVersion}:${selected.sourceAt}` : "";
  const previousSelectedSignature = useRef("");
  useEffect(() => {
    if (previousSelectedSignature.current && previousSelectedSignature.current !== selectedSignature) {
      setConfirmStale(false); setPendingRebase(null); setComparison(null);
    }
    previousSelectedSignature.current = selectedSignature;
  }, [selectedSignature]);
  useEffect(() => { if (comparison?.left) setPendingRebase(null); }, [comparison]);
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

  const readiness = data?.creationReadiness;
  return <section className="panel scenario-panel">
    <div className="scenario-intro"><div><p className="eyebrow">Decision workflow · product proof slice 3</p><p>This third proof slice turns the live sequencing board into named decision options. A draft captures current scope and placement, stream settings, capacity, cycle exceptions, dependencies, outcome links, and the current Linear source snapshot.</p></div><button className="secondary" onClick={onOpenBoard}>Open board</button></div>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <section className={`scenario-readiness${readiness?.ready ? " ready" : ""}`} aria-labelledby="scenario-readiness-title"><div><strong id="scenario-readiness-title">{readiness?.ready ? "Board ready to capture" : "Board setup required"}</strong><p>{readiness?.ready ? "The forecast prerequisites are complete. Name this option to create a draft snapshot." : "Resolve these prerequisites before creating a decision option."}</p></div>{!!readiness?.blockers.length && <ul>{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}{!!readiness?.warnings.length && <details><summary>{readiness.warnings.length} item{readiness.warnings.length === 1 ? "" : "s"} will require review before publication</summary><ul>{readiness.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}{!readiness?.ready && <button className="secondary" onClick={onOpenBoard}>Configure board</button>}</section>
    <div className="scenario-toolbar">
      <label>Selected draft<select value={selectedId} disabled={!data?.scenarios.length} onChange={(event) => { setSelectedId(event.target.value); setComparison(null); setPendingRebase(null); setConfirmStale(false); }}><option value="">{data?.scenarios.length ? "Choose a scenario" : "No scenarios yet"}</option>{data?.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}{scenario.id === data.activeScenarioId ? " · on board" : ""}{scenario.stale ? " · source changed" : ""}{scenario.archived ? " · archived" : ""}</option>)}</select></label>
      <form onSubmit={create}><label>Scenario name<input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={120} placeholder="e.g. January launch option" required /><small>Enter a name for this option; example text is not a saved value.</small></label><button disabled={busy || !newName.trim() || !readiness?.ready}>Create from board</button></form>
    </div>
    {selected && <div className="scenario-draft">
      {selected.conversionNotice && <p className="notice">{selected.conversionNotice}</p>}
      <div><h3>{selected.name}</h3><p className="meta">Draft v{selected.editVersion} · source {new Date(selected.sourceAt).toLocaleString()}{selected.stale ? " · newer Linear source available" : " · current source"}{active ? " · loaded on board" : " · not loaded"}</p></div>
      {!!selected.streamConflicts.length && <p className="warning">Stream reconciliation required: {selected.streamConflicts.map((stream) => stream.name).join(", ")} {selected.streamConflicts.length === 1 ? "is" : "are"} retired. Restore the stream or create a reconciled draft from the current board before loading or publishing this draft.</p>}
      <div className="actions">
        {!active && <button className="secondary" disabled={busy} onClick={() => {
          if (window.confirm("Load this draft’s project choices and sequence, extra scope, capacity, dependencies, and outcome settings onto the live board? Save the current board to its active draft first if you need to keep unsaved changes. Linear source data and newer unrelated outcomes will not be deleted.")) {
            void run(async () => { await request(`/api/scenarios/${selected.id}/activate`, "POST", { expectedVersion: selected.editVersion, confirmReplace: true }); setComparison(null); setPendingRebase(null); await load(); await onActivated(); }, "Draft loaded onto the board.");
          }
        }}>Load draft</button>}
        <button disabled={busy || selected.stale || !active} title={!active ? "Load this draft before saving board changes." : undefined} onClick={() => void run(async () => { await request(`/api/scenarios/${selected.id}`, "PUT", { expectedVersion: selected.editVersion }); setComparison(null); setPendingRebase(null); await load(); }, "Current board saved to the active draft.")}>Save board</button>
        {selected.stale && active && <button className="secondary" disabled={busy} onClick={() => void run(async () => { const result = await request<{ comparison: Comparison; previewToken: string }>(`/api/scenarios/${selected.id}/rebase`, "POST", { expectedVersion: selected.editVersion, preview: true }); setComparison(result.comparison); setPendingRebase({ id: selected.id, version: selected.editVersion, token: result.previewToken }); }, "Rebase preview loaded. Review it below, then accept or cancel.")}>Preview rebase</button>}
        {selected.stale && !active && <span className="meta">Load this draft before rebasing it.</span>}
      </div>
      <div className="publish-box"><h4>Publish saved draft</h4><div className="scenario-fields"><label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={200} /></label><label>Decision rationale<input value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={4000} placeholder="Why this scope and allocation?" /></label></div>{active && <p className="meta">{data?.activeDraftDirty ? "The board has unsaved changes. Save them before publishing." : `Publication will freeze draft v${selected.editVersion}.`}</p>}{selected.stale && <label className="board-check"><input type="checkbox" checked={confirmStale} onChange={(event) => setConfirmStale(event.target.checked)} />Publish against the older source snapshot</label>}<button disabled={busy || !rationale.trim() || !author.trim() || (selected.stale && !confirmStale) || (active && data?.activeDraftDirty)} onClick={() => void run(async () => { await request(`/api/scenarios/${selected.id}/publish`, "POST", { expectedVersion: selected.editVersion, rationale, author, confirmStaleSource: confirmStale }); setRationale(""); setConfirmStale(false); setComparison(null); setPendingRebase(null); await load(); }, "Immutable revision published.")}>Publish revision</button></div>
      {!!selected.revisions.length && <div className="revision-list"><h4>Published revisions</h4>{selected.revisions.map((revision) => <div key={revision.id}><span><strong>r{revision.revisionNumber}</strong> · {revision.rationale} · {revision.author} · {new Date(revision.publishedAt).toLocaleString()}{revision.staleSourceConfirmed ? " · older source confirmed" : ""}</span>{data?.baselineRevisionId === revision.id ? <span className="tag">Baseline</span> : <button className="text-button" disabled={busy} onClick={() => void run(async () => { await request("/api/scenarios/baseline", "PUT", { revisionId: revision.id }); await load(); }, "Comparison baseline updated.")}>Set baseline</button>}</div>)}</div>}
    </div>}
    {references.length >= 2 && <div className="scenario-compare"><h3>Compare decisions</h3><div className="scenario-fields"><label>From<select value={left} onChange={(event) => setLeft(event.target.value)}><option value="">Choose draft or revision</option>{references.map((item) => <option key={`left:${item.value}`} value={item.value}>{item.label}</option>)}</select></label><label>To<select value={right} onChange={(event) => setRight(event.target.value)}><option value="">Choose draft or revision</option>{references.map((item) => <option key={`right:${item.value}`} value={item.value}>{item.label}</option>)}</select></label></div><button className="secondary" disabled={busy || !left || !right || left === right} onClick={() => void run(async () => setComparison(await request<Comparison>(`/api/scenarios/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`)), "Comparison loaded.")}>Compare</button></div>}
    {comparison && <div className="comparison">
      <h3>{comparison.left ? `${comparison.left.label} → ${comparison.right?.label}` : "Rebase preview"}</h3>
      <p className="meta">Capacity: {comparison.capacity.from.baseline ?? "unset"} → {comparison.capacity.to.baseline ?? "unset"} pts/cycle · reserve {comparison.capacity.from.reserve} → {comparison.capacity.to.reserve} · horizon {comparison.capacity.from.horizon} → {comparison.capacity.to.horizon}{comparison.sourceChanged ? " · source snapshot changed" : ""}</p>
      <p className="meta">Calculation: {comparison.calculationVersions?.from ?? "v0"} → {comparison.calculationVersions?.to ?? "v0"} · Scope projects {comparison.capacity.from.scopingLeadDays ?? 14} → {comparison.capacity.to.scopingLeadDays ?? 14} days before start</p>
      <p className="meta">Holiday availability preset: {comparison.capacity.from.holidaysEnabled ? "on" : "off"} → {comparison.capacity.to.holidaysEnabled ? "on" : "off"}</p>
      <div className="comparison-grid"><div><h4>Scope and placement</h4>
        {comparison.packages.map((change) => <p key={change.id}><strong>{change.name}</strong>: {change.from?.selected ? change.from.streamId || "unassigned" : "deferred"} (position {change.from?.sequence ?? "–"}) → {change.to?.selected ? change.to.streamId || "unassigned" : "deferred"} (position {change.to?.sequence ?? "–"})</p>)}
        {!comparison.packages.length && <p className="empty">No package changes.</p>}
      </div><div><h4>Streams</h4>
        {comparison.streams.map((change) => <p key={change.id}><strong>{change.from?.name || change.name}</strong>{change.from?.name !== change.to?.name ? ` → ${change.to?.name}` : ""}: {Math.round((change.from?.allocation || 0) * 100)}% / WIP {change.from?.wip ?? "-"} → {Math.round((change.to?.allocation || 0) * 100)}% / WIP {change.to?.wip ?? "-"}</p>)}
        {!comparison.streams.length && <p className="empty">No stream changes.</p>}
      </div><div><h4>Outcome forecast</h4>
        {comparison.outcomes.map((change) => <p key={change.id}><strong>{change.title}</strong>: {change.from?.endDate || change.from?.status || "absent"}{change.from?.calendarProjected ? " · projected cycles" : ""} ({change.from?.target || "-"}{change.from?.gapCycles ? `, ${change.from.gapCycles} cycle gap` : ""}) → {change.to?.endDate || change.to?.status || "absent"}{change.to?.calendarProjected ? " · projected cycles" : ""} ({change.to?.target || "-"}{change.to?.gapCycles ? `, ${change.to.gapCycles} cycle gap` : ""}){change.to?.reasons.length ? ` · ${change.to.reasons.join(" ")}` : ""}</p>)}
        {!comparison.outcomes.length && <p className="empty">No outcome changes.</p>}
      </div></div>
    </div>}
    {pendingRebase && <div className="comparison actions"><button disabled={busy} onClick={() => void run(async () => {
      await request(`/api/scenarios/${pendingRebase.id}/rebase`, "POST", { expectedVersion: pendingRebase.version, confirm: true, previewToken: pendingRebase.token });
      setPendingRebase(null); setComparison(null); await load(); await onActivated();
    }, "Scenario rebased onto the current Linear source.")}>Accept rebase</button><button className="quiet" disabled={busy} onClick={() => { setPendingRebase(null); setComparison(null); setNotice("Rebase preview cancelled."); }}>Cancel rebase</button></div>}
    {comparison && <div className="comparison"><h4>Other forecast inputs</h4>{([
      ["Cycle exceptions", comparison.adjustments], ["Extra scope", comparison.extraScopes ?? []], ["Linear priority", comparison.priorities ?? []],
      ["Weekly availability", comparison.weeklyAvailability ?? []],
      ["Dependencies and waivers", comparison.dependencies], ["Outcome links", comparison.links],
    ] as const).map(([label, changes]) => <div key={label}><strong>{label}</strong>{changes.length
      ? <ul>{changes.map((change) => <li key={change.id}><strong>{change.name}</strong>: {assumptionSummary(label, change.from)} → {assumptionSummary(label, change.to)}</li>)}</ul>
      : <p className="empty">No changes.</p>}</div>)}</div>}
    {comparison && <div className="comparison"><h4>Decision detail</h4>
      {comparison.packages.some((change) => change.from?.pauseReason !== change.to?.pauseReason)
        ? <ul>{comparison.packages.filter((change) => change.from?.pauseReason !== change.to?.pauseReason)
          .map((change) => <li key={change.id}><strong>{change.name}</strong>: pause note {change.from?.pauseReason || "none"} → {change.to?.pauseReason || "none"}</li>)}</ul>
        : <p className="empty">No pause note changes.</p>}
      {!!comparison.streamLifecycle.length && <ul>{comparison.streamLifecycle.map((change) => <li key={change.id}><strong>{change.name}</strong>: {!change.from ? "added" : "removed"}</li>)}</ul>}
      {comparison.outcomes.some((change) => change.from?.title !== change.to?.title || change.from?.owner !== change.to?.owner || change.from?.neededBy !== change.to?.neededBy || change.from?.successSignal !== change.to?.successSignal || change.from?.description !== change.to?.description) &&
        <ul>{comparison.outcomes.filter((change) => change.from?.title !== change.to?.title || change.from?.owner !== change.to?.owner || change.from?.neededBy !== change.to?.neededBy || change.from?.successSignal !== change.to?.successSignal || change.from?.description !== change.to?.description)
          .map((change) => <li key={change.id}><strong>{change.from?.title || "absent"} → {change.to?.title || "absent"}</strong>: owner {change.from?.owner || "none"} → {change.to?.owner || "none"}; needed by {change.from?.neededBy || "unset"} → {change.to?.neededBy || "unset"}{change.from?.successSignal !== change.to?.successSignal ? "; success signal changed" : ""}{change.from?.description !== change.to?.description ? "; notes changed" : ""}</li>)}</ul>}
      {comparison.capacity.from.baselineReason !== comparison.capacity.to.baselineReason && <p>Capacity rationale: {comparison.capacity.from.baselineReason || "none"} → {comparison.capacity.to.baselineReason || "none"}.</p>}
      {comparison.capacity.from.configuredBaseline !== comparison.capacity.to.configuredBaseline && <p>Configured baseline: {comparison.capacity.from.configuredBaseline ?? "observed"} → {comparison.capacity.to.configuredBaseline ?? "observed"} points/cycle.</p>}
      {(comparison.capacity.from.cycleAnchor !== comparison.capacity.to.cycleAnchor || comparison.capacity.from.cycleDays !== comparison.capacity.to.cycleDays) && <p>Legacy calendar: anchor {comparison.capacity.from.cycleAnchor || "none"} → {comparison.capacity.to.cycleAnchor || "none"}; duration {comparison.capacity.from.cycleDays || "unset"} → {comparison.capacity.to.cycleDays || "unset"} days.</p>}
      {!!comparison.linearCycles.length && <p>{comparison.linearCycles.length} Linear cycle calendar entr{comparison.linearCycles.length === 1 ? "y" : "ies"} changed.</p>}
    </div>}
    {!data?.scenarios.length && <p className="empty">No decision options have been captured yet. Complete the readiness steps above, enter a name, and create the first draft from the board.</p>}
  </section>;
}
