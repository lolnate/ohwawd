"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AvailableWorkRow, OngoingWorkIssueDetail, WorkBucket, WorkMetric } from "@/lib/ongoing-work-insights";
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

type Inspection = { row: AvailableWorkRow; bucket: WorkBucket; opener: HTMLElement | null };

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
  const { row, bucket, opener } = inspection;

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
    const params = new URLSearchParams({ view: "available", row: row.rowId, bucket });
    void fetch(`/api/ongoing-work/issues?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => readApiResponse<{ issues: OngoingWorkIssueDetail[] }>(response, "Could not load issue inspection"))
      .then((data) => setIssues(data.issues))
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Could not load issue inspection"); });
    return () => controller.abort();
  }, [row.rowId, bucket, attempt]);

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
      <div><p className="eyebrow">{row.group === "needs-classification" ? "Needs classification" : "Ongoing work"} · {bucketLabel[bucket]}</p><h2 id="ongoing-inspection-title" ref={titleRef} tabIndex={-1}>{row.projectName}</h2><p>{metricText(row[bucket])}</p></div>
      <button type="button" className="secondary" onClick={onClose} aria-label="Close issue inspection">Close</button>
    </header>
    <div className="ongoing-inspection-body">
      {!issues && !error && <p className="ongoing-inspection-state" role="status">Loading contributing issues…</p>}
      {error && <div className="ongoing-inspection-state error" role="alert"><p>{error}</p><button type="button" className="secondary" onClick={() => setAttempt((value) => value + 1)}>Retry issue inspection</button></div>}
      {issues && !issues.length && <p className="ongoing-inspection-state empty">No contributing issues remain. Refresh the Board for current counts.</p>}
      {issues && !!issues.length && <ul className="ongoing-issue-list">{issues.map((issue) => <li key={issue.identifier}>
        <div className="ongoing-issue-heading"><div><strong>{issue.identifier}</strong><h3>{issue.title}</h3></div><a href={issue.url} target="_blank" rel="noreferrer">Open {issue.identifier} in Linear ↗</a></div>
        <p>{issue.estimate === null ? "Unestimated" : `${issue.estimate.toLocaleString()} estimated pts`} · Source workflow: <strong>{issue.workflow}</strong></p>
        {issue.unresolvedBlockers.length > 0 && <div className="ongoing-blockers"><h4>Unresolved blockers</h4><ul>{issue.unresolvedBlockers.map((blocker) => <li key={blocker.id}>{blocker.unavailable
          ? <><strong>Unavailable source context</strong><span>Linear blocker {blocker.id} is related but is not available in the connected team cache.</span></>
          : <><strong>{blocker.identifier ?? blocker.id}{blocker.title ? ` · ${blocker.title}` : ""}</strong><span>{blocker.workflow ? `Source workflow: ${blocker.workflow}` : "Source workflow unavailable"}</span>{blocker.url && <a href={blocker.url} target="_blank" rel="noreferrer">Open blocker in Linear ↗</a>}</>}
        </li>)}</ul></div>}
        {!issue.unresolvedBlockers.length && <p className="meta">No unresolved blockers contribute to this bucket.</p>}
      </li>)}</ul>}
    </div>
  </dialog>;
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

export default function OngoingAvailableWork({ rows, needsClassificationRows, classificationControl }: {
  rows: AvailableWorkRow[];
  needsClassificationRows: AvailableWorkRow[];
  classificationControl: (row: AvailableWorkRow) => ReactNode;
}) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const allRows = [...rows, ...needsClassificationRows];
  const maxIssues = Math.max(1, ...allRows.map((row) => buckets.reduce((sum, bucket) => sum + row[bucket].issueCount, 0)));
  const inspect = (row: AvailableWorkRow, bucket: WorkBucket, opener: HTMLElement) => {
    if (document.querySelector("dialog[open]")) return;
    setInspection({ row, bucket, opener });
  };

  return <section className="ongoing-work" aria-labelledby="ongoing-work-title">
    <div className="compact-section-head"><div><p className="eyebrow">Current source snapshot</p><h3 id="ongoing-work-title" tabIndex={-1}>Ongoing work</h3><p>Issue-count geometry shows work available to pull. It does not represent schedule, capacity, forecast, target dates, or ownership.</p></div><span className="count">{rows.length}</span></div>
    <div className="ongoing-legend" aria-label="Available work categories"><span className="ready">Ready</span><span className="blocked">Blocked</span><span className="backlog">Backlog</span><small>Widths use issue count only; exact estimates and uncertainty are printed below each segment.</small></div>
    {rows.length ? <AvailableTable label="Ongoing available work" rows={rows} maxIssues={maxIssues} onInspect={inspect} /> : <p className="ongoing-empty empty">No projects are currently classified Ongoing. Available work will appear here after source labels synchronize or a local classification is saved.</p>}
    {!!needsClassificationRows.length && <section className="ongoing-attention" aria-labelledby="ongoing-needs-classification-title">
      <div className="compact-section-head"><div><p className="eyebrow">Attention · excluded from Ongoing totals</p><h4 id="ongoing-needs-classification-title">Needs classification</h4><p>Resolve ambiguous Linear labels locally without losing the current work evidence.</p></div><span className="count">{needsClassificationRows.length}</span></div>
      <AvailableTable label="Needs classification available work" rows={needsClassificationRows} maxIssues={maxIssues} onInspect={inspect} classificationControl={classificationControl} />
    </section>}
    {inspection && <IssueInspection inspection={inspection} onClose={() => setInspection(null)} />}
  </section>;
}
