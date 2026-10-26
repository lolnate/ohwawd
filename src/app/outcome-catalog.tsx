"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { indexCatalog, queryCatalog, type CatalogFilters, type CatalogOutcome, type CatalogSort } from "@/lib/outcome-catalog";
import { millisecondsUntilNextTeamDate, teamLocalDate } from "@/lib/project-scope";
import { outcomeLifecycleSummary } from "./outcome-lifecycle-view";
import type { OutcomeForecast } from "@/lib/forecast";

const defaults: CatalogFilters = { search: "", owner: "all", stream: "all", projects: "all", targetDate: "all" };
type Data = Parameters<typeof indexCatalog>[0] & { timezone: string };

function forecastHealth(forecast: OutcomeForecast | undefined, error: string) {
  if (!forecast) return { label: error ? "Unavailable" : "Loading", tone: "neutral", detail: "", title: error || "Forecast is loading." };
  const title = forecast.reasons.join(" ") || undefined;
  const detail = [forecast.endDate, forecast.calendarProjected ? "projected" : null].filter(Boolean).join(" · ");
  if (forecast.status === "blocked") return { label: "Blocked", tone: "danger", detail: "", title };
  if (forecast.status === "setup_required") return { label: "Setup needed", tone: "warning", detail: "", title };
  if (forecast.status === "beyond_horizon") return { label: "Beyond horizon", tone: "warning", detail: "", title };
  if (forecast.status === "unplanned") return { label: "Unplanned", tone: "neutral", detail: "", title };
  if (forecast.target === "missed") return { label: "At risk", tone: "warning", detail, title };
  if (forecast.target === "met") return { label: "On target", tone: "success", detail, title };
  if (forecast.status === "provisional") return { label: "Provisional", tone: "provisional", detail, title };
  if (forecast.target === "no_target") return { label: "No target", tone: "neutral", detail, title };
  return { label: "Forecast ready", tone: "success", detail, title };
}

export function focusOutcomeSection(section: "needs-assignment" | "catalog") {
  const heading = document.getElementById(`outcome-${section}-title`);
  heading?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  heading?.focus({ preventScroll: true });
}

