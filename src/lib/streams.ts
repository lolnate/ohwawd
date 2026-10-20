import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getBoard } from "./board";
import { ensureSchema, db } from "./db";
import { compareSnapshots } from "./scenarios";
import { HttpError } from "./security";

type StreamClient = Pick<PoolClient, "query">;
type StreamRow = {
  id: string; name: string; position: number; wip_limit: number; allocation: number;
  active: boolean; retired_at: Date | null; retirement_reason: string; package_count?: number;
};
type ActiveDraft = { id: string; edit_version: string | number; draft_source_at: Date };
type Migration = { packageId: string; targetStreamId: string | null };

async function useDatabase(client?: StreamClient): Promise<StreamClient> {
  if (!client) await ensureSchema();
  return client ?? db();
}

function text(value: unknown, label: string, max: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > max) throw new HttpError(400, `${label} is required and must be at most ${max} characters.`);
  return result;
}

function streamId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-z-]{3,80}$/i.test(value)) throw new HttpError(400, "Stream ID is invalid.");
  return value;
}

function canonicalFingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(canonical).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonical(nested)]));
    return item;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

async function activeDraft(database: StreamClient, lock = false): Promise<ActiveDraft | null> {
  const result = await database.query<ActiveDraft>(`SELECT scenario.id,scenario.edit_version,scenario.draft_source_at
    FROM workspace_scenario_state state JOIN scenario ON scenario.id=state.active_scenario_id
    WHERE state.workspace_id=1${lock ? " FOR UPDATE OF scenario" : ""}`);
  return result.rows[0] ?? null;
}

async function requireDraftVersion(database: StreamClient, expectedVersion: unknown): Promise<ActiveDraft | null> {
  const draft = await activeDraft(database, true);
  if (!draft) return null;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== Number(draft.edit_version)) {
    throw new HttpError(409, "The active scenario changed. Refresh stream management before continuing.", {
      code: "EDIT_VERSION_CONFLICT", expectedVersion, currentVersion: Number(draft.edit_version),
    });
  }
  const current = await database.query<{ source_at: Date }>(`SELECT COALESCE(GREATEST(connection.last_imported_at,connection.cycles_refreshed_at),workspace.created_at) AS source_at
    FROM workspace LEFT JOIN linear_connection connection ON connection.workspace_id=workspace.id WHERE workspace.id=1`);
  if (current.rows[0].source_at.getTime() > draft.draft_source_at.getTime()) {
    throw new HttpError(409, "Rebase the active scenario before changing the stream configuration.", { code: "SOURCE_STALE" });
  }
  return draft;
}

async function saveActiveDraft(database: StreamClient, draft: ActiveDraft | null): Promise<number | null> {
  if (!draft) return null;
  const board = await getBoard(database);
  const updated = await database.query<{ edit_version: string | number }>(`UPDATE scenario SET draft_snapshot=$3::jsonb,
    edit_version=edit_version+1,updated_at=now() WHERE id=$1 AND edit_version=$2 RETURNING edit_version`,
  [draft.id, draft.edit_version, JSON.stringify(board)]);
  if (!updated.rowCount) throw new HttpError(409, "The active scenario changed during the stream update.", { code: "EDIT_VERSION_CONFLICT" });
  return Number(updated.rows[0].edit_version);
}

