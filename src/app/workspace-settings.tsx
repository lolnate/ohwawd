"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardState } from "./board";
import { apiRequest } from "./client-api";
import { planningWeeks, type PlanningWeek } from "@/lib/planning-calendar";
import CalendarAvailability, { type WeekDraft } from "./calendar-availability";
import { CapacitySettings, ScopeReadinessSettings, capacityDraft } from "./settings-editors";

const sections = [
  { id: "capacity", title: "Capacity assumptions", description: "Baseline delivery capacity, reserve points, and forecast horizon." },
  { id: "scope", title: "Scope readiness", description: "The lead time for preparing project scope before delivery begins." },
  { id: "availability", title: "Weekly availability and holidays", description: "Weekly availability overrides and holiday planning assumptions." },
] as const;

export type SettingsSection = (typeof sections)[number]["id"];
export type SettingsTarget = { section: SettingsSection; week?: PlanningWeek; focusField?: boolean; opener?: HTMLElement | null };
export type SettingsRequest = SettingsTarget & { id: number; opener: HTMLElement | null };
type SaveResult = { board: BoardState; refreshError: string };
type Feedback = { notice?: string; error?: string; refreshError?: string };
const emptyWeek: WeekDraft = { weekStart: "", availability: "50", label: "" };

function weekDraft(board: BoardState, start: string): WeekDraft {
  if (!start) return { ...emptyWeek };
  const week = planningWeeks({ cycles: board.planningCycles ?? board.linearCycles, timezone: board.timezone, anchorDate: start,
    overrides: board.weeklyAdjustments ?? [], holidays: board.capacity.holidays_enabled ? board.holidayWeeks ?? [] : [],
    adjustments: board.adjustments.map((item) => ({ cycleId: item.linear_cycle_id, availability: item.availability })), minimumWeeks: 1 })[0];
  return { weekStart: start, availability: String(Math.round(week.availability * 100)), label: week.label === "Normal availability" ? "" : week.label };
}

// Keep submitted writes alive when the visible dialog closes. Each opening gets
// fresh form state, and reopening waits for any previous write to settle.
export default function WorkspaceSettings({ request, onClose, onChanged }: {
  request: SettingsRequest | null; onClose: () => void; onChanged: (board: BoardState) => Promise<void>;
}) {
  const pending = useRef<Promise<SaveResult> | null>(null);
  const [saving, setSaving] = useState(false);
  const waitForSave = useCallback(async () => { try { await pending.current; } catch { /* The new opening loads canonical state after a failed write too. */ } }, []);

  function save(change: Record<string, unknown>): Promise<SaveResult> {
    if (pending.current) return Promise.reject(new Error("A settings change is already saving."));
    setSaving(true);
    const operation = (async () => {
      const board = await apiRequest<BoardState>("/api/board", "PUT", change, "Could not save settings");
      let refreshError = "";
      try { await onChanged(board); }
      catch { refreshError = "Settings were saved, but workspace views could not be refreshed."; }
      return { board, refreshError };
    })().finally(() => { pending.current = null; setSaving(false); });
    pending.current = operation;
    return operation;
  }

  return request && <SettingsDialog key={request.id} request={request} onClose={onClose} saving={saving} waitForSave={waitForSave} onSave={save} onRefresh={onChanged} />;
}

function outside(dialog: HTMLDialogElement, x: number, y: number) {
  const bounds = dialog.getBoundingClientRect();
  return x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom;
}