export type CatalogContext = { ids: string[]; clear: () => void };
export default function OutcomeCatalog({ data, error, forecast, forecastError, busy, onRetry, onAdd, onInspect, onContext }: {
  data: Data | null; error: string; busy: boolean; onRetry: () => void; onAdd: () => void;
  forecast: { outcomes: OutcomeForecast[] } | null; forecastError: string;
  onInspect: (outcome: CatalogOutcome) => void; onContext: (context: CatalogContext) => void;
}) {
  const [filters, setFilters] = useState<CatalogFilters>(defaults);
  const [sort, setSort] = useState<CatalogSort>("name");
  const timezone = data?.timezone ?? "UTC";
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      const current = new Date();
      setNow(current);
      clearTimeout(timer);
      timer = setTimeout(refresh, millisecondsUntilNextTeamDate(current, timezone) + 10);
    }
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [timezone]);
  const index = useMemo(() => indexCatalog(data ?? { outcomes: [], projects: [], links: [], streams: [] }), [data]);
  const rows = useMemo(() => queryCatalog(index, filters, sort, teamLocalDate(now, timezone)), [index, filters, sort, now, timezone]);
  const forecasts = new Map(forecast?.outcomes.map((item) => [item.id, item]));
  const clear = useCallback(() => setFilters(defaults), []);
  useEffect(() => { onContext({ ids: rows.map((row) => row.id), clear }); }, [rows, clear, onContext]);
  const restricted = !!filters.search.trim() || filters.owner !== "all" || filters.stream !== "all" || filters.projects !== "all" || filters.targetDate !== "all";
  function change<K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) { setFilters((current) => ({ ...current, [key]: value })); }
  const missingOwner = filters.owner !== "all" && filters.owner !== "none" && !index.owners.some((option) => option.value === filters.owner);
  const missingStream = filters.stream !== "all" && filters.stream !== "unassigned" && !index.streams.some((stream) => stream.id === filters.stream);

  return <section className="panel outcomes-panel" id="outcome-catalog" aria-labelledby="outcome-catalog-title">
    <div className="section-head"><div><h2 id="outcome-catalog-title" tabIndex={-1}>Outcome catalog</h2><p>Browse saved outcomes and their directly linked work.</p></div></div>
    {error && <div className="error" role="alert"><p>{data ? "Could not refresh outcomes. Showing the last successfully loaded catalog." : "Could not load outcomes."} {error}</p><button type="button" className="secondary" disabled={busy} onClick={onRetry}>Retry catalog load</button></div>}
    {!data ? !error && <p role="status">Loading outcomes…</p> : <>
      <div className="catalog-search-sort">
        <label>Search outcomes<input type="search" value={filters.search} placeholder="Outcomes or linked projects…" onChange={(event) => change("search", event.target.value)} /></label>
        <label>Sort outcomes<select aria-label="Sort outcomes" value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)}><option value="name">Name A–Z</option><option value="neededBy">Needed by</option><option value="newest">Newest created</option></select></label>
      </div>
      <div className="catalog-filters">
        <label>Owner<select aria-label="Owner" value={filters.owner} onChange={(event) => change("owner", event.target.value as CatalogFilters["owner"])}><option value="all">All owners</option><option value="none">No owner</option>{index.owners.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}{missingOwner && <option value={filters.owner}>Unavailable owner: {filters.owner.slice(6)}</option>}</select></label>
        <label>Stream<select aria-label="Stream" value={filters.stream} onChange={(event) => change("stream", event.target.value)}><option value="all">All streams</option><option value="unassigned">Needs assignment</option>{index.streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}{missingStream && <option value={filters.stream}>Unavailable stream: {filters.stream}</option>}</select></label>
        <label>Projects<select aria-label="Projects" value={filters.projects} onChange={(event) => change("projects", event.target.value as CatalogFilters["projects"])}><option value="all">All project coverage</option><option value="none">No projects</option><option value="optional">Optional only</option><option value="required">Required linked</option></select></label>
        <label>Target date<select aria-label="Target date" value={filters.targetDate} onChange={(event) => change("targetDate", event.target.value as CatalogFilters["targetDate"])}><option value="all">All dates</option><option value="past">Past target date</option><option value="next30">Next 30 days</option><option value="none">No target</option></select></label>
      </div>
      <div className="catalog-results"><p role="status" aria-live="polite">{rows.length} of {index.rows.length} outcomes{restricted ? " · Filters active" : ""}</p>{restricted && <button type="button" className="text-button" onClick={() => setFilters(defaults)}>Clear filters</button>}</div>
      {!!rows.length && <><div className="catalog-columns" aria-hidden="true"><span>Outcome</span><span>Owner</span><span>Stream</span><span>Needed by</span><span>Projects</span><span>Health</span></div>
        <ul className="catalog-list">{rows.map((row) => { const health = forecastHealth(forecasts.get(row.id), forecastError); return <li key={row.id}><article className="catalog-row" id={`outcome-${row.id}`}>
          <h3><button type="button" className="catalog-title" title={row.title} onClick={() => onInspect(row)}>{row.title}</button>{outcomeLifecycleSummary(row.lifecycle) && <small className="outcome-lifecycle-summary">{outcomeLifecycleSummary(row.lifecycle)}</small>}</h3>
          <div className="catalog-cell"><span className="catalog-cell-label">Owner</span><span>{row.owner.trim() || "No owner"}</span></div>
          <div className="catalog-cell"><span className="catalog-cell-label">Stream</span><span>{index.streams.find((stream) => stream.id === row.stream_id)?.name ?? (row.stream_id ? "Unavailable stream" : "Needs assignment")}</span></div>
          <div className="catalog-cell"><span className="catalog-cell-label">Needed by</span>{row.needed_by ? <time dateTime={row.needed_by}>{row.needed_by}</time> : <span>No target</span>}</div>
          <div className="catalog-cell"><span className="catalog-cell-label">Projects</span><span>{row.requiredProjectCount + row.optionalProjectCount ? `${row.requiredProjectCount} required · ${row.optionalProjectCount} optional` : "No projects"}</span></div>
          <div className="catalog-cell catalog-health" title={health.title}><span className="catalog-cell-label">Health</span><span className={`catalog-health-label ${health.tone}`}>{health.label}</span>{health.detail && <small>{health.detail}</small>}</div>
        </article></li>; })}</ul></>}
      {!rows.length && <p className="empty">{index.rows.length ? "No outcomes match these filters. Clear filters to browse all outcomes." : "No outcomes yet. Add an outcome to start the plan."}</p>}
      {!index.rows.length && <button type="button" disabled={busy} onClick={onAdd}>Add outcome</button>}
    </>}
  </section>;
}