async function recordEvent(database: StreamClient, streamIdValue: string | null, action: string, actor: string, rationale: string, payload: unknown): Promise<void> {
  await database.query(`INSERT INTO stream_lifecycle_event(id,stream_id,action,actor,rationale,payload)
    VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [randomUUID(), streamIdValue, action, actor, rationale, JSON.stringify(payload)]);
}

async function orderedActiveStreams(database: StreamClient, lock = false): Promise<StreamRow[]> {
  const result = await database.query<StreamRow>(`SELECT id,name,position,wip_limit,allocation::float,active,retired_at,retirement_reason
    FROM stream WHERE active=true ORDER BY position${lock ? " FOR UPDATE" : ""}`);
  return result.rows;
}

async function writeOrder(database: StreamClient, ids: string[]): Promise<void> {
  await database.query("UPDATE stream SET position=position+100000 WHERE active=true");
  for (let index = 0; index < ids.length; index++) {
    await database.query("UPDATE stream SET position=$2 WHERE id=$1 AND active=true", [ids[index], index + 1]);
  }
}

function parseMigrations(value: unknown, packages: { id: string }[], activeIds: Set<string>, retiringId: string): Migration[] {
  if (!Array.isArray(value)) throw new HttpError(400, "Choose a destination for every affected package.");
  const expected = new Set(packages.map((item) => item.id));
  const seen = new Set<string>();
  const migrations = value.map((item): Migration => {
    if (!item || typeof item !== "object") throw new HttpError(400, "Each package migration is invalid.");
    const packageId = (item as Record<string, unknown>).packageId;
    const target = (item as Record<string, unknown>).targetStreamId;
    if (typeof packageId !== "string" || !expected.has(packageId) || seen.has(packageId)) throw new HttpError(400, "Choose each affected package exactly once.");
    if (target !== null && (typeof target !== "string" || target === retiringId || !activeIds.has(target))) throw new HttpError(400, "Choose an active destination stream or Needs assignment.");
    seen.add(packageId);
    return { packageId, targetStreamId: target as string | null };
  });
  if (seen.size !== expected.size) throw new HttpError(400, "Choose a destination for every affected package.");
  return migrations;
}

async function retirementState(database: StreamClient, id: string, migrationInput: unknown) {
  const target = await database.query<StreamRow>(`SELECT id,name,position,wip_limit,allocation::float,active,retired_at,retirement_reason
    FROM stream WHERE id=$1`, [id]);
  const retiring = target.rows[0];
  if (!retiring || !retiring.active) throw new HttpError(404, "Active stream not found.");
  const activeStreams = await orderedActiveStreams(database);
  if (activeStreams.length <= 1) throw new HttpError(409, "At least one active stream must remain.");
  const packages = (await database.query<{ id: string; project_id: string; name: string; status: string; selected: boolean; in_scope: boolean }>(`SELECT package.id,package.project_id,project.name,project.status,package.selected,project.in_scope
    FROM work_package package JOIN linear_project_cache project ON project.linear_id=package.project_id
    WHERE package.stream_id=$1 ORDER BY project.name`, [id])).rows;
  const activeIds = new Set(activeStreams.map((item) => item.id));
  const migrations = parseMigrations(migrationInput === undefined
    ? packages.map((item) => ({ packageId: item.id, targetStreamId: null }))
    : migrationInput, packages, activeIds, id);
  const packageIds = packages.map((item) => item.id);
  const projectIds = packages.map((item) => item.project_id);
  const outcomes = projectIds.length ? (await database.query<{ id: string; title: string }>(`SELECT DISTINCT outcome.id,outcome.title FROM outcome
    JOIN outcome_project_link link ON link.outcome_id=outcome.id WHERE link.project_id=ANY($1::text[]) ORDER BY outcome.title`, [projectIds])).rows : [];
  const dependencies = packageIds.length ? (await database.query<{ predecessor_id: string; successor_id: string; source: string }>(`SELECT predecessor_id,successor_id,source FROM package_dependency
    WHERE predecessor_id=ANY($1::text[]) OR successor_id=ANY($1::text[]) ORDER BY predecessor_id,successor_id`, [packageIds])).rows : [];
  const scenarios = await database.query<{ id: string; name: string; draft_snapshot: { streams?: { id: string }[]; packages?: { stream_id: string | null }[] } }>("SELECT id,name,draft_snapshot FROM scenario ORDER BY name");
  const revisions = await database.query<{ id: string; scenario_name: string; revision_number: number; snapshot: { streams?: { id: string }[]; packages?: { stream_id: string | null }[] } }>(`SELECT revision.id,scenario.name AS scenario_name,revision.revision_number,revision.snapshot
    FROM scenario_revision revision JOIN scenario ON scenario.id=revision.scenario_id ORDER BY scenario.name,revision.revision_number`);
  const references = (snapshot: { streams?: { id: string }[]; packages?: { stream_id: string | null }[] }) =>
    snapshot.streams?.some((item) => item.id === id) || snapshot.packages?.some((item) => item.stream_id === id);
  const draft = await activeDraft(database);
  const draftReferences = scenarios.rows.filter((item) => references(item.draft_snapshot)).map((item) => ({ id: item.id, name: item.name, active: item.id === draft?.id }));
  const revisionReferences = revisions.rows.filter((item) => references(item.snapshot)).map((item) => ({ id: item.id, name: item.scenario_name, revisionNumber: item.revision_number }));
  const beforeBoard = await getBoard(database);
  const tokenState = { board: beforeBoard, migrations, draftReferences, revisionReferences,
    activeDraft: draft && { id: draft.id, editVersion: Number(draft.edit_version) } };
  return { retiring, activeStreams, packages, migrations, outcomes, dependencies, draftReferences, revisionReferences,
    previewToken: canonicalFingerprint(tokenState), beforeBoard };
}

async function applyRetirementRows(database: StreamClient, id: string, migrations: Migration[], reason: string): Promise<void> {
  for (const migration of migrations) {
    const updated = await database.query("UPDATE work_package SET stream_id=$2 WHERE id=$1 AND stream_id=$3", [migration.packageId, migration.targetStreamId, id]);
    if (!updated.rowCount) throw new HttpError(409, "A package assignment changed after the preview. Preview retirement again.", { code: "STREAM_PREVIEW_STALE" });
  }
  await database.query("UPDATE stream SET active=false,allocation=0,retired_at=now(),retirement_reason=$2 WHERE id=$1 AND active=true", [id, reason]);
  const remaining = await orderedActiveStreams(database);
  await writeOrder(database, remaining.map((item) => item.id));
}

export async function listStreams(client?: StreamClient) {
  const database = await useDatabase(client);
  const [streams, events, draft] = await Promise.all([
    database.query<StreamRow & { package_count: number }>(`SELECT stream.id,stream.name,stream.position,stream.wip_limit,stream.allocation::float,
      stream.active,stream.retired_at,stream.retirement_reason,COUNT(package.id)::integer AS package_count
      FROM stream LEFT JOIN work_package package ON package.stream_id=stream.id
      GROUP BY stream.id ORDER BY stream.active DESC,stream.position,stream.name`),
    database.query<{ id: string; stream_id: string | null; action: string; actor: string; rationale: string; created_at: Date }>(`SELECT id,stream_id,action,actor,rationale,created_at
      FROM stream_lifecycle_event ORDER BY created_at DESC LIMIT 20`),
    activeDraft(database),
  ]);
  return {
    streams: streams.rows.map((item) => ({ ...item, retired_at: item.retired_at?.toISOString() ?? null })),
    events: events.rows.map((item) => ({ ...item, created_at: item.created_at.toISOString() })),
    activeScenario: draft ? { id: draft.id, editVersion: Number(draft.edit_version) } : null,
  };
}

export async function addStream(input: { name?: unknown; wip?: unknown; actor?: unknown; expectedScenarioVersion?: unknown }, client?: StreamClient) {
  const database = await useDatabase(client);
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const draft = await requireDraftVersion(database, input.expectedScenarioVersion);
  const name = text(input.name, "Stream name", 80);
  const actor = "Owner";
  if (!Number.isInteger(input.wip) || (input.wip as number) < 1 || (input.wip as number) > 50) throw new HttpError(400, "WIP must be an integer from 1 to 50.");
  if ((await database.query("SELECT id FROM stream WHERE active=true AND lower(name)=lower($1)", [name])).rowCount) throw new HttpError(409, "Choose a unique active stream name.");
  const streams = await orderedActiveStreams(database, true);
  const id = randomUUID();
  await database.query(`INSERT INTO stream(id,name,position,wip_limit,allocation,active) VALUES($1,$2,$3,$4,0,true)`, [id, name, streams.length + 1, input.wip]);
  const version = await saveActiveDraft(database, draft);
  await recordEvent(database, id, "added", actor, "", { name, wip: input.wip, position: streams.length + 1 });
  return { streamId: id, activeScenarioVersion: version };
}

export async function reorderStreams(input: { streamIds?: unknown; actor?: unknown; expectedScenarioVersion?: unknown }, client?: StreamClient) {
  const database = await useDatabase(client);
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const draft = await requireDraftVersion(database, input.expectedScenarioVersion);
  const actor = "Owner";
  const active = await orderedActiveStreams(database, true);
  if (!Array.isArray(input.streamIds) || input.streamIds.some((id) => typeof id !== "string") || new Set(input.streamIds).size !== input.streamIds.length ||
    input.streamIds.length !== active.length || active.some((item) => !(input.streamIds as string[]).includes(item.id))) {
    throw new HttpError(400, "Provide every active stream exactly once.");
  }
  await writeOrder(database, input.streamIds as string[]);
  const version = await saveActiveDraft(database, draft);
  await recordEvent(database, null, "reordered", actor, "", { before: active.map((item) => item.id), after: input.streamIds });
  return { activeScenarioVersion: version };
}

export async function previewStreamRetirement(idValue: unknown, input: { migrations?: unknown }, client?: StreamClient) {
  const database = await useDatabase(client);
  const id = streamId(idValue);
  const state = await retirementState(database, id, input.migrations);
  const { beforeBoard, ...impact } = state;
  await database.query("SAVEPOINT stream_retirement_preview");
  let after;
  try {
    await applyRetirementRows(database, id, state.migrations, "Preview");
    after = await getBoard(database);
  } finally {
    await database.query("ROLLBACK TO SAVEPOINT stream_retirement_preview");
    await database.query("RELEASE SAVEPOINT stream_retirement_preview");
  }
  return { ...impact, comparison: compareSnapshots(beforeBoard, after) };
}

export async function retireStream(idValue: unknown, input: { migrations?: unknown; previewToken?: unknown; reason?: unknown; actor?: unknown; expectedScenarioVersion?: unknown }, client?: StreamClient) {
  const database = await useDatabase(client);
  const id = streamId(idValue);
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const draft = await requireDraftVersion(database, input.expectedScenarioVersion);
  const state = await retirementState(database, id, input.migrations);
  if (typeof input.previewToken !== "string" || input.previewToken !== state.previewToken) {
    throw new HttpError(409, "The stream or its assignments changed after the preview. Preview retirement again.", { code: "STREAM_PREVIEW_STALE" });
  }
  const reason = text(input.reason, "Retirement reason", 1000);
  const actor = "Owner";
  await applyRetirementRows(database, id, state.migrations, reason);
  const version = await saveActiveDraft(database, draft);
  await recordEvent(database, id, "retired", actor, reason, { migrations: state.migrations, allocationReturned: state.retiring.allocation });
  return { streamId: id, activeScenarioVersion: version };
}

export async function restoreStream(idValue: unknown, input: { name?: unknown; actor?: unknown; expectedScenarioVersion?: unknown }, client?: StreamClient) {
  const database = await useDatabase(client);
  const id = streamId(idValue);
  await database.query("SELECT id FROM workspace WHERE id=1 FOR UPDATE");
  const draft = await requireDraftVersion(database, input.expectedScenarioVersion);
  const existing = await database.query<StreamRow>(`SELECT id,name,position,wip_limit,allocation::float,active,retired_at,retirement_reason
    FROM stream WHERE id=$1 FOR UPDATE`, [id]);
  const stream = existing.rows[0];
  if (!stream || stream.active) throw new HttpError(404, "Retired stream not found.");
  const name = input.name === undefined ? stream.name : text(input.name, "Stream name", 80);
  const actor = "Owner";
  if ((await database.query("SELECT id FROM stream WHERE active=true AND lower(name)=lower($1)", [name])).rowCount) throw new HttpError(409, "Choose a unique active stream name before restoring.");
  const active = await orderedActiveStreams(database, true);
  await database.query(`UPDATE stream SET name=$2,position=$3,allocation=0,active=true,retired_at=NULL,retirement_reason=''
    WHERE id=$1`, [id, name, active.length + 1]);
  const version = await saveActiveDraft(database, draft);
  await recordEvent(database, id, "restored", actor, "", { name, position: active.length + 1 });
  return { streamId: id, activeScenarioVersion: version };
}
