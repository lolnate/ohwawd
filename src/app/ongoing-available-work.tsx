"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { AvailableWorkRow, CompletedHistoryCycle, CompletedHistoryRow, OngoingWorkInsights, OngoingWorkIssueDetail, WorkBucket, WorkMetric } from "@/lib/ongoing-work-insights";
import { readApiResponse } from "./client-api";

const buckets = ["ready", "blocked", "backlog"] as const;
const bucketLabel: Record<WorkBucket, string> = { ready: "Ready", blocked: "Blocked", backlog: "Backlog" };

function count(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function metricText(metric: WorkMetric) {
  return `${count(metric.issueCount, "issue")} · ${metric.knownPoints.toLocaleString()} known pts · ${count(metric.unestimatedCount, "unestimated issue")}`;
}

function segmentName(row: AvailableWorkRow, bucket: WorkBucket) {
  return `Inspect ${row.projectName} ${bucketLabel[bucket]} work: ${metricText(row[bucket])}`;
}

type HistoryMetric = "issues" | "points";
type CompletedHistory = OngoingWorkInsights["completedHistory"];
type Inspection =
  | { view: "available"; row: AvailableWorkRow; bucket: WorkBucket; opener: HTMLElement | null }
  | { view: "history"; row: CompletedHistoryRow; cycle: CompletedHistoryCycle; metric: HistoryMetric; opener: HTMLElement | null };

function outsideDialog(dialog: HTMLDialogElement, x: number, y: number) {
  const bounds = dialog.getBoundingClientRect();
  return x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom;
}

function IssueInspection({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  const [issues, setIssues] = useState<OngoingWorkIssueDetail[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { row, opener } = inspection;

  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (document.querySelector("dialog[open]")) return;
      const target = opener?.isConnected && opener.getClientRects().length ? opener : document.getElementById("ongoing-work-title");
      target?.focus({ preventScroll: true });
    };
  }, [opener]);

  useEffect(() => {
    const controller = new AbortController();
    setIssues(null);
    setError("");
    const params = inspection.view === "available"
      ? new URLSearchParams({ view: "available", row: row.rowId, bucket: inspection.bucket })
      : new URLSearchParams({ view: "history", row: row.rowId, cycle: inspection.cycle.id });
    void fetch(`/api/ongoing-work/issues?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => readApiResponse<{ issues: OngoingWorkIssueDetail[] }>(response, "Could not load issue inspection"))
      .then((data) => setIssues(data.issues))
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Could not load issue inspection"); });
    return () => controller.abort();
  }, [inspection, row.rowId, attempt]);

  const historyCell = inspection.view === "history" ? inspection.row.cells.find((cell) => cell.cycleId === inspection.cycle.id) : null;
  const eyebrow = inspection.view === "available"
    ? `${inspection.row.group === "needs-classification" ? "Needs classification" : "Ongoing work"} · ${bucketLabel[inspection.bucket]}`
    : `${inspection.row.kind === "project" ? "Ongoing completed work" : "Attention"} · ${cycleLabel(inspection.cycle)}`;
  const summary = inspection.view === "available" ? metricText(inspection.row[inspection.bucket]) : historyCell ? metricText(historyCell) : "Completed work";

  return <dialog ref={dialogRef} className="ongoing-inspection" aria-labelledby="ongoing-inspection-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]")).filter((item) => item.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget && outsideDialog(event.currentTarget, event.clientX, event.clientY); }}
    onPointerCancel={() => { backdropPress.current = false; }}
    onClick={(event) => {
      const startedOutside = backdropPress.current;
      backdropPress.current = false;
      if (startedOutside && event.target === event.currentTarget && outsideDialog(event.currentTarget, event.clientX, event.clientY)) onClose();
    }}>
    <header className="ongoing-inspection-header">
      <div><p className="eyebrow">{eyebrow}</p><h2 id="ongoing-inspection-title" ref={titleRef} tabIndex={-1}>{"projectName" in row ? row.projectName : row.label}</h2><p>{summary}</p></div>
      <button type="button" className="secondary" onClick={onClose} aria-label="Close issue inspection">Close</button>
    </header>
    <div className="ongoing-inspection-body">
      {!issues && !error && <p className="ongoing-inspection-state" role="status">Loading contributing issues…</p>}
      {error && <div className="ongoing-inspection-state error" role="alert"><p>{error}</p><button type="button" className="secondary" onClick={() => setAttempt((value) => value + 1)}>Retry issue inspection</button></div>}
      {issues && !issues.length && <p className="ongoing-inspection-state empty">No contributing issues remain. Refresh the Board for current counts.</p>}
      {inspection.view === "history" && inspection.row.kind === "needs-classification" && <button type="button" className="secondary" onClick={() => {
        onClose();
        requestAnimationFrame(() => {
          const target = document.getElementById("ongoing-needs-classification-title");
          target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "center", behavior: "instant" });
        });
      }}>Close and review classification controls</button>}
      {issues && !!issues.length && <ul className="ongoing-issue-list">{issues.map((issue) => <li key={issue.identifier}>
        <div className="ongoing-issue-heading"><div><strong>{issue.identifier}</strong><h3>{issue.title}</h3></div><a href={issue.url} target="_blank" rel="noreferrer">Open {issue.identifier} in Linear ↗</a></div>
        <p>{issue.estimate === null ? "Unestimated" : `${issue.estimate.toLocaleString()} estimated pts`} · Source workflow: <strong>{issue.workflow}</strong></p>
        {inspection.view === "available" && issue.unresolvedBlockers.length > 0 && <div className="ongoing-blockers"><h4>Unresolved blockers</h4><ul>{issue.unresolvedBlockers.map((blocker) => <li key={blocker.id}>{blocker.unavailable
          ? <><strong>Unavailable source context</strong><span>Linear blocker {blocker.id} is related but is not available in the connected team cache.</span></>
          : <><strong>{blocker.identifier ?? blocker.id}{blocker.title ? ` · ${blocker.title}` : ""}</strong><span>{blocker.workflow ? `Source workflow: ${blocker.workflow}` : "Source workflow unavailable"}</span>{blocker.url && <a href={blocker.url} target="_blank" rel="noreferrer">Open blocker in Linear ↗</a>}</>}
        </li>)}</ul></div>}
        {inspection.view === "available" && !issue.unresolvedBlockers.length && <p className="meta">No unresolved blockers contribute to this bucket.</p>}
      </li>)}</ul>}
    </div>
  </dialog>;
}

function cycleLabel(cycle: CompletedHistoryCycle) {
  return cycle.name ? `${cycle.name}, cycle ${cycle.number}` : `Cycle ${cycle.number}`;
}

function historyCellName(row: CompletedHistoryRow, cycle: CompletedHistoryCycle, cell: WorkMetric, metric: HistoryMetric) {
  const value = metric === "issues" ? count(cell.issueCount, "issue") : `${cell.knownPoints.toLocaleString()} known points`;
  return `Inspect ${row.label}, ${cycleLabel(cycle)}: ${metric === "issues" ? "Issues" : "Points"} ${value}; ${count(cell.issueCount, "issue")}; ${count(cell.unestimatedCount, "unestimated issue")}`;
}

function HistoryRows({ rows, cycles, metric, maximum, attention, onInspect }: {
  rows: CompletedHistoryRow[];
  cycles: CompletedHistoryCycle[];
  metric: HistoryMetric;
  maximum: number;
  attention?: boolean;
  onInspect: (row: CompletedHistoryRow, cycle: CompletedHistoryCycle, opener: HTMLElement) => void;
}) {
  return <tbody className={attention ? "history-attention-rows" : undefined}>{rows.map((row) => <tr key={row.rowId} data-history-row={row.rowId}>
    <th scope="row" className="history-row-label">{attention && <small>Attention</small>}<span>{row.label}</span></th>
    {cycles.map((cycle) => {
      const cell = row.cells.find((candidate) => candidate.cycleId === cycle.id);
      if (!cell) return <td key={cycle.id} className="history-zero"><span aria-label={`${row.label}, ${cycleLabel(cycle)}: 0`}>0</span></td>;
      const value = metric === "issues" ? cell.issueCount : cell.knownPoints;
      return <td key={cycle.id}><button type="button" className="history-cell" style={{ "--history-intensity": value / maximum } as CSSProperties}
        aria-label={historyCellName(row, cycle, cell, metric)} data-history-value={value} onClick={(event) => onInspect(row, cycle, event.currentTarget)}>{value.toLocaleString()}</button></td>;
    })}
  </tr>)}</tbody>;
}

function CompletedHistoryMatrix({ initial, onInspect }: {
  initial: CompletedHistory;
  onInspect: (row: CompletedHistoryRow, cycle: CompletedHistoryCycle, metric: HistoryMetric, opener: HTMLElement) => void;
}) {
  const [metric, setMetric] = useState<HistoryMetric>("issues");
  const [expanded, setExpanded] = useState<CompletedHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const history = expanded ?? initial;
  const rows = [...history.rows, ...history.attentionRows];
  const maximum = Math.max(1, ...rows.flatMap((row) => row.cells.map((cell) => metric === "issues" ? cell.issueCount : cell.knownPoints)));

  useEffect(() => { setExpanded(null); setError(""); }, [initial]);

  const showOlder = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ongoing-work?history=all", { cache: "no-store" });
      const data = await readApiResponse<OngoingWorkInsights>(response, "Could not load older completed cycles");
      setExpanded(data.completedHistory);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load older completed cycles"); }
    finally { setLoading(false); }
  };

  return <section className="ongoing-history" aria-labelledby="ongoing-history-title">
    <div className="compact-section-head ongoing-history-head"><div><p className="eyebrow">Completed cycle history</p><h4 id="ongoing-history-title">Completed work by actual Linear cycle</h4><p>Exact values are primary. Cell intensity uses one global scale across all shown rows and cycles as a secondary comparison cue.</p></div>
      <fieldset className="history-metric"><legend>History metric</legend><label><input type="radio" name="history-metric" value="issues" checked={metric === "issues"} onChange={() => setMetric("issues")} /> Issues</label><label><input type="radio" name="history-metric" value="points" checked={metric === "points"} onChange={() => setMetric("points")} /> Points</label></fieldset>
    </div>
    {initial.missingCycleCoverageCount > 0 && <p className="history-coverage" role="note"><strong>Cycle coverage:</strong> {count(initial.missingCycleCoverageCount, "completed issue")} {initial.missingCycleCoverageCount === 1 ? "falls" : "fall"} outside imported completed cycle dates and is not assigned to an invented cycle.</p>}
    {!history.cycles.length || !rows.length ? <p className="ongoing-empty empty">No completed Ongoing work is available within imported completed Linear cycles.</p> : <div className="history-scroll" tabIndex={0} aria-label="Completed work history matrix; scroll horizontally for more cycles">
      <table className="history-table" aria-label={`Completed work by actual Linear cycle, ${metric === "issues" ? "Issues" : "Points"}`}>
        <thead><tr><th scope="col" className="history-row-label">Project or attention</th>{history.cycles.map((cycle) => <th scope="col" key={cycle.id}><strong>{cycle.name ?? `Cycle ${cycle.number}`}</strong>{cycle.name && <span>Cycle {cycle.number}</span>}</th>)}</tr></thead>
        <HistoryRows rows={history.rows} cycles={history.cycles} metric={metric} maximum={maximum} onInspect={(row, cycle, opener) => onInspect(row, cycle, metric, opener)} />
        {!!history.attentionRows.length && <HistoryRows rows={history.attentionRows} cycles={history.cycles} metric={metric} maximum={maximum} attention onInspect={(row, cycle, opener) => onInspect(row, cycle, metric, opener)} />}
      </table>
    </div>}
    {!expanded && initial.olderCycleCount > 0 && <div className="history-older"><button type="button" className="secondary" disabled={loading} onClick={() => void showOlder()}>Show older cycles ({initial.olderCycleCount})</button>{loading && <span role="status">Loading older completed cycles…</span>}</div>}
    {error && <div className="history-load-error" role="alert"><span>{error}</span><button type="button" className="secondary" onClick={() => void showOlder()}>Retry older cycles</button></div>}
  </section>;
}

function AvailableTable({ label, rows, maxIssues, onInspect, classificationControl }: {
  label: string;
  rows: AvailableWorkRow[];
  maxIssues: number;
  onInspect: (row: AvailableWorkRow, bucket: WorkBucket, opener: HTMLElement) => void;
  classificationControl?: (row: AvailableWorkRow) => ReactNode;
}) {
  return <div className="ongoing-table-wrap"><table className="ongoing-table" aria-label={label}>
    <thead><tr><th scope="col">Project</th><th scope="col">Available issues</th><th scope="col">Context</th></tr></thead>
    <tbody>{rows.map((row) => {
      const total = buckets.reduce((sum, bucket) => sum + row[bucket].issueCount, 0);
      return <tr key={row.rowId} data-ongoing-row={row.rowId}>
        <th scope="row"><a href={row.projectUrl} target="_blank" rel="noreferrer">{row.projectName}</a>{classificationControl?.(row)}</th>
        <td><div className="available-segments" role="group" aria-label={`${row.projectName} available work; widths represent issue counts only`}>
          {buckets.map((bucket) => row[bucket].issueCount > 0
            ? <button key={bucket} type="button" className={`available-segment ${bucket}`} style={{ flexGrow: row[bucket].issueCount }} data-issue-count={row[bucket].issueCount} aria-label={segmentName(row, bucket)} onClick={(event) => onInspect(row, bucket, event.currentTarget)}><span>{bucketLabel[bucket]}</span><strong>{row[bucket].issueCount}</strong></button>
            : <span key={bucket} className={`available-segment-zero ${bucket}`} aria-label={`${bucketLabel[bucket]}: 0 issues`}><span>{bucketLabel[bucket]}</span><strong>0</strong></span>)}
          {maxIssues > total && <span className="available-segment-remainder" style={{ flexGrow: maxIssues - total }} aria-hidden="true" />}
        </div><div className="available-values">{buckets.map((bucket) => <span key={bucket}><strong>{bucketLabel[bucket]}</strong> {metricText(row[bucket])}</span>)}</div></td>
        <td><span>{count(row.startedCount, "issue")} in progress</span><small>Secondary context only</small></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

export default function OngoingAvailableWork({ rows, needsClassificationRows, completedHistory, classificationControl }: {
  rows: AvailableWorkRow[];
  needsClassificationRows: AvailableWorkRow[];
  completedHistory: CompletedHistory;
  classificationControl: (row: AvailableWorkRow) => ReactNode;
}) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const allRows = [...rows, ...needsClassificationRows];
  const maxIssues = Math.max(1, ...allRows.map((row) => buckets.reduce((sum, bucket) => sum + row[bucket].issueCount, 0)));
  const inspect = (row: AvailableWorkRow, bucket: WorkBucket, opener: HTMLElement) => {
    if (document.querySelector("dialog[open]")) return;
    setInspection({ view: "available", row, bucket, opener });
  };

  return <section className="ongoing-work" aria-labelledby="ongoing-work-title">
    <div className="compact-section-head"><div><p className="eyebrow">Current source snapshot</p><h3 id="ongoing-work-title" tabIndex={-1}>Ongoing work</h3><p>Issue-count geometry shows work available to pull. It does not represent schedule, capacity, forecast, target dates, or ownership.</p></div><span className="count">{rows.length}</span></div>
    <div className="ongoing-legend" aria-label="Available work categories"><span className="ready">Ready</span><span className="blocked">Blocked</span><span className="backlog">Backlog</span><small>Widths use issue count only; exact estimates and uncertainty are printed below each segment.</small></div>
    {rows.length ? <AvailableTable label="Ongoing available work" rows={rows} maxIssues={maxIssues} onInspect={inspect} /> : <p className="ongoing-empty empty">No projects are currently classified Ongoing. Available work will appear here after source labels synchronize or a local classification is saved.</p>}
    {!!needsClassificationRows.length && <section className="ongoing-attention" aria-labelledby="ongoing-needs-classification-title">
      <div className="compact-section-head"><div><p className="eyebrow">Attention · excluded from Ongoing totals</p><h4 id="ongoing-needs-classification-title" tabIndex={-1}>Needs classification</h4><p>Resolve ambiguous Linear labels locally without losing the current work evidence.</p></div><span className="count">{needsClassificationRows.length}</span></div>
      <AvailableTable label="Needs classification available work" rows={needsClassificationRows} maxIssues={maxIssues} onInspect={inspect} classificationControl={classificationControl} />
    </section>}
    <CompletedHistoryMatrix initial={completedHistory} onInspect={(row, cycle, metric, opener) => {
      if (document.querySelector("dialog[open]")) return;
      setInspection({ view: "history", row, cycle, metric, opener });
    }} />
    {inspection && <IssueInspection inspection={inspection} onClose={() => setInspection(null)} />}
  </section>;
}