function SettingsDialog({ request, onClose, saving, waitForSave, onSave, onRefresh }: {
  request: SettingsRequest; onClose: () => void; saving: boolean; waitForSave: () => Promise<void>;
  onSave: (change: Record<string, unknown>) => Promise<SaveResult>; onRefresh: (board: BoardState) => Promise<void>;
}) {
  const [sectionId, setSectionId] = useState<SettingsSection>(request.section);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [capacity, setCapacity] = useState({ baseline: "", reserve: "0", horizon: "26", reason: "" });
  const [leadDays, setLeadDays] = useState("14");
  const [weekly, setWeekly] = useState<WeekDraft>({ ...emptyWeek });
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Partial<Record<SettingsSection, Feedback>>>({});
  const loadGeneration = useRef(0);
  const focusedTarget = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  const section = sections.find((item) => item.id === sectionId)!;

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true); setLoadError("");
    try {
      await waitForSave();
      if (generation !== loadGeneration.current) return;
      const data = await apiRequest<BoardState>("/api/board", "GET", undefined, "Could not load settings");
      if (generation !== loadGeneration.current) return;
      setBoard(data); setCapacity(capacityDraft(data)); setLeadDays(String(data.capacity.scoping_lead_days ?? 14));
      setWeekly(weekDraft(data, request.week?.start ?? "")); setWeeklyDirty(false);
    } catch (reason) {
      if (generation === loadGeneration.current) setLoadError(reason instanceof Error ? reason.message : "Could not load settings");
    } finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [request, waitForSave]);
  useEffect(() => { void load(); return () => { ++loadGeneration.current; }; }, [load]);
  useEffect(() => {
    if (loading || !board || focusedTarget.current) return;
    focusedTarget.current = true;
    if (request.focusField) dialogRef.current?.querySelector<HTMLElement>(request.section === "capacity" ? "#settings-baseline" : request.section === "scope" ? "#settings-lead-days" : "#settings-week")?.focus();
  }, [loading, board, request]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = request.opener;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      const target = opener?.isConnected && opener.getClientRects().length ? opener : document.getElementById("workspace-settings-button");
      target?.focus({ preventScroll: true });
    };
  }, [request]);

  async function saveChange(change: Record<string, unknown>, message: string): Promise<boolean> {
    const target = sectionId;
    const previousBoard = board;
    if (change.type === "holidayPreset" && board) setBoard({ ...board, capacity: { ...board.capacity, holidays_enabled: Boolean(change.enabled) } });
    setFeedback((old) => ({ ...old, [target]: {} }));
    try {
      const result = await onSave(change);
      setBoard(result.board);
      if (change.type === "capacity") setCapacity(capacityDraft(result.board));
      if (change.type === "scoping") setLeadDays(String(result.board.capacity.scoping_lead_days));
      if (change.type === "weeklyAvailability" && !change.remove) setWeeklyDirty(false);
      if ((change.type === "holidayPreset" || (change.type === "weeklyAvailability" && change.remove && change.weekStart === weekly.weekStart)) && !weeklyDirty) setWeekly(weekDraft(result.board, weekly.weekStart));
      setFeedback((old) => ({ ...old, [target]: { notice: message, refreshError: result.refreshError } }));
      return true;
    } catch (reason) {
      if (change.type === "holidayPreset") setBoard(previousBoard);
      setFeedback((old) => ({ ...old, [target]: { error: reason instanceof Error ? reason.message : "Could not save settings" } }));
      return false;
    }
  }

  async function retryRefresh() {
    if (!board) return;
    try { await onRefresh(board); setFeedback((old) => ({ ...old, [sectionId]: { ...old[sectionId], refreshError: "" } })); }
    catch { /* Keep the saved-but-not-refreshed explanation and retry action. */ }
  }
  const currentFeedback = feedback[sectionId];

  return <dialog ref={dialogRef} className="workspace-settings" aria-labelledby="workspace-settings-title" aria-describedby="workspace-settings-description"
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']")).filter((element) => element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      // Keep edge traversal inside the surface rather than moving into browser chrome.
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY); }}
    onPointerCancel={() => { backdropPress.current = false; }}
    onClick={(event) => {
      const startedOutside = backdropPress.current;
      backdropPress.current = false;
      if (startedOutside && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY)) onClose();
    }}>
    <header className="workspace-settings-header">
      <div><h2 id="workspace-settings-title" ref={headingRef} tabIndex={-1}>Settings</h2><p id="workspace-settings-description">Shared planning assumptions for this workspace.</p></div>
      <button type="button" className="secondary" aria-label="Close Settings" onClick={onClose}>Close</button>
    </header>
    <div className="workspace-settings-body">
      <nav className="workspace-settings-nav" aria-label="Settings sections">{sections.map((item) => <button type="button" key={item.id} aria-current={sectionId === item.id ? "true" : undefined} onClick={() => setSectionId(item.id)}>{item.title}</button>)}</nav>
      <section className="workspace-settings-content" aria-labelledby={`settings-${section.id}-title`}>
        <h3 id={`settings-${section.id}-title`}>{section.title}</h3>
        <p>{section.description}</p>
        {loading && <p role="status">{saving ? "Finishing the previous settings save…" : "Loading settings…"}</p>}
        {loadError && <div><p className="error" role="alert">{loadError}</p><button className="secondary" onClick={() => void load()}>Retry loading settings</button></div>}
        {!loading && board && <>
          {saving && <p role="status">Saving settings…</p>}
          {currentFeedback?.error && <p className="error" role="alert">{currentFeedback.error}</p>}
          {currentFeedback?.notice && <p className="notice" role="status">{currentFeedback.notice}</p>}
          {currentFeedback?.refreshError && <div className="warning" role="alert">{currentFeedback.refreshError} <button type="button" className="text-button" onClick={() => void retryRefresh()}>Retry workspace refresh</button></div>}
          <fieldset disabled={saving}>
            {sectionId === "capacity" && <CapacitySettings board={board} draft={capacity} onChange={setCapacity} onSave={() => void saveChange({ type: "capacity", baseline: capacity.baseline === "" ? null : Number(capacity.baseline), reserve: Number(capacity.reserve), horizon: Number(capacity.horizon), reason: capacity.reason }, "Capacity profile saved.")} />}
            {sectionId === "scope" && <ScopeReadinessSettings leadDays={leadDays} onChange={setLeadDays} onSave={() => void saveChange({ type: "scoping", leadDays: Number(leadDays) }, "Scoping window saved.")} />}
            {sectionId === "availability" && <CalendarAvailability enabled={board.capacity.holidays_enabled ?? true} overrides={board.weeklyAdjustments ?? []} holidays={board.holidayWeeks ?? []} draft={weekly} busy={saving}
              onChange={(value) => { setWeekly(value); setWeeklyDirty(true); }} onChooseWeek={(week) => { setWeekly(weekDraft(board, week)); setWeeklyDirty(false); }} onSave={saveChange} />}
          </fieldset>
        </>}
      </section>
    </div>
  </dialog>;
}
